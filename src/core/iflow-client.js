/**
 * iFlow CLI 客户端 - 使用 spawn 直接调用
 */

const { spawn } = require('child_process');
const { logger } = require('../utils/logger');

class IFlowClient {
  constructor(config) {
    this.config = config;
  }

  async execute(message, onChunk, options = {}) {
    const { mode = 'default', thinking = false } = options;  // 改为默认不启用 thinking 模式
    
    return new Promise((resolve, reject) => {
      const args = [];
      
      if (mode && mode !== 'default') {
        args.push(`--mode=${mode}`);
      }
      
      if (thinking) {
        args.push('--thinking');
      }
      
      // 启用流式输出
      args.push('--stream');
      
      logger.info(`🚀 启动 iflow ${args.join(' ')}`);

      const child = spawn(this.config.iflow.command, args, {
        cwd: this.config.iflow.workDir,
        env: { 
          ...process.env, 
          TERM: 'xterm-256color',
          // 确保搜索功能可用
          TAVILY_API_KEY: process.env.TAVILY_API_KEY || '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',
          // 启用网络搜索
          IFLOW_ENABLE_SEARCH: 'true',
          IFLOW_SEARCH_PROVIDER: 'tavily',
          // 传递配置中的搜索相关环境变量
          ...this.config.iflow.searchEnv || {}
        }
      });

      let stdout = '';
      let stderr = '';
      let isFirstChunk = true;

      child.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        
        if (isFirstChunk) {
          logger.info('📥 开始接收输出');
          isFirstChunk = false;
        }
        
        if (onChunk) {
          onChunk(chunk, stdout);
        }
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timer = setTimeout(() => {
        logger.warn('⏱️ iFlow CLI 超时，正在终止进程');
        child.kill('SIGTERM');
        
        setTimeout(() => {
          if (child.exitCode === null) {
            child.kill('SIGKILL');
          }
        }, 5000);
        
        reject(new Error(`iFlow CLI 超时 (${this.config.iflow.timeout}ms)`));
      }, this.config.iflow.timeout);

      child.on('close', (code) => {
        clearTimeout(timer);
        logger.info(`⏱️ iFlow CLI 完成, 退出码: ${code}`);
        
        if (code === 0 || stdout) {
          resolve({
            stdout,
            stderr,
            success: true
          });
        } else {
          reject(new Error(`iFlow CLI failed: ${stderr || 'Unknown error'}`));
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        logger.error(`iFlow CLI 进程错误: ${err.message}`);
        reject(err);
      });

      // 发送用户消息到 stdin
      child.stdin.write(message + '\n');
      child.stdin.end();
    });
  }

  async executeWithRetry(message, onChunk, options = {}, maxRetries = 3) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.execute(message, onChunk, options);
      } catch (err) {
        lastError = err;
        logger.warn(`第${attempt}次尝试失败:`, err.message);
        
        if (attempt < maxRetries) {
          const delay = attempt * 2000;
          logger.info(`${delay}ms后重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('所有重试都失败了');
  }
}

module.exports = { IFlowClient };