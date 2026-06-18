import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authFetchServer } from "@/lib/fetch-server";
import { Button } from "@/components/ui/button";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server Component Auth check
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="font-bold text-xl tracking-tight">
              Auth<span className="text-primary">System</span>
            </Link>
            <nav className="hidden md:flex gap-4">
              <Link href="/dashboard" className="text-sm font-medium hover:text-primary transition-colors">
                Dashboard
              </Link>
              <Link href="/learn" className="text-sm font-medium hover:text-primary transition-colors">
                Learning Guide
              </Link>{user.role !== "USER" && (
                <Link href="/admin" className="text-sm font-medium hover:text-primary transition-colors">Admin Panel</Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <span className="px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded-md font-medium">
              {user.role}
            </span>
            <form action={async () => {
              "use server";
              await authFetchServer("/api/auth/logout", { method: "POST" });
              redirect("/login");
            }}>
              <Button variant="outline" size="sm">Log out</Button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {children}
      </main>
    </div>
  );
}
