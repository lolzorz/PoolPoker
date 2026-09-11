'use strict';
var __importDefault = (this && this.__importDefault) || ((mod) => (mod && mod.__esModule ? mod : { default: mod }));
Object.defineProperty(exports, '__esModule', { value: true });
exports.setWecomPushDisabled = setWecomPushDisabled;
exports.isWecomPushDisabled = isWecomPushDisabled;
exports.sendRoundResultToWecom = sendRoundResultToWecom;
exports.sendCrashReportToWecom = sendCrashReportToWecom;
const node_http_1 = __importDefault(require('node:http'));
const node_https_1 = __importDefault(require('node:https'));
const node_url_1 = require('node:url');
const gameEngine_1 = require('./gameEngine');
const robotConfig_1 = require('./robotConfig');
const roomManager_1 = require('./roomManager');
// 固定提及成员
const WECOM_MENTIONED_LIST = ['shyren'];
// 生产运行时需兼容 Node 16（无全局 fetch），改用 node:http(s) 实现最小 POST JSON 请求
function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const target = new node_url_1.URL(url);
    const payload = JSON.stringify(body);
    const request = (target.protocol === 'http:' ? node_http_1.default : node_https_1.default).request(
      target,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const status = res.statusCode || 0;
          resolve({
            status,
            ok: status >= 200 && status < 300,
            json: () => Promise.resolve(JSON.parse(data)),
          });
        });
      }
    );
    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}
let isPushDisabledOverride = null;
function setWecomPushDisabled(disabled) {
  isPushDisabledOverride = disabled;
}
function isWecomPushDisabled() {
  if (isPushDisabledOverride !== null) {
    return isPushDisabledOverride;
  }
  return (
    process.env.PLAYWRIGHT_TEST === 'true' ||
    process.env.DISABLE_WECOM_PUSH === 'true' ||
    process.env.NODE_ENV === 'test' ||
    !!process.env.CI
  );
}
// 每局胜利后，将房间号、各成员本局得分以及当前累计积分推送到企业微信机器人
async function sendRoundResultToWecom(room) {
  if (isWecomPushDisabled()) return; // 在 Playwright E2E 测试或显式禁用模式下不推送
  const webhookUrl = (0, robotConfig_1.getRobotWebhookUrl)();
  if (!webhookUrl) return; // 未配置机器人链接，不发送
  const memberLines = room.players.map((p) => {
    const roundDelta = (room.lastRoundScores || []).find((rs) => rs.userId === p.userId)?.delta ?? 0;
    const deltaText = roundDelta >= 0 ? `+${roundDelta}` : `${roundDelta}`;
    return `成员${p.name}：${deltaText}（累计${p.totalScore || 0}）`;
  });
  const content = `房间号：${room.code}\n${memberLines.join('\n')}`;
  const message = {
    msgtype: 'text',
    text: {
      content,
      mentioned_list: WECOM_MENTIONED_LIST,
    },
  };
  try {
    const res = await postJson(webhookUrl, message);
    if (!res.ok) {
      console.warn(`⚠️ [WeCom] 推送本局结果失败 (房间 ${room.code}, HTTP ${res.status})`);
      return;
    }
    const result = await res.json();
    if (result.errcode !== 0) {
      console.warn(`⚠️ [WeCom] 推送本局结果失败 (房间 ${room.code}): ${result.errcode} ${result.errmsg ?? ''}`);
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️ [WeCom] 推送本局结果异常 (房间 ${room.code}): ${reason}`);
  }
}
// 进程崩溃 / 异常退出时，整理报错及当前对战快照推送到企业微信机器人
async function sendCrashReportToWecom(error, type) {
  if (isWecomPushDisabled()) return;
  const webhookUrl = (0, robotConfig_1.getRobotWebhookUrl)();
  if (!webhookUrl) return;
  const nowStr = new Date().toLocaleString('zh-CN', { hour12: false });
  const errorMsg = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error && error.stack ? error.stack.split('\n').slice(0, 8).join('\n') : '';
  const activeRooms = Object.values(roomManager_1.rooms);
  let roomSnapshotText = '暂无活跃房间';
  if (activeRooms.length > 0) {
    const snapshotLines = activeRooms.map((room) => {
      const statusMap = {
        waiting: '等待开始',
        playing: '进行中',
        finished: '已完局',
      };
      const statusText = statusMap[room.status] || room.status;
      const pocketedBalls = (0, gameEngine_1.getPocketedBallNumbers)(room);
      const ballText = pocketedBalls.length > 0 ? pocketedBalls.join(', ') : '无';
      const playerLines = room.players.map((p) => {
        const stateText = p.online !== false ? '在线' : '掉线';
        return `  • ${p.name} [${stateText}]: 累计积分 ${p.totalScore || 0}, 手牌 ${p.cards.length} 张, 已进球 ${p.pocketedCards.length} 张`;
      });
      return `► 房间号 ${room.code} (状态: ${statusText}, 第 ${room.roundCount || 1} 局)\n  场上已打进球号: ${ballText}\n${playerLines.join('\n')}`;
    });
    roomSnapshotText = snapshotLines.join('\n\n');
  }
  let content = `🚨 [PoolPoker 服务端崩溃警告]\n--------------------------------\n⏰ 时间: ${nowStr}\n💥 异常类型: ${type}\n❌ 错误信息: ${errorMsg}`;
  if (stack) {
    content += `\n📍 堆栈摘要:\n${stack}`;
  }
  content += `\n\n📊 崩溃时对战快照 (共 ${activeRooms.length} 个房间):\n--------------------------------\n${roomSnapshotText}`;
  // 企业微信 Webhook 文本消息字数上限 4096 字符
  if (content.length > 4000) {
    content = content.slice(0, 3950) + '\n... [部分内容已截断]';
  }
  const message = {
    msgtype: 'text',
    text: {
      content,
      mentioned_list: WECOM_MENTIONED_LIST,
    },
  };
  try {
    const res = await postJson(webhookUrl, message);
    if (res.ok) {
      console.log('✅ [WeCom] 已发送崩溃对战告警信息');
    } else {
      console.warn(`⚠️ [WeCom] 推送崩溃报告失败, HTTP status: ${res.status}`);
    }
  } catch (err) {
    console.error('❌ [WeCom] 推送崩溃告警发生网络异常:', err);
  }
}
