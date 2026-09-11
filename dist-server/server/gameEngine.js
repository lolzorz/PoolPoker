'use strict';
var __importDefault = (this && this.__importDefault) || ((mod) => (mod && mod.__esModule ? mod : { default: mod }));
Object.defineProperty(exports, '__esModule', { value: true });
exports.addLog = addLog;
exports.getPocketedBallNumbers = getPocketedBallNumbers;
exports.checkGameWinners = checkGameWinners;
exports.calculateHandScore = calculateHandScore;
exports.handleGameFinished = handleGameFinished;
exports.computeTurnOrder = computeTurnOrder;
const node_crypto_1 = __importDefault(require('node:crypto'));
const pokerDeck_1 = require('./pokerDeck');
const wecomWebhook_1 = require('./wecomWebhook');
function addLog(room, text) {
  const time = new Date().toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  if (!room.logs) {
    room.logs = [];
  }
  room.logs.push({
    id: `${Date.now()}_${node_crypto_1.default.randomBytes(3).toString('hex')}`,
    time,
    text,
  });
  if (room.logs.length > 50) {
    room.logs = room.logs.slice(-50);
  }
}
// 获取当前房间所有已消除的球号列表 (1 ~ 15，按数字大小升序)
function getPocketedBallNumbers(room) {
  if (!room?.players) return [];
  const set = new Set();
  (room.accidentalBalls || []).forEach((b) => {
    set.add(b);
  });
  (room.breakBalls || []).forEach((b) => {
    set.add(b);
  });
  room.players.forEach((p) => {
    (p.pocketedCards || []).forEach((c) => {
      set.add(c.ballNumber);
    });
  });
  return Array.from(set).sort((a, b) => a - b);
}
// 检查是否有玩家满足胜利条件（手牌中未被打进的有效卡牌数为 0）
function checkGameWinners(room) {
  if (room?.status !== 'playing') return [];
  const pocketedSet = new Set(getPocketedBallNumbers(room));
  const winners = [];
  room.players.forEach((p) => {
    const activeCards = (p.cards || []).filter((c) => !pocketedSet.has(c.ballNumber));
    if (activeCards.length === 0) {
      p.isWinner = true;
      winners.push(p);
    }
  });
  return winners;
}
// 获取牌的基础分值：大王/小王基数1，其他牌基数2
function getCardBase(card) {
  return card.suitType === 'joker-big' || card.suitType === 'joker-small' ? 1 : 2;
}
// 计算一组未消除手牌的积分（同rank牌组合倍乘）
function calculateHandScore(remainingCards) {
  if (remainingCards.length === 0) return 0;
  const groups = new Map();
  for (const card of remainingCards) {
    if (!groups.has(card.rank)) groups.set(card.rank, []);
    groups.get(card.rank).push(card);
  }
  let total = 0;
  for (const cards of groups.values()) {
    const n = cards.length;
    const sumBase = cards.reduce((acc, c) => acc + getCardBase(c), 0);
    total += sumBase * n;
  }
  return total;
}
// 结算游戏胜利状态
function handleGameFinished(room, winners, actionPlayer) {
  room.status = 'finished';
  winners.forEach((w) => {
    w.wins = (w.wins || 0) + 1;
  });
  if (actionPlayer) {
    const actionPlayerIdx = winners.findIndex((w) => w.id === actionPlayer.id || w.userId === actionPlayer.userId);
    if (actionPlayerIdx > 0) {
      const [actionPlayerWinner] = winners.splice(actionPlayerIdx, 1);
      winners.unshift(actionPlayerWinner);
    }
  }
  room.winners = winners.map((w) => ({
    name: w.name,
    avatar: w.avatar,
    id: w.id,
    userId: w.userId,
    wins: w.wins,
  }));
  room.lastWinnerUserId = winners.length > 1 && actionPlayer ? actionPlayer.userId : winners[0].userId;
  if (winners.length === 1) {
    addLog(room, `🏆 恭喜 ${winners[0].name} 清空有效手牌，夺得本局胜利！(累计胜利 ${winners[0].wins} 次) 🎉`);
  } else {
    const names = winners.map((w) => `${w.name}(累计${w.wins}胜)`).join('、');
    addLog(room, `🏆 恭喜 ${names} 共同清空有效手牌，同时夺得本局胜利！🎉`);
  }
  // 积分结算
  const pocketedSet = new Set(getPocketedBallNumbers(room));
  const winnerUserIds = new Set(winners.map((w) => w.userId));
  const actionWinnerUserId = winners[0]?.userId ?? null;
  // 计算每位输家剩余手牌分值
  const loserEntries = [];
  room.players.forEach((p) => {
    if (!winnerUserIds.has(p.userId)) {
      const remaining = (p.cards || []).filter((c) => !pocketedSet.has(c.ballNumber));
      loserEntries.push({ player: p, handScore: calculateHandScore(remaining) });
    }
  });
  const totalLoserScore = loserEntries.reduce((acc, e) => acc + e.handScore, 0);
  const numWinners = winners.length;
  const baseShare = numWinners > 0 ? Math.floor(totalLoserScore / numWinners) : 0;
  const remainder = numWinners > 0 ? totalLoserScore % numWinners : 0;
  const roundScores = [];
  loserEntries.forEach(({ player, handScore }) => {
    player.totalScore = (player.totalScore || 0) - handScore;
    roundScores.push({ userId: player.userId, delta: -handScore });
  });
  winners.forEach((w) => {
    const player = room.players.find((p) => p.userId === w.userId);
    if (!player) return;
    const extra = remainder > 0 && w.userId === actionWinnerUserId ? remainder : 0;
    const gain = baseShare + extra;
    player.totalScore = (player.totalScore || 0) + gain;
    roundScores.push({ userId: w.userId, delta: gain });
  });
  room.lastRoundScores = roundScores;
  const scoreLines = roundScores
    .map((rs) => {
      const p = room.players.find((pl) => pl.userId === rs.userId);
      const sign = rs.delta >= 0 ? '+' : '';
      return `${p?.name ?? rs.userId}：${sign}${rs.delta}分`;
    })
    .join('，');
  addLog(room, `📊 本局积分结算：${scoreLines}`);
  // 每局胜利结算完成后，推送本局结果到企业微信机器人（不阻塞结算流程）
  (0, wecomWebhook_1.sendRoundResultToWecom)(room);
}
// 计算每局击球顺序
function computeTurnOrder(room) {
  if (!room?.players || room.players.length === 0) return [];
  const currentP = room.players.map((p) => p.userId);
  if (
    !room.lastTurnOrder ||
    room.lastTurnOrder.length === 0 ||
    !room.lastWinnerUserId ||
    !currentP.includes(room.lastWinnerUserId)
  ) {
    return (0, pokerDeck_1.shuffle)(currentP);
  }
  // 1. 保留上一局在场玩家，并补全中途加入的玩家
  const validPrev = room.lastTurnOrder.filter((id) => currentP.includes(id));
  currentP.forEach((id) => {
    if (!validPrev.includes(id)) {
      validPrev.push(id);
    }
  });
  // 2. 顺序反转
  const reversed = [...validPrev].reverse();
  // 3. 胜者优先
  let winnerIdx = reversed.indexOf(room.lastWinnerUserId);
  if (winnerIdx === -1) winnerIdx = 0;
  return [...reversed.slice(winnerIdx), ...reversed.slice(0, winnerIdx)];
}
