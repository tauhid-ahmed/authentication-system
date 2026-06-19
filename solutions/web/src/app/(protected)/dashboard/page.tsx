import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authFetchServer } from "@/lib/fetch-server";
import { Session } from "@auth/shared";

async function getSessions() {
  try {
    const res = await authFetchServer("/api/sessions", { next: { revalidate: 0 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data.sessions as Session[];
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const sessions = await getSessions();

  if (!user) return null; // Handled by layout redirect

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back to the Auth Learning System.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile Details</CardTitle>
            <CardDescription>Information extracted from your validated JWT.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 border-b pb-4">
              <div className="font-medium text-muted-foreground text-sm">ID</div>
              <div className="col-span-2 text-sm font-mono">{user.id}</div>
            </div>
            <div className="grid grid-cols-3 gap-4 border-b pb-4">
              <div className="font-medium text-muted-foreground text-sm">Email</div>
              <div className="col-span-2 text-sm">{user.email}</div>
            </div>
            <div className="grid grid-cols-3 gap-4 border-b pb-4">
              <div className="font-medium text-muted-foreground text-sm">Role</div>
              <div className="col-span-2">
                <span className="px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded-md font-medium">
                  {user.role}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="font-medium text-muted-foreground text-sm">Joined</div>
              <div className="col-span-2 text-sm">{new Date(user.createdAt).toLocaleDateString()}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Sessions</CardTitle>
            <CardDescription>Devices currently logged into your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{session.deviceInfo || "Unknown Device"}</p>
                      {session.isCurrent && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-500 text-[10px] uppercase font-bold tracking-wider rounded-sm">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      IP: {session.ipAddress || "Unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Last used: {new Date(session.lastUsedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              
              {sessions.length === 0 && (
                <p className="text-sm text-muted-foreground italic">No active sessions found.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
