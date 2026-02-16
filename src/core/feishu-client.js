/**
 * 飞书 API 客户端
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const { logger } = require('../utils/logger');

class FeishuClient {
  constructor(config) {
    this.config = config;
    this.tenantAccessToken = null;
    this.tokenExpireTime = 0;
  }

  async httpRequest(url, options, body) {
    return new Promise((resolve, reject) => {
      const u = new URL(url);
      const lib = u.protocol === 'https:' ? https : http;
      
      const req = lib.request({
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        method: options.method || 'GET',
        headers: options.headers || {},
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              data: JSON.parse(data),
              status: res.statusCode
            });
          } catch {
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              data,
              status: res.statusCode
            });
          }
        });
      });
      
      req.on('error', reject);
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Timeout'));
      });
      
      if (body) req.write(body);
      req.end();
    });
  }

  async getToken() {
    if (this.tenantAccessToken && Date.now() < this.tokenExpireTime) {
      return this.tenantAccessToken;
    }
    
    logger.info('🔑 正在获取 Token...');
    
    const r = await this.httpRequest(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      JSON.stringify({
        app_id: this.config.feishu.appId,
        app_secret: this.config.feishu.appSecret
      })
    );
    
    if (r.ok && r.data?.tenant_access_token) {
      this.tenantAccessToken = r.data.tenant_access_token;
      this.tokenExpireTime = Date.now() + (r.data.expire - 60) * 1000;
      logger.info('✅ Token 获取成功');
      return this.tenantAccessToken;
    }
    
    logger.error('❌ Token 获取失败:', JSON.stringify(r.data));
    throw new Error('获取 Token 失败');
  }

  async sendMessage(chatId, text) {
    try {
      const token = await this.getToken();
      
      const r = await this.httpRequest(
        'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
        },
        JSON.stringify({
          receive_id: chatId,
          msg_type: 'text',
          content: JSON.stringify({ text })
        })
      );
      
      if (r.ok) {
        logger.info('📤 消息已发送');
        return true;
      }
      
      logger.error('发送失败:', JSON.stringify(r.data));
      return false;
    } catch (err) {
      logger.error('发送消息错误:', err.message);
      return false;
    }
  }

  async sendCardMessage(chatId, card) {
    try {
      const token = await this.getToken();
      
      const r = await this.httpRequest(
        'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
        },
        JSON.stringify({
          receive_id: chatId,
          msg_type: 'interactive',
          content: JSON.stringify(card)
        })
      );
      
      if (r.ok && r.data?.data?.message_id) {
        logger.info('📤 卡片消息已发送');
        return r.data.data.message_id;
      }
      
      logger.error('发送卡片失败:', JSON.stringify(r.data));
      return null;
    } catch (err) {
      logger.error('发送卡片错误:', err.message);
      return null;
    }
  }

  async updateCardMessage(messageId, card) {
    try {
      const token = await this.getToken();
      
      const r = await this.httpRequest(
        `https://open.feishu.cn/open-apis/im/v1/messages/${messageId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
        },
        JSON.stringify({ content: JSON.stringify(card) })
      );
      
      return r.ok;
    } catch (err) {
      logger.error('更新卡片错误:', err.message);
      return false;
    }
  }

  async markAsRead(messageId) {
    try {
      const token = await this.getToken();
      
      const r = await this.httpRequest(
        `https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/read_status`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
        },
        JSON.stringify({ read_status: true })
      );
      
      return r.ok;
    } catch (err) {
      logger.warn('标记已读失败:', err.message);
      return false;
    }
  }
}

module.exports = { FeishuClient };
