/**
 * 常量定义
 */

const fs = require('fs');
const path = require('path');

const SEARCH_KEYWORDS = [
  '搜索', '查找', '查询', '最新', '新闻', '天气', 
  '股价', '汇率', '今天', '明天', '本周', '本月', 
  '今年', '2024', '2025', '2026', '2027', '2028'
];

const CARD_UPDATE_INTERVAL = 300;
const TIMER_UPDATE_INTERVAL = 500;
const CARD_UPDATE_DELAY = 100;

const RECONNECT_MAX_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;

const DEFAULT_MODEL = 'glm-5';
const DEFAULT_MAX_TOKENS = 128000;

const MODEL_MAX_TOKENS = {
  'qwen3-coder-plus': 128000,
  'glm-5': 128000,
  'gpt-4': 128000,
  'gpt-4-turbo': 128000,
  'gpt-3.5-turbo': 16384,
  'claude-3': 200000,
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
  'llama-3': 8192,
  'llama-3-70b': 8192,
  'mixtral': 32768,
  'mistral-large': 32768
};

// 从 package.json 读取版本号
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

module.exports = {
  SEARCH_KEYWORDS,
  CARD_UPDATE_INTERVAL,
  TIMER_UPDATE_INTERVAL,
  CARD_UPDATE_DELAY,
  RECONNECT_MAX_ATTEMPTS,
  RECONNECT_BASE_DELAY,
  RECONNECT_MAX_DELAY,
  DEFAULT_MODEL,
  DEFAULT_MAX_TOKENS,
  MODEL_MAX_TOKENS,
  VERSION
};
