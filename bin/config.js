#!/usr/bin/env node

/**
 * iFlow Feishu 配置工具
 * 在终端中配置飞书凭证
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CONFIG_PATH = path.join(process.cwd(), 'config', 'config.json');

function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (error) {
      console.error('读取配置文件失败:', error.message);
    }
  }
  return {
    feishu: {},
    iflow: { command: 'iflow', timeout: 120000 },
    server: { port: 18080 },
    sessions: { maxHistory: 15 },
    card: { titleFontSize: 'small', colors: { model: 'blue', generating: 'orange', completed: 'green' } }
  };
}

function saveConfig(config) {
  try {
    const configDir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('保存配置失败:', error.message);
    return false;
  }
}

function showStatus(config) {
  console.log('\n📋 当前配置状态\n');
  console.log(`App ID: ${config.feishu?.appId ? '✅ 已配置' : '❌ 未配置'}`);
  console.log(`App Secret: ${config.feishu?.appSecret ? '✅ 已配置' : '❌ 未配置'}`);
  console.log(`端口: ${config.server?.port || 18080}`);
  console.log('');
}

async function interactiveConfig() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise((resolve) => {
    rl.question(prompt, resolve);
  });

  console.log('\n🔧 iFlow Feishu 配置\n');
  console.log('请输入飞书应用凭证（从飞书开放平台获取）\n');

  const appId = await question('App ID: ');
  const appSecret = await question('App Secret: ');

  rl.close();

  if (!appId || !appSecret) {
    console.log('\n❌ App ID 和 App Secret 不能为空');
    process.exit(1);
  }

  const config = loadConfig();
  config.feishu = { appId, appSecret };

  if (saveConfig(config)) {
    console.log('\n✅ 配置已保存！');
    console.log(`配置文件: ${CONFIG_PATH}\n`);
    console.log('现在可以启动服务了:');
    console.log('  npm start\n');
  } else {
    console.log('\n❌ 配置保存失败');
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
🔧 iFlow Feishu 配置工具

用法:
  node bin/config.js [命令] [选项]

命令:
  init              交互式配置（推荐）
  set-appid <id>    设置 App ID
  set-secret <key>  设置 App Secret
  status            查看当前配置状态
  help              显示帮助

示例:
  # 交互式配置
  node bin/config.js init

  # 直接设置
  node bin/config.js set-appid cli_abc123
  node bin/config.js set-secret xxxxxxxxx

  # 查看状态
  node bin/config.js status
`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'init';

  switch (command) {
    case 'init':
      await interactiveConfig();
      break;

    case 'set-appid':
      if (!args[1]) {
        console.log('❌ 请提供 App ID');
        console.log('用法: node bin/config.js set-appid <your-app-id>');
        process.exit(1);
      }
      {
        const config = loadConfig();
        config.feishu = config.feishu || {};
        config.feishu.appId = args[1];
        if (saveConfig(config)) {
          console.log('✅ App ID 已设置');
        }
      }
      break;

    case 'set-secret':
      if (!args[1]) {
        console.log('❌ 请提供 App Secret');
        console.log('用法: node bin/config.js set-secret <your-app-secret>');
        process.exit(1);
      }
      {
        const config = loadConfig();
        config.feishu = config.feishu || {};
        config.feishu.appSecret = args[1];
        if (saveConfig(config)) {
          console.log('✅ App Secret 已设置');
        }
      }
      break;

    case 'status':
      showStatus(loadConfig());
      break;

    case 'help':
    case '-h':
    case '--help':
      showHelp();
      break;

    default:
      console.log(`❌ 未知命令: ${command}`);
      console.log('运行 "node bin/config.js help" 查看帮助');
      process.exit(1);
  }
}

main().catch(console.error);