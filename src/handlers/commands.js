/**
 * 命令处理器
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');

class CommandHandler {
  constructor(service) {
    this.service = service;
  }

  async handle(chatId, text) {
    const cmd = text.trim().split(' ')[0].toLowerCase();
    const args = text.trim().split(' ').slice(1);

    switch (cmd) {
      case '/help':
      case '帮助':
        return this.handleHelp(chatId);
      
      case '/clear':
      case '清空':
        return this.handleClear(chatId);
      
      case '/mode':
        return this.handleMode(chatId, args);
      
      case '/status':
        return this.handleStatus(chatId);
      
      default:
        return false;
    }
  }

  async handleHelp(chatId) {
    const helpText = `🤖 **iFlow Feishu 命令列表**

**会话管理：**
/clear - 清空当前会话
/status - 查看会话状态
/help - 显示此帮助

**模式设置：**
/mode - 查看当前模式
/mode <default|yolo|plan|smart> - 切换模式

**提示：**
直接发送消息即可与 AI 对话`;

    const card = this.service.cardBuilder.buildMarkdownCard(helpText);
    await this.service.feishuClient.sendCardMessage(chatId, card);
    return true;
  }

  async handleClear(chatId) {
    this.service.sessionManager.clear(chatId);
    
    const card = this.service.cardBuilder.buildReasoningCard('', 
      '✅ 会话已清空\n\n上下文已重置，可以开始新的对话了！');
    await this.service.feishuClient.sendCardMessage(chatId, card);
    
    return true;
  }

  async handleMode(chatId, args) {
    const settingsPath = path.join(process.env.HOME, '.iflow/settings.json');
    
    let currentMode = 'default';
    try {
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        currentMode = settings.mode || 'default';
      }
    } catch (e) {
      logger.warn('读取设置失败:', e.message);
    }
    
    if (args.length === 0) {
      // 显示当前模式
      const text = `🎛️ 当前模式：**${currentMode}**

可用模式：
• default - 默认模式（手动确认）
• yolo - YOLO模式（自动执行）
• plan - 计划模式（只规划不执行）
• smart - 智能模式

💡 切换模式：/mode <模式名>`;
      
      const card = this.service.cardBuilder.buildMarkdownCard(text);
      await this.service.feishuClient.sendCardMessage(chatId, card);
      return true;
    }
    
    // 切换模式
    const newMode = args[0];
    const validModes = ['default', 'yolo', 'plan', 'smart'];
    
    if (!validModes.includes(newMode)) {
      const card = this.service.cardBuilder.buildMarkdownCard(
        `❌ 无效的模式 "${newMode}"\n\n可用：default, yolo, plan, smart`
      );
      await this.service.feishuClient.sendCardMessage(chatId, card);
      return true;
    }
    
    try {
      let settings = {};
      if (fs.existsSync(settingsPath)) {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      }
      settings.mode = newMode;
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      
      const card = this.service.cardBuilder.buildMarkdownCard(
        `✅ **模式已切换为：** ${newMode}\n\n下次对话生效。`
      );
      await this.service.feishuClient.sendCardMessage(chatId, card);
    } catch (err) {
      const card = this.service.cardBuilder.buildMarkdownCard(
        `❌ 切换模式失败: ${err.message}`
      );
      await this.service.feishuClient.sendCardMessage(chatId, card);
    }
    
    return true;
  }

  async handleStatus(chatId) {
    const session = this.service.sessionManager.get(chatId);
    
    let modelName = '未知';
    let currentMode = 'default';
    
    try {
      const settingsPath = path.join(process.env.HOME, '.iflow/settings.json');
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        modelName = settings.modelName || 'glm-5';
        currentMode = settings.mode || 'default';
      }
    } catch (e) {
      logger.warn('读取设置失败:', e.message);
    }
    
    const text = `📊 **会话状态**

**当前模型：** ${modelName}
**当前模式：** ${currentMode}
**历史消息：** ${session.messages.length} 条
**会话ID：** ${chatId.slice(-8)}

💡 提示：
• 消息历史保留最近 15 条
• 开始新对话：/clear`;

    const card = this.service.cardBuilder.buildMarkdownCard(text);
    await this.service.feishuClient.sendCardMessage(chatId, card);
    
    return true;
  }
}

module.exports = { CommandHandler };
