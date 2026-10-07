import { ArrowRight, AudioLines } from "lucide-react";
import { Container } from "../layout/container";
import { ButtonLink } from "../ui/button";

export function FinalCTA() {
  return (
    <section className="cta-section" aria-labelledby="cta-title">
      <Container>
        <div className="cta-panel">
          <span className="cta-icon">
            <AudioLines size={26} aria-hidden="true" />
          </span>
          <p className="eyebrow">MAKE YOUR NEXT STEP COUNT</p>
          <h2 id="cta-title">Ready for your next interview?</h2>
          <p>
            Build confidence through consistent practice,
            <br className="desktop-only" /> thoughtful feedback, and a clear
            path to improvement.
          </p>
          <ButtonLink href="#availability">
            Start Practicing <ArrowRight size={17} aria-hidden="true" />
          </ButtonLink>
          <div id="availability" className="availability-note" role="note">
            <span className="availability-dot" aria-hidden="true" />
            <span>
              Coming soon. Practice and sign in will be available at launch.
              <br />
              This foundation preview demonstrates the planned experience.
            </span>
          </div>
        </div>
      </Container>
    </section>
  );
}
