import { AdminManagement } from "@/components/owner/admin-management";
export default async function Page({ searchParams }: { searchParams: Promise<{ created?: string }> }) { const params = await searchParams; return <AdminManagement created={params.created === "1"} />; }
