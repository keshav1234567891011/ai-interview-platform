import { InterviewResults } from "@/components/workspace/interview-results";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <InterviewResults id={(await params).id} />;
}
