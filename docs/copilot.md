# 🧠 MASTER GITHUB COPILOT GUIDE

## Embedded Real-Time Communication SDK (Product Build)

Paste this at the top of files, or in Copilot Chat, or as a comment block before generating code.

---

## 📋 CHANGELOG: What Has Been Built

### Overview

We are building a **production-grade, multi-tenant backend API** for an embedded real-time communication platform. Think of it as "Stripe for meetings" or "Auth0 for calls" - infrastructure that SaaS products can embed to add video/audio calling capabilities.

---

### ✅ COMPLETED WORK

#### 1. **Prisma Schema & Database Architecture**

**File:** `apps/api/prisma/schema.prisma`

**What was done:**
- Defined PostgreSQL as the database provider
- Created two core models: `App` (tenant) and `Room`
- Established a one-to-many relationship: One App can have many Rooms
- Added cascade delete: When an App is deleted, all its Rooms are deleted

**Why:**
- PostgreSQL provides ACID compliance, reliability, and scalability
- Prisma gives us type-safe database queries and automatic migrations
- The schema enforces multi-tenancy at the database level

**Schema Details:**
```prisma
model App {
  id        String   @id @default(cuid())  // Unique tenant identifier
  name      String                          // Tenant display name
  secret    String   @unique               // API secret for authentication
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  rooms     Room[]                          // One-to-many relation
}

model Room {
  id              String   @id @default(cuid())
  name            String
  maxParticipants Int      @default(2)      // MVP: 2 participants max
  appId           String                     // Foreign key to App
  app             App      @relation(...)   // Enforces tenant ownership
}
```

---

#### 2. **Database Client Singleton**

**Files:**
- `apps/api/src/database/client.ts`
- `apps/api/src/database/index.ts`

**What was done:**
- Created a Prisma client singleton to ensure a single database connection pool
- Added connection/disconnection helpers for server lifecycle
- Implemented hot-reload safety (prevents multiple clients in development)

**Why:**
- Single connection pool prevents database connection exhaustion
- Graceful shutdown ensures no orphaned connections
- Hot-reload safety prevents memory leaks during development

**Key Code:**
```typescript
// Singleton pattern with hot-reload protection
export const prisma: PrismaClient = globalThis.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}
```

---

#### 3. **Configuration Management**

**File:** `apps/api/src/config/index.ts`

**What was done:**
- Added `DATABASE_URL` configuration for PostgreSQL connection
- Added environment validation for production deployments
- Centralized all configuration in one place

**Why:**
- Environment-based configuration follows 12-factor app principles
- Validation prevents deploying with missing critical config
- Single source of truth for all settings

**Environment Variables:**
| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `HOST` | Server host | 0.0.0.0 |
| `DATABASE_URL` | PostgreSQL connection string | localhost |
| `JWT_SECRET` | Secret for signing JWTs | dev-secret |
| `JWT_EXPIRES_IN` | Default token expiration | 1h |

---

#### 4. **App (Tenant) Module - Prisma Migration**

**Files:**
- `apps/api/src/modules/app/app.service.ts` - Business logic
- `apps/api/src/modules/app/app.routes.ts` - HTTP routes
- `apps/api/src/modules/app/app.types.ts` - TypeScript types
- `apps/api/src/modules/app/app.schema.ts` - Request validation
- ~~`apps/api/src/modules/app/app.storage.ts`~~ - **DELETED** (was in-memory)

**What was done:**
- Converted all service functions from synchronous to **async**
- Replaced in-memory storage with Prisma database queries
- Updated route handlers to await async service calls
- Re-exported Prisma's `App` type for internal use

**Why:**
- Database operations are inherently async
- Prisma provides type-safe queries
- Data persists across server restarts

**API Endpoints:**
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/apps` | Create new tenant | No |
| GET | `/apps` | List all tenants | No |
| GET | `/apps/:appId` | Get single tenant | No |

**Service Functions:**
```typescript
// All functions are now async and use Prisma
async function createApp(input): Promise<CreateAppResponse>
async function getAppById(appId): Promise<GetAppResponse>
async function listApps(): Promise<GetAppResponse[]>
async function validateAppCredentials(appId, secret): Promise<App | null>
async function appExists(appId): Promise<boolean>
```

---

#### 5. **Room Module - Prisma Migration**

**Files:**
- `apps/api/src/modules/room/room.service.ts` - Business logic
- `apps/api/src/modules/room/room.routes.ts` - HTTP routes
- `apps/api/src/modules/room/room.types.ts` - TypeScript types
- `apps/api/src/modules/room/room.schema.ts` - Request validation
- ~~`apps/api/src/modules/room/room.storage.ts`~~ - **DELETED** (was in-memory)

**What was done:**
- Converted all service functions to async
- Replaced in-memory storage with Prisma queries
- Updated `authenticateApp()` helper to be async
- Added `deleteRoom()` function
- Changed default `maxParticipants` from 100 to **2** (MVP limit)

**Why:**
- Rooms must persist in the database
- MVP focuses on 1:1 calls (2 participants max)
- Tenant isolation is enforced at query level

**API Endpoints:**
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/rooms` | Create room | x-app-id, x-app-secret |
| GET | `/rooms` | List tenant's rooms | x-app-id, x-app-secret |
| GET | `/rooms/:roomId` | Get single room | x-app-id, x-app-secret |

**Tenant Isolation:**
```typescript
// Every room query is scoped to the authenticated app
const rooms = await prisma.room.findMany({
  where: { appId },  // Only rooms for this tenant
  orderBy: { createdAt: 'desc' },
});
```

---

#### 6. **Token Module - Prisma Migration**

**Files:**
- `apps/api/src/modules/token/token.service.ts` - JWT generation
- `apps/api/src/modules/token/token.routes.ts` - HTTP routes
- `apps/api/src/modules/token/token.types.ts` - TypeScript types
- `apps/api/src/modules/token/token.schema.ts` - Request validation

**What was done:**
- Updated to use async room lookup
- Token generation now validates room exists in database
- Enforces room-to-tenant ownership

**Why:**
- Tokens must reference real rooms
- Prevents token generation for non-existent rooms
- Maintains tenant isolation

**API Endpoint:**
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/rooms/:roomId/token` | Generate access token | x-app-id, x-app-secret |

**Token Claims (JWT Payload):**
```typescript
{
  appId: string,      // Tenant identifier
  roomId: string,     // Room identifier
  userId: string,     // User identifier (provided by tenant)
  role: 'host' | 'participant' | 'viewer',
  iat: number,        // Issued at
  exp: number         // Expiration (default: 1 hour)
}
```

---

#### 7. **Server Bootstrap Updates**

**File:** `apps/api/src/server/index.ts`

**What was done:**
- Added database connection on server start
- Added graceful shutdown with database disconnection
- Added config validation before startup

**Why:**
- Server must wait for database connection before accepting requests
- Graceful shutdown prevents connection leaks
- Early validation catches configuration errors

**Lifecycle:**
```
1. Validate configuration
2. Connect to database
3. Start Fastify server
4. Accept requests
   ...
5. SIGTERM/SIGINT received
6. Stop accepting requests
7. Disconnect from database
8. Exit
```

---

#### 8. **Docker Compose for PostgreSQL**

**File:** `infra/docker/docker-compose.yml`

**What was done:**
- Added PostgreSQL 15 service
- Configured persistent volume for data
- Set default credentials for development

**Why:**
- Easy local development setup
- Consistent environment across team
- Data persists across container restarts

**Usage:**
```bash
cd infra/docker
docker-compose up -d
```

**Connection String:**
```
postgresql://postgres:postgres@localhost:5432/rtc_platform?schema=public
```

---

#### 9. **Package.json Updates**

**File:** `apps/api/package.json`

**What was done:**
- Added Prisma dependencies (`prisma`, `@prisma/client`)
- Added database scripts (`db:generate`, `db:migrate`, `db:push`, `db:studio`)
- Added `fastify-plugin` for middleware encapsulation

**Scripts:**
```json
{
  "db:generate": "prisma generate",
  "db:migrate": "prisma migrate dev",
  "db:push": "prisma db push",
  "db:studio": "prisma studio"
}
```

---

#### 10. **App Auth Middleware (Centralized Authentication)**

**Files:**
- `apps/api/src/middleware/app-auth.ts` - Middleware plugin
- `apps/api/src/middleware/index.ts` - Exports

**What was done:**
- Created a Fastify plugin that validates `x-app-id` and `x-app-secret` headers
- Attaches authenticated `App` object to `request.app`
- Extended FastifyRequest type declaration
- Removed duplicate `authenticateApp()` functions from routes

**Why:**
- **DRY**: Authentication logic in one place
- **Cleaner routes**: Handlers just use `request.app.id`
- **Required for signaling**: WebSocket server will reuse this
- **Type safety**: `request.app` is properly typed

**Usage in routes:**
```typescript
// Before (duplicated in every route file)
async function authenticateApp(headers) { ... }
const appId = await authenticateApp(request.headers);

// After (centralized middleware)
await fastify.register(appAuth);
// request.app is now available in all handlers
const room = await createRoom(request.app.id, request.body);
```

**Request type extension:**
```typescript
declare module 'fastify' {
  interface FastifyRequest {
    app: App;  // Authenticated tenant
  }
}
```

---

#### 11. **Token Claims: Added jti (JWT ID)**

**Files:**
- `apps/api/src/modules/token/token.types.ts` - Added jti to TokenClaims
- `apps/api/src/modules/token/token.service.ts` - Generate jti on token creation
- `apps/api/src/shared/utils.ts` - Added generateJti() function

**What was done:**
- Added `jti` (JWT ID) claim to all tokens
- Uses UUID v4 for guaranteed uniqueness
- Updated token verification to include jti

**Why:**
- **Future token revocation**: Can invalidate specific tokens
- **Kick users**: Revoke token to force disconnect
- **Enterprise readiness**: Standard JWT claim
- **No Redis needed yet**: Just storing the claim for now

**Token structure now:**
```typescript
{
  jti: "550e8400-e29b-41d4-a716-446655440000",  // NEW
  appId: "clx...",
  roomId: "clx...",
  userId: "user-123",
  role: "host",
  iat: 1707500000,
  exp: 1707503600
}
```

---

#### 12. **Error Taxonomy (Complete)**

**File:** `apps/api/src/shared/errors.ts`

**What was done:**
- Added `toJSON()` method to AppError for consistent API responses
- Added `RateLimitError` (429) for future rate limiting
- Added `InternalError` (500) for unexpected errors
- Added `ErrorCodes` constant for SDK consumption
- Added proper stack trace capture

**Complete error taxonomy:**
| Error Class | Status | Code | When to use |
|-------------|--------|------|-------------|
| `ValidationError` | 400 | VALIDATION_ERROR | Invalid input data |
| `UnauthorizedError` | 401 | UNAUTHORIZED | Missing/invalid credentials |
| `ForbiddenError` | 403 | FORBIDDEN | Authenticated but not allowed |
| `NotFoundError` | 404 | NOT_FOUND | Resource doesn't exist |
| `ConflictError` | 409 | CONFLICT | Resource already exists |
| `RateLimitError` | 429 | RATE_LIMIT_EXCEEDED | Too many requests |
| `InternalError` | 500 | INTERNAL_ERROR | Unexpected server error |

**SDK error consumption:**
```typescript
import { ErrorCodes } from '@rtc-platform/shared';

sdk.on('error', (err) => {
  if (err.code === ErrorCodes.UNAUTHORIZED) {
    // Re-authenticate
  }
});
```

---

#### 13. **WebSocket Signaling Server**

**Files:**
- `apps/signaling/package.json` - Dependencies & scripts
- `apps/signaling/tsconfig.json` - TypeScript config
- `apps/signaling/src/types.ts` - Message protocol types
- `apps/signaling/src/room-manager.ts` - In-memory room/peer tracking
- `apps/signaling/src/server.ts` - WebSocket server implementation
- `apps/signaling/src/index.ts` - Entry point

**What was done:**
- Created a WebSocket signaling server using native `ws` library (NO Socket.IO)
- Implemented JWT token validation on room join
- Built in-memory room manager with peer tracking
- Added heartbeat ping/pong for dead connection detection
- Implemented full WebRTC signaling message relay (SDP offer/answer, ICE candidates)
- Added peer join/leave notifications with initiator flag
- Enforced max 2 participants per room (MVP limit)

**Why:**
- Signaling is required for WebRTC peer-to-peer connection establishment
- Native `ws` gives maximum control and minimal overhead
- Heartbeat detects and cleans up disconnected clients
- In-memory state is sufficient (signaling data is ephemeral)
- Token validation ensures only authorized users can join rooms

**Message Protocol (LOCKED - SDK will consume):**

| Direction | Message Type | Description |
|-----------|--------------|-------------|
| Client → Server | `join` | Join a room with JWT token |
| Client → Server | `offer` | Send SDP offer |
| Client → Server | `answer` | Send SDP answer |
| Client → Server | `ice` | Send ICE candidate |
| Client → Server | `leave` | Leave the room |
| Server → Client | `joined` | Join confirmed with existing peers |
| Server → Client | `peer-joined` | Another peer joined (includes isInitiator) |
| Server → Client | `peer-left` | Another peer left |
| Server → Client | `offer` | Relayed SDP offer |
| Server → Client | `answer` | Relayed SDP answer |
| Server → Client | `ice` | Relayed ICE candidate |
| Server → Client | `error` | Error with code and message |

**Error Codes:**
| Code | Description |
|------|-------------|
| `INVALID_MESSAGE` | Malformed or unknown message type |
| `INVALID_TOKEN` | JWT verification failed |
| `TOKEN_EXPIRED` | JWT has expired |
| `ROOM_FULL` | Room already has max participants |
| `NOT_IN_ROOM` | Action requires being in a room |
| `ALREADY_IN_ROOM` | Already joined a room |

**Room Manager:**
```typescript
// Tracks peers and rooms in memory
class RoomManager {
  registerPeer(socketId): void      // Called on connect
  joinRoom(socketId, roomId, userId, appId): JoinResult
  leaveRoom(socketId): LeaveResult | null
  getRoomPeers(socketId): string[]  // Other socket IDs in room
  getPeer(socketId): Peer | undefined
  cleanup(socketId): void           // Called on disconnect
}
```

**WebSocket Flow:**
```
1. Client connects → Server assigns socketId, starts heartbeat
2. Client sends `join` with JWT token
3. Server validates token, checks room capacity
4. Server sends `joined` with list of existing peers
5. Server notifies existing peers with `peer-joined` (isInitiator: true)
6. New peer creates offer, sends `offer`
7. Server relays offer to other peer
8. Other peer sends `answer`
9. Server relays answer
10. Both peers exchange `ice` candidates
11. WebRTC connection established!
12. On disconnect → Server sends `peer-left` to remaining peer
```

**Environment Variables:**
| Variable | Description | Default |
|----------|-------------|---------|
| `SIGNALING_PORT` | WebSocket server port | 3001 |
| `JWT_SECRET` | Secret for verifying JWTs | dev-secret |

**Usage:**
```bash
# Start signaling server
cd apps/signaling && pnpm dev

# Server listens on ws://localhost:3001
```

---

### 📁 FINAL FILE STRUCTURE

```
apps/api/
├── package.json                 # Dependencies & scripts
├── tsconfig.json
├── prisma/
│   └── schema.prisma           # Database schema
├── src/
│   ├── server/
│   │   └── index.ts            # Fastify bootstrap + DB lifecycle
│   ├── database/
│   │   ├── client.ts           # Prisma singleton
│   │   └── index.ts            # Exports
│   ├── config/
│   │   └── index.ts            # Environment config
│   ├── middleware/
│   │   ├── app-auth.ts         # App authentication plugin
│   │   └── index.ts            # Exports
│   ├── shared/
│   │   ├── errors.ts           # Complete error taxonomy
│   │   ├── utils.ts            # generateId, generateSecret, generateJti
│   │   └── index.ts
│   └── modules/
│       ├── app/                # Tenant management
│       │   ├── app.routes.ts
│       │   ├── app.service.ts
│       │   ├── app.schema.ts
│       │   ├── app.types.ts
│       │   └── index.ts
│       ├── room/               # Room management
│       │   ├── room.routes.ts
│       │   ├── room.service.ts
│       │   ├── room.schema.ts
│       │   ├── room.types.ts
│       │   └── index.ts
│       └── token/              # JWT tokens
│           ├── token.routes.ts
│           ├── token.service.ts
│           ├── token.schema.ts
│           ├── token.types.ts
│           └── index.ts

apps/signaling/
├── package.json                 # Dependencies (ws, jsonwebtoken)
├── tsconfig.json
├── src/
│   ├── types.ts                # Message protocol types (LOCKED)
│   ├── room-manager.ts         # In-memory room/peer tracking
│   ├── server.ts               # WebSocket server
│   └── index.ts                # Entry point
```

---

### 🚀 HOW TO RUN

```bash
# 1. Start PostgreSQL
cd infra/docker && docker-compose up -d

# 2. Install dependencies
pnpm install

# 3. Generate Prisma client
cd apps/api && pnpm db:generate

# 4. Run migrations
pnpm db:migrate

# 5. Start the API server (port 3000)
cd apps/api && pnpm dev

# 6. Start the signaling server (port 3001)
cd apps/signaling && pnpm dev
```

---

### 🧪 API TESTING EXAMPLES

```bash
# Create a tenant
curl -X POST http://localhost:3000/apps \
  -H "Content-Type: application/json" \
  -d '{"name": "My SaaS App"}'

# Response: { "id": "clx...", "name": "My SaaS App", "secret": "sk_..." }

# Create a room (use id and secret from above)
curl -X POST http://localhost:3000/rooms \
  -H "Content-Type: application/json" \
  -H "x-app-id: clx..." \
  -H "x-app-secret: sk_..." \
  -d '{"name": "Interview Room"}'

# Generate a token
curl -X POST http://localhost:3000/rooms/{roomId}/token \
  -H "Content-Type: application/json" \
  -H "x-app-id: clx..." \
  -H "x-app-secret: sk_..." \
  -d '{"userId": "user-123", "role": "host"}'
```

### 🧪 SIGNALING SERVER TESTING

```javascript
// Connect to signaling server
const ws = new WebSocket('ws://localhost:3001');

// Join a room
ws.send(JSON.stringify({
  type: 'join',
  roomId: 'room-id-from-api',
  token: 'jwt-token-from-api'
}));

// Listen for messages
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  
  switch (msg.type) {
    case 'joined':
      console.log('Joined room:', msg.roomId);
      console.log('Existing peers:', msg.peers);
      break;
    case 'peer-joined':
      console.log('Peer joined:', msg.userId);
      if (msg.isInitiator) {
        // I should create the offer
      }
      break;
    case 'offer':
      // Handle incoming offer, create answer
      break;
    case 'answer':
      // Handle incoming answer
      break;
    case 'ice':
      // Add ICE candidate
      break;
    case 'peer-left':
      console.log('Peer left:', msg.userId);
      break;
    case 'error':
      console.error('Error:', msg.code, msg.message);
      break;
  }
};
```

---

### 🔜 NEXT STEPS (TODO)

- [x] Signaling server (WebSocket) ✅
- [x] Client SDK (TypeScript) ✅
- [ ] Demo SaaS app (React)
- [ ] Test end-to-end (two browsers)
- [ ] Rate limiting
- [ ] API documentation (OpenAPI)

---

#### 14. **Client SDK (packages/sdk)**

**Files:**
- `packages/sdk/package.json` - Dependencies & build config
- `packages/sdk/tsconfig.json` - TypeScript config
- `packages/sdk/src/types.ts` - Public API types & error codes
- `packages/sdk/src/events/EventEmitter.ts` - Typed event system
- `packages/sdk/src/signaling/SignalingClient.ts` - WebSocket client
- `packages/sdk/src/webrtc/PeerConnection.ts` - WebRTC wrapper
- `packages/sdk/src/CallSDK.ts` - Main public facade
- `packages/sdk/src/index.ts` - Public exports

**What was done:**
- Created a framework-agnostic TypeScript SDK
- Built a typed EventEmitter for internal/external events
- Built SignalingClient with reconnection (exponential backoff)
- Built PeerConnection wrapper with perfect negotiation pattern
- Built CallSDK facade that glues everything together
- Implemented full WebRTC flow: join, offer/answer, ICE exchange
- SDK builds to ESM and CJS formats with type declarations

**Why:**
- SDK is the actual product - what customers integrate
- Framework-agnostic means it works everywhere (React, Vue, vanilla JS)
- Typed events prevent runtime errors
- Perfect negotiation handles offer collisions gracefully
- Single facade hides all WebRTC complexity

**Public API (LOCKED):**

```typescript
import { CallSDK } from '@rtc-platform/sdk';

// 1. Initialize
CallSDK.init({ appId: 'your-app-id' });

// 2. Get user media (your code)
const stream = await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true,
});

// 3. Join room
await CallSDK.join({
  roomId: 'room-123',
  token: 'jwt-from-backend',
  stream,
});

// 4. Handle events
CallSDK.on('user-joined', ({ userId }) => {
  console.log('User joined:', userId);
});

CallSDK.on('track-added', ({ userId, stream }) => {
  videoElement.srcObject = stream;
});

CallSDK.on('error', ({ code, message, fatal }) => {
  console.error('Error:', code, message);
});

// 5. Leave
CallSDK.leave();
```

**SDK Events:**
| Event | Data | Description |
|-------|------|-------------|
| `user-joined` | `{ userId }` | Remote user joined the room |
| `user-left` | `{ userId }` | Remote user left the room |
| `track-added` | `{ userId, track, stream }` | Remote media track received |
| `track-removed` | `{ userId, track }` | Remote media track removed |
| `connection-state` | `{ state, previousState }` | Connection state changed |
| `error` | `{ code, message, fatal }` | Error occurred |

**Error Codes:**
| Code | Description |
|------|-------------|
| `NOT_INITIALIZED` | SDK not initialized |
| `ALREADY_INITIALIZED` | SDK already initialized |
| `INVALID_CONFIG` | Invalid configuration |
| `CONNECTION_FAILED` | WebSocket connection failed |
| `CONNECTION_LOST` | WebSocket connection lost |
| `RECONNECT_FAILED` | Failed to reconnect after max attempts |
| `NOT_IN_ROOM` | Action requires being in a room |
| `ALREADY_IN_ROOM` | Already in a room |
| `ROOM_FULL` | Room has max participants |
| `INVALID_TOKEN` | JWT token invalid |
| `TOKEN_EXPIRED` | JWT token expired |
| `WEBRTC_NOT_SUPPORTED` | WebRTC not supported |
| `ICE_FAILED` | ICE connection failed |
| `NEGOTIATION_FAILED` | SDP negotiation failed |

**Internal Architecture:**
```
packages/sdk/src/
├── CallSDK.ts         # Public facade (singleton)
├── index.ts           # Public exports
├── types.ts           # All types & error codes
├── events/
│   └── EventEmitter.ts    # Typed event emitter
├── signaling/
│   └── SignalingClient.ts # WebSocket to signaling server
└── webrtc/
    └── PeerConnection.ts  # RTCPeerConnection wrapper
```

**Build Output:**
```bash
pnpm build
# dist/index.js   (27.84 KB, CommonJS)
# dist/index.mjs  (26.81 KB, ES Module)
# dist/index.d.ts (8.14 KB, TypeScript declarations)
```

---

## 1️⃣ GLOBAL SYSTEM CONTEXT (MOST IMPORTANT)

You are helping build a production-grade, multi-tenant, embeddable
Real-Time Communication (RTC) platform similar to:
- "Stripe for meetings"
- "Auth0 for calls"

This is NOT a video calling app.
This is INFRASTRUCTURE for SaaS products.

**Core principles:**
- SDK-first
- Multi-tenant by default
- White-label
- Secure (JWT, short-lived tokens)
- Opinionated defaults
- Simple integration for SaaS backends

**Target users:**
- SaaS founders
- Interview platforms
- LMS / internal tools

**Non-goals (for MVP):**
- No SFU
- No recording
- No mobile SDK
- No UI components

---

## 2️⃣ TECH STACK (DO NOT DEVIATE)

**Monorepo:** Turborepo + pnpm

**Backend API:**
- Node.js
- TypeScript
- Fastify
- PostgreSQL
- Prisma
- JWT

**Signaling Server:**
- Node.js
- TypeScript
- Native WebSockets (ws)
- No media handling

**Client SDK:**
- TypeScript
- Framework-agnostic
- Uses WebRTC APIs
- Exposes simple methods + events

**Demo App:**
- React + TypeScript
- Uses SDK exactly like a real customer

---

## 3️⃣ MONOREPO STRUCTURE (LOCKED)

```
rtc-platform/
├── apps/
│   ├── api/            # Tenant, room, token APIs
│   ├── signaling/      # WebSocket signaling server
│   └── demo-saas/      # Example SaaS using SDK
│
├── packages/
│   ├── sdk/            # PUBLIC SDK (main product)
│   ├── shared/         # Types, events, errors
│   └── auth/           # JWT helpers, token validation
```

**Rules:**
- SDK NEVER imports backend code
- Shared types are the only common dependency
- No circular dependencies

---

## 4️⃣ DOMAIN MODEL (VERY IMPORTANT FOR COPILOT)

### Tenant (App)
Represents a SaaS customer.
All data is scoped to a tenant.

**Fields:**
- `id`
- `name`
- `secret`
- `createdAt`

### Room
A meeting room owned by a tenant.

**Fields:**
- `id`
- `appId`
- `maxParticipants`
- `createdAt`

### Token (JWT)
Short-lived, non-reusable access token.
Generated server-to-server only.

**Claims:**
```json
{
  "appId": "string",
  "roomId": "string",
  "userId": "string",
  "role": "host | participant",
  "exp": "number"
}
```

---

## 5️⃣ BACKEND API REQUIREMENTS (FOR COPILOT)

### APIs to build
- `POST /apps`
- `POST /rooms`
- `POST /rooms/:roomId/token`

### Rules:
- Tenant authenticated via headers:
  - `x-app-id`
  - `x-app-secret`
- No end-user authentication
- Strict tenant isolation
- Prisma used for DB access
- Services contain logic, routes are thin

---

## 6️⃣ SIGNALING SERVER REQUIREMENTS

Build a WebSocket signaling server.

**Responsibilities:**
- Room presence
- SDP exchange
- ICE candidate forwarding
- Join / leave events

**Rules:**
- Media NEVER flows through signaling
- Stateless except room membership
- Must support reconnect

**Message types:**
- `join`
- `offer`
- `answer`
- `ice`
- `leave`

---

## 7️⃣ CLIENT SDK REQUIREMENTS (MOST IMPORTANT)

### Public API (DO NOT CHANGE SHAPE)

```typescript
CallSDK.init({ appId })

CallSDK.join({
  roomId,
  token
})

CallSDK.leave()

CallSDK.on("user-joined", handler)
CallSDK.on("user-left", handler)
CallSDK.on("track-added", handler)
CallSDK.on("error", handler)
```

**Rules:**
- SDK hides WebRTC complexity
- SDK manages WebSocket lifecycle
- SDK handles reconnects
- SDK returns MediaStreams only
- No UI code
- No React-specific logic

---

## 8️⃣ WEBRTC REQUIREMENTS (MVP)

Use peer-to-peer WebRTC only.
Max 2 participants per room.

**STUN:**
- Google STUN for MVP

**TURN:**
- Optional fallback (Coturn later)

**Handle:**
- ICE failures
- Connection state changes
- Track add/remove

---

## 9️⃣ DEMO SAAS APP REQUIREMENTS

Demo app simulates a SaaS customer.

**Purpose:**
- Prove SDK integration simplicity
- Act as reference implementation

**Flow:**
1. Mock tenant login
2. Create meeting (backend call)
3. Generate token
4. Join meeting via SDK

**Rules:**
- Use SDK exactly like customers would
- No shortcuts
- Copy-paste friendly code

---

## 🔟 CODING RULES (VERY IMPORTANT)

Tell Copilot explicitly:

```typescript
/**
 * Coding rules:
 * - No any
 * - No over-engineering
 * - No decorators
 * - No magic frameworks
 * - Explicit types everywhere
 * - Clean separation of concerns
 * - Services are pure
 * - Routes are thin
 * - Fail fast with clear errors
 */
```

---

## 1️⃣1️⃣ HOW YOU SHOULD USE THIS (PRACTICAL)

### When creating ANY file:
1. Paste relevant section of this guide
2. Add a short file-specific instruction
3. Let Copilot generate
4. Review
5. Adjust
6. Move on

### Example:
```typescript
/**
 * Using the RTC platform architecture:
 * Build the Room service using Prisma.
 * Validate tenant ownership.
 * Do not add extra abstractions.
 */
```

---

## 📁 Folder Structure Context

```
apps/api/src/
├── server/
│   └── index.ts            # Fastify bootstrap
├── database/
│   ├── client.ts           # Prisma client singleton
│   └── index.ts            # Database exports
├── modules/
│   ├── app/                # Tenant management
│   │   ├── app.routes.ts
│   │   ├── app.service.ts
│   │   ├── app.schema.ts
│   │   └── app.types.ts
│   ├── room/               # Room management
│   │   ├── room.routes.ts
│   │   ├── room.service.ts
│   │   ├── room.schema.ts
│   │   └── room.types.ts
│   └── token/              # Token generation
│       ├── token.routes.ts
│       ├── token.service.ts
│       ├── token.schema.ts
│       └── token.types.ts
├── shared/
│   ├── errors.ts           # Typed error classes
│   ├── utils.ts            # Utility functions
│   └── index.ts
└── config/
    └── index.ts            # Environment config
```

---

## 🗄️ Database Schema (Prisma)

```prisma
model App {
  id        String   @id @default(cuid())
  name      String
  secret    String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  rooms     Room[]
}

model Room {
  id              String   @id @default(cuid())
  name            String
  maxParticipants Int      @default(2)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  appId           String
  app             App      @relation(fields: [appId], references: [id], onDelete: Cascade)
}
```
