/**
 * HTTP 服务器模块
 */

const http = require('http');
const { logger } = require('../utils/logger');
const { VERSION } = require('./constants');

class HTTPServer {
  constructor(service) {
    this.service = service;
    this.server = null;
  }

  /**
   * 启动 HTTP 服务器
   */
  start() {
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    const { port, host } = this.service.config.server;
    
    this.server.listen(port, host, () => {
      logger.info(`HTTP 服务: http://${host}:${port}`);
    });
  }

  /**
   * 处理 HTTP 请求
   */
  async handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // 健康检查
    if (url.pathname === '/health') {
      this.handleHealth(res);
      return;
    }
    
    // 飞书事件回调
    if (url.pathname === '/feishu/event') {
      await this.handleFeishuEvent(req, res);
      return;
    }
    
    // 404
    res.writeHead(404);
    res.end('Not Found');
  }

  /**
   * 处理健康检查
   */
  handleHealth(res) {
    const health = {
      status: 'ok',
      service: 'iflow-feishu',
      version: VERSION,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health));
  }

  /**
   * 处理飞书事件
   */
  async handleFeishuEvent(req, res) {
    let body = '';
    
    req.on('data', chunk => body += chunk);
    
    req.on('end', async () => {
      try {
        const event = JSON.parse(body);
        
        // 处理 challenge 验证
        if (event.challenge) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ challenge: event.challenge }));
          return;
        }
        
        // 处理消息事件
        if (event.event?.type === 'im.message.receive_v1') {
          this.service.handleMessageEvent(event);
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: 0, msg: 'success' }));
      } catch (err) {
        logger.error(`处理 HTTP 事件错误: ${err.message}`);
        res.writeHead(400);
        res.end('Bad Request');
      }
    });
  }

  /**
   * 关闭服务器
   */
  close() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}

module.exports = { HTTPServer };
