import { BookOpen, Code2, Database, Layout } from "lucide-react";

export const TRACKS = [
  {
    id: "core",
    title: "Core Curriculum",
    icon: BookOpen,
    color: "from-emerald-500/20 to-emerald-500/5",
    border: "border-emerald-500/30",
    badge: "bg-emerald-400/10 text-emerald-400",
    desc: "The step-by-step journey from zero to production-ready authentication.",
    milestones: [
      { slug: "M0-foundations",       title: "M0: Foundations",           level: "Beginner", time: "30 min", desc: "AuthN vs AuthZ. HTTP statelessness. Session vs JWT architecture." },
      { slug: "M1-mvp-auth",          title: "M1: MVP Auth",              level: "Beginner", time: "2 hrs", desc: "Build login, signup, and /me from scratch. Password hashing." },
      { slug: "M2-advanced-tokens",   title: "M2: Advanced Tokens",       level: "Intermediate", time: "3 hrs", desc: "Refresh token rotation. Replay attack detection." },
      { slug: "M3-authorization",     title: "M3: Authorization",         level: "Intermediate", time: "2 hrs", desc: "Role hierarchy: USER → ADMIN → SUPER_ADMIN." },
      { slug: "M4-nextjs-integration",title: "M4: Next.js Integration",   level: "Intermediate", time: "3 hrs", desc: "Server Components. Auto-refresh interceptor." },
      { slug: "M5-oauth",             title: "M5: OAuth 2.0 (Google)",    level: "Intermediate", time: "3 hrs", desc: "Authorization Code + PKCE flow. State parameter CSRF protection." },
      { slug: "M6-advanced-security", title: "M6: Advanced Security",     level: "Advanced", time: "2 hrs", desc: "Rate limiting. Security headers. Audit logging." },
      { slug: "M7-session-management",title: "M7: Session Management",    level: "Advanced", time: "2 hrs", desc: "Multi-device sessions. Device fingerprinting. Remote revocation." },
      { slug: "M8-password-reset",    title: "M8: Password Reset",        level: "Advanced", time: "2 hrs", desc: "Secure email flow. Time-limited HMAC tokens." },
      { slug: "M9-mfa",               title: "M9: Multi-Factor Auth",     level: "Expert", time: "3 hrs", desc: "TOTP algorithm (RFC 6238). QR code provisioning." },
    ]
  },
  {
    id: "backend",
    title: "Backend Deep Dives",
    icon: Database,
    color: "from-blue-500/20 to-blue-500/5",
    border: "border-blue-500/30",
    badge: "bg-blue-400/10 text-blue-400",
    desc: "In-depth explorations of backend architecture, database schema, and security flows.",
    milestones: [
      { slug: "B1-backend-jwt-lifecycle",  title: "B1: JWT Lifecycle",      level: "Intermediate", time: "1.5 hrs", desc: "The math behind JWTs. Symmetric vs Asymmetric signing." },
      { slug: "B2-backend-token-rotation", title: "B2: Token Rotation",     level: "Advanced", time: "2 hrs", desc: "The database schema and algorithms behind secure token rotation." },
    ]
  },
  {
    id: "frontend",
    title: "Frontend Deep Dives",
    icon: Layout,
    color: "from-amber-500/20 to-amber-500/5",
    border: "border-amber-500/30",
    badge: "bg-amber-400/10 text-amber-400",
    desc: "Mastering client-side security, state management, and seamless UX.",
    milestones: [
      { slug: "F1-frontend-fetch-interceptor", title: "F1: Fetch Interceptor", level: "Advanced", time: "2 hrs", desc: "Handling 401s, concurrency locks, and replay attack responses." },
      { slug: "F2-frontend-token-storage",     title: "F2: Token Storage",     level: "Intermediate", time: "1.5 hrs", desc: "Memory vs Cookies. Why localStorage is banned. State architecture." },
    ]
  },
  {
    id: "architecture",
    title: "Architecture",
    icon: Code2,
    color: "from-rose-500/20 to-rose-500/5",
    border: "border-rose-500/30",
    badge: "bg-rose-400/10 text-rose-400",
    desc: "High-level system design and architectural patterns.",
    milestones: [
      { slug: "A1-architecture-oauth-patterns", title: "A1: OAuth Patterns", level: "Expert", time: "1 hr", desc: "Backend-first vs Frontend-first vs BFF pattern analysis." },
    ]
  }
];

export const FLAT_MILESTONES = TRACKS.flatMap(track => track.milestones.map(m => m.slug));
