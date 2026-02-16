#!/usr/bin/env node

/**
 * iFlow Feishu CLI 入口
 * 
 * 启动流程：
 * 1. 检测 iFlow CLI -> 未安装则引导安装
 * 2. 检测 PM2 -> 未安装则自动安装
 * 3. 检测飞书配置 -> 未配置则引导输入
 * 4. 启动服务
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// 颜色输出
const colors = {
  red: '\x1b[0;31m',
  green: '\x1b[0;32m',
  yellow: '\x1b[1;33m',
  blue: '\x1b[0;34m',
  cyan: '\x1b[0;36m',
  nc: '\x1b[0m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.nc} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.nc} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[WARN]${colors.nc} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.nc} ${msg}`),
  step: (msg) => console.log(`${colors.cyan}==>${colors.nc} ${msg}`)
};

// 获取版本号
function getVersion() {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

const VERSION = getVersion();

// 检查命令是否存在
function commandExists(cmd) {
  try {
    execSync(`which ${cmd} 2>/dev/null || command -v ${cmd} 2>/dev/null`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// 获取命令版本
function getCommandVersion(cmd) {
  try {
    const output = execSync(`${cmd} --version 2>/dev/null`, { encoding: 'utf8' }).trim();
    return output.split('\n')[0];
  } catch {
    return '未知版本';
  }
}

// 交互式问题
async function question(prompt, defaultVal = 'n') {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    const hint = defaultVal === 'y' ? '[Y/n]' : '[y/N]';
    rl.question(`${prompt} ${hint} `, (answer) => {
      rl.close();
      const reply = (answer || defaultVal).toLowerCase();
      resolve(reply === 'y' || reply === 'yes');
    });
  });
}

// 检测 iFlow CLI
async function checkIFlowCLI() {
  log.step('检查 iFlow CLI...');
  
  if (commandExists('iflow')) {
    const version = getCommandVersion('iflow');
    log.success(`iFlow CLI 已安装 (版本: ${version})`);
    return true;
  }
  
  log.warn('iFlow CLI 未安装');
  console.log('');
  console.log('iFlow CLI 是运行此插件必需的依赖。');
  console.log('官网: https://iflow.dev');
  console.log('');
  
  const install = await question('是否现在安装 iFlow CLI?', 'y');
  
  if (install) {
    log.info('正在安装 iFlow CLI...');
    try {
      execSync('npm install -g @iflow-ai/iflow-cli', { stdio: 'inherit' });
      log.success('iFlow CLI 安装成功');
      return true;
    } catch (err) {
      log.error(`安装失败: ${err.message}`);
      console.log('');
      console.log('请手动安装: npm install -g @iflow-ai/iflow-cli');
      return false;
    }
  }
  
  return false;
}

// 检测 PM2
async function checkPM2() {
  log.step('检查 PM2...');
  
  if (commandExists('pm2')) {
    const version = getCommandVersion('pm2');
    log.success(`PM2 已安装 (版本: ${version})`);
    return true;
  }
  
  log.warn('PM2 未安装');
  console.log('');
  console.log('PM2 用于进程管理，建议安装。');
  console.log('');
  
  const install = await question('是否现在安装 PM2?', 'y');
  
  if (install) {
    log.info('正在安装 PM2...');
    try {
      execSync('npm install -g pm2', { stdio: 'inherit' });
      log.success('PM2 安装成功');
      return true;
    } catch (err) {
      log.warn(`PM2 安装失败: ${err.message}`);
      console.log('服务将以前台模式运行');
      return true; // PM2 可选，继续运行
    }
  }
  
  return true; // PM2 可选
}

// 配置文件路径
const CONFIG_DIR = path.join(process.env.HOME, '.feishu-config');
const CONFIG_PATH = path.join(CONFIG_DIR, 'feishu-app.json');

// 检测飞书配置
async function checkFeishuConfig() {
  log.step('检查飞书配置...');
  
  // 检查环境变量
  if (process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET) {
    log.success('检测到环境变量配置');
    return true;
  }
  
  // 检查配置文件
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      if (config.appId && config.appSecret) {
        log.success('飞书配置已存在');
        return true;
      }
    } catch (err) {
      log.warn(`配置文件格式错误: ${err.message}`);
    }
  }
  
  log.warn('未找到飞书配置');
  console.log('');
  console.log('请输入飞书机器人凭证（从飞书开放平台获取）:');
  console.log('文档: https://open.feishu.cn/document/home/introduction-to-feishu-open-platform');
  console.log('');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const ask = (prompt) => new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
  
  const appId = await ask('📱 App ID: ');
  if (!appId || appId.trim() === '') {
    log.error('App ID 不能为空');
    rl.close();
    return false;
  }
  
  const appSecret = await ask('🔐 App Secret: ');
  if (!appSecret || appSecret.trim() === '') {
    log.error('App Secret 不能为空');
    rl.close();
    return false;
  }
  
  rl.close();
  
  // 保存配置
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  
  const config = { appId: appId.trim(), appSecret: appSecret.trim() };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  log.success(`配置已保存到: ${CONFIG_PATH}`);
  
  return true;
}

// 启动服务
function startService() {
  log.step('启动服务...');
  
  // 直接运行服务
  require('../src/index.js');
}

// 主函数
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log(`║         iFlow Feishu                 ║`);
  console.log(`║           版本 ${VERSION.padEnd(20)}║`);
  console.log('╚══════════════════════════════════════╝');
  console.log('');
  
  // 1. 检测 iFlow CLI
  if (!await checkIFlowCLI()) {
    process.exit(1);
  }
  
  // 2. 检测 PM2（可选）
  await checkPM2();
  
  // 3. 检测飞书配置
  if (!await checkFeishuConfig()) {
    process.exit(1);
  }
  
  console.log('');
  
  // 4. 启动服务
  startService();
}

main().catch((err) => {
  log.error(err.message);
  process.exit(1);
});
