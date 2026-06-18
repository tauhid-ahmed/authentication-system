import Link from "next/link";
import { ArrowRight, BookOpen, Code2, Layers, Shield, Zap, Award } from "lucide-react";

const CURRICULUM = [
  {
    phase: "Phase 1: Foundations",
    color: "from-emerald-500/20 to-emerald-500/5",
    border: "border-emerald-500/30",
    badge: "bg-emerald-400/10 text-emerald-400",
    milestones: [
      { slug: "M0-foundations",  title: "M0: Foundations",        desc: "AuthN vs AuthZ. HTTP statelessness. Session vs JWT architecture. The token pair model.", time: "30 min" },
      { slug: "M1-mvp-auth",     title: "M1: MVP Authentication", desc: "Build login, signup, and /me from scratch. Password hashing. JWT signing and verification.", time: "2 hrs" },
    ],
  },
  {
    phase: "Phase 2: Token Mastery",
    color: "from-blue-500/20 to-blue-500/5",
    border: "border-blue-500/30",
    badge: "bg-blue-400/10 text-blue-400",
    milestones: [
      { slug: "M2-advanced-tokens",    title: "M2: Advanced Tokens",       desc: "Refresh token rotation. Replay attack detection. Concurrency lock for parallel refresh.", time: "3 hrs" },
      { slug: "M3-authorization",      title: "M3: RBAC Authorization",    desc: "Role hierarchy: USER → ADMIN → SUPER_ADMIN. Middleware guards. Permission checks.", time: "2 hrs" },
      { slug: "M4-nextjs-integration", title: "M4: Next.js Integration",   desc: "Server Components. Auto-refresh interceptor. Cookie forwarding. Hydration strategy.", time: "3 hrs" },
    ],
  },
  {
    phase: "Phase 3: Production Auth",
    color: "from-amber-500/20 to-amber-500/5",
    border: "border-amber-500/30",
    badge: "bg-amber-400/10 text-amber-400",
    milestones: [
      { slug: "M5-oauth",              title: "M5: OAuth 2.0 (Google)",    desc: "Authorization Code + PKCE flow. State parameter CSRF protection. Account linking.", time: "3 hrs" },
      { slug: "M6-advanced-security",  title: "M6: Advanced Security",     desc: "Rate limiting. Security headers. Audit logging. Anomaly detection patterns.", time: "2 hrs" },
      { slug: "M7-session-management", title: "M7: Session Management",    desc: "Multi-device sessions. Device fingerprinting. Remote revocation.", time: "2 hrs" },
    ],
  },
  {
    phase: "Phase 4: Staff Engineer",
    color: "from-rose-500/20 to-rose-500/5",
    border: "border-rose-500/30",
    badge: "bg-rose-400/10 text-rose-400",
    milestones: [
      { slug: "M8-password-reset", title: "M8: Password Reset",       desc: "Secure email flow. Time-limited HMAC tokens. Prevent enumeration attacks.", time: "2 hrs" },
      { slug: "M9-mfa",           title: "M9: Multi-Factor Auth",     desc: "TOTP algorithm (RFC 6238). QR code provisioning. Backup codes. Recovery flow.", time: "3 hrs" },
    ],
  },
];

const FEATURES = [
  { icon: BookOpen,  title: "Step-by-Step Curriculum",   desc: "10 structured milestones that build on each other. Theory → Code → Practice." },
  { icon: Code2,     title: "Real Production Code",      desc: "Every concept is demonstrated with actual working code in the repository." },
  { icon: Shield,    title: "Security-First Mindset",    desc: "Learn the attack vectors first, then how to defend against them." },
  { icon: Layers,    title: "Full Stack Coverage",       desc: "Express backend + Next.js frontend, working together as a real system." },
  { icon: Zap,       title: "Practice Exercises",        desc: "Each milestone ends with challenges to reinforce your understanding." },
  { icon: Award,     title: "Staff Engineer Patterns",   desc: "Learn the architectural decisions that separate senior from staff engineers." },
];

export default function LearnPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="px-8 py-16 border-b bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="max-w-3xl">
          <span className="inline-block text-xs font-semibold bg-primary/10 text-primary px-3 py-1 rounded-full mb-4 uppercase tracking-wider">
            Authentication Mastery
          </span>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Go from Zero to{" "}
            <span className="text-primary">Staff Engineer</span>{" "}
            in Authentication
          </h1>
          <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
            This is not a tutorial you follow blindly. This is a structured curriculum that teaches you
            <strong className="text-foreground"> why</strong> every decision exists, what attacks it prevents,
            and how to reproduce it from scratch in any stack.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/learn/M0-foundations"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Start Learning <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/signup" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Create account to track progress →
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-8 py-12 border-b">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-6">What makes this different</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-4 border rounded-lg bg-card hover:border-primary/50 transition-colors">
              <Icon className="w-5 h-5 text-primary mb-3" />
              <h3 className="font-semibold mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Curriculum Phases */}
      <section className="px-8 py-12">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-8">The Curriculum</h2>
        <div className="space-y-8">
          {CURRICULUM.map((phase) => (
            <div key={phase.phase}>
              <div className="flex items-center gap-3 mb-4">
                <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded ${phase.badge}`}>
                  {phase.phase}
                </span>
              </div>
              <div className={`border rounded-xl bg-gradient-to-br ${phase.color} ${phase.border} overflow-hidden`}>
                {phase.milestones.map((m, i) => (
                  <Link
                    key={m.slug}
                    href={`/learn/${m.slug}`}
                    className={`group flex items-start gap-4 p-5 hover:bg-white/5 transition-colors ${
                      i < phase.milestones.length - 1 ? "border-b border-inherit" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold group-hover:text-primary transition-colors">{m.title}</h3>
                        <span className="text-xs text-muted-foreground">· {m.time}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{m.desc}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-1 mt-1 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
