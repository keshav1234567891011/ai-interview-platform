import { ArrowUpRight } from "lucide-react";
import { Brand } from "./brand";
import { Container } from "./container";

export function Footer() {
  return (
    <footer className="site-footer">
      <Container>
        <div className="footer-top">
          <div>
            <Brand />
            <p>A little practice. A lot more confidence.</p>
          </div>
          <nav className="footer-links" aria-label="Footer navigation">
            <div>
              <span>Product</span>
              <a href="#features">Features</a>
              <a href="#preview">
                Product preview <ArrowUpRight size={13} aria-hidden="true" />
              </a>
            </div>
            <div>
              <span>Resources</span>
              <a href="#how-it-works">How it works</a>
              <a href="#availability">Availability</a>
            </div>
            <div>
              <span>Legal</span>
              <a href="#legal">
                Privacy <span className="footer-soon">Soon</span>
              </a>
              <a href="#legal">
                Terms <span className="footer-soon">Soon</span>
              </a>
            </div>
          </nav>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} InterviewAI</span>
          <span id="legal">
            Privacy and terms will be available before launch.
          </span>
          <span className="footer-note">
            <i aria-hidden="true" /> Built for your next step.
          </span>
        </div>
      </Container>
    </footer>
  );
}
