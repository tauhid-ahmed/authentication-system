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
        <div className="mx-auto flex h-14 w-full max-w-screen-2xl items-center justify-between gap-2 px-3 sm:h-16 sm:px-4 lg:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="flex min-w-0 items-center gap-1.5 font-semibold tracking-tight sm:gap-2"
            >
              <BookOpen className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
              <span className="truncate text-sm sm:text-base">
                Execution <span className="text-primary">Mastery</span>
              </span>
            </Link>
          </div>
          <nav className="flex shrink-0 items-center gap-2 sm:gap-3 lg:gap-4">
            <Link
              href="/learn"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground sm:text-sm"
            >
              Curriculum
            </Link>
            <Link
              href="/login"
              className="hidden text-xs text-muted-foreground transition-colors hover:text-foreground sm:inline sm:text-sm"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:px-3 sm:text-sm"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto flex h-[calc(100vh-3.5rem)] min-h-0 w-full max-w-screen-2xl overflow-hidden sm:h-[calc(100vh-4rem)]">
        <LearnSidebar existingFiles={Array.from(existingFiles)} />
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto max-w-5xl px-3 pb-12 pt-4 sm:px-4 sm:pb-16 sm:pt-6 lg:px-8 lg:pt-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
