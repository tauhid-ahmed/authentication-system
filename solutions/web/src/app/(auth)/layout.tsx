export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold tracking-tight">
            Execution <span className="text-primary">System</span>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Zero to Staff Engineer Curriculum
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
