import { AdminUserDetail } from "@/components/workspace/admin";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <AdminUserDetail id={(await params).id} />; }
