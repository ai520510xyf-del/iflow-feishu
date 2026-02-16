# iflow-feishu 项目待办事项

## 已知问题

### 1. 卡片列表格式问题
- **问题**：飞书卡片中的 Markdown 列表格式显示不正确
- **状态**：待修复
- **备注**：需要调研飞书卡片 API 对 Markdown 列表的支持方式

### 2. 上下文统计不准确
- **问题**：剩余上下文百分比为估算值，与实际可能有偏差
- **状态**：可接受
- **备注**：当前使用基于字符数的估算方案，基本可用

### 3. 网络搜索功能
- **问题**：iflow CLI 在 spawn 模式下搜索功能可能受限
- **状态**：已优化
- **备注**：已添加智能检测搜索关键词并添加提示词

## 待优化项

### 1. 功能增强
- [ ] 添加重试机制的状态显示
- [ ] 支持动态修改配置（模型、模式等）

## 已完成 ✅

- [x] 项目重命名：iflow-feishu → iflow-feishu
- [x] 架构变更：从 ACP WebSocket 改为 spawn 直接调用
- [x] 卡片状态显示优化（模型名 | 剩余% | Doing/Done）
- [x] 智能搜索检测
- [x] **代码重构 v10.1**
  - [x] 模块拆分：message-processor, stream-handler, http-server, websocket-client
  - [x] 常量定义：constants.js
  - [x] 配置验证：config.js
  - [x] 日志格式统一：logger.js
  - [x] 清理备份文件和未使用代码
  - [x] README 更新

## 项目结构

```
src/core/
├── service.js           # 主服务（协调者）
├── card-builder.js     # 卡片构建器
├── constants.js        # 常量定义
├── feishu-client.js    # 飞书 API 客户端
├── http-server.js      # HTTP 服务器
├── iflow-client.js     # iFlow CLI 客户端
├── message-processor.js # 消息处理器
├── session.js          # 会话管理
├── stream-handler.js   # 流式处理
└── websocket-client.js # WebSocket 客户端
```

## 注意事项

1. **测试要求**：每次修改后需要在飞书中实际测试验证
2. **日志查看**：遇到问题及时查看 `~/.pm2/logs/iflow-feishu-*.log`
3. **重启服务**：修改代码后需要执行 `pm2 restart iflow-feishu`

---

最后更新：2026-02-16