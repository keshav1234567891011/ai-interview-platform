import { ArrowUpRight, Check, Ellipsis, TrendingUp } from "lucide-react";
import { performance, weakAreas } from "@/lib/demo-data";
import { PerformanceChart } from "./performance-chart";

export function HeroPreview() {
  return (
    <div
      className="hero-preview"
      aria-label="Illustrative interview performance dashboard"
    >
      <div className="preview-window-bar">
        <span className="window-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>interviewai / overview</span>
        <span className="demo-label">Demo preview</span>
      </div>
      <div className="hero-preview-content">
        <div className="preview-heading">
          <div>
            <p className="panel-eyebrow">YOUR PRACTICE, IN PERSPECTIVE</p>
            <h2>Interview Performance</h2>
          </div>
          <Ellipsis size={20} aria-hidden="true" />
        </div>
        <div className="score-overview">
          <div className="score-ring">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle className="ring-track" cx="60" cy="60" r="51" />
              <circle className="ring-value" cx="60" cy="60" r="51" />
            </svg>
            <div>
              <strong>82</strong>
              <span>Overall score</span>
            </div>
          </div>
          <div className="score-metrics">
            {performance.map((item) => (
              <div className="metric" key={item.label}>
                <div>
                  <span>{item.label}</span>
                  <strong>{item.score}%</strong>
                </div>
                <div className="metric-track">
                  <span style={{ width: `${item.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="chart-heading">
          <span>Practice makes progress</span>
          <span className="positive">
            <TrendingUp size={13} aria-hidden="true" /> Sample trend
          </span>
        </div>
        <PerformanceChart compact />
        <div className="recent-interview">
          <div className="interview-icon">
            <Check size={17} aria-hidden="true" />
          </div>
          <div>
            <span className="small-muted">Recent interview</span>
            <strong>Backend Developer</strong>
          </div>
          <div className="recent-result">
            <span className="status-complete">Completed</span>
            <span>
              Score: <strong>82</strong>
            </span>
          </div>
        </div>
        <div className="weak-areas">
          <span>Weak areas</span>
          <div>
            {weakAreas.map((area) => (
              <span className="topic-tag" key={area}>
                {area}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="preview-floating-note">
        <span className="note-icon">
          <ArrowUpRight size={18} aria-hidden="true" />
        </span>
        <div>
          <strong>Your next step, made clearer.</strong>
          <span>Turn feedback into focused practice.</span>
        </div>
      </div>
    </div>
  );
}
