'use strict';
var __importDefault = (this && this.__importDefault) || ((mod) => (mod && mod.__esModule ? mod : { default: mod }));
Object.defineProperty(exports, '__esModule', { value: true });
exports.shuffle = shuffle;
exports.create54PokerDeck = create54PokerDeck;
const node_crypto_1 = __importDefault(require('node:crypto'));
// 洗牌算法 (Fisher-Yates，基于 node:crypto CSPRNG 安全随机数发生器)
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = node_crypto_1.default.randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
// 创建标准 54 张扑克牌库
function create54PokerDeck() {
  const suits = [
    { symbol: '♠', type: 'spade', color: 'black' },
    { symbol: '♥', type: 'heart', color: 'red' },
    { symbol: '♣', type: 'club', color: 'black' },
    { symbol: '♦', type: 'diamond', color: 'red' },
  ];
  const ranks = [
    { rank: 'A', ball: 1 },
    { rank: '2', ball: 2 },
    { rank: '3', ball: 3 },
    { rank: '4', ball: 4 },
    { rank: '5', ball: 5 },
    { rank: '6', ball: 6 },
    { rank: '7', ball: 7 },
    { rank: '8', ball: 8 },
    { rank: '9', ball: 9 },
    { rank: '10', ball: 10 },
    { rank: 'J', ball: 11 },
    { rank: 'Q', ball: 12 },
    { rank: 'K', ball: 13 },
  ];
  const deck = [];
  let cardId = 1;
  suits.forEach((s) => {
    ranks.forEach((r) => {
      deck.push({
        id: `c_${cardId++}`,
        suit: s.symbol,
        suitType: s.type,
        color: s.color,
        rank: r.rank,
        ballNumber: r.ball,
      });
    });
  });
  deck.push({
    id: `c_${cardId++}`,
    suit: '🃏',
    suitType: 'joker-small',
    color: 'gray',
    rank: '小王',
    ballNumber: 14,
  });
  deck.push({
    id: `c_${cardId++}`,
    suit: '👑',
    suitType: 'joker-big',
    color: 'gold',
    rank: '大王',
    ballNumber: 15,
  });
  return deck;
}
