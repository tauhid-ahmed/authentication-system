import fs from "fs";
import path from "path";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read milestones from the docs directory
  const docsDir = path.join(process.cwd(), "../../docs/milestones");
  
  let files: string[] = [];
  try {
    files = fs.readdirSync(docsDir).filter(f => f.endsWith('.md'));
  } catch (error) {
    console.error("Failed to read milestones directory", error);
  }

  // Sort them naturally (M0, M1, M2...)
  files.sort((a, b) => {
    const numA = parseInt(a.match(/M(\d+)/)?.[1] || "0");
    const numB = parseInt(b.match(/M(\d+)/)?.[1] || "0");
    return numA - numB;
  });

  const milestones = files.map(file => {
    const slug = file.replace('.md', '');
    const title = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return { slug, title };
  });

  return (
    <div className="flex flex-col md:flex-row gap-6 max-w-7xl mx-auto w-full">
      <aside className="w-full md:w-64 flex-shrink-0">
        <Card className="sticky top-20">
          <CardHeader>
            <CardTitle className="text-lg">Learning Flow</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <nav className="flex flex-col">
              {milestones.map((m) => (
                <Link
                  key={m.slug}
                  href={`/learn/${m.slug}`}
                  className="px-4 py-3 text-sm hover:bg-muted transition-colors border-b last:border-b-0 text-muted-foreground hover:text-foreground"
                >
                  {m.title}
                </Link>
              ))}
            </nav>
          </CardContent>
        </Card>
      </aside>
      
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
