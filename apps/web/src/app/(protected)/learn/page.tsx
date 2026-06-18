import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LearnPage() {
  return (
    <Card className="h-full flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
      <CardHeader>
        <CardTitle className="text-3xl">Welcome to the Learning Portal</CardTitle>
        <CardDescription className="text-lg mt-2 max-w-lg mx-auto">
          This system is designed to take you from Zero to Staff Engineer in modern authentication.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-6 mt-4">
        <p className="text-muted-foreground max-w-xl">
          Use the sidebar on the left to navigate through the curriculum. We start with the absolute fundamentals in M0 and work our way up to production-grade security architecture.
        </p>
        <Button asChild size="lg">
          <Link href="/learn/M0-foundations">Start with M0: Foundations</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
