/**
 * 消息处理器模块
 */

const { SEARCH_KEYWORDS, DEFAULT_MODEL, DEFAULT_MAX_TOKENS, MODEL_MAX_TOKENS } = require('./constants');
const { logger } = require('../utils/logger');

class MessageProcessor {
  constructor(service) {
    this.service = service;
  }

  /**
   * 解析消息事件
   * @param {Object} event - 飞书事件
   * @returns {Object|null} - 解析后的消息对象
   */
  parseMessage(event) {
    const message = event.event?.message || event.body?.event?.message || event.message;
    if (!message) {
      logger.warn('无法解析消息，消息格式不正确');
      return null;
    }
    
    return {
      chatId: message.chat_id,
      msgId: message.message_id,
      msgType: message.message_type,
      raw: message
    };
  }

  /**
   * 提取文本内容
   * @param {Object} message - 消息对象
   * @returns {string} - 提取的文本
   */
  extractText(message) {
    const content = message.raw?.content || message.content;
    
    try {
      if (typeof content === 'string') {
        return JSON.parse(content).text || content;
      }
      return content.text || String(content);
    } catch (e) {
      logger.warn(`解析消息内容失败: ${e.message}`);
      return String(content);
    }
  }

  /**
   * 检测是否需要搜索
   * @param {string} text - 用户文本
   * @returns {boolean}
   */
  needsSearch(text) {
    return SEARCH_KEYWORDS.some(keyword => text.includes(keyword));
  }

  /**
   * 获取当前模型名称
   * @returns {string}
   */
  getModelName() {
    try {
      const fs = require('fs');
      const path = require('path');
      const settingsPath = path.join(process.env.HOME, '.iflow/settings.json');
      
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        return settings.modelName || DEFAULT_MODEL;
      }
    } catch (e) {
      logger.warn('获取模型设置失败:', e.message);
    }
    return DEFAULT_MODEL;
  }

  /**
   * 获取模型最大 token 数
   * @param {string} modelName - 模型名称
   * @returns {number}
   */
  getMaxTokens(modelName = DEFAULT_MODEL) {
    const modelMaxTokens = this.service.config.iflow.modelMaxTokens || {};
    return modelMaxTokens[modelName] || this.service.config.iflow.maxTokens || DEFAULT_MAX_TOKENS;
  }

  /**
   * 构建带上下文的 prompt
   * @param {string} chatId - 聊天ID
   * @param {string} userText - 用户文本
   * @returns {Object} - 包含 prompt 和历史信息
   */
  buildPromptWithContext(chatId, userText) {
    const session = this.service.sessionManager.get(chatId);
    let messageWithContext = userText;
    let historyCount = 0;
    
    if (session.messages && session.messages.length > 0) {
      const contextParts = ['以下是之前的对话历史：\n'];
      const recentMessages = session.messages.slice(-10);
      
      for (const msg of recentMessages) {
        if (msg.role === 'user') {
          contextParts.push(`用户：${msg.content}`);
        } else if (msg.role === 'assistant') {
          contextParts.push(`助手：${msg.content}`);
        }
      }
      
      contextParts.push('\n现在用户的新问题是：');
      contextParts.push(`用户：${userText}`);
      contextParts.push('\n请基于以上对话历史回答用户的新问题。');
      
      messageWithContext = contextParts.join('\n');
      historyCount = recentMessages.length;
    }
    
    return {
      prompt: messageWithContext,
      historyCount,
      totalMessages: session.messages.length
    };
  }

  /**
   * 计算剩余上下文百分比
   * @param {string} chatId - 聊天ID
   * @param {number} outputLength - 输出长度
   * @param {string} modelName - 模型名称
   * @returns {number}
   */
  calculateContentLeftPercent(chatId, outputLength, modelName) {
    const session = this.service.sessionManager.get(chatId);
    const historyLength = session.messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0);
    const maxTokens = this.getMaxTokens(modelName);
    
    const totalUsed = historyLength + outputLength + 500;
    const estimatedTokens = Math.ceil(totalUsed / 4);
    
    return Math.max(0, Math.min(100, Math.round(((maxTokens - estimatedTokens) / maxTokens) * 100)));
  }
}

module.exports = { MessageProcessor };
