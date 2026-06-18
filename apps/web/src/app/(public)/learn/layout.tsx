import fs from "fs";
import path from "path";
import Link from "next/link";
import { BookOpen, Circle } from "lucide-react";
import { TRACKS } from "@/lib/curriculum";

const LEVEL_COLORS: Record<string, string> = {
  Beginner:     "text-emerald-400 bg-emerald-400/10",
  Intermediate: "text-blue-400 bg-blue-400/10",
  Advanced:     "text-amber-400 bg-amber-400/10",
  Expert:       "text-rose-400 bg-rose-400/10",
};

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  const docsDir = path.join(process.cwd(), "../../docs/milestones");
  let existingFiles = new Set<string>();
  try {
    const files = fs.readdirSync(docsDir);
    files.forEach(f => existingFiles.add(f.replace('.md', '')));
  } catch {}

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <BookOpen className="w-5 h-5 text-primary" />
            Execution <span className="text-primary">Mastery</span>
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

      <div className="flex flex-1 max-w-screen-2xl mx-auto w-full overflow-hidden">
        <aside className="w-72 flex-shrink-0 border-r bg-card/30 h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar">
          <div className="p-4 space-y-6">
            {TRACKS.map((track) => (
              <div key={track.id}>
                <div className="flex items-center gap-2 mb-3 px-2 text-muted-foreground">
                  <track.icon className="w-4 h-4" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">{track.title}</h3>
                </div>
                <nav className="space-y-0.5">
                  {track.milestones.map((m) => {
                    const exists = existingFiles.has(m.slug);
                    const levelColor = LEVEL_COLORS[m.level];
                    return (
                      <Link
                        key={m.slug}
                        href={exists ? `/learn/${m.slug}` : "#"}
                        className={`group flex items-start gap-3 px-3 py-2 rounded-lg transition-all text-sm ${
                          exists ? "hover:bg-muted/60 cursor-pointer" : "opacity-40 cursor-not-allowed"
                        }`}
                      >
                        <span className="mt-1 flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors">
                          <Circle className="w-3.5 h-3.5" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground leading-tight">{m.title}</p>
                          <span className={`inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded mt-1 ${levelColor}`}>
                            {m.level}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>
        </aside>

        <main className="flex-1 h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}
