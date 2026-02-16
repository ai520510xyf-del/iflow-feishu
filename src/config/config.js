/**
 * 配置管理模块
 * 
 * 负责加载和验证配置
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { DEFAULT_MODEL, DEFAULT_MAX_TOKENS, MODEL_MAX_TOKENS } = require('../core/constants');

const CONFIG_DIR = path.join(process.env.HOME, '.feishu-config');
const CONFIG_PATH = path.join(CONFIG_DIR, 'feishu-app.json');

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
 * 获取或创建配置（同步版本用于启动时）
 */
function getOrCreateConfig() {
  let feishuConfig = loadFeishuConfig();
  
  if (!feishuConfig) {
    console.log('\n⚠️  未找到飞书配置文件');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('请创建配置文件: ~/.feishu-config/feishu-app.json');
    console.log('内容格式:\n');
    console.log('  {');
    console.log('    "appId": "cli_xxxxxxxxxxxx",');
    console.log('    "appSecret": "xxxxxxxxxxxxxxxx"');
    console.log('  }\n');
    console.log('或设置环境变量:');
    console.log('  FEISHU_APP_ID=cli_xxxxxxxxxxxx');
    console.log('  FEISHU_APP_SECRET=xxxxxxxxxxxxxxxx\n');
    
    // 检查环境变量
    if (process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET) {
      console.log('✅ 检测到环境变量配置\n');
      return {
        appId: process.env.FEISHU_APP_ID,
        appSecret: process.env.FEISHU_APP_SECRET
      };
    }
    
    process.exit(1);
  }
  
  return feishuConfig;
}

// 加载飞书配置
const feishuConfig = getOrCreateConfig();

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
