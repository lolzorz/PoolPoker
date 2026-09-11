'use strict';
var __importDefault = (this && this.__importDefault) || ((mod) => (mod && mod.__esModule ? mod : { default: mod }));
Object.defineProperty(exports, '__esModule', { value: true });
exports.rootDir = exports.ballConfigs = exports.appConfig = void 0;
exports.isValidBallConfigKey = isValidBallConfigKey;
const node_fs_1 = __importDefault(require('node:fs'));
const node_path_1 = __importDefault(require('node:path'));
const js_yaml_1 = __importDefault(require('js-yaml'));
const rootDir = process.cwd();
exports.rootDir = rootDir;
let appConfig = { port: 3000 };
exports.appConfig = appConfig;
const configPath = node_path_1.default.join(rootDir, 'config.yaml');
if (node_fs_1.default.existsSync(configPath)) {
  try {
    const fileContents = node_fs_1.default.readFileSync(configPath, 'utf8');
    const parsedConfig = js_yaml_1.default.load(fileContents);
    if (parsedConfig && typeof parsedConfig === 'object') {
      exports.appConfig = appConfig = { ...appConfig, ...parsedConfig };
      console.log(`📄 成功读取 config.yaml 配置文件 (配置端口: ${appConfig.port})`);
    }
  } catch (e) {
    const err = e;
    console.warn(`⚠️ 读取 config.yaml 异常, 使用默认参数: ${err.message}`);
  }
}
const ballConfigPath = node_path_1.default.join(rootDir, 'ball_configs.json');
if (!node_fs_1.default.existsSync(ballConfigPath)) {
  console.error('❌ 缺少 ball_configs.json，服务启动失败。');
  process.exit(1);
}
let ballConfigs = {};
exports.ballConfigs = ballConfigs;
try {
  const parsed = JSON.parse(node_fs_1.default.readFileSync(ballConfigPath, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
    throw new Error('配置内容为空或格式非法');
  }
  if (!parsed.default) {
    throw new Error('缺少 default 配置');
  }
  exports.ballConfigs = ballConfigs = parsed;
  console.log(`🎨 成功读取 ball_configs.json 配置文件 (配置数: ${Object.keys(ballConfigs).length})`);
} catch (e) {
  const err = e;
  console.error(`❌ 读取 ball_configs.json 失败: ${err.message}`);
  process.exit(1);
}
function isValidBallConfigKey(key) {
  return !!(key && ballConfigs[key]);
}
