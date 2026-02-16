/**
 * 会话管理
 */

const fs = require('fs');
const path = require('path');

class SessionManager {
  constructor(config) {
    this.config = config;
    this.sessions = new Map();
  }
  
  get(chatId) {
    if (!this.sessions.has(chatId)) {
      const filePath = path.join(this.config.dir, `${chatId}.json`);
      this.sessions.set(chatId, fs.existsSync(filePath) 
        ? JSON.parse(fs.readFileSync(filePath, 'utf8')) 
        : { messages: [], createdAt: Date.now() }
      );
    }
    return this.sessions.get(chatId);
  }
  
  addMessage(chatId, role, content) {
    const session = this.get(chatId);
    session.messages.push({ role, content, timestamp: Date.now() });
    
    if (session.messages.length > this.config.maxHistory) {
      session.messages = session.messages.slice(-this.config.maxHistory);
    }
    
    const filePath = path.join(this.config.dir, `${chatId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
    
    return session;
  }
  
  clear(chatId) {
    this.sessions.delete(chatId);
    const filePath = path.join(this.config.dir, `${chatId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  
  getSessionCount() {
    return this.sessions.size;
  }
}

module.exports = { SessionManager };