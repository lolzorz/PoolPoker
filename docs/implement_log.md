# implement_log — PoolPoker 球霸扑克

> 实现步骤日志：每段一轮，记录 Agent 交互细节流程与最终改动。统一追加到文末，编号递增。

### 第1轮：项目初始化 — 台球抽牌卡牌对战原型 [2026-08-18]
- **输入**：搭建「朋友线下打台球聚会」的对战 Web 应用原型：基于 54 张扑克发牌、牌面映射台球球号，支持房间、发牌、销牌、胜负判定。
- **探索与决策**：采用 Node.js + Socket.IO 单文件 `server.js` + 原生 HTML/CSS/JS（`public/`）快速起步；牌面→球号映射定为 A\~K → 1\~13、小王 → 14、大王 → 15，固定含 8 号黑八。房间用 4 位数字码降低门槛。
- **最终改动**：
  - `server.js` — 新增：Socket.IO 服务，房间创建/加入、发牌、销牌、胜负判定逻辑。
  - `public/index.html` / `public/css/style.css` / `public/js/app.js` — 新增：游戏页面、样式、前端交互逻辑。
  - `config.yaml` / `deploy.sh` / `README.md` / `.gitignore` / `package.json` — 新增：配置、部署脚本、说明文档。
- **commit**：`485c4ab` / `04678ea`

### 第2轮：对局核心机制完善 — 全局赛况、置灰免打、自动/多人胜利 [2026-08-18]
- **输入**：完善对局体验——全局赛况显示球号、手牌自动置灰免打、自动与多人联合胜利判定；修正置灰球泄露其他玩家手牌信息的问题。
- **探索与决策**：胜利判定统一以「已打进球号集合」为准（`pocketedBallNumbers`），玩家手牌中未被打进的卡牌数归零即胜；已打进球号对应的手牌在 UI 置灰显示「已进球·无需打出」，既提示免打又不暴露他人手牌。
- **最终改动**：
  - `server.js` — 修改：完善胜利判定（自动/多人联合）、球号集合维护。
  - `public/index.html` / `public/js/app.js` / `public/css/style.css` — 修改：全局赛况球号显示、手牌置灰免打、胜利结算展示。
- **commit**：`e13488c` / `031b2f3`

### 第3轮：断线重连与暂离保护 [2026-08-18]
- **输入**：支持基于 `userId` 的断线重连，掉线玩家 30 秒内保留房间位置（后续放宽至 1 小时）；暂离玩家在 UI 标记「暂离」。
- **探索与决策**：玩家标识从 socket id 升级为持久化 `userId`（`localStorage` 生成 `u_随机串`），重连时按 `userId` 找回玩家；`config.yaml` 增加 `disconnect_timeout_ms`（默认 1 小时）。
- **最终改动**：
  - `server.js` — 修改：断线重连按 userId 定位、暂离保护、掉线标记。
  - `public/index.html` / `public/js/app.js` — 修改：userId 持久化、暂离态 UI。
  - `config.yaml` — 修改：新增 `disconnect_timeout_ms`。
- **commit**：`f02a571` / `4914229`

### 第4轮：击球顺序与 Continue 切牌提醒 [2026-08-18]
- **输入**：新增击球顺序显示与反向轮转逻辑，以及 Continue 提醒切牌功能；后续简化为仅在全局赛况展示击球顺序。
- **探索与决策**：击球顺序下局反向轮转（上一局顺序反转），上一局胜者轮转到首位优先击球；击球提醒收敛到全局赛况展示，去除多余提醒入口。
- **最终改动**：
  - `server.js` — 修改：击球顺序轮转计算（反转 + 胜者优先）。
  - `public/index.html` / `public/js/app.js` — 修改：击球顺序展示、Continue 提醒切牌；后续简化移除多余击球提醒。
- **commit**：`38d6446` / `e86e97b`

### 第5轮：意外进球与犯规罚抽 [2026-08-18]
- **输入**：新增「意外进球」选项——进球后可选择自己持有的球，去掉意外进球的自动罚牌，支持犯规罚抽牌并更新玩家手牌。
- **探索与决策**：意外进球记录到独立的 `accidentalBalls` 集合（不自动罚牌），与玩家销牌 `pocketedCards` 合并构成全局「已打进球号」；犯规则从牌堆 `pop` 一张罚给玩家。
- **最终改动**：
  - `server.js` — 修改：意外进球（`accidental_pocket`）去除自动罚牌、犯规罚抽逻辑。
  - `public/index.html` / `public/js/app.js` — 修改：意外进球选项、犯规交互与手牌更新。
- **commit**：`1d662ba` / `760469c` / `6121685`

### 第6轮：撤回进球与结算手牌明细 [2026-08-19]
- **输入**：添加撤回进球功能（底部提示文字优化）；结算弹窗展示所有玩家手牌明细。
- **探索与决策**：撤回进球把 `pocketedCards` 中的牌移回 `cards`；结算弹窗按「已消除 / 免打卡 / 未消除」三类展示每位玩家手牌。
- **最终改动**：
  - `server.js` — 修改：`retract_ball` 撤回逻辑。
  - `src/App.vue`（原 `public/js/app.js`）— 修改：撤回入口与底部提示。
  - `RetractBallModal.vue`（原结算相关）— 新增：撤回进球弹窗。
  - `VictoryModal.vue` — 修改：展示所有玩家手牌明细。
- **commit**：`0a41f1b` / `083f409`

### 第7轮：球色主题与星牌配色 [2026-08-19]
- **输入**：新增可配置球色主题（API + UI 选择），添加星牌（xingpai）品牌配色；后续调整星牌 4/12 号为粉色、5 号为红色，以及 5 号球默认配色微调。
- **探索与决策**：球色抽到 `ball_configs.json` 独立配置，服务端 `/api/ball-configs` 下发，前端下拉选择并生成 `--ball-N-hi/mid/lo` CSS 变量；球号 9\~15 用条纹样式区分。
- **最终改动**：
  - `ball_configs.json` — 新增：`default` / `xingpai` 两套 0\~15 号三段渐变配色。
  - `server.js` / `server/config.ts` — 修改：球色配置加载与 `/api/ball-configs` 接口。
  - `src/App.vue` / `src/components/RoomLobby.vue` / `src/styles/main.css` — 修改：球色选择 UI、CSS 变量、mini-ball 条纹样式。
- **commit**：`48d167e` / `a51eec6` / `65a8e92` / `f995e93` / `fc0aa19`

### 第8轮：前端工程化重构 — Vue3 + TS + Vite + Tailwind [2026-08-19]
- **输入**：升级前端工程架构至 Vue 3 + TypeScript + Vite，配置 PostCSS/Autoprefixer/Tailwind CSS；移除防窥遮盖功能；支持保存用户名下次自动填充；修复大厅输入框 placeholder 变形截断问题。
- **探索与决策**：原生 HTML/JS 拆分为 Vue 3 单文件组件（`src/components/`）+ `<script setup lang="ts">`；Tailwind 负责布局与玻璃拟态样式；`deploy.sh` 重命名为 `run.sh`。
- **最终改动**：
  - `src/App.vue` / `src/main.ts` / `src/components/*.vue` — 新增：Vue 组件化迁移。
  - `index.html` / `vite.config.ts` / `tsconfig.json` / `tsconfig.node.json` / `tailwind.config.js` / `postcss.config.mjs` — 新增：Vite/TS/Tailwind 工程配置。
  - `public/` 目录 — 删除：原生前端产物迁入 `src/`。
  - `src/styles/main.css` — 修改：移除防窥遮盖样式。
  - `src/composables/usePlayerProfile.ts`（后续拆分）— 修改：用户名 `localStorage` 持久化。
- **commit**：`89e2989` / `4cc4297` / `98a9b6e` / `a7b29bd` / `88e2c4f`

### 第9轮：业务逻辑抽离到 composables [2026-08-20]
- **输入**：把应用逻辑从组件解耦到 composables（`useGameRoom` / `usePlayerProfile` / `useSocket`）；优化服务端断线查找（socketId 反向索引 Map）。
- **探索与决策**：`App.vue` 中的 Socket 与房间逻辑抽到 `useGameRoom`；玩家资料持久化抽到 `usePlayerProfile`；Socket 连接管理抽到 `useSocket`。服务端用 `socketIndex: Map<socketId, {roomCode,userId}>` 取代遍历查找，O(1) 定位。
- **最终改动**：
  - `src/composables/useGameRoom.ts` / `usePlayerProfile.ts` / `useSocket.ts` — 新增：业务逻辑 composables。
  - `src/App.vue` — 修改：改为组装与调用 composables。
  - `server.js` — 修改：新增 `socketIndex` 反向索引。
- **commit**：`d2d844d` / `f198b95`

### 第10轮：Playwright E2E 测试与累计胜负 [2026-08-20]
- **输入**：初始化 Playwright 端到端测试；将计分替换为持久化胜场数（`wins`）并在游戏 UI 展示累计胜负。
- **探索与决策**：新增 `test:e2e` 脚本与 `playwright.config.ts`；玩家模型加 `wins` 字段，胜利时递增，大厅/赛况/结算弹窗展示「N 胜」。
- **最终改动**：
  - `e2e/poolpoker.spec.ts` / `playwright.config.ts` — 新增：端到端测试与配置。
  - `server.js` — 修改：胜利 `wins+1` 替代原计分。
  - `src/components/BilliardsTable.vue` / `RoomLobby.vue` / `VictoryModal.vue` — 修改：展示胜场数。
  - `src/types/game.ts` — 修改：Player 新增 `wins`。
  - `package.json` / `.gitignore` — 修改：`test:e2e` 脚本、测试产物忽略。
- **commit**：`84b33f4` / `34dd448`

### 第11轮：多人同时胜利与下局首击优先级 [2026-08-20]
- **输入**：支持多人同时胜利结算，击球触发的胜者优先展示；下一局首击顺序优先级（上局胜者轮转到首位）。
- **探索与决策**：`checkGameWinners` 返回所有有效手牌清空的玩家；`handleGameFinished` 把击球触发的胜者 `unshift` 到首位；`computeTurnOrder` 反转上局顺序后把胜者移到首位。
- **最终改动**：
  - `server.js` — 修改：多人胜利判定与结算、击球顺序胜者优先。
  - `src/components/VictoryModal.vue` — 修改：多人胜利展示（`共同清空有效手牌`）。
  - `e2e/poolpoker.spec.ts` — 修改：新增多人同时胜利测试。
- **commit**：`547b159`

### 第12轮：裁判代记模式 — 代理进球与罚抽 [2026-08-20]
- **输入**：新增代理记录模式，可为指定玩家记录进球/犯规（裁判代记）。
- **探索与决策**：新增 `referee_pocket_ball` / `referee_draw_penalty` 两个事件，按 `targetUserId` 定位目标玩家；进球找不到球号时回退为「全场已进球」记录；前端 `RefereePocketModal` / `RefereeFoulModal` 供选择目标玩家。
- **最终改动**：
  - `server.js` — 新增：`referee_pocket_ball` / `referee_draw_penalty` 事件。
  - `src/components/RefereePocketModal.vue` / `RefereeFoulModal.vue` — 新增：裁判代记弹窗。
  - `src/App.vue` / `src/components/BilliardsTable.vue` / `src/composables/useGameRoom.ts` — 修改：代记入口与处理。
  - `e2e/poolpoker.spec.ts` — 修改：裁判代记测试。
- **commit**：`e0b7da6`

### 第13轮：工程化优化 — 路径别名 / Biome / Husky / commitlint [2026-08-20]
- **输入**：工程 DX 优化——`@/` 路径别名、Biome linter、Husky pre-commit 钩子、commitlint commit-msg 钩子。
- **探索与决策**：`@/` → `src`、`@shared/` → `shared`（后续）；Biome 统一 lint/format；lint-staged 在提交时自动修复。
- **最终改动**：
  - `vite.config.ts` / `tsconfig.json` / `tailwind.config.js` — 修改：路径别名与配置。
  - `biome.json` / `.husky/pre-commit` / `commitlint.config.js` / `.husky/commit-msg` — 新增：lint/format 与 git 钩子。
  - `package.json` — 修改：lint/format/commitlint 脚本与依赖。
  - 大量 `src/**` — 修改：导入路径改用 `@/`、格式统一。
- **commit**：`4e25576` / `0d735c7`

### 第14轮：服务端 TypeScript 模块化与共享类型 [2026-08-21]
- **输入**：服务端模块化为 TypeScript，抽取 `shared/types`，清理代理文件。
- **探索与决策**：单文件 `server.js` 拆为 `index.ts` / `config.ts` / `logger.ts` / `pokerDeck.ts` / `gameEngine.ts` / `roomManager.ts` / `socketHandlers.ts`；前后端共享 `shared/types/game.ts` / `socket.ts`，删除旧的 `src/types` 与 `server.js`。
- **最终改动**：
  - `server/*.ts` — 新增：服务端模块化拆分。
  - `shared/types/game.ts` / `socket.ts` — 新增：共享类型（`src/types` 迁入并删除）。
  - `server.js` — 删除：单文件服务端。
  - `run.sh` / `package.json` / `tsconfig.json` / `vite.config.ts` — 修改：`tsx` 启动、`@shared` 别名、脚本调整。
- **commit**：`70d2483`

### 第15轮：移动端重连优化 — HTTP 快照与 Socket 参数调优 [2026-08-21]
- **输入**：优化移动端断线重连——HTTP 快速同步房间状态 + 调优 Socket.IO 参数；新增 `/api/rooms/:code` 快照接口。
- **探索与决策**：页面切回前台时先 `fetchLatestRoomState` 拉 `/api/rooms/:code` 快照立即恢复 UI，再触发 Socket 重连；Socket 客户端与 `pingTimeout/pingInterval` 参数调优以适配移动网络。
- **最终改动**：
  - `server/index.ts` — 新增：`/api/rooms/:code` HTTP 快照接口。
  - `server/roomManager.ts` — 修改：`getClientRoomState` 支持按 userId 查询（复用裁剪逻辑）。
  - `src/composables/useGameRoom.ts` — 新增：`fetchLatestRoomState` + `visibilitychange` 切前台同步。
  - `src/composables/useSocket.ts` — 修改：重连参数调优。
- **commit**：`d7d4e1b`

### 第16轮：进球/犯规记录合并与默认选中自己 [2026-08-21]
- **输入**：合并进球与犯规记录入口，默认选中当前玩家自己。
- **探索与决策**：删除独立的 `AccidentalPocketModal`，进球/犯规记录统一走 `RefereePocketModal` / `RefereeFoulModal`，打开时 `defaultUserId` 默认当前用户；服务端 `referee_pocket_ball` 自记时日志与本人销牌一致。
- **最终改动**：
  - `src/components/AccidentalPocketModal.vue` — 删除：意外进球独立弹窗（并入裁判代记）。
  - `server/socketHandlers.ts` — 修改：自记/代记日志区分。
  - `src/App.vue` / `src/components/RefereeFoulModal.vue` / `RefereePocketModal.vue` / `BilliardsTable.vue` / `src/composables/useGameRoom.ts` — 修改：记录入口合并、默认选中自己。
  - `e2e/poolpoker.spec.ts` — 修改：适配记录入口变更。
- **commit**：`33a20a9`

### 第17轮：Socket 日志优化 [2026-08-21]
- **输入**：优化 Socket 日志——带时间戳、关联用户名、断开原因。
- **探索与决策**：新增 `logger.ts` 抽离 `formatTimestamp` / `getSocketUsername` / `logSocketConnect` / `logSocketDisconnect`；用户名从 `socket.data` → `handshake.auth/query` → 房间成员逐级取。
- **最终改动**：
  - `server/logger.ts` — 新增：Socket 日志模块。
  - `server/index.ts` / `server/socketHandlers.ts` — 修改：接入日志。
  - `shared/types/socket.ts` / `src/composables/useSocket.ts` — 修改：连接携带 `auth.name/userId`。
- **commit**：`9c56339`

### 第18轮：会话安全 — sessionToken 防劫持 [2026-08-21]
- **输入**：引入 `sessionToken` 防止会话劫持，重连时校验身份。
- **探索与决策**：玩家创建/加入时生成 `sessionToken`（`crypto.randomUUID`），前端存 `localStorage`；`rejoin_room` 校验 `player.sessionToken === sessionToken`，不匹配拒绝。`shared/types/game.ts` 的 Player 增 `sessionToken`，`socket.ts` 增 `RejoinRoomPayload`。
- **最终改动**：
  - `server/socketHandlers.ts` — 修改：`sessionToken` 生成与 `rejoin_room` 校验。
  - `shared/types/game.ts` / `shared/types/socket.ts` — 修改：新增 `sessionToken` 字段与重连 payload。
  - `src/composables/useGameRoom.ts` — 修改：持久化并回传 `sessionToken`。
- **commit**：`c1f7219`

### 第19轮：随机数安全 — CSPRNG 替换 Math.random [2026-08-21]
- **输入**：洗牌与房间码改用 `node:crypto` CSPRNG，替换 `Math.random`。
- **探索与决策**：洗牌用 `crypto.randomInt(0, i+1)`、房间码用 `crypto.randomInt(1000, 10000)`；`pokerDeck.ts` / `gameEngine.ts` / `roomManager.ts` 引入 `node:crypto`。
- **最终改动**：
  - `server/pokerDeck.ts` — 修改：`shuffle` 用 `crypto.randomInt`。
  - `server/roomManager.ts` — 修改：`generateRoomCode` 用 `crypto.randomInt`。
  - `server/gameEngine.ts` — 修改：`addLog` id 用 `crypto.randomBytes`。
  - `playwright.config.ts` — 修改：测试配置微调。
- **commit**：`9d83e87`

### 第20轮：局末积分结算与规则弹窗 [2026-08-21]
- **输入**：新增局末积分结算——输家按剩余手牌扣分、赢家平分，结算弹窗展示每张未消除牌的罚分，并提供「积分计算规则」说明弹窗。
- **探索与决策**：`gameEngine.ts` 新增 `calculateHandScore`（大小王基数 1、其余 2，同 rank 组合倍乘）与 `handleGameFinished` 内的积分结算（输家 `totalScore` 扣分、赢家平分、余数归击球触发胜者），结果写 `room.lastRoundScores`；`shared/types/game.ts` 增 `RoundScoreEntry` 与 `totalScore`/`lastRoundScores` 字段；`VictoryModal` 展示本局积分变化、累计总分与每张剩余牌罚分（`cardPenaltyBase × rankCount`）；`App.vue` 内联积分规则弹窗。
- **最终改动**：
  - `server/gameEngine.ts` — 修改：`calculateHandScore` / `handleGameFinished` 积分结算。
  - `server/roomManager.ts` / `server/socketHandlers.ts` — 修改：下发 `totalScore` / `lastRoundScores`。
  - `shared/types/game.ts` — 修改：`RoundScoreEntry`、`Player.totalScore`、`Room.lastRoundScores`。
  - `src/App.vue` — 修改：积分规则弹窗（内联）。
  - `src/components/VictoryModal.vue` — 修改：积分变化、累计总分、单张罚分展示。
- **commit**：`150d669`（经 `38123ae` 合并）

### 第21轮：每局结算推送企业微信机器人 [2026-08-21]
- **输入**：新增「看板」——每局胜利结算后，把房间号与各成员积分推送到企业微信机器人。
- **探索与决策**：新增 `server/wecomWebhook.ts` 承载推送逻辑，`sendRoundResultToWecom(room)` 把「房间号 + 各成员本局得分变化（`+N/-N`）+ 累计积分」拼成文本消息（`msgtype: text`），POST 到企业微信机器人 Webhook（地址与提及成员先写死）；在 `gameEngine.ts` 的 `handleGameFinished` 结算完成后调用，异步推送、不阻塞结算流程；推送失败（HTTP 非 2xx / `errcode !== 0` / 异常）只打印 `⚠️ [WeCom]` 警告日志，不抛出、不影响对局。
- **最终改动**：
  - `server/wecomWebhook.ts` — 新增：企业微信结算推送（拼消息 + fetch POST + 错误告警）。
  - `server/gameEngine.ts` — 修改：`handleGameFinished` 结算后调用 `sendRoundResultToWecom`。
- **commit**：`ac2b2a2`

### 第22轮：机器人 Webhook 链接改为运行时配置 [2026-08-21]
- **输入**：机器人 Webhook 地址不写死，改为运行时通过设置页面配置。
- **探索与决策**：Webhook 地址抽到 `server/robotConfig.ts`（内存变量 + `get/set`），新增 `/api/robot-url`（GET 读 / POST 写）接口与 `/enter_robot` 静态设置页面（独立于 SPA），页面保存/清除后 `setRobotWebhookUrl` 更新内存值；`sendRoundResultToWecom` 推送前先 `getRobotWebhookUrl()` 检查，未配置则直接返回不发送；`index.ts` 启用 `express.json()` 以解析 POST body。链接仅存内存，服务重启后清空。
- **最终改动**：
  - `server/robotConfig.ts` — 新增：Webhook 链接内存配置（`getRobotWebhookUrl` / `setRobotWebhookUrl`）。
  - `server/index.ts` — 修改：`express.json()`、`/api/robot-url`（GET/POST）、`/enter_robot` 静态页面路由。
  - `server/wecomWebhook.ts` — 修改：改从 `robotConfig` 取链接，未配置跳过推送。
  - `public/enter_robot.html` — 新增：机器人链接设置页面（读取/保存/清除）。
- **commit**：`fb66860`

### 第23轮：手牌按球号排序，罚牌日志隐去点数花色 [2026-08-21]
- **输入**：手牌按球号升序排列；犯规罚抽的日志不再显示具体点数花色。
- **探索与决策**：手牌排序放在前端计算属性，新增 `sortedMyCards`（`[...cards].sort((a,b) => a.ballNumber - b.ballNumber)`），`App.vue` 手牌区改渲染 `sortedMyCards`，避免改动服务端 `cards` 数组本身；罚抽日志去掉 `[suit+rank]` 后缀，普通犯规与裁判代记两处统一为「罚抽 1 张扑克牌」。
- **最终改动**：
  - `src/composables/useGameRoom.ts` — 修改：新增 `sortedMyCards` 计算属性并导出。
  - `src/App.vue` — 修改：手牌区改渲染 `sortedMyCards`。
  - `server/socketHandlers.ts` — 修改：`draw_penalty` / `referee_draw_penalty` 罚抽日志去掉具体点数花色。
- **commit**：`9f3e9b4`

### 第24轮：开球进球记录 [2026-08-21]
- **输入**：新增「开球进球」记录——开球时入袋的球记为已进球，但不归入任何玩家手牌。
- **探索与决策**：沿用 `accidental_pocket` 的「全场已进球」思路，新增独立 `breakBalls` 数组（写入 `ServerRoom`，创建/开局/重开时清空）以区别于意外进球；`getPocketedBallNumbers` 把 `breakBalls` 并入全局已进球号并集，从而不影响胜负判定与前端置灰逻辑。新增 `break_pocket` 事件（payload `BreakPocketPayload`），去重入袋、记日志、判胜负。前端在 `RefereePocketModal` 里加「开球进球」切换按钮（`isBreakPocket`），选中后隐藏玩家选择、走独立的 `confirm-break` 事件，由 `useGameRoom.handleBreakPocketConfirm` 发 `break_pocket`。
- **最终改动**：
  - `shared/types/game.ts` — 修改：`ServerRoom` 新增 `breakBalls: number[]`。
  - `shared/types/socket.ts` — 修改：新增 `BreakPocketPayload` 与 `ClientToServerEvents.break_pocket`。
  - `server/gameEngine.ts` — 修改：`getPocketedBallNumbers` 并入 `breakBalls`。
  - `server/socketHandlers.ts` — 新增：`break_pocket` 事件处理器；创建/开局/重开处清空 `breakBalls`。
  - `src/components/RefereePocketModal.vue` — 修改：新增「开球进球」切换、`confirm-break` 事件、按钮禁用逻辑与开球描述框。
  - `src/composables/useGameRoom.ts` — 新增：`handleBreakPocketConfirm` 并导出。
  - `src/App.vue` — 修改：接入 `handleBreakPocketConfirm` 与 `@confirm-break`。
- **commit**：未提交（工作区改动）

### 第25轮：内存数据收敛 + 撤回改造为快照栈 [2026-08-22]
- **输入**：整理游戏进行用到的所有内存数据封装到一个结构体；撤回功能改为——每步操作后的新结构体放进一个总体记录数组，撤回时 pop 数组回到上一步；每局开始游戏时清空数组，数组为空时撤回无效果。
- **探索与决策**：
  - 将 `ServerRoom` 里散落的「进行态」字段收敛为 `GameState`（`shared/types/game.ts`）：`status` / `players[]`（`GamePlayerSnapshot`，仅含 `cards`/`pocketedCards`/`cardCount`/`activeCardCount`/`wins`/`isWinner`/`totalScore`）/ `deck` / `accidentalBalls` / `breakBalls` / `winners` / `turnOrder` / `lastTurnOrder` / `lastWinnerUserId` / `roundCount` / `lastRoundScores`。快照**不含 logs**（日志属审计记录不随撤回回退）与身份/连接/设置类字段（`id`/`userId`/`sessionToken`/`name`/`avatar`/`isHost`/`online`/`settings`）。
  - 新增 `server/gameState.ts` 承载快照：`snapshotGameState` / `restoreGameState`（深拷贝）、`recordGameStep`（操作后 push）、`undoGameStep`（pop 当前、回退到新栈顶）。采用「push 操作后状态」语义，`undoGameStep` 丢弃栈顶回退到再上一步，历史只剩基线（length ≤ 1）时返回 null 无效果。
  - 撤回权限定为「所有玩家」、前端交互定为「撤回上一步 + 确认框」，移除选牌弹窗（`RetractBallModal.vue` 删除），`RetractBallPayload` 去掉 `cardId`。
- **最终改动**：
  - `shared/types/game.ts` — 修改：新增 `GameState` / `GamePlayerSnapshot`；`ServerRoom` 增 `gameHistory: GameState[]`。
  - `shared/types/socket.ts` — 修改：`RetractBallPayload` 移除 `cardId`，仅留 `roomCode`。
  - `server/gameState.ts` — 新增：`snapshotGameState` / `restoreGameState` / `recordGameStep` / `undoGameStep`。
  - `server/socketHandlers.ts` — 修改：`create_room` 初始化 `gameHistory`；`start_game` 清空并 `recordGameStep` 播种发牌基线；`pocket_ball`/`draw_penalty`/`accidental_pocket`/`break_pocket`/`referee_pocket_ball`（两分支）/`referee_draw_penalty` 操作后 `recordGameStep`；`retract_ball` 改为 `undoGameStep` 并追加「已撤回到上一步操作 / 没有可撤回的操作」日志；`handleRestartRoom` 清空 `gameHistory`。
  - `src/composables/useGameRoom.ts` — 修改：`handleRetractConfirm(cardId)` 改为 `handleRetract()`（`window.confirm` 后发 `retract_ball`），移除 `showRetractModal`。
  - `src/App.vue` — 修改：撤回按钮改为 `@click="handleRetract"`，移除 `RetractBallModal` 引用。
  - `src/components/RetractBallModal.vue` — 删除：选牌撤回弹窗（被确认框交互取代）。
  - `e2e/poolpoker.spec.ts` — 修改：撤回用例改为验证「已撤回到上一步操作」日志。
- **验收**：`npm run build`（vue-tsc + vite）通过；变更文件 Biome 检查通过。
- **commit**：未提交（工作区改动）

### 第26轮：生产运行时兼容 Node 16 [2026-09-11]
- **输入**：上一轮提交把工具链整体升到 Node 24 / TS 5.8（`engines.node` 改成 `>=24.0.0`）。用户要求：部署 server 的目标主机即使只有 Node 16，生产运行时也要能跑起来，范围限定为「仅生产运行时（server 进程）」——`pnpm install` / `vite build` / `vue-tsc` / 单测等开发链路仍可留在 Node 24。
- **探索与决策**：
  - grep + `npm view <pkg> engines` 排查出两类阻塞点：①运行时 API——`server/config.ts` 的 `import.meta.dirname`（Node 20.11+/21.2+ 才有）、`server/wecomWebhook.ts` 两处全局 `fetch`（Node 18+ 才有）；②生产启动方式本身依赖 Node 18+——`pnpm start` 直接用 `tsx server/index.ts`，而 `tsx@4` 的 `engines.node` 是 `>=18.0.0`，光修好 API 不够，只要生产还靠 `tsx` 跑 `.ts`，Node16 主机就起不来。express（`>=0.10.0`）、socket.io（`>=10.2.0`）、socket.io-client（`>=10.0.0`）、js-yaml、`crypto.randomInt/randomUUID/randomBytes` 核实均兼容 Node16，未改动；`vite.config.ts`/`vitest.config.ts` 里的 `import.meta.dirname` 只在 Node24 构建阶段执行，不动。
  - `rootDir` 改为 `process.cwd()`：server 无论 dev（`tsx server/index.ts`）还是编译后生产运行都从仓库根目录启动（pnpm 脚本、`run.sh` 均先 `cd` 到项目根），`process.cwd()` 与原 `import.meta.dirname` 算出的根目录等价，且在 ESM 与编译后 CommonJS 下都合法（`import.meta` 在编译成 CommonJS 时会被 tsc 直接报错）。
  - `fetch` 替换方案对比：node-fetch v3 是 ESM-only，编译成 CommonJS 后 `require` 会报 `ERR_REQUIRE_ESM`；v2 虽兼容但没必要新增依赖——最终手写基于 `node:http`/`node:https` 的最小 `postJson(url, body)`，返回 `{ status, ok, json() }`（`json()` 走 `Promise.resolve(JSON.parse(data))`），使两处调用点 `res.ok`/`res.status`/`await res.json()` 完全不用改。
  - 生产启动脱离 `tsx`：新增独立 `tsconfig.server.json`（不 extend 根 `tsconfig.json`，避免继承 `moduleResolution: bundler`/`allowImportingTsExtensions` 等与 CommonJS 输出冲突的选项），把 `server/**/*.ts` + `shared/**/*.ts` 编译成 CommonJS 到 `dist-server/`；因 `rootDir` 设为 `.`，产物保留了 `server/` 子目录层级，实际入口是 `dist-server/server/index.js`（不是 `dist-server/index.js`）。根 `package.json` 是 `"type": "module"`，额外在 `dist-server/package.json` 写 `{"type":"commonjs"}` 覆盖，让 Node 把编译产物当 CommonJS 解析。`engines.node` 保持 `>=24.0.0` 不变——它描述的是 `pnpm install`/构建链路的要求，编译产物用裸 `node` 执行时根本不走这个检查。未改 `run.sh`/`webhook-deploy.sh`（不在本次范围内）。
- **最终改动**：
  - `server/config.ts` — 修改：`rootDir` 由 `path.resolve(import.meta.dirname, '..')` 改为 `process.cwd()`。
  - `server/wecomWebhook.ts` — 新增：基于 `node:http`/`node:https` 的 `postJson(url, body)` helper；两处 `sendRoundResultToWecom`/`sendCrashReportToWecom` 里的 `fetch(...)` 调用替换为 `postJson(...)`。
  - `tsconfig.server.json` — 新增：独立 tsc 配置（target ES2020、module CommonJS、moduleResolution Node、esModuleInterop、outDir `dist-server`、rootDir `.`），`include` server/shared，`exclude` `server/__tests__`。
  - `package.json` — 修改：新增 `build:server`（`tsc -p tsconfig.server.json && echo '{"type":"commonjs"}' > dist-server/package.json`）；`build` 追加 `&& pnpm run build:server`；`start` 改为 `pnpm run build && node dist-server/server/index.js`（不再用 `tsx`）；`dev:backend` 不变。
  - `.gitignore` — 修改：新增 `dist-server/`。
  - `AGENTS.md` — 修改：Commands 一节更新 `build`/`start` 说明，新增一条 Node16 生产运行时兼容性说明。
- **验收**：`pnpm exec tsc -p tsconfig.server.json` 编译无报错；`pnpm run build`（vue-tsc + vite build + build:server）在 Node22 全部通过；用 nvm 临时安装真实 Node 16.20.2，直接 `node dist-server/server/index.js` 启动，`curl /api/ball-configs`、`curl /api/robot-url`、`curl /`（dist 静态资源）均返回 200 且内容正常；切回 Node22 跑 `pnpm run test:unit`，18 个单测全部通过，确认 `process.cwd()` 改动无回归。
- **commit**：未提交（工作区改动）


