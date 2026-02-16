/**
 * 日志工具模块
 * 
 * 提供统一的日志输出格式
 */

/** 日志级别枚举 */
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

/** 当前日志级别 */
let currentLevel = LogLevel.INFO;

/**
 * 获取北京时间字符串
 * @returns {string}
 */
function getBeijingTime() {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return beijingTime.toISOString().replace('Z', '+08:00');
}

/**
 * 格式化日志参数
 * @param {Array} args - 参数数组
 * @returns {string}
 */
function formatArgs(args) {
  return args.map(arg => {
    if (arg instanceof Error) {
      return `${arg.message}\n${arg.stack}`;
    }
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
}

/**
 * 输出日志
 * @param {string} level - 日志级别名称
 * @param {Array} args - 日志参数
 */
function log(level, args) {
  const levelValue = LogLevel[level];
  if (levelValue < currentLevel) return;
  
  const timestamp = getBeijingTime();
  const message = formatArgs(args);
  const prefix = `[${timestamp}] [${level}]`;
  
  switch (level) {
    case 'ERROR':
      console.error(prefix, message);
      break;
    case 'WARN':
      console.warn(prefix, message);
      break;
    default:
      console.log(prefix, message);
  }
}

/**
 * 日志记录器
 */
const logger = {
  /**
   * 调试日志
   * @param {...any} args
   */
  debug: (...args) => log('DEBUG', args),
  
  /**
   * 信息日志
   * @param {...any} args
   */
  info: (...args) => log('INFO', args),
  
  /**
   * 警告日志
   * @param {...any} args
   */
  warn: (...args) => log('WARN', args),
  
  /**
   * 错误日志
   * @param {...any} args
   */
  error: (...args) => log('ERROR', args),
  
  /**
   * 设置日志级别
   * @param {string} level - DEBUG, INFO, WARN, ERROR
   */
  setLevel: (level) => {
    const value = LogLevel[level.toUpperCase()];
    if (value !== undefined) {
      currentLevel = value;
    }
  },
  
  /**
   * 获取当前日志级别
   * @returns {string}
   */
  getLevel: () => {
    return Object.keys(LogLevel).find(k => LogLevel[k] === currentLevel);
  }
};

module.exports = { logger, LogLevel };
