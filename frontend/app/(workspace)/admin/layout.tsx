import { AdminGuard } from "@/components/workspace/admin";
export default function Layout({ children }: { children: React.ReactNode }) { return <AdminGuard>{children}</AdminGuard>; }
