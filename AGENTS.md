# AGENTS.md

This file provides project context, architecture guidelines, and operational procedures for AI coding agents working with code in this repository.

## Project

PoolPoker (球霸扑克) — a real-time multiplayer web & Wear OS game for offline pool nights. 54 poker cards are dealt; card ranks map to pool ball numbers (A–K → 1–13, small joker → 14, big joker → 15, always including the 8-ball). Players create/join rooms via a 4-digit numeric code, then "pocket" balls by tapping the matching card to clear their hand. First to clear all valid cards wins.

## Commands

```bash
nvm use               # switch Node.js version specified in .nvmrc
pnpm install          # install dependencies
pnpm run dev          # run backend (tsx watch) + frontend (Vite HMR) concurrently
pnpm run dev:backend  # backend only, watch mode (server/index.ts, port 3000)
pnpm run dev:frontend # Vite dev server only (port 5173, proxies /socket.io → :3000)
pnpm run build        # vue-tsc type-check + Vite production build → dist/ + server/shared compile → dist-server/
pnpm run build:server # tsc -p tsconfig.server.json (server/ + shared/ → CommonJS JS in dist-server/, Node 16-safe)
pnpm start            # pnpm run build && node dist-server/server/index.js
pnpm run preview      # serve the built dist/
pnpm run test:unit    # Vitest unit tests for server domain logic
pnpm run test:e2e     # Playwright end-to-end tests (single chromium project)
pnpm run lint         # biome check .
pnpm run format       # biome format --write .
```

- **Run unit tests**: `pnpm run test:unit` or `pnpm run test:unit:watch` (test files located in `server/__tests__/*.spec.ts`).
- **Run a single Playwright test**: `pnpm exec playwright test -g "<test name>"` (spec is `e2e/poolpoker.spec.ts`).
- The e2e config auto-starts the server via `pnpm start` (reuses an existing server on `http://127.0.0.1:3000`).
- **Husky** runs on commit: `pre-commit` → `pnpm exec vue-tsc --noEmit` + `pnpm exec lint-staged` (biome); `commit-msg` → commitlint (conventional commits required).
- Unit tests use **Vitest** for fast deterministic domain logic testing. Playwright is used for E2E tests.
- **Production runtime targets Node 16.** `pnpm install`/`pnpm run build` require Node ≥24 (per `engines.node`), but the compiled production server (`dist-server/server/index.js`, built by `pnpm run build:server` via `tsconfig.server.json`) only uses Node 16-compatible runtime APIs and is started with plain `node` (no `tsx`, which itself requires Node ≥18). This lets the build run on a modern Node toolchain while the deployed long-running process runs on a Node 16 host. `dev:backend` still uses `tsx watch` and is unaffected (dev-only).

## Architecture

Multi-client architecture supporting Web browsers, Android Phone Companion, and native Wear OS watches:

```
Browser (Vue 3 components) / Wear OS (:wear-app) / Companion (:phone-companion)
  → Socket.IO emit / Data Layer API (contract in shared/types/socket.ts & :shared-models)
server/socketHandlers.ts  →  gameEngine.ts / pokerDeck.ts / roomManager.ts
  → broadcastRoomState → room_updated (multi-socket per userId) → Reactive UI re-render
```

- **Web Frontend** (`src/`): Vue 3 + TypeScript + Vite + Tailwind CSS. All business logic lives in three composables (`useGameRoom`, `useSocket`, `usePlayerProfile`); components (`src/components/*.vue`) handle presentation + events.
- **Android & Wear OS** (`android/`):
  - `:shared-models`: Kotlin data models (`WearSyncRoomPayload`, `WearActionPayload`) and DataLayer contracts.
  - `:phone-companion`: Android phone companion service using Wearable DataLayer & Socket.IO.
  - `:wear-app`: Native Wear OS app built with Jetpack Compose for Wear OS (Single-Activity + `SwipeToDismissBox`, modularized UI in `com.poolpoker.wear.ui`: `GameCardScreen`, `WearMainGameContent`, `WearModalScreens`, `WearSingleCardItem`, `BilliardBallBadge`, `WearDirectConnectScreen`).
- **Backend** (`server/`): Node.js + Express + Socket.IO, run via `tsx`. All room state is held in-memory in `roomManager.ts` (`rooms: Record<string, ServerRoom>`). `socketHandlers.ts` is the single mutation entry point.
- **Shared** (`shared/types/`): `game.ts` (domain models) and `socket.ts` (event contract). Both frontend and backend import these types to keep fields in sync.

Path aliases (defined in both `tsconfig.json` and `vite.config.ts`): `@/` → `src/`, `@shared/` → `shared/`.

## Key Constraints & Invariants

These are non-obvious and must be preserved when editing:

- **Two room shapes.** `ServerRoom` holds server-internal fields (`deck`, `accidentalBalls`, `lastWinnerUserId`, `lastTurnOrder`); `Room` is the sanitized client view. `getClientRoomState` (in `roomManager.ts`) clips `cards` to only the requesting user (or everyone once the room is `finished`) to prevent leaking active hand cards, while `pocketedCards` (eliminated cards) are public to all players so everyone can see the "已消xxxx" status. Never add a sensitive field to the client view without clipping it here.
- **Multi-Socket Broadcast per `userId`.** `broadcastRoomState` (in `roomManager.ts`) resolves socket IDs to `userId` using `socketIndex.get(socketId)?.userId`. This allows multiple sockets sharing the same `userId` (e.g. phone browser + Wear OS watch) to receive the private player hand simultaneously.
- **Identity & rejoin security.** Players have a persistent `userId` (client-generated, stored in `localStorage` on Web and `SharedPreferences` on Wear OS / Android) plus a per-session `sessionToken` (`crypto.randomUUID`). `rejoin_room` must verify `player.sessionToken === sessionToken` or reject with an "身份凭证失效" error. `SharedPreferences` persistence ensures re-entering a room after app restart/re-install restores the existing player hand.
- **CSPRNG only.** All randomness uses `node:crypto` (`crypto.randomInt` for shuffle/room codes, `crypto.randomUUID` for tokens). Never use `Math.random`.
- **Win condition is ball-number-based, not card-based.** The global "already-pocketed ball numbers" set is the union of `accidentalBalls` + every player's `pocketedCards` (`getPocketedBallNumbers`). A player wins when none of their remaining cards map to an unpocketed ball number. The UI greys out (dims) cards whose ball number is already pocketed ("已进球·无需打出") — a deliberate design that shows "no need to play" without revealing other hands.
- **Host authority.** `update_settings` and `start_game` are host-only; the host is resolved via the `socketIndex` reverse index (`socketId → { roomCode, userId }`). On host leave, hosting transfers to the first remaining player; empty rooms are deleted.
- **Wear OS Swipe-to-Dismiss Navigation.** Sub-screens in Wear OS (`WearFoulModalScreen`, `WearPocketModalScreen`) must be wrapped with `SwipeToDismissBox` and `BackHandler` in Single-Activity scope. Swiping back or pressing hardware back closes the active modal and returns to `WearMainGameContent` ("返回上一级"), aligning with the cancel button without popping the Activity to watch desktop.
- **Local Domain Configuration.** Server URLs for Android/Wear OS are loaded from `android/gradle.properties.local` (`POOLPOKER_SERVER_URL`, git-ignored) and injected via `BuildConfig.SERVER_URL`.

## Configuration

- `config.yaml` — server runtime settings: `port` (default 3000), `room.default_cards_per_player` (5), `room.max_players` (8), `room.disconnect_timeout_ms` (1h). Loaded by `server/config.ts`; missing/invalid values fall back to defaults.
- `ball_configs.json` — ball color themes (`default`, `xingpai`), each mapping ball numbers 0–15 to a `[hi, mid, lo]` gradient. Served via `GET /api/ball-configs`; missing/invalid `default` causes `process.exit(1)`.
- `android/gradle.properties.local` — local environment properties for Android/Wear OS (`POOLPOKER_SERVER_URL`).

## HTTP API (Express, `server/index.ts`)

- `GET /api/ball-configs` — ball color themes.
- `GET /api/rooms/:code?userId=...` — HTTP snapshot of sanitized room state (used by clients for fast re-sync on reconnect/tab-foreground). 404 if the room doesn't exist.

## Docs

- `docs/overview.md` is the authoritative deep-dive: full data-flow diagram, per-file responsibilities, and implementation history.
- `docs/wear_app_architecture.md` covers the native Wear OS app architecture, `com.poolpoker.wear.ui` module breakdown, and swipe-to-dismiss gesture navigation rules.
- `docs/implement_log.md` records round-by-round implementation decisions. Consult these before making architectural changes; keep them in sync for substantive work.
