'use strict';
var __importDefault = (this && this.__importDefault) || ((mod) => (mod && mod.__esModule ? mod : { default: mod }));
Object.defineProperty(exports, '__esModule', { value: true });
exports.registerSocketHandlers = registerSocketHandlers;
const node_crypto_1 = __importDefault(require('node:crypto'));
const config_1 = require('./config');
const gameEngine_1 = require('./gameEngine');
const gameState_1 = require('./gameState');
const logger_1 = require('./logger');
const pokerDeck_1 = require('./pokerDeck');
const roomManager_1 = require('./roomManager');
function registerSocketHandlers(io, socket) {
  // 1. 创建房间
  socket.on('create_room', (data, callback) => {
    const { userId, name, avatar, ballConfigKey } = data;
    if (!userId || !name) {
      if (callback) callback({ success: false, message: '用户信息不完整' });
      return;
    }
    socket.data.userName = name;
    socket.data.userId = userId;
    const roomCode = (0, roomManager_1.generateRoomCode)();
    const sessionToken = node_crypto_1.default.randomUUID();
    const newPlayer = {
      id: socket.id,
      userId,
      sessionToken,
      name,
      avatar: avatar || '🎱',
      isHost: true,
      online: true,
      cardCount: 0,
      activeCardCount: 0,
      cards: [],
      pocketedCards: [],
      wins: 0,
      isWinner: false,
      totalScore: 0,
    };
    const validatedConfigKey = (0, config_1.isValidBallConfigKey)(ballConfigKey) ? ballConfigKey : 'default';
    const newRoom = {
      code: roomCode,
      hostUserId: userId,
      hostSocketId: socket.id,
      status: 'waiting',
      players: [newPlayer],
      deck: [],
      accidentalBalls: [],
      breakBalls: [],
      winners: [],
      turnOrder: [],
      roundCount: 0,
      settings: {
        cardsPerPlayer: 5,
        maxPlayers: 8,
        includeBlackEight: true,
        ballConfigKey: validatedConfigKey,
      },
      logs: [],
      lastRoundScores: [],
      gameHistory: [],
    };
    roomManager_1.rooms[roomCode] = newRoom;
    roomManager_1.socketIndex.set(socket.id, { roomCode, userId });
    socket.join(roomCode);
    (0, gameEngine_1.addLog)(newRoom, `🏠 房间创建成功，房主 ${name} 进入房间`);
    if (callback) callback({ success: true, roomCode, sessionToken });
    socket.emit('room_created', { roomCode });
    (0, roomManager_1.broadcastRoomState)(io, roomCode);
  });
  // 2. 加入房间
  socket.on('join_room', (data, callback) => {
    const { roomCode, userId, name, avatar } = data;
    if (name) socket.data.userName = name;
    if (userId) socket.data.userId = userId;
    const room = roomManager_1.rooms[roomCode];
    if (!room) {
      if (callback) callback({ success: false, message: '房间不存在' });
      return;
    }
    if (room.players.length >= room.settings.maxPlayers && !room.players.some((p) => p.userId === userId)) {
      if (callback) callback({ success: false, message: '房间人数已满' });
      return;
    }
    let player = room.players.find((p) => p.userId === userId);
    if (player) {
      if (!player.sessionToken) {
        player.sessionToken = node_crypto_1.default.randomUUID();
      }
      player.id = socket.id;
      player.name = name || player.name;
      player.avatar = avatar || player.avatar;
      player.online = true;
      (0, gameEngine_1.addLog)(room, `🔌 玩家 ${player.name} 重新连接`);
    } else {
      const sessionToken = node_crypto_1.default.randomUUID();
      player = {
        id: socket.id,
        userId,
        sessionToken,
        name,
        avatar: avatar || '🎱',
        isHost: false,
        online: true,
        cardCount: 0,
        activeCardCount: 0,
        cards: [],
        pocketedCards: [],
        wins: 0,
        isWinner: false,
        totalScore: 0,
      };
      if (room.status === 'playing') {
        const count = room.settings.cardsPerPlayer || 5;
        for (let i = 0; i < count; i++) {
          const card = room.deck.pop();
          if (card) {
            player.cards.push(card);
          }
        }
        player.cardCount = player.cards.length;
      }
      room.players.push(player);
      (0, gameEngine_1.addLog)(room, `👋 玩家 ${name} 加入房间`);
    }
    roomManager_1.socketIndex.set(socket.id, { roomCode, userId });
    socket.join(roomCode);
    if (callback) callback({ success: true, roomCode, sessionToken: player.sessionToken });
    (0, roomManager_1.broadcastRoomState)(io, roomCode);
  });
  // 2.1 尝试断线重连恢复
  socket.on('rejoin_room', (data, callback) => {
    const { roomCode, userId, sessionToken } = data;
    const room = roomManager_1.rooms[roomCode];
    if (!room) {
      if (callback) callback({ success: false, message: '房间已解散或不存在' });
      return;
    }
    const player = room.players.find((p) => p.userId === userId);
    if (!player) {
      if (callback) callback({ success: false, message: '你不在此房间成员列表中' });
      return;
    }
    if (!sessionToken || player.sessionToken !== sessionToken) {
      if (callback) callback({ success: false, message: '身份凭证失效或验证失败，拒绝加入' });
      return;
    }
    if (player.name) socket.data.userName = player.name;
    if (userId) socket.data.userId = userId;
    player.id = socket.id;
    player.online = true;
    if (player.userId === room.hostUserId) {
      room.hostSocketId = socket.id;
    }
    roomManager_1.socketIndex.set(socket.id, { roomCode, userId });
    socket.join(roomCode);
    (0, gameEngine_1.addLog)(room, `🔄 玩家 ${player.name} 恢复了房间连接`);
    if (callback) callback({ success: true, roomCode, sessionToken: player.sessionToken });
    (0, roomManager_1.broadcastRoomState)(io, roomCode);
  });
  // 3. 修改房间设置（发牌数/黑八/球色等）
  socket.on('update_settings', (data) => {
    const { roomCode, settings } = data;
    const room = roomManager_1.rooms[roomCode];
    if (!room) return;
    const session = roomManager_1.socketIndex.get(socket.id);
    if (!session || session.userId !== room.hostUserId) return;
    if (settings.ballConfigKey && !(0, config_1.isValidBallConfigKey)(settings.ballConfigKey)) {
      delete settings.ballConfigKey;
    }
    room.settings = { ...room.settings, ...settings };
    (0, gameEngine_1.addLog)(room, '⚙️ 房主更新了游戏房间设置');
    (0, roomManager_1.broadcastRoomState)(io, roomCode);
  });
  // 4. 开始游戏 / 发牌
  socket.on('start_game', (data) => {
    const { roomCode } = data;
    const room = roomManager_1.rooms[roomCode];
    if (!room) return;
    const session = roomManager_1.socketIndex.get(socket.id);
    if (!session || session.userId !== room.hostUserId) return;
    if (room.players.length === 0) return;
    room.deck = (0, pokerDeck_1.shuffle)((0, pokerDeck_1.create54PokerDeck)());
    room.accidentalBalls = [];
    room.breakBalls = [];
    room.winners = [];
    room.lastRoundScores = [];
    room.roundCount += 1;
    room.status = 'playing';
    const count = room.settings.cardsPerPlayer || 5;
    room.players.forEach((p) => {
      p.cards = [];
      p.pocketedCards = [];
      p.isWinner = false;
      for (let i = 0; i < count; i++) {
        const card = room.deck.pop();
        if (card) {
          p.cards.push(card);
        }
      }
      p.cardCount = p.cards.length;
    });
    room.turnOrder = (0, gameEngine_1.computeTurnOrder)(room);
    room.lastTurnOrder = [...room.turnOrder];
    // 每局开始游戏时清空撤回历史，并记录「发牌完成」的初始状态作为第 0 步基线
    room.gameHistory = [];
    (0, gameState_1.recordGameStep)(room);
    (0, gameEngine_1.addLog)(room, `🎮 第 ${room.roundCount} 局游戏正式开始！每位玩家发牌 ${count} 张`);
    (0, roomManager_1.broadcastRoomState)(io, roomCode);
  });
  // 5. 击球消除卡牌（进球）
  socket.on('pocket_ball', (data) => {
    const { roomCode, cardId } = data;
    const room = roomManager_1.rooms[roomCode];
    if (room?.status !== 'playing') return;
    const session = roomManager_1.socketIndex.get(socket.id);
    if (!session) return;
    const player = room.players.find((p) => p.userId === session.userId);
    if (!player) return;
    const cardIndex = player.cards.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) return;
    const [pocketedCard] = player.cards.splice(cardIndex, 1);
    player.pocketedCards.push(pocketedCard);
    (0, gameEngine_1.addLog)(
      room,
      `🎯 ${player.name} 打进 ${pocketedCard.ballNumber}号球，消去卡牌 [${pocketedCard.suit}${pocketedCard.rank}]`
    );
    const winners = (0, gameEngine_1.checkGameWinners)(room);
    if (winners.length > 0) {
      (0, gameEngine_1.handleGameFinished)(room, winners, player);
    }
    (0, gameState_1.recordGameStep)(room);
    (0, roomManager_1.broadcastRoomState)(io, roomCode);
  });
  // 6. 犯规罚抽牌
  socket.on('draw_penalty', (data) => {
    const { roomCode } = data;
    const room = roomManager_1.rooms[roomCode];
    if (room?.status !== 'playing') return;
    const session = roomManager_1.socketIndex.get(socket.id);
    if (!session) return;
    const player = room.players.find((p) => p.userId === session.userId);
    if (!player) return;
    if (room.deck.length === 0) {
      room.deck = (0, pokerDeck_1.shuffle)((0, pokerDeck_1.create54PokerDeck)());
      (0, gameEngine_1.addLog)(room, '🎴 牌堆已耗尽，洗混新扑克牌库补充牌堆！');
    }
    const penaltyCard = room.deck.pop();
    if (penaltyCard) {
      player.cards.push(penaltyCard);
      (0, gameEngine_1.addLog)(room, `⚠️ ${player.name} 犯规，罚抽 1 张扑克牌`);
    }
    (0, gameState_1.recordGameStep)(room);
    (0, roomManager_1.broadcastRoomState)(io, roomCode);
  });
  // 7. 误进无关球 / 裁判登记球入袋
  socket.on('accidental_pocket', (data) => {
    const { roomCode, ballNumber } = data;
    const room = roomManager_1.rooms[roomCode];
    if (room?.status !== 'playing') return;
    if (!room.accidentalBalls.includes(ballNumber)) {
      room.accidentalBalls.push(ballNumber);
      (0, gameEngine_1.addLog)(room, `🎱 记录场上 ${ballNumber}号球判定为已进球`);
      const winners = (0, gameEngine_1.checkGameWinners)(room);
      if (winners.length > 0) {
        (0, gameEngine_1.handleGameFinished)(room, winners, null);
      }
      (0, gameState_1.recordGameStep)(room);
    }
    (0, roomManager_1.broadcastRoomState)(io, roomCode);
  });
  // 7.1 开球进球 - 记录场上球入袋，不归入任何玩家手牌
  socket.on('break_pocket', (data) => {
    const { roomCode, ballNumber } = data;
    const room = roomManager_1.rooms[roomCode];
    if (room?.status !== 'playing') return;
    if (!room.breakBalls.includes(ballNumber)) {
      room.breakBalls.push(ballNumber);
      (0, gameEngine_1.addLog)(room, `🚀 记录开球进球：${ballNumber}号球已进球`);
      const winners = (0, gameEngine_1.checkGameWinners)(room);
      if (winners.length > 0) {
        (0, gameEngine_1.handleGameFinished)(room, winners, null);
      }
      (0, gameState_1.recordGameStep)(room);
    }
    (0, roomManager_1.broadcastRoomState)(io, roomCode);
  });
  // 8. 撤回上一步操作（整体回退到上一步状态）
  socket.on('retract_ball', (data) => {
    const { roomCode } = data;
    const room = roomManager_1.rooms[roomCode];
    if (!room) return;
    const previous = (0, gameState_1.undoGameStep)(room);
    if (!previous) {
      (0, gameEngine_1.addLog)(room, '↩️ 没有可撤回的操作');
    } else {
      (0, gameEngine_1.addLog)(room, '↩️ 已撤回到上一步操作');
    }
    (0, roomManager_1.broadcastRoomState)(io, roomCode);
  });
  // 9. 记录进球 - 帮指定玩家消卡或记录全场进球
  socket.on('referee_pocket_ball', (data) => {
    const { roomCode, targetUserId, ballNumber } = data;
    const room = roomManager_1.rooms[roomCode];
    if (room?.status !== 'playing') return;
    const targetPlayer = room.players.find((p) => p.userId === targetUserId);
    if (!targetPlayer) return;
    const cardIndex = targetPlayer.cards.findIndex((c) => c.ballNumber === ballNumber);
    if (cardIndex !== -1) {
      const [pocketedCard] = targetPlayer.cards.splice(cardIndex, 1);
      targetPlayer.pocketedCards.push(pocketedCard);
      const refereePlayer = room.players.find((p) => p.id === socket.id);
      const isSelfAction = refereePlayer && refereePlayer.userId === targetPlayer.userId;
      if (isSelfAction) {
        (0, gameEngine_1.addLog)(
          room,
          `🎯 ${targetPlayer.name} 打进 ${pocketedCard.ballNumber}号球，消去卡牌 [${pocketedCard.suit}${pocketedCard.rank}]`
        );
      } else {
        const refName = refereePlayer ? refereePlayer.name : '其他玩家';
        (0, gameEngine_1.addLog)(
          room,
          `⚖️ ${refName} 为 ${targetPlayer.name} 记录打进并消除了手牌 [${pocketedCard.suit}${pocketedCard.rank} -> ${pocketedCard.ballNumber}号球]！`
        );
      }
      const winners = (0, gameEngine_1.checkGameWinners)(room);
      if (winners.length > 0) {
        (0, gameEngine_1.handleGameFinished)(room, winners, targetPlayer);
      }
      (0, gameState_1.recordGameStep)(room);
    } else {
      if (!room.accidentalBalls.includes(ballNumber)) {
        room.accidentalBalls.push(ballNumber);
        (0, gameEngine_1.addLog)(room, `🎱 记录 ${targetPlayer.name} 打进 ${ballNumber}号球（判定为全场已进球）`);
        const winners = (0, gameEngine_1.checkGameWinners)(room);
        if (winners.length > 0) {
          (0, gameEngine_1.handleGameFinished)(room, winners, null);
        }
        (0, gameState_1.recordGameStep)(room);
      }
    }
    (0, roomManager_1.broadcastRoomState)(io, roomCode);
  });
  // 10. 裁判代记 - 帮指定玩家罚抽卡
  socket.on('referee_draw_penalty', (data) => {
    const { roomCode, targetUserId } = data;
    const room = roomManager_1.rooms[roomCode];
    if (room?.status !== 'playing') return;
    const targetPlayer = room.players.find((p) => p.userId === targetUserId);
    if (!targetPlayer) return;
    if (room.deck.length === 0) {
      room.deck = (0, pokerDeck_1.shuffle)((0, pokerDeck_1.create54PokerDeck)());
      (0, gameEngine_1.addLog)(room, '🎴 牌堆已耗尽，洗混新扑克牌库补充牌堆！');
    }
    const penaltyCard = room.deck.pop();
    if (penaltyCard) {
      targetPlayer.cards.push(penaltyCard);
      (0, gameEngine_1.addLog)(room, `👨‍⚖️ 裁判代记：${targetPlayer.name} 犯规，罚抽 1 张扑克牌`);
    }
    (0, gameState_1.recordGameStep)(room);
    (0, roomManager_1.broadcastRoomState)(io, roomCode);
  });
  // 11. 请求重新开始
  socket.on('request_restart', (data) => {
    const { roomCode } = data;
    const room = roomManager_1.rooms[roomCode];
    if (!room) return;
    (0, gameEngine_1.addLog)(room, '🔄 房主发起了重新开始本局对决');
    (0, roomManager_1.broadcastRoomState)(io, roomCode);
  });
  // 12. 确认重新开始 / 重置房间
  const handleRestartRoom = (roomCode) => {
    const room = roomManager_1.rooms[roomCode];
    if (!room) return;
    room.deck = [];
    room.accidentalBalls = [];
    room.breakBalls = [];
    room.winners = [];
    room.status = 'waiting';
    room.gameHistory = [];
    room.players.forEach((p) => {
      p.cards = [];
      p.pocketedCards = [];
      p.isWinner = false;
      p.cardCount = 0;
      p.activeCardCount = 0;
    });
    (0, gameEngine_1.addLog)(room, '🔄 房主重置了游戏，回到发牌等待状态。');
    (0, roomManager_1.broadcastRoomState)(io, roomCode);
  };
  socket.on('confirm_restart', (data) => {
    const { roomCode } = data;
    const room = roomManager_1.rooms[roomCode];
    if (!room) return;
    const session = roomManager_1.socketIndex.get(socket.id);
    if (!session || session.userId !== room.hostUserId) return;
    handleRestartRoom(roomCode);
  });
  socket.on('restart_game', (data) => {
    const { roomCode } = data;
    const room = roomManager_1.rooms[roomCode];
    if (!room) return;
    const session = roomManager_1.socketIndex.get(socket.id);
    if (!session || session.userId !== room.hostUserId) return;
    handleRestartRoom(roomCode);
  });
  // 13. 离开房间
  socket.on('leave_room', (data) => {
    const { roomCode, userId } = data;
    const room = roomManager_1.rooms[roomCode];
    if (!room) return;
    const pIdx = room.players.findIndex((p) => p.userId === userId);
    if (pIdx !== -1) {
      const [removedPlayer] = room.players.splice(pIdx, 1);
      (0, gameEngine_1.addLog)(room, `🚪 玩家 ${removedPlayer.name} 离开了房间`);
      if (room.players.length > 0) {
        if (room.hostUserId === userId) {
          room.hostUserId = room.players[0].userId;
          room.hostSocketId = room.players[0].id;
          room.players[0].isHost = true;
          (0, gameEngine_1.addLog)(room, `👑 房主已自动转让给 ${room.players[0].name}`);
        }
      } else {
        delete roomManager_1.rooms[roomCode];
      }
    }
    socket.leave(roomCode);
    roomManager_1.socketIndex.delete(socket.id);
    (0, roomManager_1.broadcastRoomState)(io, roomCode);
  });
  // 14. 断开连接处理
  socket.on('disconnect', (reason) => {
    (0, logger_1.logSocketDisconnect)(socket, reason);
    const session = roomManager_1.socketIndex.get(socket.id);
    if (session) {
      const { roomCode, userId } = session;
      const room = roomManager_1.rooms[roomCode];
      if (room) {
        const player = room.players.find((p) => p.userId === userId);
        if (player) {
          player.online = false;
          (0, gameEngine_1.addLog)(room, `⚡ 玩家 ${player.name} 掉线/网络中断`);
          (0, roomManager_1.broadcastRoomState)(io, roomCode);
        }
      }
      roomManager_1.socketIndex.delete(socket.id);
    }
  });
}
