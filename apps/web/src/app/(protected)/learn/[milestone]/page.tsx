import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent } from "@/components/ui/card";

interface MilestonePageProps {
  params: Promise<{
    milestone: string;
  }>;
}

export default async function MilestonePage({ params }: MilestonePageProps) {
  // Await the params object in Next.js 15+ 
  const resolvedParams = await params;
  const { milestone } = resolvedParams;
  
  const filePath = path.join(process.cwd(), "../../docs/milestones", `${milestone}.md`);

  let content = "";
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    notFound(); // Triggers a 404 page if the milestone doesn't exist
  }

  return (
    <Card className="min-h-full">
      <CardContent className="p-8">
        <article className="prose prose-slate dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </article>
      </CardContent>
    </Card>
  );
}
