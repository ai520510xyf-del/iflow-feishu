/**
 * 流式响应处理器模块
 */

const { logger } = require('../utils/logger');
const { CARD_UPDATE_INTERVAL, TIMER_UPDATE_INTERVAL, CARD_UPDATE_DELAY } = require('./constants');

class StreamHandler {
  constructor(service) {
    this.service = service;
  }

  /**
   * 从输出中提取响应
   * @param {string|Object} output - 输出内容
   * @param {string} chatId - 聊天ID
   * @param {string} modelName - 模型名称
   * @returns {Object} - { reasoning, content, contentLeftPercent }
   */
  extractResponse(output, chatId, modelName) {
    let text = '';
    if (typeof output === 'string') {
      text = output;
    } else if (output?.stdout) {
      text = output.stdout;
    }
    
    if (!text || typeof text !== 'string') {
      return { reasoning: '', content: '(空响应)', contentLeftPercent: null };
    }
    
    const maxTokens = this.getMaxTokens(modelName);
    let contentLeftPercent = this.extractTokenUsage(text, maxTokens);
    
    if (contentLeftPercent === null && chatId) {
      contentLeftPercent = this.getTokenUsageFromLogs(modelName);
    }
    
    text = this.cleanOutput(text);
    
    const { reasoning, content } = this.extractThinking(text);
    
    return { reasoning, content: content || '(无法提取响应)', contentLeftPercent };
  }

  /**
   * 获取模型最大 token 数
   */
  getMaxTokens(modelName) {
    const modelMaxTokens = this.service.config.iflow.modelMaxTokens || {};
    return modelMaxTokens[modelName] || this.service.config.iflow.maxTokens || 128000;
  }

  /**
   * 从输出中提取 token 使用信息
   */
  extractTokenUsage(text, maxTokens) {
    const execInfoMatch = text.match(/<Execution Info>([\s\S]*?)<\/Execution Info>/);
    if (execInfoMatch) {
      try {
        const execInfo = JSON.parse(execInfoMatch[1]);
        if (execInfo.tokenUsage && execInfo.tokenUsage.total > 0) {
          const used = execInfo.tokenUsage.total;
          const remaining = Math.max(0, maxTokens - used);
          return Math.round((remaining / maxTokens) * 100);
        }
      } catch (e) {
        // 解析失败，忽略
      }
    }
    return null;
  }

  /**
   * 清理输出文本
   */
  cleanOutput(text) {
    let cleaned = text;
    
    const execInfoIndex = cleaned.indexOf('<Execution Info>');
    if (execInfoIndex > 0) {
      cleaned = cleaned.substring(0, execInfoIndex).trim();
    }
    
    const warningIndex = cleaned.indexOf('⚠️');
    if (warningIndex > 0) {
      cleaned = cleaned.substring(0, warningIndex).trim();
    }
    
    return cleaned;
  }

  /**
   * 提取思考过程
   */
  extractThinking(text) {
    let reasoning = '';
    let content = text.trim();
    
    const thinkMatch = text.match(/<tool_call>([\s\S]*?)<\/think>/);
    if (thinkMatch) {
      reasoning = thinkMatch[1].trim();
      content = text.replace(/<tool_call>[\s\S]*?<\/think>/, '').trim();
    }
    
    return { reasoning, content };
  }

  /**
   * 从日志读取 token 使用情况
   */
  getTokenUsageFromLogs(modelName) {
    try {
      const fs = require('fs');
      const path = require('path');
      const logDir = path.join(process.env.HOME, '.iflow', 'log');
      
      const maxTokens = this.getMaxTokens(modelName);
      
      const files = fs.readdirSync(logDir)
        .filter(f => f.startsWith('console-') && f.endsWith('.log'))
        .map(f => ({
          name: f,
          time: fs.statSync(path.join(logDir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);
      
      if (files.length === 0) return null;
      
      const latestLog = path.join(logDir, files[0].name);
      const content = fs.readFileSync(latestLog, 'utf8');
      const lastPart = content.slice(-5000);
      
      const tokenMatch = lastPart.match(/(\d+)\s+tokens\s+from\s+the\s+input\s+messages\s+and\s+(\d+)\s+tokens\s+for\s+the\s+completion/);
      if (tokenMatch) {
        const inputTokens = parseInt(tokenMatch[1], 10);
        const outputTokens = parseInt(tokenMatch[2], 10);
        const totalUsed = inputTokens + outputTokens;
        const remaining = Math.max(0, maxTokens - totalUsed);
        logger.info(`📊 从日志读取 token: 输入=${inputTokens}, 输出=${outputTokens}, 总计=${totalUsed}/${maxTokens}`);
        return Math.round((remaining / maxTokens) * 100);
      }
      
      const maxContextMatch = lastPart.match(/maximum\s+context\s+length\s+of\s+(\d+)\s+tokens/);
      if (maxContextMatch) {
        return 0;
      }
      
      return null;
    } catch (e) {
      logger.warn('读取日志失败:', e.message);
      return null;
    }
  }

  /**
   * 创建卡片更新器
   */
  createCardUpdater(cardId, startTime, modelName, initialPercent) {
    let lastUpdate = 0;
    let currentReasoning = '';
    let currentContent = '';
    let currentPercent = initialPercent;
    let isInThinking = false;
    let isStreamEnded = false;
    let streamEndTime = null;
    let isCompleted = false;
    let thinkingStartTime = null;
    let thinkingEndTime = null;
    
    const update = async (force = false) => {
      if (!cardId || isCompleted) return;
      
      const now = Date.now();
      if (!force && now - lastUpdate < CARD_UPDATE_INTERVAL) return;
      
      lastUpdate = now;
      
      const elapsed = isStreamEnded && streamEndTime 
        ? streamEndTime - startTime 
        : now - startTime;
      
      const card = this.service.cardBuilder.buildReasoningCard(
        currentReasoning,
        currentContent,
        thinkingStartTime && thinkingEndTime ? thinkingEndTime - thinkingStartTime : null,
        isInThinking ? null : elapsed,
        isInThinking,
        !isStreamEnded,
        modelName,
        currentPercent
      );
      
      try {
        await this.service.feishuClient.updateCardMessage(cardId, card);
      } catch (e) {
        logger.warn(`卡片更新失败: ${e.message}`);
      }
    };
    
    return {
      update,
      setReasoning: (r) => { currentReasoning = r; },
      setContent: (c) => { currentContent = c; },
      setPercent: (p) => { currentPercent = p; },
      setThinking: (isThinking) => { isInThinking = isThinking; },
      setThinkingStart: (t) => { thinkingStartTime = t; },
      setThinkingEnd: (t) => { thinkingEndTime = t; },
      endStream: (t) => { isStreamEnded = true; streamEndTime = t; },
      complete: () => { isCompleted = true; },
      isCompleted: () => isCompleted,
      getReasoning: () => currentReasoning,
      getContent: () => currentContent,
      getThinkingStart: () => thinkingStartTime,
      getThinkingEnd: () => thinkingEndTime
    };
  }

  /**
   * 创建定时器
   */
  createTimer(updater) {
    return setInterval(() => {
      if (!updater.isCompleted()) {
        updater.update();
      }
    }, TIMER_UPDATE_INTERVAL);
  }
}

module.exports = { StreamHandler };