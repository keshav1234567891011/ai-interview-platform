import { Fingerprint, MessageSquareText, TrendingUp } from "lucide-react";
import { Container } from "../layout/container";
import { SectionHeading } from "../ui/section-heading";

const reasons = [
  {
    icon: Fingerprint,
    title: "Personalized practice",
    copy: "Your experience, your goals, your next role. Preparation should start with you.",
  },
  {
    icon: MessageSquareText,
    title: "Actionable feedback",
    copy: "Go beyond a score. Understand what worked and what to try next.",
  },
  {
    icon: TrendingUp,
    title: "Trackable improvement",
    copy: "Connect each practice session to a bigger picture of your progress.",
  },
];

export function WhyInterviewAI() {
  return (
    <section className="section why-section" aria-label="Why InterviewAI">
      <Container className="why-grid">
        <SectionHeading
          eyebrow="DESIGNED WITH INTENTION"
          title="More than practice. A way forward."
        >
          InterviewAI is being built around one idea: better preparation begins
          with better insight.
        </SectionHeading>
        <div className="reasons-list">
          {reasons.map(({ icon: Icon, title, copy }) => (
            <div className="reason" key={title}>
              <span>
                <Icon size={21} strokeWidth={1.6} aria-hidden="true" />
              </span>
              <div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
