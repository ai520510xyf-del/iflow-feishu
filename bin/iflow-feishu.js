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
    // 验证 iFlow CLI 是否真正可用
    try {
      execSync('iflow --version', { stdio: 'pipe', timeout: 5000 });
      log.success(`iFlow CLI 已安装 (版本: ${version})`);
      return true;
    } catch (err) {
      log.warn('iFlow CLI 存在但无法正常运行');
      console.log(`错误: ${err.message}`);
    }
  }
  
  log.warn('iFlow CLI 未安装或不可用');
  console.log('');
  console.log('iFlow CLI 是运行此插件必需的依赖。');
  console.log('官网: https://iflow.dev');
  console.log('');
  
  const install = await question('是否现在安装 iFlow CLI?', 'y');
  
  if (install) {
    log.info('正在安装 iFlow CLI...');
    try {
      execSync('npm install -g @iflow-ai/iflow-cli', { stdio: 'inherit' });
      // 再次验证
      if (commandExists('iflow')) {
        log.success('iFlow CLI 安装成功');
        return true;
      } else {
        log.error('安装后仍未找到 iflow 命令，请检查 PATH');
        return false;
      }
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

// 验证飞书凭证
async function verifyFeishuCredentials(appId, appSecret) {
  const https = require('https');
  
  return new Promise((resolve) => {
    log.info('正在验证飞书凭证...');
    
    const postData = JSON.stringify({
      app_id: appId,
      app_secret: appSecret
    });
    
    const req = https.request({
      hostname: 'open.feishu.cn',
      port: 443,
      path: '/open-apis/auth/v3/tenant_access_token/internal',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.tenant_access_token) {
            resolve({ valid: true, token: result.tenant_access_token });
          } else {
            resolve({ 
              valid: false, 
              error: result.msg || '验证失败',
              code: result.code
            });
          }
        } catch (err) {
          resolve({ valid: false, error: '响应解析失败' });
        }
      });
    });
    
    req.on('error', (err) => {
      resolve({ valid: false, error: `网络错误: ${err.message}` });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({ valid: false, error: '验证超时' });
    });
    
    req.write(postData);
    req.end();
  });
}

// 检测飞书配置
async function checkFeishuConfig() {
  log.step('检查飞书配置...');
  
  // 优先检查环境变量
  if (process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET) {
    const verify = await verifyFeishuCredentials(process.env.FEISHU_APP_ID, process.env.FEISHU_APP_SECRET);
    if (verify.valid) {
      log.success('环境变量配置有效');
      return true;
    } else {
      log.warn(`环境变量配置无效: ${verify.error}`);
      log.info('尝试使用配置文件...');
    }
  }
  
  // 检查配置文件
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      if (config.appId && config.appSecret) {
        const verify = await verifyFeishuCredentials(config.appId, config.appSecret);
        if (verify.valid) {
          log.success('飞书配置有效');
          return true;
        } else {
          log.warn(`配置文件无效: ${verify.error}`);
          log.info('需要重新配置');
        }
      }
    } catch (err) {
      log.warn(`配置文件格式错误: ${err.message}`);
    }
  } else {
    log.warn('未找到飞书配置文件');
  }
  
  // 交互式配置
  let configured = false;
  let attempts = 0;
  const maxAttempts = 3;
  
  console.log('');
  console.log('请输入飞书机器人凭证（从飞书开放平台获取）:');
  console.log('文档: https://open.feishu.cn/document/home/introduction-to-feishu-open-platform');
  
  while (!configured && attempts < maxAttempts) {
    if (attempts > 0) {
      console.log('');
      log.warn(`第 ${attempts + 1} 次尝试 (最多 ${maxAttempts} 次)`);
    }
    
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
      attempts++;
      continue;
    }
    
    const appSecret = await ask('🔐 App Secret: ');
    if (!appSecret || appSecret.trim() === '') {
      log.error('App Secret 不能为空');
      rl.close();
      attempts++;
      continue;
    }
    
    rl.close();
    
    // 验证凭证
    const verify = await verifyFeishuCredentials(appId.trim(), appSecret.trim());
    
    if (verify.valid) {
      // 保存配置
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }
      
      const config = { appId: appId.trim(), appSecret: appSecret.trim() };
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      log.success(`配置已保存到: ${CONFIG_PATH}`);
      configured = true;
    } else {
      log.error(`凭证验证失败: ${verify.error}`);
      if (verify.code === 10003 || verify.code === 10014) {
        console.log('提示: 请检查 App ID 和 App Secret 是否正确');
      } else if (verify.code === 10015) {
        console.log('提示: 应用已被禁用，请在飞书开放平台检查应用状态');
      }
      attempts++;
    }
  }
  
  if (!configured) {
    log.error('配置失败次数过多，请检查凭证后重试');
    return false;
  }
  
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
