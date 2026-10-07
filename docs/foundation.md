# Foundation milestone

Branch: `01-foundation-ui`

This milestone establishes the frontend, visual language, landing page, backend application, and future database migration path. It intentionally ends before authentication or interview business logic.

## Delivered scope

- Responsive navigation, mobile menu, theme persistence, and minimal footer
- Premium hero with static interview performance preview
- Six planned feature cards, four planned workflow steps, and candidate dashboard preview
- Personalized practice, actionable feedback, and improvement value section
- Final CTA with honest availability notice
- Strict TypeScript and ESLint setup, local Geist fonts, Lucide icons, and Tailwind CSS
- FastAPI application factory and typed `GET /health`
- Environment settings with a redacted database URL
- Lazy PostgreSQL SQLAlchemy engine, session dependency, and declarative base
- Alembic configuration and empty versions directory
- Browser/accessibility and backend verification suites
- Root ignore rules, setup documentation, and placeholder environment example

The frontend does not call the backend. Sample candidate names, scores, sessions, chart trends, and recommendations live in static component/data definitions. No statistics about adoption or success are invented. No PostgreSQL tables or migrations are created.

## Next milestone boundaries

Accounts, JWT, profiles, resume uploads, job description analysis, AI questions, evaluations, analytics endpoints, and database models require their own approved milestones. PostgreSQL credentials must be configured manually in the ignored local environment file when needed. AI integration is planned and currently requires no OpenAI key.

## Implementation references

Configuration follows the official [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Next.js ESLint configuration](https://nextjs.org/docs/app/api-reference/config/eslint), [Tailwind Next.js guide](https://tailwindcss.com/docs/installation/framework-guides/nextjs), [FastAPI settings documentation](https://fastapi.tiangolo.com/advanced/settings/), and [Alembic tutorial](https://alembic.sqlalchemy.org/en/latest/tutorial.html).
