# overview — PoolPoker 球霸扑克

## 需求概述

实现「朋友线下打台球聚会」场景的实时多人在线对战 Web 应用：以 54 张扑克牌发牌、牌面映射台球球号（A\~K → 1\~13 号、小王 → 14 号、大王 → 15 号，固定包含 8 号黑八），玩家通过 4 位数字房间号创建/加入房间，开局发牌后按「进球 → 点击对应卡牌销牌」的方式逐步消去手牌，率先清空全部有效手牌者获胜。应用覆盖完整对战生命周期：房间大厅（昵称/头像/球色配置/发牌数调节）、断线重连与暂离保护、击球顺序轮转、销牌/撤回上一步（快照栈逐步回退）、犯规罚抽牌、意外进球/误进无关球、开球进球（不归入任何玩家手牌）、裁判代记（进球/犯规）、多人联合胜利结算与累计胜负/积分统计、每局结算自动推送企业微信机器人（Webhook 链接运行时配置），以及 Playwright 端到端测试与一键构建部署脚本。前端经 Vue3 + TS + Vite 重构，后端从单文件 `server.js` 演进为 TypeScript 模块化 + Socket.IO 实时同步，前后端共享 `shared/types` 类型定义。

---

## 架构设计

### 数据流

```
浏览器 (Vue 组件) → composables (useGameRoom/useSocket) → Socket.IO emit 事件
        ↓
   socketHandlers (14 个事件处理器，鉴权 + 状态变更)
        ↓
   gameEngine (胜负判定 / 积分结算 / 击球顺序)  ·  pokerDeck (牌库 + 洗牌)
        ↓
   roomManager (内存房间表 + 按玩家身份序列化 + broadcastRoomState)
        ↓
   room_updated 事件 → 各客户端 room 状态 → Vue 响应式渲染
```

- **前端**：Vue 3 + TypeScript + Vite + Tailwind CSS，业务逻辑收敛到三个 composable（`usePlayerProfile` / `useSocket` / `useGameRoom`），组件只做展示与事件转发。
- **后端**：Node.js + Express + Socket.IO（TypeScript，`tsx` 运行），房间状态全部保存在内存 `rooms: Record<string, ServerRoom>`。
- **共享层**：`shared/types/game.ts`（Card/Player/Room 等领域模型）与 `shared/types/socket.ts`（前后端 Socket 事件契约），两端复用同一类型，保证字段一致。
- **关键约束**：
  - 房间状态以 `ServerRoom`（服务端内部态，含 `deck`/`accidentalBalls` 等敏感字段）与 `Room`（下发客户端的裁剪态）两种形态存在；`getClientRoomState` 按「是否本人 / 房间是否 finished」裁剪未进球手牌 `cards`（防止泄露其他玩家手牌），而 `pocketedCards`（已消除卡牌）公开下发给所有玩家（在全局赛况显示「已消xxxx」）。
  - 撤回采用快照栈：`ServerRoom.gameHistory` 存每步操作后的 `GameState` 快照（深拷贝，不含日志），每步操作 `recordGameStep` push、撤回 `undoGameStep` pop 回退到上一步；每局 `start_game` 清空并播种发牌完成基线，历史只剩基线时撤回无效果；`gameHistory` 不下发客户端。
  - 身份校验：每个玩家持有 `sessionToken`（`crypto.randomUUID`），`rejoin_room` 重连必须校验 token，防止会话劫持。
  - 随机性统一用 `node:crypto` CSPRNG（洗牌 `crypto.randomInt`、房间码 `crypto.randomInt`、token `crypto.randomUUID`），不使用 `Math.random`。
  - 生产运行时兼容 Node 16：`server/` 与 `shared/` 的运行时代码禁止使用 Node 16 之后才有的全局 API（如 `import.meta.dirname`、全局 `fetch`）——`config.ts` 用 `process.cwd()` 定位仓库根目录，`wecomWebhook.ts` 用基于 `node:http`/`node:https` 手写的 `postJson` 替代全局 `fetch`。生产启动不依赖要求 Node ≥18 的 `tsx`：经 `tsconfig.server.json` 把 `server/` + `shared/` 编译为 CommonJS（`dist-server/`），用裸 `node dist-server/server/index.js` 启动。开发/构建链路（`pnpm install` / `vite build` / `vue-tsc` / `tsx watch`）仍要求 Node ≥24，两者互不影响。

### 目录结构

```
PoolPoker/
├── server/                  # 后端 (TypeScript)
│   ├── index.ts             # Express + Socket.IO 启动、静态托管、/api 路由
│   ├── config.ts            # config.yaml 与 ball_configs.json 加载
│   ├── logger.ts            # socket 连接/断开日志（时间戳 + 用户名）
│   ├── pokerDeck.ts         # 54 张牌库 + CSPRNG 洗牌
│   ├── gameEngine.ts        # 胜负判定 / 积分结算 / 击球顺序
│   ├── gameState.ts         # 游戏进行态快照 / 记录 / 撤回（gameHistory 快照栈）
│   ├── roomManager.ts       # 内存房间表、房间码生成、状态裁剪、广播
│   ├── wecomWebhook.ts      # 每局结算推送到企业微信机器人
│   ├── robotConfig.ts       # 机器人 Webhook 链接运行时配置（内存）
│   └── socketHandlers.ts    # 15 个 Socket 事件处理器
├── shared/types/            # 前后端共享类型
│   ├── game.ts              # Card/Player/Room/ServerRoom/BallConfig 等
│   └── socket.ts            # 事件 payload 与 Client/Server 事件接口
├── src/                     # 前端 (Vue 3 + TS + Vite)
│   ├── composables/         # usePlayerProfile / useSocket / useGameRoom
│   ├── components/          # RoomLobby/BilliardsTable/PokerCard/VictoryModal 等
│   ├── App.vue              # 页面组装与弹窗编排
│   └── styles/main.css
├── public/enter_robot.html  # 机器人 Webhook 链接设置页面（独立于 SPA）
├── e2e/poolpoker.spec.ts    # Playwright 端到端测试
├── ball_configs.json        # 球色主题配置（default / xingpai）
├── config.yaml              # 端口与房间默认设置
├── run.sh / webhook-deploy.sh  # 一键构建运行 / Webhook 自动部署
└── vite.config.ts / tsconfig.json / tsconfig.server.json / biome.json / commitlint.config.js
```

---

## 实现摘要

### 牌库与洗牌（`server/pokerDeck.ts`）

- `create54PokerDeck()` 生成标准 54 张牌库：52 张正牌（4 花色 × A\~K，`ballNumber` 1\~13）+ 小王（`suitType: joker-small`，球号 14，灰）+ 大王（`joker-big`，球号 15，金）。
- `shuffle()` Fisher-Yates 洗牌，随机源 `crypto.randomInt`（CSPRNG），返回新数组不改原数组。
- 每张 `Card` 含 `id`（`c_1`…）、`suit`（花色符号）、`suitType`、`color`（红/黑/金/灰）、`rank`、`ballNumber`。

### 游戏引擎（`server/gameEngine.ts`）

- `addLog`：追加对局日志（`zh-CN` 时间戳 + `crypto.randomBytes` id），保留最近 50 条。
- `getPocketedBallNumbers`：`accidentalBalls`（意外进球）、`breakBalls`（开球进球）与各玩家 `pocketedCards`（销牌）的球号并集，升序返回——全局「已打进球号」的唯一来源。
- `checkGameWinners`：仅 `status === 'playing'` 时判定，某玩家 `cards` 中未被已打进球号命中的「有效卡牌」数量为 0 即胜，支持多人同时胜利。
- `calculateHandScore`：结算输家剩余手牌积分——大小王基数 1、其余牌基数 2，同 rank 组合倍乘（n 张 = 基数之和 × n）。
- `handleGameFinished`：置 `finished`、胜者 `wins+1`、击球触发者优先排序、记录 `lastWinnerUserId`；随后做本局积分结算——每位输家 `totalScore` 扣剩余手牌分、赢家平分输家总分（余数归击球触发的胜者），结果写入 `room.lastRoundScores` 并打印结算日志；结算完成后调用 `sendRoundResultToWecom` 异步推送本局结果到企业微信机器人（不阻塞结算流程）。
- `computeTurnOrder`：计算下局击球顺序——无上一局顺序时随机洗牌；否则保留上一局在场玩家并补入新玩家 → 顺序反转 → 上一局胜者轮转到首位。

### 游戏进行态快照与撤回（`server/gameState.ts`）

- 将一局游戏的「进行态」收敛为 `GameState`（`shared/types/game.ts`）：`status` / `players[]`（`GamePlayerSnapshot`，仅含 `cards`/`pocketedCards`/`cardCount`/`activeCardCount`/`wins`/`isWinner`/`totalScore`）/ `deck` / `accidentalBalls` / `breakBalls` / `winners` / `turnOrder` / `lastTurnOrder` / `lastWinnerUserId` / `roundCount` / `lastRoundScores`；不含 `logs` 与身份/连接/设置类字段。
- `snapshotGameState` / `restoreGameState`：深拷贝打包 / 还原进行态；`recordGameStep` 把「操作后」状态 push 进 `ServerRoom.gameHistory`；`undoGameStep` pop 掉当前状态回退到上一步（历史只剩基线时无效果）。
- 撤回语义：`retract_ball` 不再按 `cardId` 精确撤牌，而是整体回退牌桌最近一步操作；日志属于审计记录不随快照回退，每次撤回额外追加一条日志。

### 企业微信结算推送（`server/wecomWebhook.ts` / `server/robotConfig.ts`）

- `wecomWebhook.ts`：`sendRoundResultToWecom(room)` 每局结算后把「房间号 + 各成员本局得分变化 + 累计积分」拼成文本，POST 到企业微信机器人 Webhook（`msgtype: text` + 固定提及成员列表）；未配置 Webhook 链接时直接返回不发送；HTTP 非 2xx / `errcode !== 0` / 异常时打印 `⚠️ [WeCom]` 警告日志，不抛出。
- `robotConfig.ts`：机器人 Webhook 链接运行时配置——内存变量 `robotWebhookUrl`，`getRobotWebhookUrl` / `setRobotWebhookUrl`（`trim` 后保存），服务重启即清空。

### 房间管理（`server/roomManager.ts`）

- `rooms` 内存房间表、`socketIndex` 为 `socketId → { roomCode, userId }` 反向索引（优化断线查找）。
- `generateRoomCode`：`crypto.randomInt(1000, 10000)` 生成 4 位数字房号，冲突时重试。
- `getClientRoomState`：把 `ServerRoom` 裁剪为下发客户端的 `Room`——未进球手牌 `cards` 仅当「目标用户本人」或「房间 finished」时下发，否则置空，从源头防止泄露其他玩家未进球手牌；而已消除的 `pocketedCards` 则向所有玩家下发；`logs` 只取最近 15 条。
- `broadcastRoomState`：遍历房间内 socket，按每个玩家的身份分别序列化下发，保证各客户端只见各自可见的数据。

### Socket 事件（`server/socketHandlers.ts`）

共 15 个事件处理器，均在内存态上做变更后 `broadcastRoomState`：

- `create_room` / `join_room` / `rejoin_room`：建房/加入/断线重连。均生成或校验 `sessionToken`（`crypto.randomUUID`）；`join_room` 按 `userId` 判重复，重复则复用玩家并刷新 `sessionToken`/`id`/`online`，新玩家若房间已在 `playing` 则从 `deck` 补发牌；`rejoin_room` 严格校验 `player.sessionToken === sessionToken`，不通过拒绝并返回「身份凭证失效」。
- `update_settings` / `start_game`：房主专属（`socketIndex` 反查 `userId === hostUserId`）。`start_game` 洗牌发牌、清空 `accidentalBalls`/`breakBalls`/`winners`/`lastRoundScores`、`roundCount+1`、按 `computeTurnOrder` 计算击球顺序；随后清空 `gameHistory` 并 `recordGameStep` 播种发牌完成基线。
- `pocket_ball`（销牌）/ `draw_penalty`（犯规罚抽）/ `accidental_pocket`（意外进球）/ `retract_ball`（撤回上一步）：本人手牌操作；罚抽时牌堆耗尽自动洗新牌堆补牌；前三个操作完成后 `recordGameStep` 记快照，`retract_ball` 调用 `undoGameStep` 回退上一步。
- `break_pocket`（开球进球）：记录开球时入袋的球号到 `breakBalls`（不归入任何玩家手牌），已进则跳过，随后判定胜负并 `recordGameStep`。
- `referee_pocket_ball` / `referee_draw_penalty`：裁判代记，按 `targetUserId` 定位目标玩家消卡/罚抽；进球找不到对应球号时回退为「全场已进球」记录（`accidentalBalls`）；完成后 `recordGameStep`。
- `request_restart` / `confirm_restart` / `restart_game`：重开流程，`handleRestartRoom` 重置牌堆/球号/胜负、玩家清空手牌回 `waiting`，并清空 `gameHistory`。
- `leave_room`：移出玩家，房主离开自动转让给首位玩家；空房删除。
- `disconnect`：`logSocketDisconnect` + 标记 `online=false` 并广播。

### 服务启动与配置（`server/index.ts` / `server/config.ts` / `server/logger.ts`）

- `config.ts`：读取 `config.yaml`（端口），缺失/异常回退默认 3000；加载 `ball_configs.json`（缺 `default` 或非法直接 `process.exit(1)`），导出 `isValidBallConfigKey` 校验。
- `index.ts`：Express 提供 `/api/ball-configs`（球色配置）、`/api/rooms/:code`（HTTP 快照查询房间状态，供移动端快速同步）、`/api/robot-url`（GET/POST 读取/设置机器人 Webhook 链接）、`/enter_robot`（机器人链接设置页面，独立于 SPA 的静态路由）等接口；托管 `dist` 静态资源并 SPA 回退；Socket.IO 配置 `pingTimeout 10000` / `pingInterval 5000`。
- `logger.ts`：`formatTimestamp` 统一时间戳格式；`getSocketUsername` 从 `socket.data` → `handshake.auth/query` → 房间成员逐级取用户名；`logSocketConnect`/`logSocketDisconnect` 打印带时间戳、用户、断开原因的日志。

### 前端 Composables（`src/composables/`）

- `usePlayerProfile`：玩家身份持久化——`userId`（首次生成 `u_随机串`）、`playerName`、`selectedAvatar`（6 个头像）、`selectedBallConfigKey` 均存 `localStorage`；`getFinalPlayerName` 空名回退「球友+随机三位数」。
- `useSocket`：Socket.IO 客户端初始化，`auth` 携带已存 name/userId，调优重连参数 `reconnectionAttempts: Infinity` / `reconnectionDelay: 300` / `reconnectionDelayMax: 1000` / `timeout: 5000`；封装 `on`/`off`/`emit`。
- `useGameRoom`：核心业务状态与操作——`room` 状态、`isHost`/`myInfo`/`turnOrderPlayers` 计算属性、`sortedMyCards`（本人手牌按球号升序排序的计算属性）、球色配置加载与 CSS 变量生成（`--ball-N-hi/mid/lo`）、`isCardDimmed`（球号已打进则置灰免打）；挂载时 `fetchLatestRoomState`（HTTP 快照）+ `visibilitychange` 切前台时快照同步 + Socket 重连；`setupSocketListeners` 监听 `connect`（自动 `rejoin_room`）、`room_updated`（更新 `room` 并胜利时放彩带）、`room_created`、`error_message`；对外暴露建房/加入/调发牌数/开局/销牌/撤回上一步（`handleRetract`，`window.confirm` 确认后发 `retract_ball`）/记录进球/记录犯规/重开/离开等全部 `handle*` 方法。

### 前端组件（`src/components/`）

- `RoomLobby`：登录（昵称/头像/球色）+ 创建/加入选项卡（4 位房间码数字输入）+ 等待大厅（成员列表/房主发牌数调节/开始发牌）。
- `BilliardsTable`：全局赛况——本局击球顺序、已打出球号列表（mini-ball 彩色球 + 条纹）、玩家赛况列表（胜场/剩余张数/暂离态/进度条/记录进球与犯规快捷按钮）。
- `PokerCard`：手牌卡牌（牌面 rank/suit + 台球球号），已打进球号覆盖「已进球·无需打出」遮罩。
- `VictoryModal`：结算弹窗——胜利者信息、图例、每位玩家三类手牌明细（已消除/免打卡/未消除，未消除牌按同 rank 倍乘标注 `-N分` 罚分）、本局积分变化（`+/-N分`）与累计总积分、房主「再来一局」。
- `RefereePocketModal` / `RefereeFoulModal`：记录进球/犯规弹窗，默认选中当前玩家自己，进球额外选择未打进球号，并可切换「开球进球」记录不归属任何玩家的入袋球。
- `RestartModal`：重开确认。
- `GameHeader` / `GameLogs`：房间码与局数标题栏、对局实况日志。
- `App.vue`：组装上述组件；手牌区含「规则」按钮弹出积分规则说明弹窗（牌基础分值/组合倍率/结算方式，内联在 App.vue）。

### 配置文件与主题（`ball_configs.json` / `config.yaml`）

- `ball_configs.json`：多套球色主题（`default` / `xingpai`），每套含 0\~15 号球的三段渐变配色（`[hi, mid, lo]`）；xingpai 4/12 号粉色、5 号红色（星牌真实配色）。
- `config.yaml`：`app_name`、`port`、`room.default_cards_per_player`（默认 5）、`room.max_players`（8）、`room.disconnect_timeout_ms`（默认 1 小时）。

### 工程化与测试

- 构建链：Vite + `vue-tsc` 类型检查前端；`server/` + `shared/` 另经 `tsconfig.server.json`（`tsc`，target ES2020/CommonJS）编译到 `dist-server/`，生产环境用裸 `node dist-server/server/index.js` 启动（兼容 Node 16，不依赖 `tsx`）；开发态 `dev:backend` 仍用 `tsx watch` 直接跑 TS。`@/` 指向 `src`、`@shared/` 指向 `shared` 的路径别名；Biome 做 lint/format，Husky `pre-commit` + lint-staged、`commit-msg` + commitlint（conventional commits）。
- `e2e/poolpoker.spec.ts`：Playwright 端到端测试，覆盖玩家资料持久化、多人房间同步、销牌/置灰/意外进球/撤回/罚牌/重开、累计胜负、多人同时胜利与下局首击顺序、裁判代记等全流程。

---

## 涉及文件清单

| 文件路径 |
|----------|
| `server/index.ts`（Express + Socket.IO 启动、`/api/ball-configs`、`/api/rooms/:code` 快照接口、静态托管） |
| `server/config.ts`（config.yaml / ball_configs.json 加载、`isValidBallConfigKey`；`rootDir` 用 `process.cwd()` 定位，兼容 Node 16 生产运行时） |
| `server/logger.ts`（socket 连接/断开日志，时间戳 + 用户名） |
| `server/pokerDeck.ts`（54 张牌库、CSPRNG 洗牌） |
| `server/gameEngine.ts`（胜负判定、积分结算、击球顺序） |
| `server/gameState.ts`（游戏进行态快照、记录、撤回 gameHistory 栈） |
| `server/wecomWebhook.ts`（每局结算推送企业微信机器人；`postJson` 基于 `node:http`/`node:https` 手写实现，替代全局 `fetch` 以兼容 Node 16） |
| `server/robotConfig.ts`（机器人 Webhook 链接运行时配置） |
| `server/roomManager.ts`（内存房间表、房间码生成、状态裁剪防泄露、广播） |
| `server/socketHandlers.ts`（15 个 Socket 事件处理器、sessionToken 校验） |
| `shared/types/game.ts`（Card/Player/Room/ServerRoom/GameState/GamePlayerSnapshot/RoundScoreEntry/BallConfig 等） |
| `shared/types/socket.ts`（事件 payload 与 Client/Server 事件接口） |
| `src/composables/usePlayerProfile.ts` / `useSocket.ts` / `useGameRoom.ts` |
| `src/App.vue`（页面组装、积分规则弹窗） |
| `src/components/RoomLobby.vue` / `BilliardsTable.vue` / `PokerCard.vue` / `VictoryModal.vue` / `RefereePocketModal.vue` / `RefereeFoulModal.vue` / `RestartModal.vue` / `GameHeader.vue` / `GameLogs.vue` |
| `public/enter_robot.html`（机器人 Webhook 链接设置页面） |
| `src/styles/main.css`（玻璃拟态、mini-ball 球色、条纹样式） |
| `e2e/poolpoker.spec.ts`（Playwright 端到端测试） |
| `ball_configs.json`（default / xingpai 球色主题） |
| `config.yaml`（端口、房间默认设置） |
| `run.sh`（一键构建运行）/ `webhook-deploy.sh`（Webhook 自动部署） |
| `vite.config.ts` / `tsconfig.json` / `tsconfig.server.json`（server/shared 编译为 CommonJS，供 `dist-server/` 生产运行）/ `tailwind.config.js` / `postcss.config.mjs` / `biome.json` / `commitlint.config.js` / `.husky/` |
| `package.json`（`build` 含 `build:server`；`start` 用裸 `node dist-server/server/index.js` 而非 `tsx`） |

---

## 专题文档索引

| 文档 | 内容 |
|------|------|
| [implement_log.md](implement_log.md) | 实现步骤日志（按轮次记录需求、探索与决策、最终改动、commit） |
