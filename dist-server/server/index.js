'use strict';
var __importDefault = (this && this.__importDefault) || ((mod) => (mod && mod.__esModule ? mod : { default: mod }));
Object.defineProperty(exports, '__esModule', { value: true });
exports.server = exports.io = exports.app = void 0;
const node_fs_1 = __importDefault(require('node:fs'));
const node_http_1 = __importDefault(require('node:http'));
const node_path_1 = __importDefault(require('node:path'));
const express_1 = __importDefault(require('express'));
const socket_io_1 = require('socket.io');
const config_1 = require('./config');
const logger_1 = require('./logger');
const robotConfig_1 = require('./robotConfig');
const roomManager_1 = require('./roomManager');
const socketHandlers_1 = require('./socketHandlers');
const wecomWebhook_1 = require('./wecomWebhook');
const app = (0, express_1.default)();
exports.app = app;
const server = node_http_1.default.createServer(app);
exports.server = server;
app.use(express_1.default.json());
const io = new socket_io_1.Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 10000,
  pingInterval: 5000,
});
exports.io = io;
app.get('/api/ball-configs', (_req, res) => {
  res.json({
    defaultKey: 'default',
    configs: config_1.ballConfigs,
  });
});
app.get('/api/rooms/:code', (req, res) => {
  const roomCode = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
  const userId = req.query.userId;
  const clientRoom = (0, roomManager_1.getClientRoomState)(roomCode, userId);
  if (!clientRoom) {
    return res.status(404).json({ success: false, message: '房间不存在' });
  }
  res.json({ success: true, room: clientRoom });
});
// 机器人 Webhook 链接：内存读取 / 设置（由 /enter_robot 页面调用）
app.get('/api/robot-url', (_req, res) => {
  res.json({ success: true, url: (0, robotConfig_1.getRobotWebhookUrl)() });
});
app.post('/api/robot-url', (req, res) => {
  const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  (0, robotConfig_1.setRobotWebhookUrl)(url);
  res.json({ success: true, url: (0, robotConfig_1.getRobotWebhookUrl)() });
});
// 企微机器人推送开关 (供 E2E 测试或动态关停调用)
app.get('/api/wecom-push/status', (_req, res) => {
  res.json({ success: true, disabled: (0, wecomWebhook_1.isWecomPushDisabled)() });
});
app.post('/api/wecom-push/toggle', (req, res) => {
  const disabled = req.body?.disabled;
  if (typeof disabled === 'boolean') {
    (0, wecomWebhook_1.setWecomPushDisabled)(disabled);
  }
  res.json({ success: true, disabled: (0, wecomWebhook_1.isWecomPushDisabled)() });
});
// 机器人链接设置页面（独立路由，独立于 SPA）
const enterRobotPage = node_path_1.default.join(config_1.rootDir, 'public', 'enter_robot.html');
app.get('/enter_robot', (_req, res) => {
  if (node_fs_1.default.existsSync(enterRobotPage)) {
    res.sendFile(enterRobotPage);
  } else {
    res.status(404).send('页面不存在');
  }
});
// 托管静态资源目录（优先托管打包出来的 dist 目录）
const distDir = node_path_1.default.join(config_1.rootDir, 'dist');
if (node_fs_1.default.existsSync(distDir)) {
  app.use(express_1.default.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.url.startsWith('/socket.io') || req.url.startsWith('/api/')) return next();
    res.sendFile(node_path_1.default.join(distDir, 'index.html'));
  });
} else {
  console.warn('⚠️ 注意: 未发现 dist 构建目录，请先运行 `pnpm run build` 进行项目构建。');
}
io.on('connection', (socket) => {
  (0, logger_1.logSocketConnect)(socket);
  (0, socketHandlers_1.registerSocketHandlers)(io, socket);
});
// 全局崩溃异常捕获与对战告警推送
let isCrashing = false;
async function handleCrash(error, type) {
  console.error(`💥 捕获到全局崩溃/异常 (${type}):`, error);
  if (isCrashing) return;
  isCrashing = true;
  try {
    await Promise.race([
      (0, wecomWebhook_1.sendCrashReportToWecom)(error, type),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  } catch (err) {
    console.error('❌ 推送崩溃告警失败:', err);
  } finally {
    process.exit(1);
  }
}
process.on('uncaughtException', (err) => handleCrash(err, 'uncaughtException'));
process.on('unhandledRejection', (reason) => handleCrash(reason, 'unhandledRejection'));
server.listen(config_1.appConfig.port, () => {
  console.log('=================================');
  console.log('🎱 54张扑克台球 Web App 已启动');
  console.log(`📄 读取端口: ${config_1.appConfig.port}`);
  console.log(`🌐 访问地址: http://localhost:${config_1.appConfig.port}`);
  console.log('=================================');
});
