import {
  AudioLines,
  FileUser,
  ListChecks,
  ScanSearch,
  ChartNoAxesCombined,
  BriefcaseBusiness,
  ArrowUpRight,
} from "lucide-react";
import { Container } from "../layout/container";
import { Card } from "../ui/card";
import { SectionHeading } from "../ui/section-heading";

const features = [
  {
    icon: AudioLines,
    title: "AI Mock Interviews",
    copy: "Practice realistic technical interviews tailored to your target role.",
    detail: "Practice with purpose",
  },
  {
    icon: FileUser,
    title: "Resume-Aware Questions",
    copy: "Use candidate skills and experience to personalize interview practice.",
    detail: "Built around your experience",
  },
  {
    icon: ListChecks,
    title: "Structured Evaluation",
    copy: "Receive feedback across technical accuracy, reasoning and communication.",
    detail: "Planned - Understand every answer",
  },
  {
    icon: ScanSearch,
    title: "Skill Gap Detection",
    copy: "Identify topics that need improvement before real interviews.",
    detail: "Know what to work on",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Performance Analytics",
    copy: "Track scores and progress across multiple practice sessions.",
    detail: "Planned - See your growth",
  },
  {
    icon: BriefcaseBusiness,
    title: "Job-Specific Practice",
    copy: "Prepare using the skills and requirements from a target job description.",
    detail: "Prepare for your next role",
  },
];

export function Features() {
  return (
    <section id="features" className="section" aria-labelledby="features-title">
      <Container>
        <div className="section-heading-row">
          <SectionHeading
            titleId="features-title"
            eyebrow="PURPOSEFUL PREPARATION"
            title="Everything you need to move forward."
          >
            A thoughtful toolkit for turning interview uncertainty into a clear
            plan.
          </SectionHeading>
          <span className="section-status">
            <span /> Available and evolving
          </span>
        </div>
        <div className="features-grid">
          {features.map(({ icon: Icon, title, copy, detail }) => (
            <Card className="feature-card" key={title}>
              <div className="feature-icon">
                <Icon size={22} strokeWidth={1.6} aria-hidden="true" />
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
              <div className="feature-detail">
                <span>{detail}</span>
                <ArrowUpRight size={15} aria-hidden="true" />
              </div>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}
