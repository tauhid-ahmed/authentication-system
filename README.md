# Auth Learning System

> A complete authentication curriculum + production architecture. Zero → Staff Engineer.

## What This Is

This is NOT a starter template. This is a **curriculum engine** — a living codebase that evolves milestone by milestone, teaching authentication from first principles to production-grade systems.

## Architecture

```
/auth-learning-system
  /apps/web      → Next.js 15 App Router (frontend)
  /apps/api      → Express.js (backend API)
  /packages/shared → Zod schemas + TypeScript types
  /prisma        → Database schema (Neon PostgreSQL)
  /docs          → Complete learning curriculum
```

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- Neon PostgreSQL account (free at neon.tech)

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment variables
cp .env.example apps/api/.env
# Fill in: DATABASE_URL, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET

# 3. Push database schema
pnpm db:push

# 4. Start development servers
pnpm dev
# API: http://localhost:5000
# Web: http://localhost:3000
```

## Milestone Progress

| Milestone | Topic | Status |
|---|---|---|
| M0 | Auth Foundations (Theory) | Read `/docs/milestones/M0-foundations.md` |
| M1 | MVP Auth | Signup + Login |
| M2 | Session Auth | Server sessions |
| M3 | JWT Auth | Stateless tokens |
| M4 | Access Token System | 5-min JWT + protected routes |
| M5 | Refresh Tokens | 30-day refresh lifecycle |
| M6 | Refresh Token Rotation | Replay attack prevention |
| M7 | Express Architecture | Controllers/Services/Repos |
| M8 | Next.js Auth System | Server Components + Actions |
| M9 | OAuth | Google (Frontend + Backend flows) |
| M10 | RBAC | Role-based access control |
| M11 | Session Management | Multi-device + revocation |
| M12 | BFF Pattern | Proxy layer for web/mobile |
| M13 | Security Hardening | CSRF, rate limiting, XSS |
| M14 | Observability | Audit logs + anomaly detection |

## Start Learning

**Day 1**: Read [`/docs/milestones/M0-foundations.md`](./docs/milestones/M0-foundations.md)

Then follow the [14-day plan](./docs/milestones/M0-foundations.md#14-day-plan).

## Tech Stack

- **Frontend**: Next.js 15 App Router, Tailwind CSS, shadcn/ui, React Hook Form, Zod
- **Backend**: Express.js, TypeScript, Prisma
- **Database**: Neon PostgreSQL
- **Auth**: JWT (5m) + Refresh Tokens (30d), HTTP-only cookies, RBAC
- **Package Manager**: pnpm (monorepo workspaces)
