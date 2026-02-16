/**
 * iFlow Feishu
 * 将 iFlow CLI 接入飞书机器人
 */

const { FeishuService } = require('./core/service');
const { initConfig, VERSION } = require('./config/config');
const { logger } = require('./utils/logger');

async function main() {
  // 初始化配置（支持交互式向导）
  const config = await initConfig();

  console.log(`\n🚀 iFlow Feishu v${VERSION}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📱 飞书 App ID: ${config.feishu.appId.substring(0, 15)}...`);
  console.log(`🌐 服务端口: ${config.server.port}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const service = new FeishuService(config);
  
  try {
    await service.start();
    
    console.log('\n🎉 服务已就绪!');
    console.log('在飞书中给机器人发消息试试！\n');
  } catch (error) {
    logger.error('❌ 启动失败:', error.message);
    process.exit(1);
  }

  // 优雅退出
  process.on('SIGINT', () => {
    logger.info('👋 正在关闭...');
    service.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('👋 正在关闭...');
    service.stop();
    process.exit(0);
  });
}

// 未捕获异常处理
process.on('uncaughtException', (err) => {
  logger.error('未捕获的异常:', err);
});

process.on('unhandledRejection', (reason) => {
  logger.error('未处理的 Promise 拒绝:', reason);
});

main();