import { ArrowRight, Check, Sparkles } from "lucide-react";
import { Container } from "../layout/container";
import { ButtonLink } from "../ui/button";
import { HeroPreview } from "./hero-preview";

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <Container className="hero-grid">
        <div className="hero-copy entrance">
          <span className="hero-badge">
            <Sparkles size={14} aria-hidden="true" /> AI-Powered Interview
            Preparation
          </span>
          <h1 id="hero-title">
            Practice Smarter.
            <br />
            <span>Interview Better.</span>
          </h1>
          <p>
            Prepare for technical interviews with personalized practice,
            structured feedback, skill insights, and performance tracking.
          </p>
          <div className="hero-actions">
            <ButtonLink href="/register">
              Start Practicing <ArrowRight size={17} aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href="#features" variant="secondary">
              Explore Features
            </ButtonLink>
          </div>
          <div className="trust-row">
            {[
              "Role-specific practice",
              "Structured feedback",
              "Progress tracking",
            ].map((value) => (
              <span key={value}>
                <Check size={13} aria-hidden="true" />
                {value}
              </span>
            ))}
          </div>
          <p className="hero-footnote">
            Built for the interview ahead. And the career beyond.
          </p>
        </div>
        <div className="hero-visual entrance">
          <HeroPreview />
        </div>
      </Container>
      <Container>
        <div className="role-strip">
          <span>YOUR NEXT ROLE STARTS WITH BETTER PRACTICE</span>
          <div>
            <span>Software Engineer</span>
            <i aria-hidden="true" />
            <span>Backend Developer</span>
            <i aria-hidden="true" />
            <span>Frontend Developer</span>
            <i aria-hidden="true" />
            <span>Full Stack Developer</span>
          </div>
        </div>
      </Container>
    </section>
  );
}
