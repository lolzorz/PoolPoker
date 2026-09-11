'use strict';
var __importDefault = (this && this.__importDefault) || ((mod) => (mod && mod.__esModule ? mod : { default: mod }));
Object.defineProperty(exports, '__esModule', { value: true });
exports.socketIndex = exports.rooms = void 0;
exports.generateRoomCode = generateRoomCode;
exports.getClientRoomState = getClientRoomState;
exports.broadcastRoomState = broadcastRoomState;
const node_crypto_1 = __importDefault(require('node:crypto'));
const gameEngine_1 = require('./gameEngine');
exports.rooms = {};
exports.socketIndex = new Map();
function generateRoomCode() {
  let code = '';
  do {
    code = node_crypto_1.default.randomInt(1000, 10000).toString();
  } while (exports.rooms[code]);
  return code;
}
function getClientRoomState(roomCode, targetUserId) {
  const room = exports.rooms[roomCode];
  if (!room) return null;
  const pocketedBallNumbers = (0, gameEngine_1.getPocketedBallNumbers)(room);
  return {
    code: room.code,
    hostUserId: room.hostUserId,
    hostSocketId: room.hostSocketId,
    settings: room.settings,
    status: room.status,
    roundCount: room.roundCount,
    deckCount: room.deck.length,
    logs: room.logs.slice(-15),
    winners: room.winners || [],
    pocketedBallNumbers: pocketedBallNumbers,
    turnOrder: room.turnOrder || [],
    players: room.players.map((p) => {
      const isSelf = targetUserId ? p.userId === targetUserId : false;
      return {
        id: p.id,
        userId: p.userId,
        name: p.name,
        avatar: p.avatar,
        isHost: p.userId === room.hostUserId,
        online: p.online !== false,
        cardCount: p.cards.length,
        activeCardCount: p.cards.length,
        cards: isSelf || room.status === 'finished' ? p.cards : [],
        pocketedCards: p.pocketedCards,
        wins: p.wins || 0,
        isWinner: p.isWinner || false,
        totalScore: p.totalScore || 0,
      };
    }),
    lastRoundScores: room.lastRoundScores || [],
  };
}
function broadcastRoomState(io, roomCode) {
  const room = exports.rooms[roomCode];
  if (!room) return;
  const roomSockets = io.sockets.adapter.rooms.get(roomCode);
  if (!roomSockets) return;
  for (const socketId of roomSockets) {
    const playerSocket = io.sockets.sockets.get(socketId);
    if (playerSocket) {
      const socketData = exports.socketIndex.get(socketId);
      const currentPlayer = room.players.find(
        (p) => p.id === socketId || (socketData?.userId && p.userId === socketData.userId)
      );
      const targetUserId = currentPlayer?.userId || socketData?.userId;
      const clientRoom = getClientRoomState(roomCode, targetUserId);
      if (clientRoom) {
        playerSocket.emit('room_updated', clientRoom);
      }
    }
  }
}
