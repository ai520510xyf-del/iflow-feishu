# iFlow Feishu

将 [iFlow CLI](https://iflow.dev) 接入飞书机器人。

## 功能特性

- **多模型支持** - 支持 iFlow CLI 的所有模型
- **流式回复** - 实时显示 AI 思考和回复过程
- **会话管理** - 自动保存上下文历史
- **模式切换** - 支持 default/yolo/plan/smart 模式
- **自动搜索** - 检测搜索关键词自动启用网络搜索

## 快速开始

### 一键启动

```bash
iflow-feishu
```

启动脚本会自动完成以下操作：

1. **检查 iFlow CLI** - 未安装时询问是否安装
2. **安装插件依赖** - 自动安装 npm 依赖
3. **安装 PM2** - 自动安装进程管理器
4. **配置飞书凭证** - 首次使用时引导输入
5. **启动服务**

### 前置要求

- Node.js >= 16.0.0

### 手动配置

如需手动配置飞书凭证：

```bash
mkdir -p ~/.feishu-config
echo '{
  "appId": "your-app-id",
  "appSecret": "your-app-secret"
}' > ~/.feishu-config/feishu-app.json
```

## 命令列表

| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助信息 |
| `/clear` | 清空当前会话历史 |
| `/mode` | 查看当前模式 |
| `/mode <模式>` | 切换模式 (default/yolo/plan/smart) |
| `/status` | 查看会话状态 |

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

## 架构说明

### 模块职责

| 模块 | 职责 |
|------|------|
| service.js | 协调各模块，管理服务生命周期 |
| message-processor.js | 消息解析、上下文构建 |
| stream-handler.js | 流式响应处理、token 提取 |
| http-server.js | HTTP 服务，健康检查，事件回调 |
| websocket-client.js | 飞书 WebSocket 连接 |
| feishu-client.js | 飞书 API 封装 |
| iflow-client.js | iFlow CLI 调用封装 |
| session.js | 会话持久化存储 |
| card-builder.js | 飞书卡片构建 |
| commands.js | 命令处理逻辑 |

### 数据流

```
飞书消息 -> WebSocket -> service.handleMessageEvent()
    -> messageProcessor.parseMessage()
    -> commandHandler.handle() 或 processMessage()
    -> iflowClient.execute() (流式)
    -> streamHandler.extractResponse()
    -> feishuClient.updateCardMessage()
```

## 配置选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `feishu.appId` | 飞书应用 ID | - |
| `feishu.appSecret` | 飞书应用密钥 | - |
| `server.port` | HTTP 服务端口 | 18080 |
| `sessions.maxHistory` | 最大历史消息数 | 15 |
| `iflow.timeout` | CLI 超时时间(ms) | 300000 |

## 环境变量

| 变量 | 说明 |
|------|------|
| `PORT` | 服务端口 |
| `LOG_LEVEL` | 日志级别 (DEBUG/INFO/WARN/ERROR) |

## 常用操作

```bash
# 查看服务状态
pm2 status iflow-feishu

# 查看日志
pm2 logs iflow-feishu

# 重启服务
pm2 restart iflow-feishu

# 健康检查
curl http://localhost:18080/health
```

## 许可证

MIT
