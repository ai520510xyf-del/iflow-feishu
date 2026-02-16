/**
 * 配置管理模块
 * 
 * 负责加载和验证配置
 */

const fs = require('fs');
const path = require('path');
const { DEFAULT_MODEL, DEFAULT_MAX_TOKENS, MODEL_MAX_TOKENS } = require('../core/constants');

/**
 * 加载飞书配置
 * @returns {Object|null}
 */
function loadFeishuConfig() {
  const configPath = path.join(process.env.HOME, '.feishu-config', 'feishu-app.json');
  
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return {
        appId: config.appId || config.app_id,
        appSecret: config.appSecret || config.app_secret
      };
    }
  } catch (err) {
    console.error(`[ERROR] 读取飞书配置失败: ${err.message}`);
  }
  
  return null;
}

/**
 * 验证配置
 * @param {Object} config - 配置对象
 * @throws {Error} - 配置无效时抛出错误
 */
function validateConfig(config) {
  if (!config.feishu?.appId) {
    throw new Error('缺少飞书 App ID');
  }
  
  if (!config.feishu?.appSecret) {
    throw new Error('缺少飞书 App Secret');
  }
  
  if (!config.server?.port || config.server.port < 1 || config.server.port > 65535) {
    throw new Error('无效的服务端口');
  }
  
  return true;
}

// 加载飞书配置
const feishuConfig = loadFeishuConfig();

if (!feishuConfig) {
  console.error('\n错误: 未找到飞书配置文件');
  console.error('\n请先运行: iflow-feishu');
  console.error('首次运行时会引导你配置飞书机器人凭证\n');
  process.exit(1);
}

// 构建完整配置
const config = {
  feishu: {
    appId: feishuConfig.appId,
    appSecret: feishuConfig.appSecret,
  },
  iflow: {
    command: 'iflow',
    timeout: 300000,
    workDir: process.env.HOME || '/data/data/com.termux/files/home',
    maxTokens: DEFAULT_MAX_TOKENS,
    modelMaxTokens: MODEL_MAX_TOKENS
  },
  server: { 
    port: parseInt(process.env.PORT, 10) || 18080,
    host: '0.0.0.0'
  },
  sessions: {
    dir: path.join(process.env.HOME || '/tmp', '.iflow-feishu', 'sessions'),
    maxHistory: 15,
  },
  card: {
    titleFontSize: 'small',
    colors: {
      model: 'blue',
      generating: 'orange',
      completed: 'green'
    }
  }
};

// 验证配置
validateConfig(config);

// 确保会话目录存在
if (!fs.existsSync(config.sessions.dir)) {
  fs.mkdirSync(config.sessions.dir, { recursive: true });
}

module.exports = config;
