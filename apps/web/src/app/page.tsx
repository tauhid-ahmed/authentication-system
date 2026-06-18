import Link from "next/link";
import { ArrowRight, BookOpen, Shield, Zap } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background text-foreground relative overflow-hidden">
      {/* Background glow effect */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-3xl w-full flex flex-col items-center gap-10 text-center">
        {/* Badge */}
        <span className="inline-flex items-center gap-2 text-xs font-semibold bg-primary/10 text-primary px-4 py-1.5 rounded-full border border-primary/20">
          <BookOpen className="w-3.5 h-3.5" />
          Authentication Learning System
        </span>

        {/* Hero */}
        <div className="space-y-4">
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-none">
            Auth<span className="text-primary">Mastery</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            A complete, production-grade learning system taking you from zero to{" "}
            <strong className="text-foreground">Staff Engineer</strong> — covering every aspect of modern authentication.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <Link
            href="/learn"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-all hover:scale-105 active:scale-100"
          >
            <BookOpen className="w-4 h-4" />
            Start Learning — It&apos;s Free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-3.5 border rounded-lg font-medium hover:bg-muted/50 transition-colors"
          >
            Sign In to Dashboard
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mt-4">
          <div className="p-5 border rounded-xl bg-card text-left hover:border-primary/40 transition-colors group">
            <Zap className="w-5 h-5 text-primary mb-3" />
            <h3 className="font-semibold mb-1">M1–M4: Token Architecture</h3>
            <p className="text-sm text-muted-foreground">JWTs, HTTP-only cookies, refresh rotation, replay attack prevention.</p>
          </div>
          <div className="p-5 border rounded-xl bg-card text-left hover:border-primary/40 transition-colors group">
            <Shield className="w-5 h-5 text-primary mb-3" />
            <h3 className="font-semibold mb-1">M5–M7: System Design</h3>
            <p className="text-sm text-muted-foreground">OAuth 2.0 + PKCE, RBAC, multi-device session management.</p>
          </div>
          <div className="p-5 border rounded-xl bg-card text-left hover:border-primary/40 transition-colors group">
            <BookOpen className="w-5 h-5 text-primary mb-3" />
            <h3 className="font-semibold mb-1">M8–M9: Production</h3>
            <p className="text-sm text-muted-foreground">Password reset, TOTP multi-factor auth, and anomaly detection.</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          No account required to access the curriculum. <Link href="/signup" className="text-primary hover:underline">Create an account</Link> to interact with the live auth system.
        </p>
      </div>
    </main>
  );
}
