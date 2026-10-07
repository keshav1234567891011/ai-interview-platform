import { InterviewSession } from "@/components/workspace/interview-session";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InterviewSession id={id} />;
}
