'use strict';
var __importDefault = (this && this.__importDefault) || ((mod) => (mod && mod.__esModule ? mod : { default: mod }));
Object.defineProperty(exports, '__esModule', { value: true });
exports.getRobotWebhookUrl = getRobotWebhookUrl;
exports.setRobotWebhookUrl = setRobotWebhookUrl;
const node_fs_1 = __importDefault(require('node:fs'));
const node_path_1 = __importDefault(require('node:path'));
const config_1 = require('./config');
const URL_FILE_PATH = node_path_1.default.join(config_1.rootDir, '.robot_url');
// 机器人 Webhook 链接：优先从环境变量、持久化文件读取，也可通过 /enter_robot 动态设置
let robotWebhookUrl = (process.env.ROBOT_WEBHOOK_URL || '').trim();
if (!robotWebhookUrl && node_fs_1.default.existsSync(URL_FILE_PATH)) {
  try {
    robotWebhookUrl = node_fs_1.default.readFileSync(URL_FILE_PATH, 'utf8').trim();
  } catch (e) {
    console.warn(`⚠️ 读取 .robot_url 失败: ${e}`);
  }
}
function getRobotWebhookUrl() {
  return robotWebhookUrl;
}
function setRobotWebhookUrl(url) {
  robotWebhookUrl = (url || '').trim();
  try {
    if (robotWebhookUrl) {
      node_fs_1.default.writeFileSync(URL_FILE_PATH, robotWebhookUrl, 'utf8');
    } else if (node_fs_1.default.existsSync(URL_FILE_PATH)) {
      node_fs_1.default.unlinkSync(URL_FILE_PATH);
    }
  } catch (e) {
    console.warn(`⚠️ 保存 .robot_url 失败: ${e}`);
  }
}
