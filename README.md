# One-Call

> **"Stripe for meetings" | "Auth0 for calls"**

A production-grade, multi-tenant, embeddable Real-Time Communication (RTC) platform. This is infrastructure for SaaS products to add video/audio calling capabilities.

## 🎯 What is One-Call?

One-Call is **NOT** a video calling app. It's **infrastructure** that SaaS products embed to add real-time communication features.

**Target users:**
- SaaS founders adding video features
- Interview platforms
- LMS / internal tools
- Telehealth applications

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Your SaaS Backend                        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │ Create App  │───▶│ Create Room │───▶│ Get Token   │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ (JWT Token)
┌─────────────────────────────────────────────────────────────┐
│                    Your Frontend (SDK)                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  CallSDK.join({ roomId, token })                    │    │
│  │  CallSDK.on("user-joined", handler)                 │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ (WebSocket + WebRTC)
┌─────────────────────────────────────────────────────────────┐
│                   One-Call Infrastructure                    │
│  ┌──────────┐    ┌─────────────┐    ┌──────────────┐        │
│  │   API    │    │  Signaling  │    │  STUN/TURN   │        │
│  └──────────┘    └─────────────┘    └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Monorepo Structure

```
one-call/
├── apps/
│   ├── api/            # Tenant, room, token REST APIs (Fastify + Prisma)
│   ├── signaling/      # WebSocket signaling server
│   └── demo-saas/      # Example SaaS using SDK
│
├── packages/
│   ├── sdk/            # PUBLIC SDK (main product)
│   ├── shared/         # Types, events, errors
│   └── auth/           # JWT helpers, token validation
│
├── infra/
│   └── docker/         # Docker Compose for local dev
│
└── docs/
    └── copilot.md      # Architecture & changelog
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- pnpm
- Docker (for PostgreSQL)

### Setup

```bash
# 1. Clone the repo
git clone git@github.com:Ashish23jun/One-Call.git
cd One-Call

# 2. Install dependencies
pnpm install

# 3. Start PostgreSQL
cd infra/docker && docker-compose up -d && cd ../..

# 4. Setup database
cd apps/api
pnpm db:generate
pnpm db:migrate

# 5. Start the API server
pnpm dev
```

### API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | \`/apps\` | Create tenant | None |
| GET | \`/apps\` | List tenants | None |
| POST | \`/rooms\` | Create room | \`x-app-id\`, \`x-app-secret\` |
| GET | \`/rooms\` | List rooms | \`x-app-id\`, \`x-app-secret\` |
| POST | \`/rooms/:roomId/token\` | Generate access token | \`x-app-id\`, \`x-app-secret\` |

### Example Usage

```bash
# 1. Create a tenant (your SaaS app)
curl -X POST http://localhost:3000/apps \
  -H "Content-Type: application/json" \
  -d '{"name": "My Interview Platform"}'

# Response: { "id": "clx...", "name": "...", "secret": "sk_..." }

# 2. Create a room
curl -X POST http://localhost:3000/rooms \
  -H "Content-Type: application/json" \
  -H "x-app-id: <your-app-id>" \
  -H "x-app-secret: <your-app-secret>" \
  -d '{"name": "Interview #123"}'

# 3. Generate a token for a user
curl -X POST http://localhost:3000/rooms/<room-id>/token \
  -H "Content-Type: application/json" \
  -H "x-app-id: <your-app-id>" \
  -H "x-app-secret: <your-app-secret>" \
  -d '{"userId": "candidate-456", "role": "participant"}'
```

## 🔧 Tech Stack

| Component | Technology |
|-----------|------------|
| Monorepo | Turborepo + pnpm |
| API | Node.js + Fastify + TypeScript |
| Database | PostgreSQL + Prisma |
| Auth | JWT (short-lived tokens) |
| Signaling | WebSocket (ws) |
| Media | WebRTC (P2P) |
| SDK | TypeScript (framework-agnostic) |

## 📋 Roadmap

- [x] Multi-tenant API (App, Room, Token)
- [x] PostgreSQL + Prisma
- [x] App auth middleware
- [x] JWT with jti (revocation-ready)
- [ ] Signaling server (WebSocket)
- [ ] Client SDK
- [ ] WebRTC integration
- [ ] Demo SaaS app
- [ ] Rate limiting
- [ ] OpenAPI docs

## 📄 License

MIT

---

Built with ❤️ for SaaS developers who want to add real-time communication without the complexity.
