import { OwnerGuard } from "@/components/owner/owner-guard";
export default function Layout({ children }: { children: React.ReactNode }) { return <OwnerGuard>{children}</OwnerGuard>; }
