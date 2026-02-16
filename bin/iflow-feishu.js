#!/usr/bin/env node

/**
 * iFlow Feishu CLI 入口
 */

const path = require('path');
const { spawn } = require('child_process');

// 启动脚本路径
const scriptPath = path.join(__dirname, '..', 'iflow-feishu.sh');

// 如果启动脚本不存在，直接启动服务
const fs = require('fs');
if (!fs.existsSync(scriptPath)) {
  // 直接运行 node 服务
  require('../src/index.js');
  return;
}

// 运行启动脚本
const child = spawn('bash', [scriptPath], {
  stdio: 'inherit',
  env: process.env
});

child.on('close', (code) => {
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error('启动失败:', err.message);
  process.exit(1);
});
