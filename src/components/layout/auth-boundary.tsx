import { AuthProvider } from "@/contexts/auth-context";
import { NotificationsProvider } from "@/contexts/notifications-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { getInitialAuth } from "@/lib/auth-initial";

export async function AuthBoundary({
  authPromise,
  children,
}: {
  authPromise: ReturnType<typeof getInitialAuth>;
  children: React.ReactNode;
}) {
  const { user, company } = await authPromise;
  return (
    <AuthProvider initialUser={user} initialCompany={company}>
      <NotificationsProvider>
        <TooltipProvider delay={150}>{children}</TooltipProvider>
      </NotificationsProvider>
    </AuthProvider>
  );
}
