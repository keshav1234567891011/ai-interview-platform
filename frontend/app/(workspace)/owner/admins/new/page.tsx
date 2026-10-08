import { CreateAdmin } from "@/components/owner/create-admin";
export default async function Page({ searchParams }: { searchParams: Promise<{ user?: string }> }) { const params = await searchParams; return <CreateAdmin existingUserId={params.user} />; }
