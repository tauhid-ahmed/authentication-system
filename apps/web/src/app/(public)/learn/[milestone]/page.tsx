import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import Link from "next/link";
import MarkdownRenderer from "@/components/markdown-renderer";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Terminal,
  Lightbulb,
} from "lucide-react";
import { FLAT_MILESTONES } from "@/lib/curriculum";

const EXERCISES: Record<string, { task: string; hint: string }[]> = {
  "M0-foundations": [
    {
      task: "In your own words, explain the difference between a Session and a JWT to a junior developer.",
      hint: "Think about: where is the state stored, what happens when you need to revoke access?",
    },
    {
      task: "Draw the token pair flow (Access + Refresh) on paper from login to a protected API call.",
      hint: "Include: browser, Next.js server, Express API, and Database in your diagram.",
    },
    {
      task: "Find the Access Token and Refresh Token in the browser's cookies after logging in.",
      hint: "Open DevTools → Application → Cookies → localhost. Notice they are HttpOnly (no JS access).",
    },
  ],
  "M1-mvp-auth": [
    {
      task: "Read apps/api/src/modules/auth/auth.service.ts and trace the login flow from start to finish.",
      hint: "Follow: password comparison → JWT sign → refresh token save → cookie set.",
    },
    {
      task: "What happens if you send a wrong password? Trace the error response through the code.",
      hint: "Look for the INVALID_CREDENTIALS error. Notice we return the same error for both wrong email AND wrong password — why?",
    },
  ],
  "M2-advanced-tokens": [
    {
      task: "Find the replay attack detection code in sessions.repository.ts. Explain in comments what it does.",
      hint: "Look for the isRevoked check + the familyToken revocation logic.",
    },
    {
      task: "Read the concurrency lock in fetch-client.ts. What race condition is it preventing?",
      hint: "Think about: 3 API calls expire at the same time. Without the lock, what happens to the refresh token?",
    },
  ],
};

interface MilestonePageProps {
  params: Promise<{ milestone: string }>;
}

export default async function MilestonePage({ params }: MilestonePageProps) {
  const { milestone } = await params;
  const docsDir = path.join(process.cwd(), "../../docs/milestones");
  const filePath = path.join(docsDir, `${milestone}.md`);

  let content = "";
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    notFound();
  }

  const currentIdx = FLAT_MILESTONES.indexOf(milestone);
  const prevSlug = currentIdx > 0 ? FLAT_MILESTONES[currentIdx - 1] : null;
  const nextSlug =
    currentIdx < FLAT_MILESTONES.length - 1
      ? FLAT_MILESTONES[currentIdx + 1]
      : null;
  const exercises = EXERCISES[milestone] || [];

  const prevTitle = prevSlug
    ? prevSlug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    : null;
  const nextTitle = nextSlug
    ? nextSlug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    : null;

  return (
    <div className="max-w-4xl mx-auto md:px-8 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
        <Link
          href="/learn"
          className="hover:text-foreground transition-colors flex items-center gap-1"
        >
          <BookOpen className="w-3.5 h-3.5" /> Curriculum
        </Link>
        <span>/</span>
        <span className="text-foreground">
          {milestone
            .replace(/-/g, " ")
            .replace(/\b\w/g, (l) => l.toUpperCase())}
        </span>
      </div>

      {/* Reading Note */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20 mb-8 text-sm">
        <Lightbulb className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <div>
          <strong className="text-foreground">How to use this lesson:</strong>
          <span className="text-muted-foreground ml-1">
            Read the concept, then open the corresponding source file in your
            editor and trace the code. The code and the lesson are designed to
            be read together.
          </span>
        </div>
      </div>

      {/* Main Markdown Content */}
      <article>
        <MarkdownRenderer content={content} />
      </article>

      {/* Practice Exercises */}
      {exercises.length > 0 && (
        <section className="mt-12 border-t pt-10">
          <div className="flex items-center gap-2 mb-6">
            <Terminal className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">Practice Exercises</h2>
          </div>
          <div className="space-y-4">
            {exercises.map((ex, i) => (
              <div
                key={i}
                className="p-5 border rounded-lg bg-card hover:border-primary/40 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-foreground mb-3">
                      {ex.task}
                    </p>
                    <details className="text-sm">
                      <summary className="cursor-pointer text-muted-foreground hover:text-primary transition-colors select-none">
                        💡 Show Hint
                      </summary>
                      <p className="mt-2 text-muted-foreground pl-4 border-l-2 border-primary/30">
                        {ex.hint}
                      </p>
                    </details>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Prev / Next Navigation */}
      <div className="mt-12 pt-8 border-t grid grid-cols-2 gap-4">
        {prevSlug ? (
          <Link
            href={`/learn/${prevSlug}`}
            className="group flex items-start gap-3 p-4 border rounded-lg bg-card hover:border-primary/50 transition-all"
          >
            <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary mt-0.5 transition-colors" />
            <div>
              <p className="text-xs text-muted-foreground mb-1">Previous</p>
              <p className="font-medium text-sm group-hover:text-primary transition-colors">
                {prevTitle}
              </p>
            </div>
          </Link>
        ) : (
          <div />
        )}

        {nextSlug ? (
          <Link
            href={`/learn/${nextSlug}`}
            className="group flex items-end gap-3 p-4 border rounded-lg bg-card hover:border-primary/50 transition-all text-right ml-auto w-full"
          >
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">Next</p>
              <p className="font-medium text-sm group-hover:text-primary transition-colors">
                {nextTitle}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary mt-0.5 transition-colors" />
          </Link>
        ) : (
          <div className="p-4 border rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 text-center">
            <p className="font-semibold text-primary mb-1">
              🎉 Curriculum Complete!
            </p>
            <p className="text-xs text-muted-foreground">
              You've covered the entire authentication learning path.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
