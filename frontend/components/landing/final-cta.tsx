"use client";
import { useAuth } from "../auth/auth-provider";
import { ArrowRight, AudioLines } from "lucide-react";
import { Container } from "../layout/container";
import { ButtonLink } from "../ui/button";

export function FinalCTA() {
  const { user } = useAuth();
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
            <br className="desktop-only" /> focused questions, and a clear path
            to improvement.
          </p>
          <ButtonLink href={user ? "/interviews/new" : "/register"}>
            Start Practicing <ArrowRight size={17} aria-hidden="true" />
          </ButtonLink>
          <div id="availability" className="availability-note" role="note">
            <span className="availability-dot" aria-hidden="true" />
            <span>
              Create your account to begin your preparation.
              <br />
              Detailed evaluation and analytics are still in development.
            </span>
          </div>
        </div>
      </Container>
    </section>
  );
}
