import {
  AudioLines,
  LayoutDashboard,
  MessagesSquare,
  ChartNoAxesCombined,
  Settings2,
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  Check,
  Sparkles,
  Target,
} from "lucide-react";
import { Container } from "../layout/container";
import { SectionHeading } from "../ui/section-heading";
import { performance, sessions, weakAreas } from "@/lib/demo-data";
import { PerformanceChart } from "./performance-chart";

export function DashboardPreview() {
  return (
    <section
      id="preview"
      className="section product-section"
      aria-label="Product preview"
    >
      <Container>
        <div className="section-heading-row">
          <SectionHeading
            eyebrow="THE BIGGER PICTURE"
            title="Your progress. All in one place."
          >
            Less guesswork, more direction. A preview of your future practice
            workspace.
          </SectionHeading>
          <span className="demo-label">Illustrative demo · Sample data</span>
        </div>
        <div className="dashboard-shell">
          <aside
            className="dashboard-sidebar"
            aria-label="Illustrative dashboard sidebar"
          >
            <div className="dashboard-brand">
              <AudioLines size={20} aria-hidden="true" />
              <span>InterviewAI</span>
            </div>
            <span className="sidebar-label">WORKSPACE</span>
            <div className="sidebar-item active">
              <LayoutDashboard size={16} aria-hidden="true" /> Overview
            </div>
            <div className="sidebar-item">
              <MessagesSquare size={16} aria-hidden="true" /> Interviews
            </div>
            <div className="sidebar-item">
              <ChartNoAxesCombined size={16} aria-hidden="true" /> Analytics
            </div>
            <div className="sidebar-item">
              <BookOpen size={16} aria-hidden="true" /> Practice library
            </div>
            <div className="sidebar-bottom">
              <Settings2 size={16} aria-hidden="true" /> Settings
            </div>
            <div className="demo-profile">
              <span>AC</span>
              <div>
                <strong>Alex Carter</strong>
                <small>Sample candidate</small>
              </div>
            </div>
          </aside>
          <div className="dashboard-main">
            <div className="dashboard-topbar">
              <span>
                Workspace <span>/</span> Overview
              </span>
              <span className="demo-label">Demo preview</span>
            </div>
            <div className="dashboard-content">
              <div className="dashboard-welcome">
                <div>
                  <p>YOUR NEXT CHAPTER</p>
                  <h3>
                    Welcome back, Alex <span className="welcome-dot">.</span>
                  </h3>
                  <span>Every session is a step in the right direction.</span>
                </div>
                <span className="dashboard-practice">
                  New practice session{" "}
                  <ArrowUpRight size={14} aria-hidden="true" />
                </span>
              </div>
              <div className="dashboard-summary">
                <div>
                  <span>Interview readiness</span>
                  <strong>
                    82<span>/100</span>
                  </strong>
                  <small className="positive">
                    <TrendingIcon /> Building confidence
                  </small>
                </div>
                <div>
                  <span>Practice sessions</span>
                  <strong>06</strong>
                  <small>Sample interview history</small>
                </div>
                <div>
                  <span>Focus areas</span>
                  <strong>03</strong>
                  <small>Your next opportunities</small>
                </div>
              </div>
              <div className="dashboard-panel-grid">
                <div className="dashboard-panel progress-panel">
                  <div className="panel-title">
                    <h4>Performance over time</h4>
                    <span>Last 6 sessions</span>
                  </div>
                  <PerformanceChart />
                  <div className="chart-legend">
                    <i aria-hidden="true" /> Overall score{" "}
                    <span>Illustrative progress</span>
                  </div>
                </div>
                <div className="dashboard-panel skills-panel">
                  <div className="panel-title">
                    <h4>Skill breakdown</h4>
                    <Target size={15} aria-hidden="true" />
                  </div>
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
                  <div className="skills-note">
                    <Sparkles size={13} aria-hidden="true" /> A clearer view of
                    your strengths.
                  </div>
                </div>
              </div>
              <div className="dashboard-panel-grid lower-panels">
                <div className="dashboard-panel">
                  <div className="panel-title">
                    <h4>Recent sessions</h4>
                    <span>Sample history</span>
                  </div>
                  <div className="sessions-list">
                    {sessions.map((session) => (
                      <div className="session-row" key={session.date}>
                        <span className="session-check">
                          <Check size={14} aria-hidden="true" />
                        </span>
                        <div>
                          <strong>{session.role}</strong>
                          <span>
                            {session.topic} · {session.date}
                          </span>
                        </div>
                        <span className="session-score">
                          {session.score}
                          <small>/100</small>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="dashboard-panel recommendation-panel">
                  <div className="panel-title">
                    <h4>Recommended practice</h4>
                    <BookOpen size={15} aria-hidden="true" />
                  </div>
                  <p>Small steps. Meaningful progress.</p>
                  <div className="recommendation">
                    <span className="recommendation-icon">
                      <BookOpen size={17} aria-hidden="true" />
                    </span>
                    <div>
                      <strong>Database Indexing</strong>
                      <span>Build a stronger foundation</span>
                    </div>
                    <ArrowRight size={16} aria-hidden="true" />
                  </div>
                  <div className="improvement-topics">
                    <span>Improvement areas</span>
                    {weakAreas.slice(1).map((area) => (
                      <span className="topic-tag" key={area}>
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="preview-disclaimer">
          A look at what’s ahead. All scores, sessions, and recommendations
          shown here are demonstration content.
        </p>
      </Container>
    </section>
  );
}

function TrendingIcon() {
  return <ArrowUpRight size={13} aria-hidden="true" />;
}
