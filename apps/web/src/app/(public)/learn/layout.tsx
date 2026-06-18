import fs from "fs";
import path from "path";
import Link from "next/link";
import { BookOpen, CheckCircle, Circle } from "lucide-react";

// All milestone definitions — title, slug, level, and description
const MILESTONES = [
  { slug: "M0-foundations",       title: "M0: Foundations",           level: "Beginner",      desc: "AuthN vs AuthZ, HTTP statelessness, session vs token architecture." },
  { slug: "M1-mvp-auth",          title: "M1: MVP Auth",              level: "Beginner",      desc: "Build the login, signup, and /me endpoints from scratch." },
  { slug: "M2-advanced-tokens",   title: "M2: Advanced Tokens",       level: "Intermediate",  desc: "Access tokens, refresh tokens, and rotation with replay attack prevention." },
  { slug: "M3-authorization",     title: "M3: Authorization (RBAC)",  level: "Intermediate",  desc: "Role-based access control: USER, ADMIN, SUPER_ADMIN." },
  { slug: "M4-nextjs-integration",title: "M4: Next.js Integration",   level: "Intermediate",  desc: "Server Components, Client Components, and the auto-refresh interceptor." },
  { slug: "M5-oauth",             title: "M5: OAuth 2.0 (Google)",    level: "Intermediate",  desc: "Authorization Code + PKCE flow for Google login." },
  { slug: "M6-advanced-security", title: "M6: Advanced Security",     level: "Advanced",      desc: "Rate limiting, CSRF, security headers, and anomaly detection." },
  { slug: "M7-session-management",title: "M7: Session Management",    level: "Advanced",      desc: "Multi-device sessions, device tracking, and remote revocation." },
  { slug: "M8-password-reset",    title: "M8: Password Reset",        level: "Advanced",      desc: "Secure email-based password reset with time-limited tokens." },
  { slug: "M9-mfa",               title: "M9: Multi-Factor Auth",     level: "Expert",        desc: "TOTP-based 2FA with QR code provisioning and backup codes." },
];

const LEVEL_COLORS: Record<string, string> = {
  Beginner:     "text-emerald-400 bg-emerald-400/10",
  Intermediate: "text-blue-400 bg-blue-400/10",
  Advanced:     "text-amber-400 bg-amber-400/10",
  Expert:       "text-rose-400 bg-rose-400/10",
};

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  // Check which milestones have files
  const docsDir = path.join(process.cwd(), "../../docs/milestones");
  let existingFiles = new Set<string>();
  try {
    const files = fs.readdirSync(docsDir);
    files.forEach(f => existingFiles.add(f.replace('.md', '')));
  } catch {}

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Nav */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <BookOpen className="w-5 h-5 text-primary" />
            Auth<span className="text-primary">Mastery</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/learn" className="text-muted-foreground hover:text-foreground transition-colors">Curriculum</Link>
            <Link href="/login" className="text-muted-foreground hover:text-foreground transition-colors">Sign In</Link>
            <Link href="/signup" className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors">
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      <div className="flex flex-1 max-w-screen-2xl mx-auto w-full">
        {/* Sidebar */}
        <aside className="w-72 flex-shrink-0 border-r bg-card/30 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
              Learning Path — Zero to Staff Engineer
            </p>
            <nav className="space-y-1">
              {MILESTONES.map((m, i) => {
                const exists = existingFiles.has(m.slug);
                const levelColor = LEVEL_COLORS[m.level];
                return (
                  <Link
                    key={m.slug}
                    href={exists ? `/learn/${m.slug}` : "#"}
                    className={`group flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${
                      exists
                        ? "hover:bg-muted/60 cursor-pointer"
                        : "opacity-40 cursor-not-allowed"
                    }`}
                  >
                    <span className="mt-0.5 flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors">
                      {exists ? <Circle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{m.title}</p>
                      <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded mt-0.5 ${levelColor}`}>
                        {m.level}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
