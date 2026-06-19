import Link from "next/link";
import { ArrowRight, BookOpen, Code2, Layers, Shield, Zap, Award } from "lucide-react";
import { TRACKS } from "@/lib/curriculum";

const FEATURES = [
  { icon: BookOpen,  title: "Step-by-Step Curriculum",   desc: "Theory → Code → Practice. Structured lessons." },
  { icon: Code2,     title: "Real Production Code",      desc: "Every concept is demonstrated with actual working code." },
  { icon: Shield,    title: "Security-First Mindset",    desc: "Learn the attack vectors first, then how to defend them." },
  { icon: Layers,    title: "Separation of Concerns",    desc: "Backend, Frontend, and Architecture are clearly separated." },
  { icon: Zap,       title: "Practice Exercises",        desc: "Each milestone ends with hands-on challenges." },
  { icon: Award,     title: "Staff Engineer Patterns",   desc: "Learn architectural decisions that define senior engineers." },
];

export default function LearnPage() {
  return (
    <div className="flex flex-col">
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
            This curriculum doesn't just show you how to write code. It separates the learning into Core concepts, Backend deep-dives, Frontend integration, and Architecture — allowing you to master each domain independently.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/learn/M0-foundations"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Start Learning <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

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

      <section className="px-8 py-12">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-8">The Curriculum Tracks</h2>
        <div className="space-y-12">
          {TRACKS.map((track) => (
            <div key={track.id}>
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded ${track.badge}`}>
                    {track.title}
                  </span>
                </div>
                <p className="text-muted-foreground">{track.desc}</p>
              </div>
              <div className={`border rounded-xl bg-gradient-to-br ${track.color} ${track.border} overflow-hidden`}>
                {track.milestones.map((m, i) => (
                  <Link
                    key={m.slug}
                    href={`/learn/${m.slug}`}
                    className={`group flex items-start gap-4 p-5 hover:bg-white/5 transition-colors ${
                      i < track.milestones.length - 1 ? "border-b border-inherit" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold group-hover:text-primary transition-colors">{m.title}</h3>
                        <span className="text-xs text-muted-foreground">· {m.time}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground ml-2">{m.level}</span>
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
