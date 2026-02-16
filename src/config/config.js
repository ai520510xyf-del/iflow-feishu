/**
 * 配置管理模块
 * 
 * 负责加载和验证配置，支持交互式配置向导
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { DEFAULT_MODEL, DEFAULT_MAX_TOKENS, MODEL_MAX_TOKENS } = require('../core/constants');

const CONFIG_DIR = path.join(process.env.HOME, '.feishu-config');
const CONFIG_PATH = path.join(CONFIG_DIR, 'feishu-app.json');

// 获取版本号
function getVersion() {
  try {
    const pkgPath = path.join(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

const VERSION = getVersion();

/**
 * 加载飞书配置
 * @returns {Object|null}
 */
function loadFeishuConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
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
 * 保存飞书配置
 * @param {string} appId 
 * @param {string} appSecret 
 */
function saveFeishuConfig(appId, appSecret) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  
  const config = { appId, appSecret };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log(`\n✅ 配置已保存到: ${CONFIG_PATH}\n`);
}

/**
 * 配置向导 - 交互式创建配置
 */
async function setupWizard() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise((resolve) => {
    rl.question(prompt, resolve);
  });

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║     iFlow Feishu 配置向导            ║');
  console.log('╚══════════════════════════════════════╝\n');
  console.log('请输入飞书机器人凭证（从飞书开放平台获取）:');
  console.log('文档: https://open.feishu.cn/document/home/introduction-to-feishu-open-platform\n');

  const appId = await question('📱 App ID: ');
  if (!appId || appId.trim() === '') {
    console.error('\n❌ App ID 不能为空');
    rl.close();
    process.exit(1);
  }

  const appSecret = await question('🔐 App Secret: ');
  if (!appSecret || appSecret.trim() === '') {
    console.error('\n❌ App Secret 不能为空');
    rl.close();
    process.exit(1);
  }

  rl.close();

  saveFeishuConfig(appId.trim(), appSecret.trim());
  
  return { appId: appId.trim(), appSecret: appSecret.trim() };
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

/**
 * 构建完整配置对象
 */
function buildConfig(feishuConfig) {
  return {
    version: VERSION,
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
}

/**
 * 初始化配置（异步，支持交互式向导）
 * @returns {Promise<Object>} 配置对象
 */
async function initConfig() {
  let feishuConfig = loadFeishuConfig();
  
  // 检查环境变量
  if (!feishuConfig && process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET) {
    feishuConfig = {
      appId: process.env.FEISHU_APP_ID,
      appSecret: process.env.FEISHU_APP_SECRET
    };
  }
  
  // 配置缺失，启动向导
  if (!feishuConfig) {
    console.log('\n⚠️  未找到飞书配置文件');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    feishuConfig = await setupWizard();
  }
  
  const config = buildConfig(feishuConfig);
  
  // 验证配置
  validateConfig(config);
  
  // 确保会话目录存在
  if (!fs.existsSync(config.sessions.dir)) {
    fs.mkdirSync(config.sessions.dir, { recursive: true });
  }
  
  return config;
}

module.exports = {
  initConfig,
  getVersion,
  VERSION,
  CONFIG_PATH
};
