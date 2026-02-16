/**
 * WebSocket 客户端模块
 */

const Lark = require('@larksuiteoapi/node-sdk');
const { logger } = require('../utils/logger');
const { RECONNECT_MAX_ATTEMPTS, RECONNECT_BASE_DELAY, RECONNECT_MAX_DELAY } = require('./constants');

class WebSocketClient {
  constructor(service) {
    this.service = service;
    this.wsClient = null;
    this.eventDispatcher = null;
    this.reconnectAttempts = 0;
  }

  /**
   * 启动 WebSocket 连接
   */
  start() {
    logger.info('创建飞书 WebSocket 客户端...');
    
    const { appId, appSecret } = this.service.config.feishu;
    
    this.wsClient = new Lark.WSClient({
      appId,
      appSecret,
      loggerLevel: Lark.LoggerLevel.warn,
    });
    
    this.eventDispatcher = new Lark.EventDispatcher({
      encryptKey: '',
      verificationToken: '',
    });
    
    this.registerEventHandlers();
    
    try {
      this.wsClient.start({ eventDispatcher: this.eventDispatcher });
      logger.info('WebSocket 已启动');
      this.reconnectAttempts = 0;
    } catch (err) {
      logger.error(`WebSocket 启动失败: ${err}`);
      this.scheduleReconnect();
    }
  }

  /**
   * 注册事件处理器
   */
  registerEventHandlers() {
    this.eventDispatcher.register({
      'im.message.receive_v1': async (data) => {
        logger.info('收到消息');
        this.service.handleMessageEvent(data);
      },
      'im.message.message_read_v1': async () => {},
      'im.chat.member.bot.added_v1': async () => {
        logger.info('机器人被添加到群聊');
      },
      'im.chat.member.bot.deleted_v1': async () => {
        logger.info('机器人被移出群聊');
      },
    });
  }

  /**
   * 安排重连
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
      logger.error('WebSocket 重连次数已达上限');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts - 1),
      RECONNECT_MAX_DELAY
    );
    
    logger.info(`${delay/1000}秒后尝试第${this.reconnectAttempts}次重连...`);
    
    setTimeout(() => {
      this.start();
    }, delay);
  }

  /**
   * 停止 WebSocket
   */
  stop() {
    if (this.wsClient) {
      // Lark SDK 没有显式的 stop 方法
      this.wsClient = null;
      this.eventDispatcher = null;
    }
  }
}

module.exports = { WebSocketClient };
