# iFlow Feishu

将 [iFlow CLI](https://iflow.dev) 接入飞书机器人。

## 功能特性

- **多模型支持** - 支持 iFlow CLI 的所有模型
- **流式回复** - 实时显示 AI 思考和回复过程
- **会话管理** - 自动保存上下文历史
- **模式切换** - 支持 default/yolo/plan/smart 模式
- **自动搜索** - 检测搜索关键词自动启用网络搜索
- **交互式配置** - 首次运行自动引导配置

## 安装

```bash
npm install -g iflow-feishu
```

## 快速开始

### 方式一：交互式配置（推荐）

直接运行，首次使用会引导你配置飞书凭证：

```bash
iflow-feishu
```

按提示输入飞书机器人的 App ID 和 App Secret 即可。

### 方式二：环境变量

```bash
export FEISHU_APP_ID="cli_xxxxxxxxxxxx"
export FEISHU_APP_SECRET="xxxxxxxxxxxxxxxx"
iflow-feishu
```

### 方式三：配置文件

```bash
mkdir -p ~/.feishu-config
cat > ~/.feishu-config/feishu-app.json << 'EOF'
{
  "appId": "cli_xxxxxxxxxxxx",
  "appSecret": "xxxxxxxxxxxxxxxx"
}
EOF
iflow-feishu
```

## 前置要求

- Node.js >= 16.0.0
- iFlow CLI（可选，用于本地开发）

## 命令列表

在飞书中给机器人发送以下命令：

| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助信息 |
| `/clear` | 清空当前会话历史 |
| `/mode` | 查看当前模式 |
| `/mode <模式>` | 切换模式 (default/yolo/plan/smart) |
| `/status` | 查看会话状态 |

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `FEISHU_APP_ID` | 飞书应用 ID | - |
| `FEISHU_APP_SECRET` | 飞书应用密钥 | - |
| `PORT` | HTTP 服务端口 | 18080 |
| `LOG_LEVEL` | 日志级别 (DEBUG/INFO/WARN/ERROR) | INFO |

## 常用操作

```bash
# 健康检查
curl http://localhost:18080/health

# 后台运行
nohup iflow-feishu > iflow-feishu.log 2>&1 &

# 查看日志
tail -f iflow-feishu.log

# 使用 PM2 管理
pm2 start iflow-feishu
pm2 logs iflow-feishu
pm2 restart iflow-feishu
pm2 stop iflow-feishu
```

## 飞书机器人配置

1. 访问 [飞书开放平台](https://open.feishu.cn/)
2. 创建企业自建应用
3. 开通机器人能力
4. 配置事件订阅：
   - URL: `http://your-server:18080/webhook`
   - 事件：接收消息
5. 获取 App ID 和 App Secret

## 项目结构

```
iflow-feishu/
├── src/
│   ├── index.js              # 入口文件
│   ├── config/
│   │   └── config.js         # 配置管理
│   ├── core/
│   │   ├── service.js        # 主服务（协调者）
│   │   ├── card-builder.js   # 卡片构建器
│   │   ├── constants.js      # 常量定义
│   │   ├── feishu-client.js  # 飞书 API 客户端
│   │   ├── http-server.js    # HTTP 服务器
│   │   ├── iflow-client.js   # iFlow CLI 客户端
│   │   ├── message-processor.js # 消息处理器
│   │   ├── session.js        # 会话管理
│   │   ├── stream-handler.js # 流式处理
│   │   └── websocket-client.js # WebSocket 客户端
│   ├── handlers/
│   │   └── commands.js       # 命令处理器
│   └── utils/
│       └── logger.js         # 日志工具
├── config/
│   └── config.example.json   # 配置示例
├── package.json
└── README.md
```

## 许可证

MIT
