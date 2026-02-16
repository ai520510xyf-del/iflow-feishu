/**
 * 飞书服务主类 - v1.0.0
 * 
 * 职责：协调各模块，管理服务生命周期
 */

const { SessionManager } = require('./session');
const { IFlowClient } = require('./iflow-client');
const { FeishuClient } = require('./feishu-client');
const { CardBuilder } = require('./card-builder');
const { CommandHandler } = require('../handlers/commands');
const { MessageProcessor } = require('./message-processor');
const { StreamHandler } = require('./stream-handler');
const { HTTPServer } = require('./http-server');
const { WebSocketClient } = require('./websocket-client');
const { logger } = require('../utils/logger');
const { VERSION, CARD_UPDATE_DELAY } = require('./constants');

class FeishuService {
  constructor(config) {
    this.config = config;
    
    // 核心组件
    this.sessionManager = new SessionManager(config.sessions);
    this.iflowClient = new IFlowClient(config);
    this.feishuClient = new FeishuClient(config);
    this.cardBuilder = new CardBuilder();
    this.commandHandler = new CommandHandler(this);
    
    // 处理器
    this.messageProcessor = new MessageProcessor(this);
    this.streamHandler = new StreamHandler(this);
    
    // 服务组件
    this.httpServer = new HTTPServer(this);
    this.wsClient = new WebSocketClient(this);
    
    // 状态管理
    this.processingChats = new Set();
  }

  /**
   * 启动服务
   */
  async start() {
    logger.info(`启动 iFlow Feishu v${VERSION}...`);
    
    await this.checkIFlowAvailable();
    
    this.httpServer.start();
    this.wsClient.start();
    
    logger.info('服务启动成功');
  }

  /**
   * 检查 iFlow CLI 是否可用
   */
  async checkIFlowAvailable() {
    const { execSync } = require('child_process');
    try {
      execSync('iflow --version', { stdio: 'pipe' });
      logger.info('iFlow CLI 可用');
    } catch (err) {
      logger.error('iFlow CLI 未找到');
      throw new Error('iFlow CLI not found');
    }
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    const result = { iflow: false, config: true, sessions: true };
    
    try {
      const { execSync } = require('child_process');
      execSync('iflow --version', { stdio: 'pipe' });
      result.iflow = true;
    } catch (e) {
      logger.warn('健康检查: iFlow CLI 不可用');
    }
    
    try {
      result.sessionCount = this.sessionManager.getSessionCount();
    } catch (e) {
      logger.warn('健康检查: 会话管理器错误');
      result.sessions = false;
    }
    
    try {
      result.config = !!(this.config.feishu.appId && this.config.feishu.appSecret);
    } catch (e) {
      result.config = false;
    }
    
    return result;
  }

  /**
   * 处理消息事件
   */
  async handleMessageEvent(event) {
    const parsed = this.messageProcessor.parseMessage(event);
    if (!parsed) return;
    
    const { chatId, msgId, msgType } = parsed;
    
    logger.info(`收到消息 - 聊天ID: ${chatId}, 类型: ${msgType}`);
    
    // 标记已读
    if (msgId) {
      this.feishuClient.markAsRead(msgId).catch(() => {});
    }
    
    // 跳过非文本消息
    if (msgType !== 'text') {
      logger.info(`跳过非文本消息: ${msgType}`);
      return;
    }
    
    // 提取文本
    const userText = this.messageProcessor.extractText(parsed);
    logger.info(`用户输入: ${userText.substring(0, 100)}${userText.length > 100 ? '...' : ''}`);
    
    // 防止重复处理
    if (this.processingChats.has(chatId)) {
      logger.warn(`正在处理 ${chatId} 的消息，跳过重复请求`);
      return;
    }
    
    this.processingChats.add(chatId);
    
    try {
      await this.processMessage(chatId, userText);
    } catch (e) {
      logger.error(`处理消息失败: ${e.message}`);
      await this.sendErrorCard(chatId, e.message);
    } finally {
      this.processingChats.delete(chatId);
    }
  }

  /**
   * 处理消息
   */
  async processMessage(chatId, userText) {
    const trimmedText = userText.trim();
    
    // 处理命令
    const isCommand = await this.commandHandler.handle(chatId, trimmedText);
    if (isCommand) {
      logger.info(`命令处理完成`);
      return;
    }
    
    // 检测搜索需求
    let processedText = trimmedText;
    if (this.messageProcessor.needsSearch(trimmedText)) {
      logger.info('检测到搜索需求');
      processedText = `请使用网络搜索功能回答以下问题：${trimmedText}`;
    }
    
    // 获取模型
    const modelName = this.messageProcessor.getModelName();
    logger.info(`使用模型: ${modelName}`);
    
    // 发送加载卡片
    const cardId = await this.sendLoadingCard(chatId, modelName);
    
    try {
      // 构建上下文
      const { prompt, historyCount } = this.messageProcessor.buildPromptWithContext(chatId, processedText);
      
      if (historyCount > 0) {
        logger.info(`附加 ${historyCount} 条历史消息`);
      }
      
      // 调用 iFlow
      const result = await this.callIFlow(prompt, cardId, modelName, chatId);
      
      // 保存会话
      this.sessionManager.addMessage(chatId, 'user', trimmedText);
      this.sessionManager.addMessage(chatId, 'assistant', result.content);
      
      logger.info(`消息处理完成`);
    } catch (err) {
      logger.error(`调用失败: ${err.message}`);
      await this.updateErrorCard(cardId, err.message, modelName);
    }
  }

  /**
   * 发送加载卡片
   */
  async sendLoadingCard(chatId, modelName) {
    try {
      return await this.feishuClient.sendCardMessage(
        chatId,
        this.cardBuilder.buildReasoningCard(null, '', null, 0, false, true, modelName)
      );
    } catch (e) {
      logger.error(`发送加载卡片失败: ${e.message}`);
      return null;
    }
  }

  /**
   * 发送错误卡片
   */
  async sendErrorCard(chatId, message) {
    try {
      await this.feishuClient.sendCardMessage(
        chatId,
        this.cardBuilder.buildReasoningCard(null, `处理失败: ${message}`, null, null, false, false)
      );
    } catch (e) {
      logger.error(`发送错误卡片失败: ${e.message}`);
    }
  }

  /**
   * 更新错误卡片
   */
  async updateErrorCard(cardId, message, modelName) {
    if (!cardId) return;
    try {
      await this.feishuClient.updateCardMessage(
        cardId,
        this.cardBuilder.buildReasoningCard(null, `调用失败: ${message}`, null, null, false, false, modelName)
      );
    } catch (e) {
      logger.error(`更新错误卡片失败: ${e.message}`);
    }
  }

  /**
   * 调用 iFlow CLI
   */
  async callIFlow(userText, cardId, modelName, chatId) {
    const startTime = Date.now();
    let thinkingStartTime = null;
    let thinkingEndTime = null;
    let hasDetectedThinking = false;
    let isInThinkingPhase = false;
    
    // 计算初始上下文百分比
    const session = this.sessionManager.get(chatId);
    const historyLength = session.messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0);
    const initialPercent = this.messageProcessor.calculateContentLeftPercent(chatId, 0, modelName);
    
    logger.info(`初始上下文 - 剩余: ${initialPercent}%`);
    
    // 创建卡片更新器
    const updater = this.streamHandler.createCardUpdater(cardId, startTime, modelName, initialPercent);
    updater.update(true);
    
    // 启动定时器
    const timer = this.streamHandler.createTimer(updater);
    
    try {
      const output = await this.iflowClient.executeWithRetry(
        userText,
        (newChunk, stdoutSoFar) => {
          if (updater.isCompleted()) return;
          
          // 检测思考阶段
          const hasThinkStart = stdoutSoFar.includes('<tool_call>');
          const hasThinkEnd = stdoutSoFar.includes('}');
          
          if (hasThinkStart && !hasDetectedThinking) {
            hasDetectedThinking = true;
            isInThinkingPhase = true;
            thinkingStartTime = Date.now();
            updater.setThinkingStart(thinkingStartTime);
            updater.setThinking(true);
            logger.info('进入思考阶段');
          }
          
          if (isInThinkingPhase && hasThinkEnd) {
            isInThinkingPhase = false;
            thinkingEndTime = Date.now();
            updater.setThinkingEnd(thinkingEndTime);
            updater.setThinking(false);
            logger.info('思考阶段结束');
          }
          
          // 提取响应
          const extracted = this.streamHandler.extractResponse(stdoutSoFar, chatId, modelName);
          updater.setReasoning(extracted.reasoning);
          updater.setContent(extracted.content || '');
          
          // 更新上下文百分比
          const currentLength = (stdoutSoFar || '').length;
          const percent = this.messageProcessor.calculateContentLeftPercent(chatId, currentLength, modelName);
          updater.setPercent(percent);
          
          updater.update();
        },
        { mode: 'default', thinking: false }
      );
      
      // 流式结束
      updater.endStream(Date.now());
      
      // 获取最终结果
      const finalExtracted = this.streamHandler.extractResponse(output.stdout || output, chatId, modelName);
      if (finalExtracted.contentLeftPercent !== null) {
        updater.setPercent(finalExtracted.contentLeftPercent);
      }
      
      // 清理
      clearInterval(timer);
      updater.complete();
      
      await new Promise(resolve => setTimeout(resolve, CARD_UPDATE_DELAY));
      
      // 计算时间
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const finalThinkingTime = thinkingStartTime && thinkingEndTime 
        ? thinkingEndTime - thinkingStartTime 
        : null;
      const finalResponseTime = finalThinkingTime 
        ? endTime - thinkingEndTime 
        : totalTime;
      
      logger.info(`完成 - 思考: ${finalThinkingTime || 0}ms, 回复: ${finalResponseTime}ms`);
      
      // 更新最终卡片
      if (cardId) {
        const hasReasoning = finalExtracted.reasoning && finalExtracted.reasoning.trim();
        await this.feishuClient.updateCardMessage(
          cardId,
          this.cardBuilder.buildReasoningCard(
            hasReasoning ? finalExtracted.reasoning : null,
            finalExtracted.content,
            finalThinkingTime,
            finalResponseTime,
            false,
            false,
            modelName,
            finalExtracted.contentLeftPercent
          )
        );
      }
      
      return finalExtracted;
      
    } catch (err) {
      clearInterval(timer);
      updater.complete();
      throw err;
    }
  }

  /**
   * 停止服务
   */
  stop() {
    this.httpServer.close();
    this.wsClient.stop();
    logger.info('服务已停止');
  }
}

module.exports = { FeishuService };
