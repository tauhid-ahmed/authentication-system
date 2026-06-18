import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-background text-foreground">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm flex flex-col gap-8">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl text-center">
          Execution <span className="text-primary">Mastery</span>
        </h1>
        <p className="text-lg text-muted-foreground text-center max-w-2xl">
          A complete, production-grade learning system taking you from zero to
          Staff Engineer.
        </p>

        <div className="flex gap-4 mt-8">
          <Button asChild size="lg">
            <Link href="/login">Log In</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/signup">Create Account</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 w-full max-w-4xl">
          <div className="p-6 border rounded-lg bg-card text-card-foreground">
            <h3 className="font-semibold mb-2">M1-M6: Token Architecture</h3>
            <p className="text-sm text-muted-foreground">
              JWTs, HTTP-only cookies, refresh token rotation, and replay attack
              prevention.
            </p>
          </div>
          <div className="p-6 border rounded-lg bg-card text-card-foreground">
            <h3 className="font-semibold mb-2">M7-M12: System Design</h3>
            <p className="text-sm text-muted-foreground">
              Express architecture, Next.js Server Components, OAuth, RBAC, and
              multi-device sessions.
            </p>
          </div>
          <div className="p-6 border rounded-lg bg-card text-card-foreground">
            <h3 className="font-semibold mb-2">M13-M14: Production</h3>
            <p className="text-sm text-muted-foreground">
              Security hardening, rate limiting, audit logging, and anomaly
              detection.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
