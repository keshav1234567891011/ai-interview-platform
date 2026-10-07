import {
  FileUp,
  Crosshair,
  MessagesSquare,
  ClipboardCheck,
} from "lucide-react";
import { Container } from "../layout/container";
import { SectionHeading } from "../ui/section-heading";

const steps = [
  {
    icon: FileUp,
    title: "Upload Your Resume",
    copy: "Start with your skills, experience, and the story you bring.",
  },
  {
    icon: Crosshair,
    title: "Choose Your Target Role",
    copy: "Give your preparation a direction that matters to you.",
  },
  {
    icon: MessagesSquare,
    title: "Take Your Interview",
    copy: "Work through a focused, realistic practice session.",
  },
  {
    icon: ClipboardCheck,
    title: "Review Your Feedback",
    copy: "Leave with clarity on your strengths and next steps.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="section how-section"
      aria-label="How it works"
    >
      <Container>
        <SectionHeading
          centered
          eyebrow="A CLEAR PATH FORWARD"
          title="From preparation to confidence."
        >
          Four simple steps. One more prepared you. This workflow is planned for
          launch.
        </SectionHeading>
        <ol className="steps-grid">
          {steps.map(({ icon: Icon, title, copy }, index) => (
            <li key={title}>
              <div className="step-top">
                <span className="step-number">0{index + 1}</span>
                <Icon size={21} strokeWidth={1.5} aria-hidden="true" />
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
