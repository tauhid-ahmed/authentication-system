import fs from "fs";
import path from "path";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import LearnSidebar from "@/components/learn-sidebar";

export default function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const docsDir = path.join(process.cwd(), "../../docs/milestones");
  let existingFiles = new Set<string>();
  try {
    const files = fs.readdirSync(docsDir);
    files.forEach((f) => existingFiles.add(f.replace(".md", "")));
  } catch {}

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-xl">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold text-base sm:text-lg tracking-tight"
          >
            <BookOpen className="w-5 h-5 text-primary" />
            <span>
              Execution <span className="text-primary">Mastery</span>
            </span>
          </Link>
          <nav className="flex items-center gap-3 sm:gap-4 text-sm">
            <Link
              href="/learn"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Curriculum
            </Link>
            <Link
              href="/login"
              className="hidden sm:inline text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      <div className="flex h-[calc(100vh-4rem)] min-h-0 max-w-screen-2xl mx-auto w-full overflow-hidden">
        <LearnSidebar existingFiles={Array.from(existingFiles)} />
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
