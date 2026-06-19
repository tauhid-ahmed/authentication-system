/**
 * create-tutorial-branches.js
 * Creates 9 progressive Git branches, each building on the previous.
 * Each branch = one chapter with TODO stubs + completed code from previous chapters.
 *
 * Run: node scripts/create-tutorial-branches.js
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function exec(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}

function write(relPath, content) {
  const full = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  console.log(`  wrote: ${relPath}`);
}

function del(relPath) {
  const full = path.join(ROOT, relPath);
  if (fs.existsSync(full)) fs.rmSync(full, { recursive: true, force: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAPTER CONTENT
// ─────────────────────────────────────────────────────────────────────────────

// ── Chapter 1: Express Server ─────────────────────────────────────────────────
const ch01_chapter_md = `# Chapter 1: Build Your First Express Server

> **Branch:** \`tutorial/01-express-server\`
> **Previous knowledge needed:** Basic JavaScript/TypeScript
> **Time:** ~30 minutes

---

## What you will build
A running HTTP server that responds to requests. At the end of this chapter,
you will be able to visit \`http://localhost:5000/api/health\` and see a live response.

## Why Express?
Express.js is the most popular Node.js web framework. Think of it like a
**restaurant front desk** — it receives HTTP requests (customers), figures out
where to send them (routing), and sends back a response (the meal).

---

## The Architecture

\`\`\`
Browser / curl
     │
     ▼
Express App (index.ts)
     │
     ├── Middleware (JSON parser, logger...)
     │
     └── Routes
          └── GET /api/health  ← you build this
\`\`\`

---

## Your Task

### Step 1 — Mount the health router
Open \`apps/api/src/index.ts\`. Find the TODO and import + mount the health router.

### Step 2 — Implement the health route
Open \`apps/api/src/routes/health.ts\`. Implement the GET /health endpoint.
It must respond with:
\`\`\`json
{
  "status": "ok",
  "uptime": 42.1,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
\`\`\`

### Verify it works
\`\`\`bash
# Terminal 1
pnpm dev

# Terminal 2
curl http://localhost:5000/api/health
# You should see: {"status":"ok","uptime":...,"timestamp":"..."}
\`\`\`

---

## Key Concepts

| Concept | Explanation |
|---|---|
| \`express()\` | Creates the app object. Like the restaurant itself. |
| \`app.use()\` | Registers middleware or routes. Applied to every request. |
| \`Router\` | A mini-app for grouping related routes together. |
| \`req\` | The incoming request (URL, headers, body). |
| \`res\` | The response you send back to the browser. |
| \`res.json()\` | Sends a JSON response with Content-Type: application/json. |

---

## Challenge Exercise (Optional)
Add a second route: \`GET /api/status\` that returns:
\`\`\`json
{ "version": "1.0.0", "node": "v20.x.x", "env": "development" }
\`\`\`
Hint: \`process.version\` gives the Node version, \`process.env.NODE_ENV\` gives the env.

---

## When done, move to Chapter 2:
\`\`\`bash
git add apps/api/
git commit -m "Ch01: Implemented Express server and health route"
git checkout tutorial/02-password-hashing
\`\`\`
`;

const ch01_index_ts = `// ============================================================
// apps/api/src/index.ts — Chapter 1: Your Express Server
// ============================================================
//
// 📚 LEARN: This is the entry point of your API.
// Node.js runs this file when you do "pnpm dev".
// It creates an Express app, wires up middleware and routes,
// then starts listening for HTTP connections on a port.
//
// ============================================================
import express from 'express';

// 📚 LEARN: express() creates the main application object.
// Everything else gets configured on this "app".
const app = express();

// 📚 LEARN: Middleware runs before your route handlers.
// express.json() reads the raw request body and parses it as JSON,
// making it available as req.body on POST/PUT requests.
// Without this, req.body would be undefined.
app.use(express.json());

// ✅ TODO Ch01 Step 1:
// Import your health router and mount it at '/api'
//
// 💡 HINT: It looks like this:
//   import healthRouter from './routes/health.js';
//   app.use('/api', healthRouter);
//
// YOUR CODE HERE ↓



// ─────────────────────────────────────────────────────────────
// Start the server
// ─────────────────────────────────────────────────────────────
const PORT = Number(process.env.API_PORT) || 5000;

app.listen(PORT, () => {
  console.log('');
  console.log('🚀 Auth API is running!');
  console.log(\`   Local:  http://localhost:\${PORT}\`);
  console.log(\`   Health: http://localhost:\${PORT}/api/health\`);
  console.log('');
  console.log('📚 Chapter 1: Express Server');
  console.log('   Open apps/api/src/routes/health.ts and implement the route!');
  console.log('');
});
`;

const ch01_health_ts = `// ============================================================
// apps/api/src/routes/health.ts — Chapter 1 Exercise
// ============================================================
//
// 📚 LEARN: A "health check" endpoint is standard in every production API.
// Load balancers, Docker, Kubernetes, and monitoring tools call /health
// to check if your server is alive and responding.
// If it returns 200 OK, the server is healthy.
// If it returns 500 or doesn't respond, traffic gets redirected.
//
// ============================================================
import { Router } from 'express';

// 📚 LEARN: Router() creates a "mini app" for grouping related routes.
// This keeps your code organised — auth routes in one file,
// health routes in another, user routes in another.
const router = Router();

// ✅ TODO Ch01 Step 2: Implement the GET /health route
//
// 📚 LEARN: router.get(path, handler) registers a route that responds to GET requests.
// - req = the incoming request (read: headers, body, query params)
// - res = the response builder (write: status code, JSON body)
//
// Your route must:
//   1. Respond with HTTP status 200
//   2. Return JSON: { status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() }
//
// 💡 HINT: res.json({ ... }) sends JSON with status 200 automatically.
//          To be explicit about status: res.status(200).json({ ... })
//
// YOUR CODE HERE ↓
router.get('/health', (req, res) => {
  // Implement me!
});

export default router;
`;

// ── Chapter 1 COMPLETED (used as base for Ch02) ──────────────────────────────
const ch01_index_ts_done = `import express from 'express';
import healthRouter from './routes/health.js';

const app = express();
app.use(express.json());

// Health & status routes
app.use('/api', healthRouter);

const PORT = Number(process.env.API_PORT) || 5000;
app.listen(PORT, () => {
  console.log(\`🚀 Auth API running at http://localhost:\${PORT}\`);
  console.log(\`📚 Chapter 2: Password Hashing — open apps/api/src/utils/hash.ts\`);
});
`;

const ch01_health_ts_done = `import { Router } from 'express';
const router = Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
`;

// ── Chapter 2: Password Hashing ───────────────────────────────────────────────
const ch02_chapter_md = `# Chapter 2: Never Store Plain Passwords

> **Branch:** \`tutorial/02-password-hashing\`
> **Previous:** Chapter 1 (Express Server is working ✅)
> **Time:** ~20 minutes

---

## The Golden Rule of Authentication
**Never, ever store a plain text password in your database.**

If your database gets hacked, every password is immediately exposed.
Instead, we store a **hash** — a one-way scrambled version of the password.

---

## How bcrypt works

\`\`\`
"myPassword123"  ──bcrypt──▶  "$2a$12$eW5bP3...randomHash...xK2"

"myPassword123"  ──bcrypt──▶  "$2a$12$dK8qR7...DIFFERENT hash...mP9"
                                         ↑ different every time! (salt)
\`\`\`

### Key properties:
1. **One-way**: You CANNOT reverse a hash back to the original password
2. **Salted**: bcrypt adds random data (salt) so identical passwords produce different hashes
3. **Slow on purpose**: It takes ~300ms to hash. This makes brute-force attacks impractical.

---

## Your Task

Open \`apps/api/src/utils/hash.ts\` and implement two functions:

### hashPassword(plainText)
- Takes a plain text password
- Returns a bcrypt hash

### comparePassword(plainText, hash)
- Takes a plain text attempt + a stored hash
- Returns true if they match, false if not

---

## Verify it works

\`\`\`bash
node -e "
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('mypassword', 12);
console.log('Hash:', hash);
console.log('Match:', bcrypt.compareSync('mypassword', hash));
console.log('Wrong:', bcrypt.compareSync('wrongpassword', hash));
"
\`\`\`

---

## Key Concepts

| Concept | Explanation |
|---|---|
| Hash | A one-way transformation. Cannot be reversed. |
| Salt | Random data added to the input before hashing. Makes identical inputs produce different hashes. |
| Cost factor (12) | How many times bcrypt iterates. Higher = slower = more secure. |
| Timing attack | Attacker measures response time to learn information. bcrypt's constant time prevents this. |

---

## When done:
\`\`\`bash
git add apps/api/src/utils/
git commit -m "Ch02: Implemented hashPassword and comparePassword"
git checkout tutorial/03-database-and-users
\`\`\`
`;

const ch02_hash_ts = `// ============================================================
// apps/api/src/utils/hash.ts — Chapter 2 Exercise
// ============================================================
//
// 📚 LEARN: This is one of the most important files in any auth system.
// We never store raw passwords — we store bcrypt hashes.
//
// bcrypt is special because:
// 1. It is intentionally SLOW (~300ms) — brute force becomes impractical
// 2. It auto-generates a random "salt" — same password = different hash every time
// 3. The hash includes the salt — so we only need to store one string in the DB
//
// ============================================================
import bcrypt from 'bcryptjs';

// 📚 LEARN: The "cost factor" controls how slow bcrypt is.
// 12 = 2^12 = 4096 iterations. Takes ~300ms on a modern CPU.
// Attacker would need 300ms per guess = only ~3 guesses/second.
// NEVER use a cost factor below 10 in production.
const BCRYPT_ROUNDS = 12;

/**
 * Hash a plain-text password using bcrypt.
 *
 * ✅ TODO Ch02 Step 1: Implement this function.
 *
 * 💡 HINT: bcrypt.hash(password, BCRYPT_ROUNDS) returns a Promise<string>
 *
 * @param plainText - The raw password from the signup form
 * @returns The hashed password to store in the database
 */
export async function hashPassword(plainText: string): Promise<string> {
  // YOUR CODE HERE ↓

  throw new Error('Not implemented yet — complete Chapter 2!');
}

/**
 * Compare a plain-text password against a stored bcrypt hash.
 *
 * ✅ TODO Ch02 Step 2: Implement this function.
 *
 * 📚 LEARN: bcrypt.compare() extracts the salt from the stored hash,
 * hashes the attempt with the same salt, then compares.
 * This is constant-time — it takes the same time whether or not it matches,
 * preventing timing attacks.
 *
 * 💡 HINT: bcrypt.compare(attempt, storedHash) returns Promise<boolean>
 *
 * @param plainText - The password attempt from the login form
 * @param hash      - The stored bcrypt hash from the database
 * @returns true if password matches, false if not
 */
export async function comparePassword(plainText: string, hash: string): Promise<boolean> {
  // YOUR CODE HERE ↓

  throw new Error('Not implemented yet — complete Chapter 2!');
}
`;

// ── Chapter 2 COMPLETED ───────────────────────────────────────────────────────
const ch02_hash_ts_done = `import bcrypt from 'bcryptjs';
const BCRYPT_ROUNDS = 12;

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, BCRYPT_ROUNDS);
}

export async function comparePassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}
`;

// ── Chapter 3: Database ───────────────────────────────────────────────────────
const ch03_chapter_md = `# Chapter 3: Database & User Model

> **Branch:** \`tutorial/03-database-and-users\`
> **Previous:** Chapter 2 (Password hashing works ✅)
> **Time:** ~30 minutes

---

## What is Prisma?
Prisma is an ORM (Object-Relational Mapper). Instead of writing raw SQL,
you define your data models in \`schema.prisma\` and Prisma generates:
- A type-safe database client (\`prisma.user.findUnique(...)\`)
- Database migrations (the actual SQL to create/alter tables)

---

## Your Task

### Step 1 — Define the User model
Open \`apps/api/prisma/schema.prisma\` and add the User model.

A user needs:
- \`id\` — unique identifier (CUID, auto-generated)
- \`email\` — unique email address
- \`passwordHash\` — the bcrypt hash (NEVER the plain password!)
- \`name\` — optional display name
- \`createdAt\` / \`updatedAt\` — automatic timestamps

### Step 2 — Create the database client
Open \`apps/api/src/db/prisma.ts\` and create the Prisma client singleton.

### Step 3 — Run the migration
\`\`\`bash
cd apps/api
npx prisma migrate dev --name init
\`\`\`

### Step 4 — Verify
\`\`\`bash
npx prisma studio
# Opens a browser UI at localhost:5555 showing your database tables
\`\`\`

---

## Key Concepts

| Concept | Explanation |
|---|---|
| ORM | Maps database tables to TypeScript objects |
| Migration | A versioned SQL script that changes the database schema |
| Prisma Client | Auto-generated TypeScript client for querying your DB |
| Singleton | One shared instance throughout your app (important for DB connections) |
| CUID | Collision-resistant unique ID — better than auto-increment for distributed systems |

---

## When done:
\`\`\`bash
git add apps/api/prisma/ apps/api/src/db/
git commit -m "Ch03: Set up Prisma database with User model"
git checkout tutorial/04-signup-endpoint
\`\`\`
`;

const ch03_schema_prisma = `// ============================================================
// apps/api/prisma/schema.prisma — Chapter 3 Exercise
// ============================================================
//
// 📚 LEARN: schema.prisma is the single source of truth for your database.
// You define your "models" here (like TypeScript types but for the DB),
// then run "prisma migrate dev" and Prisma writes the actual SQL for you.
//
// ============================================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// ✅ TODO Ch03 Step 1: Define the User model
//
// 📚 LEARN: A Prisma model = a database table.
// Field syntax: fieldName  FieldType  @modifier
//
// You need these fields:
//   id           String    @id @default(cuid())   // unique primary key
//   email        String    @unique                // no duplicate emails
//   passwordHash String?                          // nullable (OAuth users have no password)
//   name         String?                          // optional display name
//   role         String    @default("USER")       // for Chapter 9 (RBAC)
//   createdAt    DateTime  @default(now())
//   updatedAt    DateTime  @updatedAt
//
// 💡 HINT: The model keyword defines a table. Model name = table name.
//
// YOUR CODE HERE ↓
// model User {
//   ...
// }
`;

const ch03_db_prisma_ts = `// ============================================================
// apps/api/src/db/prisma.ts — Chapter 3 Exercise
// ============================================================
//
// 📚 LEARN: PrismaClient opens a connection pool to your database.
// You should only have ONE instance in your app (singleton pattern).
// If you create multiple instances (e.g. in hot-reload dev mode),
// you'll exhaust your database connections.
//
// The pattern below is the official Prisma recommendation:
// store the client on globalThis in development so hot-reloads
// reuse the same instance instead of creating a new one each time.
//
// ============================================================
import { PrismaClient } from '@prisma/client';

// ✅ TODO Ch03 Step 2: Create the Prisma singleton
//
// 💡 HINT: The pattern is:
//
// const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
//
// export const prisma =
//   globalForPrisma.prisma || new PrismaClient();
//
// if (process.env.NODE_ENV !== 'production') {
//   globalForPrisma.prisma = prisma;
// }
//
// YOUR CODE HERE ↓

export const prisma = new PrismaClient(); // replace with singleton pattern above
`;

// ── Chapter 3 COMPLETED ───────────────────────────────────────────────────────
const ch03_schema_done = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String?
  name         String?
  role         String   @default("USER")
  emailVerified Boolean @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  sessions     Session[]
}
`;

const ch03_db_done = `import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
`;

// ── Chapter 4: Signup Endpoint ────────────────────────────────────────────────
const ch04_chapter_md = `# Chapter 4: The Signup Endpoint

> **Branch:** \`tutorial/04-signup-endpoint\`
> **Previous:** Chapter 3 (Database with User model ✅)
> **Time:** ~45 minutes

---

## What you will build

\`POST /api/auth/signup\` — the endpoint that creates a new user account.

---

## The Three-Layer Architecture

Every feature in a production API follows this pattern:

\`\`\`
HTTP Request
     │
     ▼
┌─────────────────────────────────────────────────────┐
│ CONTROLLER (auth.controller.ts)                     │
│   • Parse the request body                          │
│   • Call the service                                │
│   • Send the HTTP response                          │
└──────────────────────┬──────────────────────────────┘
                       │ calls
                       ▼
┌─────────────────────────────────────────────────────┐
│ SERVICE (auth.service.ts)                           │
│   • Business logic: "does this email exist?"        │
│   • Orchestrates: calls hash util + calls repository│
│   • Throws errors: "DUPLICATE_EMAIL"                │
└──────────────────────┬──────────────────────────────┘
                       │ calls
                       ▼
┌─────────────────────────────────────────────────────┐
│ REPOSITORY (auth.repository.ts)                     │
│   • Database queries only                           │
│   • prisma.user.create(), prisma.user.findUnique()  │
└─────────────────────────────────────────────────────┘
\`\`\`

**Why separate them?**
- Services can be tested without HTTP
- Repositories can be swapped (SQLite → Postgres) without touching business logic
- Controllers stay thin and readable

---

## Your Task

### Step 1 — Repository: emailExists + createUser
Open \`apps/api/src/modules/auth/auth.repository.ts\`

### Step 2 — Service: signup logic
Open \`apps/api/src/modules/auth/auth.service.ts\`

### Step 3 — Controller: parse request, call service, respond
Open \`apps/api/src/modules/auth/auth.controller.ts\`

The route is already wired up for you in \`auth.routes.ts\`.

---

## Verify it works

\`\`\`bash
curl -X POST http://localhost:5000/api/auth/signup \\
  -H "Content-Type: application/json" \\
  -d '{"email":"alice@example.com","password":"SecurePass123!","name":"Alice"}'

# Expected response:
# { "user": { "id": "...", "email": "alice@example.com", "name": "Alice" } }
\`\`\`

---

## When done:
\`\`\`bash
git add apps/api/src/modules/auth/
git commit -m "Ch04: Implemented signup endpoint"
git checkout tutorial/05-login-and-jwt
\`\`\`
`;

const ch04_repository_ts = `// ============================================================
// apps/api/src/modules/auth/auth.repository.ts — Chapter 4 Exercise
// ============================================================
//
// 📚 LEARN: The Repository pattern isolates database access.
// This file ONLY does database queries — no business logic here.
//
// WHY? If you later switch from SQLite to PostgreSQL, you change
// only this file. Nothing else needs to know how the DB works.
//
// ============================================================
import { prisma } from '../../db/prisma.js';

export const authRepository = {

  /**
   * Check if an email address already has an account.
   *
   * ✅ TODO Step 1: Implement this function.
   *
   * 💡 HINT: prisma.user.findUnique({ where: { email } })
   * Return true if a user was found, false if null.
   */
  async emailExists(email: string): Promise<boolean> {
    // YOUR CODE HERE ↓
    throw new Error('Not implemented — complete Chapter 4!');
  },

  /**
   * Create a new user in the database.
   *
   * ✅ TODO Step 2: Implement this function.
   *
   * 💡 HINT: prisma.user.create({ data: { email, passwordHash, name } })
   * Returns the created user object.
   */
  async createUser(data: { email: string; passwordHash: string; name?: string }) {
    // YOUR CODE HERE ↓
    throw new Error('Not implemented — complete Chapter 4!');
  },

};
`;

const ch04_service_ts = `// ============================================================
// apps/api/src/modules/auth/auth.service.ts — Chapter 4 Exercise
// ============================================================
//
// 📚 LEARN: The Service layer holds business logic.
// It answers questions like:
//   - "Can this user sign up?" (is the email free?)
//   - "Should this login succeed?" (is the password correct?)
//
// Services NEVER touch HTTP (no req, no res).
// This makes them easy to test and reuse.
//
// ============================================================
import { authRepository } from './auth.repository.js';
import { hashPassword } from '../../utils/hash.js';

export const authService = {

  /**
   * Sign up a new user.
   *
   * Business rules:
   * 1. Check if email is already taken → throw 'DUPLICATE_EMAIL'
   * 2. Hash the password (NEVER store plain text!)
   * 3. Create the user in the database
   * 4. Return the new user (without the passwordHash!)
   *
   * ✅ TODO Step 3: Implement this function.
   *
   * 💡 HINT: Use authRepository.emailExists() to check step 1.
   *          Use hashPassword() from '../../utils/hash.js' for step 2.
   *          Use authRepository.createUser() for step 3.
   */
  async signup(input: { email: string; password: string; name?: string }) {
    // YOUR CODE HERE ↓
    throw new Error('Not implemented — complete Chapter 4!');
  },

};
`;

const ch04_controller_ts = `// ============================================================
// apps/api/src/modules/auth/auth.controller.ts — Chapter 4 Exercise
// ============================================================
//
// 📚 LEARN: The Controller handles HTTP.
// Its ONLY jobs are:
//   1. Read the request (body, headers, params)
//   2. Call the service with the parsed data
//   3. Send the HTTP response
//
// Controllers should be THIN. If you see business logic here,
// move it to the service.
//
// ============================================================
import { Request, Response } from 'express';
import { authService } from './auth.service.js';

/**
 * POST /api/auth/signup
 *
 * ✅ TODO Step 4: Implement this controller function.
 *
 * 1. Read email, password, name from req.body
 * 2. Call authService.signup({ email, password, name })
 * 3. On success: respond with 201 + { user }
 * 4. On error 'DUPLICATE_EMAIL': respond with 409 + { error: 'Email already in use' }
 * 5. On any other error: respond with 500 + { error: 'Internal server error' }
 *
 * 💡 HINT: Wrap in try/catch. Check error.message for 'DUPLICATE_EMAIL'.
 *          res.status(201).json({ user }) sends a 201 Created response.
 */
export async function signup(req: Request, res: Response) {
  // YOUR CODE HERE ↓
  res.status(501).json({ error: 'Not implemented — complete Chapter 4!' });
}
`;

const ch04_routes_ts = `// ============================================================
// apps/api/src/modules/auth/auth.routes.ts
// Chapter 4: This file is complete — just shows you how routing works.
// ============================================================
//
// 📚 LEARN: Routes wire URLs to controller functions.
// This file says: "When a POST request comes in to /signup, call the signup function."
//
// The '/api/auth' prefix is added in index.ts when this router is mounted.
// So: app.use('/api/auth', authRouter) + router.post('/signup', ...) = POST /api/auth/signup
//
import { Router } from 'express';
import { signup } from './auth.controller.js';

const router = Router();

// This line is the complete route definition for Chapter 4.
// In Chapter 5, you will add: router.post('/login', login);
// In Chapter 6, you will add: router.get('/me', authenticate, getMe);
router.post('/signup', signup);

export default router;
`;

// ── Chapter 4 COMPLETED ───────────────────────────────────────────────────────
const ch04_repository_done = `import { prisma } from '../../db/prisma.js';

export const authRepository = {
  async emailExists(email: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { email } });
    return user !== null;
  },

  async createUser(data: { email: string; passwordHash: string; name?: string }) {
    return prisma.user.create({ data });
  },

  async findByEmailWithPassword(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },
};
`;

const ch04_service_done_base = `import { authRepository } from './auth.repository.js';
import { hashPassword } from '../../utils/hash.js';

export const authService = {
  async signup(input: { email: string; password: string; name?: string }) {
    const taken = await authRepository.emailExists(input.email);
    if (taken) throw new Error('DUPLICATE_EMAIL');

    const passwordHash = await hashPassword(input.password);
    const user = await authRepository.createUser({
      email: input.email,
      passwordHash,
      name: input.name,
    });

    const { passwordHash: _, ...safeUser } = user as any;
    return { user: safeUser };
  },
};
`;

const ch04_controller_done_base = `import { Request, Response } from 'express';
import { authService } from './auth.service.js';

export async function signup(req: Request, res: Response) {
  try {
    const { email, password, name } = req.body;
    const result = await authService.signup({ email, password, name });
    res.status(201).json(result);
  } catch (err: any) {
    if (err.message === 'DUPLICATE_EMAIL') {
      return res.status(409).json({ error: 'Email already in use' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function login(req: Request, res: Response) {
  res.status(501).json({ error: 'Not implemented yet — complete Chapter 5!' });
}

export async function getMe(req: Request, res: Response) {
  res.status(501).json({ error: 'Not implemented yet — complete Chapter 6!' });
}

export async function refreshToken(req: Request, res: Response) {
  res.status(501).json({ error: 'Not implemented yet — complete Chapter 7!' });
}

export async function logout(req: Request, res: Response) {
  res.status(501).json({ error: 'Not implemented yet — complete Chapter 7!' });
}
`;

// ── Chapter 5: Login + JWT ────────────────────────────────────────────────────
const ch05_chapter_md = `# Chapter 5: Login & JWT Access Tokens

> **Branch:** \`tutorial/05-login-and-jwt\`
> **Previous:** Chapter 4 (Signup works ✅)
> **Time:** ~40 minutes

---

## What is a JWT?

A **JSON Web Token** is a string with three parts separated by dots:

\`\`\`
eyJhbGciOiJIUzI1NiJ9  .  eyJzdWIiOiJ1c2VyXzEifQ  .  xK2mP9...signature
     HEADER                      PAYLOAD                  SIGNATURE
\`\`\`

- **Header**: Algorithm used (HS256)
- **Payload**: Data you want to store (user ID, role) — BASE64 ENCODED, NOT ENCRYPTED
- **Signature**: HMAC of header+payload using a secret key

### Key insight: JWT is SIGNED, not encrypted
Anyone can decode the payload (it's just base64). But they CANNOT change it
without the server's secret key — the signature would be invalid.
Never put sensitive data (passwords, credit cards) in a JWT payload!

---

## The Login Flow

\`\`\`
Browser  →  POST /api/auth/login  →  Server
                                       │
                                  1. Find user by email
                                  2. Compare password with hash
                                  3. Sign a JWT with user ID
                                  4. Return the JWT
                                       │
Browser  ←──────────────────────────────
         receives: { accessToken: "eyJ..." }
\`\`\`

---

## Your Task

### Step 1 — Implement JWT signing
Open \`apps/api/src/utils/jwt.ts\`

### Step 2 — Add login to the service
Open \`apps/api/src/modules/auth/auth.service.ts\` — find the login TODO

### Step 3 — Add login to the controller
Open \`apps/api/src/modules/auth/auth.controller.ts\` — find the login TODO

The route is already wired up.

---

## Verify

\`\`\`bash
# First sign up
curl -X POST http://localhost:5000/api/auth/signup \\
  -H "Content-Type: application/json" \\
  -d '{"email":"alice@example.com","password":"SecurePass123!"}'

# Then log in
curl -X POST http://localhost:5000/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"alice@example.com","password":"SecurePass123!"}'

# You should see: { "accessToken": "eyJ..." }

# Decode your JWT at: https://jwt.io
# You should see your user ID in the payload!
\`\`\`

---

## When done:
\`\`\`bash
git add apps/api/src/
git commit -m "Ch05: Implemented login with JWT access tokens"
git checkout tutorial/06-protected-routes
\`\`\`
`;

const ch05_jwt_ts = `// ============================================================
// apps/api/src/utils/jwt.ts — Chapter 5 Exercise
// ============================================================
//
// 📚 LEARN: JWTs (JSON Web Tokens) are the industry standard for
// stateless authentication. Your server signs a token with a secret key.
// The client sends that token on every request.
// The server verifies the signature to trust the token.
//
// Think of it like a casino chip: the casino issues it, you can use it,
// but you can't forge it without the casino's mold (the secret).
//
// ============================================================
import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET || 'dev-access-secret-change-in-prod';
const ACCESS_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';

export type AccessTokenPayload = {
  sub: string;  // user ID (subject)
  role: string;
};

/**
 * Sign an access token for a user.
 *
 * ✅ TODO Ch05 Step 1: Implement this function.
 *
 * 📚 LEARN: jwt.sign(payload, secret, options) creates a signed JWT.
 * The payload is stored in the token — visible to anyone who has the token.
 * The secret is used to create the signature — only your server knows this.
 *
 * 💡 HINT:
 *   return jwt.sign(
 *     { sub: payload.sub, role: payload.role },
 *     ACCESS_SECRET,
 *     { expiresIn: ACCESS_EXPIRY }
 *   ) as string;
 */
export function signAccessToken(payload: AccessTokenPayload): string {
  // YOUR CODE HERE ↓
  throw new Error('Not implemented — complete Chapter 5!');
}

/**
 * Verify an access token and return its payload.
 *
 * ✅ TODO Ch05 Step 2: Implement this function.
 *
 * 📚 LEARN: jwt.verify() checks:
 *   1. Is the signature valid? (was it signed with our secret?)
 *   2. Has it expired? (is the exp claim in the past?)
 * If either check fails, it throws an error.
 *
 * 💡 HINT:
 *   return jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload;
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  // YOUR CODE HERE ↓
  throw new Error('Not implemented — complete Chapter 5!');
}
`;

const ch05_service_with_login_todo = `import { authRepository } from './auth.repository.js';
import { hashPassword, comparePassword } from '../../utils/hash.js';
import { signAccessToken } from '../../utils/jwt.js';

export const authService = {

  // ── Signup (completed in Chapter 4) ────────────────────────────────────────
  async signup(input: { email: string; password: string; name?: string }) {
    const taken = await authRepository.emailExists(input.email);
    if (taken) throw new Error('DUPLICATE_EMAIL');

    const passwordHash = await hashPassword(input.password);
    const user = await authRepository.createUser({
      email: input.email,
      passwordHash,
      name: input.name,
    });

    const { passwordHash: _, ...safeUser } = user as any;
    return { user: safeUser };
  },

  // ── Login (your task for Chapter 5) ────────────────────────────────────────
  /**
   * Log in a user and return an access token.
   *
   * Business rules:
   * 1. Find user by email (authRepository.findByEmailWithPassword)
   * 2. ALWAYS run password comparison even if user not found
   *    WHY? Timing attack prevention — if we return early on "user not found",
   *    an attacker can tell which emails are registered by measuring response time.
   * 3. If user not found OR password wrong → throw 'INVALID_CREDENTIALS'
   *    WHY the same error? Don't reveal whether the email exists.
   * 4. Sign and return an access token
   *
   * ✅ TODO Ch05 Step 3: Implement this function.
   *
   * 💡 HINT for timing attack prevention:
   *   const DUMMY_HASH = '$2a$12$dummyhashdummyhashdummyhashdummyhash1234567890';
   *   const valid = await comparePassword(input.password, user?.passwordHash ?? DUMMY_HASH);
   */
  async login(input: { email: string; password: string }) {
    // YOUR CODE HERE ↓
    throw new Error('Not implemented — complete Chapter 5!');
  },

};
`;

const ch05_controller_with_login_todo = `import { Request, Response } from 'express';
import { authService } from './auth.service.js';

// ── Signup (completed in Chapter 4) ──────────────────────────────────────────
export async function signup(req: Request, res: Response) {
  try {
    const { email, password, name } = req.body;
    const result = await authService.signup({ email, password, name });
    res.status(201).json(result);
  } catch (err: any) {
    if (err.message === 'DUPLICATE_EMAIL') {
      return res.status(409).json({ error: 'Email already in use' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Login (your task for Chapter 5) ──────────────────────────────────────────
/**
 * POST /api/auth/login
 *
 * ✅ TODO Ch05 Step 4: Implement this controller.
 *
 * 1. Read email, password from req.body
 * 2. Call authService.login({ email, password })
 * 3. On success: respond with 200 + { accessToken }
 * 4. On error 'INVALID_CREDENTIALS': respond with 401 + { error: 'Invalid email or password' }
 * 5. On any other error: 500
 *
 * 💡 HINT: HTTP 401 = Unauthorized (credentials are wrong)
 */
export async function login(req: Request, res: Response) {
  // YOUR CODE HERE ↓
  res.status(501).json({ error: 'Not implemented — complete Chapter 5!' });
}

// ── Placeholders for later chapters ──────────────────────────────────────────
export async function getMe(req: Request, res: Response) {
  res.status(501).json({ error: 'Not implemented yet — complete Chapter 6!' });
}
export async function refreshToken(req: Request, res: Response) {
  res.status(501).json({ error: 'Not implemented yet — complete Chapter 7!' });
}
export async function logout(req: Request, res: Response) {
  res.status(501).json({ error: 'Not implemented yet — complete Chapter 7!' });
}
`;

const ch05_routes_with_login = `import { Router } from 'express';
import { signup, login, getMe, refreshToken, logout } from './auth.controller.js';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);       // Added in Chapter 5
router.get('/me', getMe);           // Implemented in Chapter 6
router.post('/refresh', refreshToken); // Implemented in Chapter 7
router.post('/logout', logout);     // Implemented in Chapter 7

export default router;
`;

// ── Chapter 6: Protected Routes ───────────────────────────────────────────────
const ch06_chapter_md = `# Chapter 6: Protected Routes & the /me Endpoint

> **Branch:** \`tutorial/06-protected-routes\`
> **Previous:** Chapter 5 (Login + JWT works ✅)
> **Time:** ~30 minutes

---

## The Problem
Right now, anyone can call any endpoint. You need a way to protect routes
so only authenticated users can access them.

## The Solution: Middleware

\`\`\`
Request → authenticate middleware → route handler
               │
          reads the token from:
            Authorization: Bearer eyJ...
          or
            Cookie: accessToken=eyJ...
               │
          verifies signature
               │
          attaches user to req.user
               │
          calls next()  ──→  route handler runs
               │
          OR throws 401 ──→  request rejected
\`\`\`

---

## Your Task

### Step 1 — Build the authenticate middleware
Open \`apps/api/src/middlewares/authenticate.ts\`

### Step 2 — Implement GET /me
Open \`apps/api/src/modules/auth/auth.controller.ts\` — find the getMe TODO.
The /me endpoint reads \`req.user\` (set by authenticate) and returns the user profile.

---

## Verify

\`\`\`bash
# Log in to get your token
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"alice@example.com","password":"SecurePass123!"}' \\
  | jq -r '.accessToken')

# Call /me with the token
curl http://localhost:5000/api/auth/me \\
  -H "Authorization: Bearer $TOKEN"

# Expected: { "id": "...", "email": "alice@example.com", ... }

# Try without token
curl http://localhost:5000/api/auth/me
# Expected: 401 { "error": "No token provided" }
\`\`\`

---

## When done:
\`\`\`bash
git add apps/api/src/
git commit -m "Ch06: Implemented authenticate middleware and /me endpoint"
git checkout tutorial/07-refresh-tokens
\`\`\`
`;

const ch06_authenticate_ts = `// ============================================================
// apps/api/src/middlewares/authenticate.ts — Chapter 6 Exercise
// ============================================================
//
// 📚 LEARN: Middleware is a function that runs between the HTTP request
// arriving and your route handler executing.
//
// Middleware signature: (req, res, next) => void
//   - req: the incoming request
//   - res: the response builder
//   - next(): call this to pass control to the next middleware/handler
//             DON'T call next() if you send a response (like a 401 error)
//
// This middleware:
// 1. Reads the token from the Authorization header or cookie
// 2. Verifies the JWT signature
// 3. Attaches the decoded payload to req.user
// 4. Calls next() so the route handler runs
//
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';

// 📚 LEARN: We extend Express's Request type so TypeScript knows
// that req.user exists after this middleware runs.
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string };
    }
  }
}

/**
 * ✅ TODO Ch06 Step 1: Implement the authenticate middleware.
 *
 * Algorithm:
 * 1. Get the token:
 *    a. Check Authorization header: "Bearer eyJ..."
 *       → const header = req.headers.authorization;
 *          if (header?.startsWith('Bearer ')) token = header.slice(7);
 *    b. OR check cookie: req.cookies?.accessToken
 *
 * 2. If no token found: return res.status(401).json({ error: 'No token provided' })
 *
 * 3. Verify the token: verifyAccessToken(token)
 *    If it throws (expired/invalid): return res.status(401).json({ error: 'Invalid token' })
 *
 * 4. Attach user to request: req.user = { id: payload.sub, role: payload.role }
 *
 * 5. Call next()
 *
 * 💡 HINT: Use try/catch around verifyAccessToken — it throws on invalid tokens.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  // YOUR CODE HERE ↓
  res.status(501).json({ error: 'Middleware not implemented — complete Chapter 6!' });
}
`;

// ── Chapter 7: Refresh Tokens ─────────────────────────────────────────────────
const ch07_chapter_md = `# Chapter 7: Refresh Tokens & Logout

> **Branch:** \`tutorial/07-refresh-tokens\`
> **Previous:** Chapter 6 (Protected routes work ✅)
> **Time:** ~60 minutes

---

## The Problem with Short-Lived Access Tokens

Access tokens expire in 15 minutes for security. But users don't want to
log in every 15 minutes! How do we keep them logged in safely?

## The Solution: Token Pair Architecture

\`\`\`
Access Token  — Short-lived (15min), stateless JWT, kept in memory
Refresh Token — Long-lived (30 days), stored in DB, kept in HttpOnly cookie
\`\`\`

### The Refresh Flow
\`\`\`
1. Access token expires → API returns 401
2. Client sends refresh token → POST /api/auth/refresh
3. Server validates refresh token against DB
4. Server issues new access token + new refresh token (ROTATION)
5. Old refresh token is deleted from DB (one-time use)
\`\`\`

### Why rotate refresh tokens?
If an attacker steals a refresh token and tries to use it AFTER you've already
used it (rotated it), the server detects REUSE and logs out ALL your sessions.

---

## Your Task

### Step 1 — Add Session model to Prisma schema
Sessions table stores refresh tokens (hashed).

### Step 2 — Implement createSession + rotateRefreshToken
Open \`apps/api/src/utils/tokens.ts\`

### Step 3 — Add refresh + logout to the service
Open \`apps/api/src/modules/auth/auth.service.ts\`

---

## Verify

\`\`\`bash
# Login — now you get both tokens
curl -X POST http://localhost:5000/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"alice@example.com","password":"SecurePass123!"}' \\
  -c cookies.txt

# Refresh the token
curl -X POST http://localhost:5000/api/auth/refresh \\
  -b cookies.txt -c cookies.txt

# Logout
curl -X POST http://localhost:5000/api/auth/logout \\
  -b cookies.txt
\`\`\`

---

## When done:
\`\`\`bash
git add apps/api/
git commit -m "Ch07: Implemented refresh tokens and logout"
git checkout tutorial/08-rate-limiting
\`\`\`
`;

const ch07_tokens_ts = `// ============================================================
// apps/api/src/utils/tokens.ts — Chapter 7 Exercise
// ============================================================
//
// 📚 LEARN: Refresh tokens are stored in the database so we can:
// 1. Revoke them (logout)
// 2. Detect reuse (replay attack prevention)
// 3. Track active sessions (logout from all devices)
//
// We store a HASH of the refresh token, not the token itself.
// This way, even if the DB is compromised, attackers can't use the tokens.
//
// The flow:
// createSession()     → writes a hashed refresh token to the sessions table
// rotateRefreshToken() → validates old token, writes new one, deletes old
// revokeSession()     → deletes the session from the DB
//
// ============================================================
import { randomBytes } from 'crypto';
import { prisma } from '../db/prisma.js';

/**
 * Create a new session and return the plain refresh token.
 *
 * ✅ TODO Ch07 Step 1: Implement this function.
 *
 * Steps:
 * 1. Generate a random token: randomBytes(48).toString('hex')
 * 2. Hash it: use crypto.createHash('sha256').update(token).digest('hex')
 * 3. Save to DB: prisma.session.create({ data: { userId, tokenHash, ... } })
 * 4. Return the PLAIN token (the client needs this, not the hash)
 *
 * 💡 HINT: The Session model needs: id (cuid), userId, tokenHash, expiresAt, createdAt
 */
export async function createSession(
  userId: string,
  deviceInfo?: { browser?: string; os?: string },
  ipAddress?: string
): Promise<{ refreshToken: string; sessionId: string }> {
  // YOUR CODE HERE ↓
  throw new Error('Not implemented — complete Chapter 7!');
}

/**
 * Rotate a refresh token (one-time use).
 *
 * ✅ TODO Ch07 Step 2: Implement this function.
 *
 * Steps:
 * 1. Hash the incoming refresh token
 * 2. Find the session where tokenHash matches
 * 3. If not found → REUSE DETECTED → delete ALL user sessions, return null
 * 4. If found → delete the old session, create a new one
 * 5. Return the new { refreshToken, sessionId }
 *
 * 💡 HINT: This is the core security mechanism. If token is reused,
 *          it means either: (a) the user re-sent an old request, or
 *          (b) an attacker stole the token. Either way, revoke everything.
 */
export async function rotateRefreshToken(
  oldToken: string,
  userId: string
): Promise<{ refreshToken: string; sessionId: string } | null> {
  // YOUR CODE HERE ↓
  throw new Error('Not implemented — complete Chapter 7!');
}

/**
 * Revoke a single session (logout).
 *
 * ✅ TODO Ch07 Step 3: Implement this function.
 * 💡 HINT: prisma.session.deleteMany({ where: { id: sessionId } })
 */
export async function revokeSession(sessionId: string): Promise<void> {
  // YOUR CODE HERE ↓
  throw new Error('Not implemented — complete Chapter 7!');
}
`;

const ch07_schema_with_session = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String?
  name          String?
  role          String    @default("USER")
  emailVerified Boolean   @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  sessions      Session[]
}

// ✅ TODO Ch07 Step 0: Add the Session model below.
//
// 📚 LEARN: We store refresh tokens in the database so we can revoke them.
// We store the HASH of the token, not the plain token (extra security layer).
//
// A Session needs:
//   id          String   @id @default(cuid())
//   userId      String               // which user owns this session
//   tokenHash   String   @unique     // SHA-256 hash of the refresh token
//   expiresAt   DateTime             // when this session expires
//   ipAddress   String?              // optional: for audit logs
//   createdAt   DateTime @default(now())
//
//   user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
//
// YOUR CODE HERE ↓
`;

// ── Chapter 8: Rate Limiting ──────────────────────────────────────────────────
const ch08_chapter_md = `# Chapter 8: Rate Limiting & Security Headers

> **Branch:** \`tutorial/08-rate-limiting-security\`
> **Previous:** Chapter 7 (Refresh tokens + logout work ✅)
> **Time:** ~25 minutes

---

## Why Rate Limiting?

Without rate limiting, an attacker can try millions of password combinations:
\`\`\`
for password in wordlist:
    POST /api/auth/login { email, password }
# Tries 10,000 passwords per second
\`\`\`

With rate limiting: max 5 login attempts per 15 minutes per IP.
Now it takes 500+ hours to try 10,000 passwords.

---

## Why Security Headers?

Browsers blindly trust JavaScript. Security headers tell browsers:
- \`X-Frame-Options: DENY\` → Prevents clickjacking attacks
- \`X-Content-Type-Options: nosniff\` → Prevents MIME sniffing
- \`Content-Security-Policy\` → Controls what scripts can run
- \`Strict-Transport-Security\` → Forces HTTPS

The \`helmet\` npm package sets all these with one line.

---

## Your Task

### Step 1 — Add helmet for security headers
Open \`apps/api/src/app.ts\` and add \`app.use(helmet())\`

### Step 2 — Implement rate limiters
Open \`apps/api/src/middlewares/rateLimiter.ts\`

Create three rate limiters:
- \`loginLimiter\` — 5 attempts per 15 minutes
- \`signupLimiter\` — 3 attempts per hour
- \`generalLimiter\` — 100 requests per 15 minutes

### Step 3 — Apply them to routes
In \`auth.routes.ts\`, add the rate limiters before the controller functions.

---

## Verify

\`\`\`bash
# Hit login 6 times with wrong password
for i in {1..6}; do
  curl -X POST http://localhost:5000/api/auth/login \\
    -H "Content-Type: application/json" \\
    -d '{"email":"alice@example.com","password":"wrong"}'
done
# The 6th attempt should return 429 Too Many Requests
\`\`\`

---

## When done:
\`\`\`bash
git add apps/api/src/
git commit -m "Ch08: Added rate limiting and security headers"
git checkout tutorial/09-rbac-roles
\`\`\`
`;

const ch08_ratelimiter_ts = `// ============================================================
// apps/api/src/middlewares/rateLimiter.ts — Chapter 8 Exercise
// ============================================================
//
// 📚 LEARN: Rate limiting protects against:
// - Brute force attacks: trying many passwords
// - Credential stuffing: trying leaked email/password combos
// - DoS: flooding your server with requests
//
// express-rate-limit tracks request counts per IP in memory.
// In production, you'd use Redis to share counts across multiple servers.
//
// ============================================================
import rateLimit from 'express-rate-limit';

/**
 * ✅ TODO Ch08 Step 2a: Create the login rate limiter.
 *
 * Requirements:
 * - Window: 15 minutes
 * - Max attempts: 5
 * - Message: { error: 'Too many login attempts. Try again in 15 minutes.' }
 *
 * 💡 HINT:
 * export const loginLimiter = rateLimit({
 *   windowMs: 15 * 60 * 1000,
 *   max: 5,
 *   message: { error: '...' },
 *   standardHeaders: true,   // Returns rate limit info in headers
 *   legacyHeaders: false,
 * });
 */
export const loginLimiter = rateLimit({
  // YOUR CODE HERE ↓
  windowMs: 15 * 60 * 1000,
  max: 5, // ← change these values
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

/**
 * ✅ TODO Ch08 Step 2b: Create the signup rate limiter.
 * Requirements: 3 per hour per IP.
 */
export const signupLimiter = rateLimit({
  // YOUR CODE HERE ↓
  windowMs: 60 * 60 * 1000,
  max: 100, // ← set to 3
  message: { error: 'Too many accounts created. Try again later.' },
});

/**
 * ✅ TODO Ch08 Step 2c: Create a general API rate limiter.
 * Requirements: 100 requests per 15 minutes per IP.
 */
export const generalLimiter = rateLimit({
  // YOUR CODE HERE ↓
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests. Please slow down.' },
});
`;

// ── Chapter 9: RBAC ────────────────────────────────────────────────────────────
const ch09_chapter_md = `# Chapter 9: Role-Based Access Control (RBAC)

> **Branch:** \`tutorial/09-rbac-roles\`
> **Previous:** Chapter 8 (Rate limiting + security headers ✅)
> **Time:** ~25 minutes

---

## What is RBAC?

**Role-Based Access Control** means: what you can do depends on your role.

\`\`\`
USER  → can read their own profile, update their name
ADMIN → can list all users, delete accounts, see audit logs
\`\`\`

## How it works with JWTs

The user's role is embedded in the JWT payload at login:
\`\`\`json
{ "sub": "user_123", "role": "ADMIN", "iat": 1234, "exp": 5678 }
\`\`\`

Your \`authenticate\` middleware reads this and sets \`req.user.role\`.
Then a \`requireRole\` middleware checks if the role is allowed.

---

## Your Task

### Step 1 — Build the requireRole middleware
Open \`apps/api/src/middlewares/requireRole.ts\`

### Step 2 — Create an admin route
Open \`apps/api/src/modules/users/users.routes.ts\`

Add a \`GET /api/users\` route that:
- Requires authentication (\`authenticate\` middleware)
- Requires ADMIN role (\`requireRole('ADMIN')\` middleware)
- Returns a list of all users

---

## Verify

\`\`\`bash
# Log in as a regular user and try to access admin route
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"alice@example.com","password":"SecurePass123!"}' \\
  | jq -r '.accessToken')

curl http://localhost:5000/api/users \\
  -H "Authorization: Bearer $TOKEN"

# Expected: 403 Forbidden { "error": "Insufficient permissions" }
\`\`\`

---

## Congratulations! 🎉
You've built a production-grade authentication system from scratch!

### What you built across 9 chapters:
1. ✅ Express server
2. ✅ Secure password hashing (bcrypt)
3. ✅ Database with Prisma
4. ✅ User signup endpoint
5. ✅ Login with JWT access tokens
6. ✅ Protected routes (authenticate middleware)
7. ✅ Refresh tokens with rotation (replay attack prevention)
8. ✅ Rate limiting + security headers
9. ✅ Role-based access control (RBAC)

### Next steps:
- Add email verification
- Add Google OAuth (see \`solutions/api\` for reference)
- Add multi-factor authentication (TOTP)
- Deploy to production with proper environment variables
`;

const ch09_requirerole_ts = `// ============================================================
// apps/api/src/middlewares/requireRole.ts — Chapter 9 Exercise
// ============================================================
//
// 📚 LEARN: RBAC (Role-Based Access Control) is the most common
// authorization pattern. You assign roles to users, then check
// which roles are allowed to access each route.
//
// This middleware is used AFTER authenticate:
//   router.get('/admin', authenticate, requireRole('ADMIN'), handler)
//
// The authenticate middleware runs first, sets req.user.
// requireRole checks if req.user.role matches the required role.
//
// ============================================================
import { Request, Response, NextFunction } from 'express';

/**
 * ✅ TODO Ch09 Step 1: Implement the requireRole middleware factory.
 *
 * A "middleware factory" is a function that RETURNS a middleware function.
 * This lets you pass parameters: requireRole('ADMIN'), requireRole('USER').
 *
 * Algorithm:
 * 1. If req.user is not set → 401 (not authenticated)
 * 2. If req.user.role !== requiredRole → 403 Forbidden
 * 3. Otherwise → call next()
 *
 * 💡 HINT:
 * export function requireRole(role: string) {
 *   return (req: Request, res: Response, next: NextFunction): void => {
 *     if (!req.user) { return res.status(401).json(...) }
 *     if (req.user.role !== role) { return res.status(403).json(...) }
 *     next();
 *   };
 * }
 */
export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // YOUR CODE HERE ↓
    res.status(501).json({ error: 'requireRole not implemented — complete Chapter 9!' });
  };
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCRIPT
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  console.log('\n🚀 Creating 9 tutorial branches...\n');

  // Stage and commit any pending changes on current branch
  exec('git add -A');
  try {
    exec('git commit -m "chore: checkpoint before creating tutorial branches"');
  } catch {
    console.log('  (nothing to commit, continuing)');
  }

  // ── BRANCH 01: Express Server ───────────────────────────────────────────────
  console.log('\n═══ Creating tutorial/01-express-server ═══');
  exec('git checkout main');

  // Delete any existing tutorial branches to recreate cleanly
  const tutorialBranches = [
    'tutorial/01-express-server',
    'tutorial/02-password-hashing',
    'tutorial/03-database-and-users',
    'tutorial/04-signup-endpoint',
    'tutorial/05-login-and-jwt',
    'tutorial/06-protected-routes',
    'tutorial/07-refresh-tokens',
    'tutorial/08-rate-limiting-security',
    'tutorial/09-rbac-roles',
  ];

  for (const b of tutorialBranches) {
    try { exec(`git branch -D ${b}`); } catch {}
  }

  exec('git checkout -b tutorial/01-express-server');

  // Minimal package.json for the api to compile
  write('apps/api/package.json', JSON.stringify({
    name: "@auth/api",
    version: "1.0.0",
    private: true,
    type: "module",
    scripts: {
      dev: "tsx watch --env-file=.env src/index.ts",
      build: "tsc"
    },
    dependencies: {
      express: "^4.18.2"
    },
    devDependencies: {
      "@types/express": "^4.17.21",
      "@types/node": "^20.14.10",
      tsx: "^4.7.0",
      typescript: "^5.4.5"
    }
  }, null, 2));

  write('CHAPTER.md', ch01_chapter_md);
  write('apps/api/src/index.ts', ch01_index_ts);
  write('apps/api/src/routes/health.ts', ch01_health_ts);

  exec('git add -A');
  exec('git commit -m "tutorial/01: Chapter 1 — Express Server starter"');

  // ── BRANCH 02: Password Hashing ─────────────────────────────────────────────
  console.log('\n═══ Creating tutorial/02-password-hashing ═══');
  exec('git checkout -b tutorial/02-password-hashing');

  write('CHAPTER.md', ch02_chapter_md);
  // Complete ch01
  write('apps/api/src/index.ts', ch01_index_ts_done);
  write('apps/api/src/routes/health.ts', ch01_health_ts_done);
  // Add ch02 dependencies to package.json
  write('apps/api/package.json', JSON.stringify({
    name: "@auth/api",
    version: "1.0.0",
    private: true,
    type: "module",
    scripts: { dev: "tsx watch --env-file=.env src/index.ts" },
    dependencies: { express: "^4.18.2", bcryptjs: "^2.4.3" },
    devDependencies: {
      "@types/express": "^4.17.21",
      "@types/bcryptjs": "^2.4.6",
      "@types/node": "^20.14.10",
      tsx: "^4.7.0",
      typescript: "^5.4.5"
    }
  }, null, 2));
  // Ch02 TODO
  write('apps/api/src/utils/hash.ts', ch02_hash_ts);

  exec('git add -A');
  exec('git commit -m "tutorial/02: Chapter 2 — Password Hashing starter (Ch01 complete)"');

  // ── BRANCH 03: Database ──────────────────────────────────────────────────────
  console.log('\n═══ Creating tutorial/03-database-and-users ═══');
  exec('git checkout -b tutorial/03-database-and-users');

  write('CHAPTER.md', ch03_chapter_md);
  // Complete ch02
  write('apps/api/src/utils/hash.ts', ch02_hash_ts_done);
  // Add Prisma to package.json
  write('apps/api/package.json', JSON.stringify({
    name: "@auth/api",
    version: "1.0.0",
    private: true,
    type: "module",
    scripts: {
      dev: "tsx watch --env-file=.env src/index.ts",
      "db:migrate": "prisma migrate dev",
      "db:studio": "prisma studio",
      "db:generate": "prisma generate"
    },
    dependencies: {
      express: "^4.18.2",
      bcryptjs: "^2.4.3",
      "@prisma/client": "^5.15.0"
    },
    devDependencies: {
      "@types/express": "^4.17.21",
      "@types/bcryptjs": "^2.4.6",
      "@types/node": "^20.14.10",
      prisma: "^5.15.0",
      tsx: "^4.7.0",
      typescript: "^5.4.5"
    }
  }, null, 2));
  // Ch03 TODOs
  write('apps/api/prisma/schema.prisma', ch03_schema_prisma);
  write('apps/api/src/db/prisma.ts', ch03_db_prisma_ts);

  exec('git add -A');
  exec('git commit -m "tutorial/03: Chapter 3 — Database & Prisma starter (Ch02 complete)"');

  // ── BRANCH 04: Signup ────────────────────────────────────────────────────────
  console.log('\n═══ Creating tutorial/04-signup-endpoint ═══');
  exec('git checkout -b tutorial/04-signup-endpoint');

  write('CHAPTER.md', ch04_chapter_md);
  // Complete ch03
  write('apps/api/prisma/schema.prisma', ch03_schema_done);
  write('apps/api/src/db/prisma.ts', ch03_db_done);
  // Update index to mount auth routes
  write('apps/api/src/index.ts', `import express from 'express';
import { prisma } from './db/prisma.js';
import healthRouter from './routes/health.js';
import authRouter from './modules/auth/auth.routes.js';

const app = express();
app.use(express.json());
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);

const PORT = Number(process.env.API_PORT) || 5000;
app.listen(PORT, async () => {
  await prisma.$connect();
  console.log('🚀 Auth API running at http://localhost:' + PORT);
  console.log('📚 Chapter 4: Signup Endpoint — open apps/api/src/modules/auth/');
});
`);
  // Add jsonwebtoken to deps
  write('apps/api/package.json', JSON.stringify({
    name: "@auth/api",
    version: "1.0.0",
    private: true,
    type: "module",
    scripts: {
      dev: "tsx watch --env-file=.env src/index.ts",
      "db:migrate": "prisma migrate dev",
      "db:studio": "prisma studio"
    },
    dependencies: {
      express: "^4.18.2",
      bcryptjs: "^2.4.3",
      "@prisma/client": "^5.15.0",
      jsonwebtoken: "^9.0.2"
    },
    devDependencies: {
      "@types/express": "^4.17.21",
      "@types/bcryptjs": "^2.4.6",
      "@types/jsonwebtoken": "^9.0.6",
      "@types/node": "^20.14.10",
      prisma: "^5.15.0",
      tsx: "^4.7.0",
      typescript: "^5.4.5"
    }
  }, null, 2));
  // Ch04 TODOs
  write('apps/api/src/modules/auth/auth.repository.ts', ch04_repository_ts);
  write('apps/api/src/modules/auth/auth.service.ts', ch04_service_ts);
  write('apps/api/src/modules/auth/auth.controller.ts', ch04_controller_ts);
  write('apps/api/src/modules/auth/auth.routes.ts', ch04_routes_ts);

  exec('git add -A');
  exec('git commit -m "tutorial/04: Chapter 4 — Signup Endpoint starter (Ch03 complete)"');

  // ── BRANCH 05: Login + JWT ───────────────────────────────────────────────────
  console.log('\n═══ Creating tutorial/05-login-and-jwt ═══');
  exec('git checkout -b tutorial/05-login-and-jwt');

  write('CHAPTER.md', ch05_chapter_md);
  // Complete ch04
  write('apps/api/src/modules/auth/auth.repository.ts', ch04_repository_done);
  write('apps/api/src/modules/auth/auth.service.ts', ch05_service_with_login_todo);
  write('apps/api/src/modules/auth/auth.controller.ts', ch05_controller_with_login_todo);
  write('apps/api/src/modules/auth/auth.routes.ts', ch05_routes_with_login);
  // Ch05 TODOs
  write('apps/api/src/utils/jwt.ts', ch05_jwt_ts);

  exec('git add -A');
  exec('git commit -m "tutorial/05: Chapter 5 — Login + JWT starter (Ch04 complete)"');

  // ── BRANCH 06: Protected Routes ──────────────────────────────────────────────
  console.log('\n═══ Creating tutorial/06-protected-routes ═══');
  exec('git checkout -b tutorial/06-protected-routes');

  write('CHAPTER.md', ch06_chapter_md);
  // Complete ch05 jwt + service
  write('apps/api/src/utils/jwt.ts', `import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET || 'dev-access-secret';
const ACCESS_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';

export type AccessTokenPayload = { sub: string; role: string };

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY }) as string;
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload;
}
`);
  write('apps/api/src/modules/auth/auth.service.ts', `import { authRepository } from './auth.repository.js';
import { hashPassword, comparePassword } from '../../utils/hash.js';
import { signAccessToken } from '../../utils/jwt.js';

export const authService = {
  async signup(input: { email: string; password: string; name?: string }) {
    const taken = await authRepository.emailExists(input.email);
    if (taken) throw new Error('DUPLICATE_EMAIL');
    const passwordHash = await hashPassword(input.password);
    const user = await authRepository.createUser({ email: input.email, passwordHash, name: input.name });
    const { passwordHash: _, ...safeUser } = user as any;
    return { user: safeUser };
  },

  async login(input: { email: string; password: string }) {
    const user = await authRepository.findByEmailWithPassword(input.email);
    const DUMMY = '$2a$12$dummyhashdummyhashdummyhashdummyhash1234567890';
    const valid = await comparePassword(input.password, user?.passwordHash ?? DUMMY);
    if (!user || !valid) throw new Error('INVALID_CREDENTIALS');
    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    return { accessToken };
  },
};
`);
  write('apps/api/src/modules/auth/auth.controller.ts', `import { Request, Response } from 'express';
import { authService } from './auth.service.js';
import { verifyAccessToken } from '../../utils/jwt.js';
import { authRepository } from './auth.repository.js';

export async function signup(req: Request, res: Response) {
  try {
    const result = await authService.signup(req.body);
    res.status(201).json(result);
  } catch (err: any) {
    if (err.message === 'DUPLICATE_EMAIL') return res.status(409).json({ error: 'Email already in use' });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (err: any) {
    if (err.message === 'INVALID_CREDENTIALS') return res.status(401).json({ error: 'Invalid email or password' });
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Chapter 6 TODO ────────────────────────────────────────────────────────────
/**
 * GET /api/auth/me
 *
 * ✅ TODO Ch06 Step 2: Return the current user's profile.
 *
 * By the time this runs, the \`authenticate\` middleware has already:
 *   - Verified the token
 *   - Set req.user = { id: '...', role: '...' }
 *
 * You need to:
 * 1. Use req.user.id to fetch the full user from the database
 * 2. Return the user (without passwordHash)
 *
 * 💡 HINT: authRepository.findById(req.user.id)
 */
export async function getMe(req: Request, res: Response) {
  // YOUR CODE HERE ↓
  res.status(501).json({ error: 'Not implemented — complete Chapter 6!' });
}

export async function refreshToken(req: Request, res: Response) {
  res.status(501).json({ error: 'Not implemented yet — complete Chapter 7!' });
}
export async function logout(req: Request, res: Response) {
  res.status(501).json({ error: 'Not implemented yet — complete Chapter 7!' });
}
`);
  // Ch06 TODO
  write('apps/api/src/middlewares/authenticate.ts', ch06_authenticate_ts);
  // Updated routes with authenticate
  write('apps/api/src/modules/auth/auth.routes.ts', `import { Router } from 'express';
import { signup, login, getMe, refreshToken, logout } from './auth.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', authenticate, getMe);  // authenticate runs first!
router.post('/refresh', refreshToken);
router.post('/logout', logout);

export default router;
`);

  exec('git add -A');
  exec('git commit -m "tutorial/06: Chapter 6 — Protected Routes starter (Ch05 complete)"');

  // ── BRANCH 07: Refresh Tokens ────────────────────────────────────────────────
  console.log('\n═══ Creating tutorial/07-refresh-tokens ═══');
  exec('git checkout -b tutorial/07-refresh-tokens');

  write('CHAPTER.md', ch07_chapter_md);
  // Complete ch06
  write('apps/api/src/middlewares/authenticate.ts', `import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';

declare global {
  namespace Express {
    interface Request { user?: { id: string; role: string }; }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  let token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) token = (req as any).cookies?.accessToken;

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
`);
  write('apps/api/src/modules/auth/auth.controller.ts', `import { Request, Response } from 'express';
import { authService } from './auth.service.js';
import { authRepository } from './auth.repository.js';

export async function signup(req: Request, res: Response) {
  try {
    res.status(201).json(await authService.signup(req.body));
  } catch (err: any) {
    if (err.message === 'DUPLICATE_EMAIL') return res.status(409).json({ error: 'Email already in use' });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    res.json(await authService.login(req.body));
  } catch (err: any) {
    if (err.message === 'INVALID_CREDENTIALS') return res.status(401).json({ error: 'Invalid email or password' });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getMe(req: Request, res: Response) {
  try {
    const user = await authRepository.findById(req.user!.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { passwordHash: _, ...safeUser } = user as any;
    res.json({ user: safeUser });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Chapter 7 TODOs ───────────────────────────────────────────────────────────
/**
 * POST /api/auth/refresh
 * ✅ TODO Ch07 Step 4: Implement token refresh.
 * 1. Get refresh token from cookie: req.cookies?.refreshToken
 * 2. Call authService.refresh(refreshToken)
 * 3. Set new cookies, return new accessToken
 */
export async function refreshToken(req: Request, res: Response) {
  // YOUR CODE HERE ↓
  res.status(501).json({ error: 'Not implemented — complete Chapter 7!' });
}

/**
 * POST /api/auth/logout
 * ✅ TODO Ch07 Step 5: Implement logout.
 * 1. Get sessionId from req.user (after authenticate middleware)
 * 2. Call authService.logout(sessionId, userId)
 * 3. Clear the refresh token cookie
 * 4. Return 204 No Content
 */
export async function logout(req: Request, res: Response) {
  // YOUR CODE HERE ↓
  res.status(501).json({ error: 'Not implemented — complete Chapter 7!' });
}
`);
  // Add cookie-parser to deps
  write('apps/api/package.json', JSON.stringify({
    name: "@auth/api",
    version: "1.0.0",
    private: true,
    type: "module",
    scripts: {
      dev: "tsx watch --env-file=.env src/index.ts",
      "db:migrate": "prisma migrate dev"
    },
    dependencies: {
      express: "^4.18.2",
      bcryptjs: "^2.4.3",
      "@prisma/client": "^5.15.0",
      jsonwebtoken: "^9.0.2",
      "cookie-parser": "^1.4.6"
    },
    devDependencies: {
      "@types/express": "^4.17.21",
      "@types/bcryptjs": "^2.4.6",
      "@types/jsonwebtoken": "^9.0.6",
      "@types/cookie-parser": "^1.4.7",
      "@types/node": "^20.14.10",
      prisma: "^5.15.0",
      tsx: "^4.7.0",
      typescript: "^5.4.5"
    }
  }, null, 2));
  // Ch07 TODOs
  write('apps/api/prisma/schema.prisma', ch07_schema_with_session);
  write('apps/api/src/utils/tokens.ts', ch07_tokens_ts);

  exec('git add -A');
  exec('git commit -m "tutorial/07: Chapter 7 — Refresh Tokens starter (Ch06 complete)"');

  // ── BRANCH 08: Rate Limiting ─────────────────────────────────────────────────
  console.log('\n═══ Creating tutorial/08-rate-limiting-security ═══');
  exec('git checkout -b tutorial/08-rate-limiting-security');

  write('CHAPTER.md', ch08_chapter_md);
  // Add rate limit + helmet to deps
  write('apps/api/package.json', JSON.stringify({
    name: "@auth/api",
    version: "1.0.0",
    private: true,
    type: "module",
    scripts: { dev: "tsx watch --env-file=.env src/index.ts", "db:migrate": "prisma migrate dev" },
    dependencies: {
      express: "^4.18.2",
      bcryptjs: "^2.4.3",
      "@prisma/client": "^5.15.0",
      jsonwebtoken: "^9.0.2",
      "cookie-parser": "^1.4.6",
      "express-rate-limit": "^7.3.1",
      helmet: "^7.1.0"
    },
    devDependencies: {
      "@types/express": "^4.17.21",
      "@types/bcryptjs": "^2.4.6",
      "@types/jsonwebtoken": "^9.0.6",
      "@types/cookie-parser": "^1.4.7",
      "@types/node": "^20.14.10",
      prisma: "^5.15.0",
      tsx: "^4.7.0",
      typescript: "^5.4.5"
    }
  }, null, 2));
  // Ch08 TODO
  write('apps/api/src/middlewares/rateLimiter.ts', ch08_ratelimiter_ts);

  exec('git add -A');
  exec('git commit -m "tutorial/08: Chapter 8 — Rate Limiting starter (Ch07 complete)"');

  // ── BRANCH 09: RBAC ──────────────────────────────────────────────────────────
  console.log('\n═══ Creating tutorial/09-rbac-roles ═══');
  exec('git checkout -b tutorial/09-rbac-roles');

  write('CHAPTER.md', ch09_chapter_md);
  // Complete ch08 rate limiter
  write('apps/api/src/middlewares/rateLimiter.ts', `import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true, legacyHeaders: false,
});

export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 3,
  message: { error: 'Too many accounts created. Try again later.' },
  standardHeaders: true, legacyHeaders: false,
});

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 100,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true, legacyHeaders: false,
});
`);
  // Ch09 TODO
  write('apps/api/src/middlewares/requireRole.ts', ch09_requirerole_ts);

  exec('git add -A');
  exec('git commit -m "tutorial/09: Chapter 9 — RBAC starter (Ch08 complete)"');

  // ── Return to main ────────────────────────────────────────────────────────────
  exec('git checkout main');

  console.log('\n\n✅ All 9 tutorial branches created!\n');
  console.log('Branch list:');
  console.log('  tutorial/01-express-server');
  console.log('  tutorial/02-password-hashing');
  console.log('  tutorial/03-database-and-users');
  console.log('  tutorial/04-signup-endpoint');
  console.log('  tutorial/05-login-and-jwt');
  console.log('  tutorial/06-protected-routes');
  console.log('  tutorial/07-refresh-tokens');
  console.log('  tutorial/08-rate-limiting-security');
  console.log('  tutorial/09-rbac-roles');
  console.log('\nTo start: git checkout tutorial/01-express-server && cat CHAPTER.md');
}

main();
