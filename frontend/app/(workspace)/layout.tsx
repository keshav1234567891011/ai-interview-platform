import { AuthGuard } from "@/components/auth/auth-guard";
import { Header } from "@/components/layout/header";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1}>
        <AuthGuard>
          <WorkspaceShell>{children}</WorkspaceShell>
        </AuthGuard>
      </main>
    </>
  );
}
