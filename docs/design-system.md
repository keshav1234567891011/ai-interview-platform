# InterviewAI design system

The foundation uses a dark-first, neutral SaaS aesthetic with one restrained violet accent. Light mode preserves the same hierarchy and component geometry. Theme preference is stored locally under `interviewai-theme`; dark is the default, and the selected theme is restored before paint.

## Semantic tokens

Tokens live in `frontend/app/globals.css` and are exposed through Tailwind's inline theme mapping.

| Token | Purpose |
| --- | --- |
| `--background`, `--foreground` | Page canvas and primary text |
| `--card`, `--card-foreground` | Cards and dashboard panels |
| `--surface` | Raised or inset UI surfaces |
| `--muted`, `--muted-foreground` | Progress tracks and supporting text |
| `--border` | Subtle component boundaries |
| `--primary` | Links, icons, charts, highlights, and focus outlines |
| `--primary-solid`, `--primary-foreground` | Filled accessible CTA buttons |
| `--primary-subtle` | Restrained icon and navigation backgrounds |
| `--highlight` | Reserved cyan semantic highlight |
| `--success`, `--warning`, `--destructive` | Consistent semantic status colors |

Supporting text uses readable neutral colors. Filled buttons use a darker violet than decorative accents to preserve white-label contrast. Decorative window dots are neutral; color does not carry meaning by itself.

## Type and spacing

Geist is bundled through the `geist` dependency. Desktop hero text is approximately 60px, section headings 36px, card titles 15px, body 12–16px, and labels 9–11px. Compact desktop product previews intentionally use a smaller scale; mobile dashboards reflow into readable full-width panels. The primary heading, section headings, and card titles use distinct semantic levels and moderate font weights.

Spacing generally follows a 4px base with 8, 12, 16, 24, 32, and larger section gaps. Cards use 8–16px corner radii, subtle borders, and limited shadows. Gradients are confined to hero accents, the CTA, and the chart area.

## Components and behavior

- `Container` caps readable width and applies responsive gutters.
- `Button` and `ButtonLink` share primary, secondary, and ghost styles.
- `Card` provides consistent surfaces; feature hover states add a small lift.
- `SectionHeading` provides an eyebrow, heading, and optional supporting copy.
- The navigation is sticky and reflows into an accessible disclosure below 800px. Escape closes the menu and returns focus to its toggle.
- The hero stacks on tablets; feature cards go from three columns to two to one.
- Workflow steps become a vertical progression on phones.
- The full dashboard removes its decorative sidebar on tablets and stacks panels on phones.

## Accessibility and motion

Visible focus outlines, a working skip link, semantic landmarks, one page-level heading, descriptive chart labels, and labeled icon buttons support keyboard and assistive technology use. Static dashboard mock controls are presentation elements rather than misleading clickable controls. Demo labels appear in each dashboard, and a full disclaimer sits below the larger preview.

Motion uses CSS only: a short entrance, subtle hover states, and theme transitions. `prefers-reduced-motion: reduce` disables animations and transitions and restores instant anchor navigation.
