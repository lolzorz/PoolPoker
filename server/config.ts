import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import type { BallConfig } from '../shared/types/game';

export interface AppConfig {
  port: number;
}

const rootDir = process.cwd();

let appConfig: AppConfig = { port: 3000 };
const configPath = path.join(rootDir, 'config.yaml');

if (fs.existsSync(configPath)) {
  try {
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const parsedConfig = yaml.load(fileContents) as Partial<AppConfig>;
    if (parsedConfig && typeof parsedConfig === 'object') {
      appConfig = { ...appConfig, ...parsedConfig };
      console.log(`📄 成功读取 config.yaml 配置文件 (配置端口: ${appConfig.port})`);
    }
  } catch (e) {
    const err = e as Error;
    console.warn(`⚠️ 读取 config.yaml 异常, 使用默认参数: ${err.message}`);
  }
}

const ballConfigPath = path.join(rootDir, 'ball_configs.json');
if (!fs.existsSync(ballConfigPath)) {
  console.error('❌ 缺少 ball_configs.json，服务启动失败。');
  process.exit(1);
}

let ballConfigs: Record<string, BallConfig> = {};
try {
  const parsed = JSON.parse(fs.readFileSync(ballConfigPath, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
    throw new Error('配置内容为空或格式非法');
  }
  if (!parsed.default) {
    throw new Error('缺少 default 配置');
  }
  ballConfigs = parsed as Record<string, BallConfig>;
  console.log(`🎨 成功读取 ball_configs.json 配置文件 (配置数: ${Object.keys(ballConfigs).length})`);
} catch (e) {
  const err = e as Error;
  console.error(`❌ 读取 ball_configs.json 失败: ${err.message}`);
  process.exit(1);
}

export function isValidBallConfigKey(key: string): boolean {
  return !!(key && ballConfigs[key]);
}

export { appConfig, ballConfigs, rootDir };
