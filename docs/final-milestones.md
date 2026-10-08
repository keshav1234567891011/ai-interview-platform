AUTONOMOUS FINAL DEVELOPMENT — INTERVIEWAI

Complete the final milestones 07 through 09 sequentially.

This is the final major feature-development run before deployment.

PROJECT ROOT:

C:\Users\Asus\Project\ai-interview-platform

GITHUB:

https://github.com/keshav1234567891011/ai-interview-platform.git


==================================================
ABSOLUTE WORKSPACE BOUNDARY
==================================================

The ONLY filesystem location you may access is:

C:\Users\Asus\Project\ai-interview-platform

You may read, search, create, edit, move, rename and delete files
ONLY within this repository.

Never inspect:

Desktop
Documents
Downloads
AppData
OneDrive
browser data
SSH keys
credential stores
PowerShell history
other repositories
other projects
personal files
system files

Never use ../ to escape the repository.

Never recursively search outside this repository.

Never request unrestricted filesystem access.

If something truly requires access outside this repository:
STOP and ask me to perform it manually.

The workspace security rules override every other instruction.


==================================================
POWERSHELL / COMMAND PERMISSION
==================================================

You may autonomously use PowerShell for this project.

Allowed:

git
npm
node
project-local Python
backend/.venv
pip inside backend/.venv
pytest
ruff
alembic
uvicorn
psql against ai_interview_db only
localhost HTTP checks
project-local filesystem commands

You may run:

npm install
npm ci
npm run dev
npm run build
npm run lint
npm run test
npm run typecheck

and equivalent project-local commands.

You may install dependencies ONLY inside this repository.

Never modify:

global Git configuration
global Python
global Node.js
PATH
Windows settings
registry
PowerShell execution policy
firewall
unrelated Windows processes
PostgreSQL server configuration

Never install system-wide applications.


==================================================
SECRETS
==================================================

backend/.env may be used internally by the running application.

Never display its contents.

Never output:

DATABASE_URL
database password
JWT_SECRET
OPENAI_API_KEY
tokens
cookies
authentication credentials

Never commit .env.

.env.example may contain placeholders only.

If OPENAI_API_KEY is unavailable, all core application functionality
must continue through deterministic/browser-supported fallbacks.

Never make automated tests dependent on paid OpenAI requests.


==================================================
GIT IDENTITY
==================================================

Preserve repository-local Git identity:

user.name:
keshav1234567891011

user.email:
152797887+keshav1234567891011@users.noreply.github.com

Never change this identity.

Never add:

Co-authored-by
Codex
AI
another person's author identity


==================================================
GIT STRATEGY
==================================================

Current expected branch:

main

main currently contains milestones 01 through 06.

Create and complete:

07-evaluation-voice
08-analytics-admin-avatar
09-production-readiness

For EACH milestone:

1. Start from latest main.
2. Create milestone branch.
3. Implement milestone.
4. Run checks.
5. Fix errors.
6. Review git status.
7. Confirm secrets are not staged.
8. Commit.
9. Push milestone branch.
10. Switch to main.
11. Fast-forward main using --ff-only.
12. Push main.
13. Continue to next milestone.

Never force push.

Never rewrite published history.

If --ff-only unexpectedly cannot work:
STOP and report the Git state instead of rebasing or forcing.


==================================================
LOCAL DEVELOPMENT MUST REMAIN SIMPLE
==================================================

From repository root:

npm run dev

must continue starting the complete development application.

Frontend:

http://localhost:3000

Backend:

http://127.0.0.1:8010

FastAPI docs:

http://127.0.0.1:8010/docs

PostgreSQL:

ai_interview_db

Do not break the currently working registration/login/database flow.


##################################################
MILESTONE 07
BRANCH: 07-evaluation-voice
##################################################

GOAL:

Turn the existing mock interview into a complete evaluated
voice-or-text interview experience.

Implement:

- technical answer evaluation
- detailed feedback
- microphone answers
- speech transcription architecture
- communication analysis
- interview result report
- recommendations


==================================================
ANSWER INPUT MODES
==================================================

Candidate must be able to answer every interview question using:

1. Microphone
OR
2. Text

Text input must ALWAYS remain available.

Voice must never be the only way to complete an interview.

Create a clear toggle/control:

Answer with microphone
Answer with text


==================================================
MICROPHONE UX
==================================================

For voice mode provide:

Start recording
Recording indicator
Elapsed recording time
Stop recording
Playback before submission where practical
Discard / Record again
Submit answer

Use browser MediaRecorder when available.

Ask for microphone permission ONLY when the candidate deliberately
presses the microphone control.

Never activate microphone automatically.

Never record in the background.

Clearly indicate whenever recording is active.

Stop media tracks after recording ends or user leaves the page.

Handle permission denial gracefully.

If microphone is unavailable:
show a useful message and preserve text-answer mode.


==================================================
SPEECH TO TEXT ARCHITECTURE
==================================================

Implement a clean transcription abstraction.

Preferred hierarchy:

1. configured server-side speech transcription provider when supported
2. browser-native SpeechRecognition/webkitSpeechRecognition when available
3. text entry fallback

Do not tightly couple interview components directly to one provider.

If using OpenAI transcription:

OPENAI_API_KEY comes from backend environment configuration only.

Never expose API key to browser.

Audio should be sent securely to backend.

Validate:

file type
payload size
recording duration

Do not retain raw audio permanently unless explicitly needed.

Default behavior should be:

audio used for transcription/analysis
then removed after processing when practical.

Do not commit recordings.


==================================================
COMMUNICATION SIGNAL COLLECTION
==================================================

For microphone answers collect only defensible signals.

Possible metrics:

recording duration
word count
estimated words per minute
number of detected filler words
number of repeated filler phrases
very long silent pauses where reliably measurable
answer length
sentence structure signals

Do NOT claim medically/scientifically precise emotion detection.

Do NOT infer:

personality
mental health
race
gender
age
confidence as a psychological trait
truthfulness

Communication analysis must focus on interview delivery only.


==================================================
FILLER WORD ANALYSIS
==================================================

Detect common filler expressions in transcript such as:

um
uh
like
you know
actually
basically
so
I mean
kind of
sort of

Avoid naïvely penalizing legitimate uses.

Return:

total filler count
fillers per 100 words
most frequent filler terms

Use these only as communication-improvement signals.


==================================================
SPEAKING PACE
==================================================

When recording duration and transcript word count exist:

calculate estimated words per minute.

Use broad descriptive categories rather than pretending there is one
perfect speaking speed.

Examples:

very slow
measured
balanced
fast
very fast

Recommendations should be contextual.


==================================================
PAUSE ANALYSIS
==================================================

If reliable audio timing/speech events are available, identify unusually
long pauses.

Do not fabricate pause metrics if timing is unavailable.

If unavailable, omit that metric rather than guessing.


==================================================
TECHNICAL EVALUATION
==================================================

Implement AnswerEvaluation.

Use a clear rubric such as:

Technical correctness          40%
Concept coverage               25%
Reasoning/explanation          20%
Practical example/tradeoffs    10%
Communication                   5%

Adjust where necessary for question category.

Return validated structured fields:

score
technical_score
reasoning_score
communication_score
strengths
weaknesses
concepts_missed
feedback
improvement_suggestion

Use 0–100 ranges consistently.


==================================================
AI EVALUATION
==================================================

When OPENAI_API_KEY exists:

use the existing AI abstraction.

Require structured validated output.

Treat candidate answers as untrusted user content.

Never allow candidate text to override application instructions.

Never store or expose hidden model chain-of-thought.

Store concise evaluation outputs only.

Handle:

timeouts
rate limits
invalid responses
provider errors

Fallback must work.


==================================================
NO-AI FALLBACK
==================================================

Interview evaluation MUST function without OPENAI_API_KEY.

Implement transparent deterministic fallback based on signals such as:

expected concepts
keyword coverage
answer completeness
question context
answer length
basic communication signals

Do not pretend deterministic evaluation has human-level understanding.

Keep fallback results useful but conservative.


==================================================
INTERVIEW AGGREGATION
==================================================

After interview completion calculate:

Overall Score
Technical Knowledge
Problem Solving / Reasoning
Communication

Also derive:

strongest topics
weakest topics
recommended topics

Do not fabricate unsupported values.


==================================================
RESULTS PAGE
==================================================

Create premium:

/interviews/[id]/results

Show:

Overall Score

Technical Knowledge
Problem Solving
Communication

Strengths
Weaknesses
Recommended improvement areas

Question-by-question analysis.

For every question display:

question
candidate answer/transcript
technical score
communication score
feedback
concepts missed
how to improve

For voice answers additionally show available communication data:

speaking pace
filler words
long pauses if available
answer duration


==================================================
COMMUNICATION REPORT
==================================================

Create a dedicated section:

Communication Analysis

Possible display:

Speaking pace
Clarity indicators
Filler frequency
Long pauses
Answer structure
Conciseness

Give actionable recommendations such as:

"Pause silently for a moment instead of filling thinking time with 'um'."

"Start with the core definition before giving implementation details."

"Your answer was technically strong but could be more concise."

Do not shame users.

Use neutral professional language.


==================================================
DASHBOARD INTEGRATION
==================================================

Dashboard should now show REAL:

latest score
technical performance
communication performance
weakest area
recommended next interview

Remove any remaining demo values being presented as user data.


==================================================
DATABASE
==================================================

Create migrations for evaluation/communication data.

Do not store raw audio indefinitely by default.

Ensure appropriate user ownership and authorization.


==================================================
TESTING
==================================================

Test:

text answer evaluation
voice transcript evaluation
filler-word analysis
pace calculation
aggregation
AI evaluation success
AI invalid output
AI failure fallback
no-key fallback
authorization
results API
results UI
microphone unsupported state
microphone permission denied handling

Mock external AI/transcription calls.

Do not require real microphone hardware for automated tests.


==================================================
COMMIT
==================================================

Commit:

feat: add voice interviews and detailed evaluation feedback

Push:

07-evaluation-voice

Fast-forward main.

Push main.


##################################################
MILESTONE 08
BRANCH: 08-analytics-admin-avatar
##################################################

GOAL:

Complete the candidate experience with:

- interview scheduling
- interview history
- analytics
- 3D interviewer experience
- spoken interviewer questions
- admin dashboard
- final product UI polish


==================================================
INTERVIEW SCHEDULING
==================================================

Allow candidate to:

Start now
OR
Schedule interview

Create a maintainable scheduled interview model/state.

Candidate should be able to choose:

date
time
target role
difficulty
focus areas
question count

Use clear timezone handling.

Store timestamps consistently.

Display scheduled time in the user's local browser timezone.


==================================================
SCHEDULED INTERVIEW PAGE
==================================================

Create:

/interviews/scheduled

Show:

Upcoming interviews
Past scheduled interviews
Cancelled interviews where appropriate

Allow:

Start when available
Reschedule
Cancel

Do not create fake calendar integrations.

No Google Calendar integration is required.


==================================================
DASHBOARD UPCOMING INTERVIEW
==================================================

Dashboard should display the next scheduled interview prominently.

Example:

Backend Developer
Today • 7:30 PM

Start Interview

or:

Starts in 45 minutes

Do not rely solely on countdown timers for authorization/state logic.


==================================================
OPTIONAL IN-APP REMINDER
==================================================

Provide an in-app reminder when candidate is using the application near
the scheduled time.

Do not require browser notifications.

Do not request notification permission automatically.


==================================================
3D INTERVIEWER
==================================================

Build an optional lightweight stylized 3D interviewer for the live
interview page.

Use:

Three.js
and/or
React Three Fiber

only if appropriate for the existing frontend.

Do not download or use a copyrighted/proprietary human model.

Prefer a lightweight stylized interviewer built from simple geometry,
procedural shapes, or an explicitly repository-owned/openly licensed
asset if one is deliberately included.

The avatar is a UI feature, NOT a real person.

Do not imply it represents a real interviewer.


==================================================
3D PERFORMANCE
==================================================

The interview must remain fully usable if:

WebGL is unavailable
3D rendering fails
device is low powered
user prefers reduced motion

Provide a polished static 2D fallback.

Never make 3D a requirement for completing an interview.

Lazy-load heavy 3D code.

Avoid harming initial dashboard/landing performance.


==================================================
3D AVATAR BEHAVIOR
==================================================

The interviewer can have subtle states:

idle
asking question
listening
thinking/preparing

Use restrained animation.

Possible visual behavior:

subtle head movement
breathing motion
small hand/pose movement
mouth animation while speaking

Avoid uncanny or excessive animation.

Respect prefers-reduced-motion.


==================================================
QUESTION TEXT TO SPEECH
==================================================

Add:

"Read question aloud"

and optionally:

Auto-read questions

Use browser SpeechSynthesis as the baseline.

Do not require a paid TTS provider.

Candidate must always be able to read question as text.

Provide:

mute
replay question
speech on/off

Do not autoplay speech before a user has interacted if browser policy
would block it.


==================================================
LIVE INTERVIEW LAYOUT
==================================================

Create a polished interview-room experience.

Desktop example:

LEFT / MAIN:
3D interviewer
question
interviewer status

RIGHT:
progress
category
timer/session information
controls

BOTTOM:
microphone answer
text answer
submit/next

Mobile:

3D/avatar becomes compact or optional.
Question and answer controls remain primary.

Never sacrifice usability for the avatar.


==================================================
INTERVIEW HISTORY
==================================================

Create:

/interviews/history

Display:

date
role
difficulty
status
overall score
technical score
communication score
duration where reliable

Allow opening results.


==================================================
ANALYTICS
==================================================

Create:

/analytics

Use REAL stored interview data.

Display:

completed interviews
average overall score
latest score
best score

technical average
reasoning average
communication average

Use meaningful charts:

score trend over time
technical vs communication trend
category/topic performance
strongest topics
weakest topics

Use Recharts.

Handle:

0 interviews
1 interview
many interviews

with excellent UX.


==================================================
PROGRESS INSIGHTS
==================================================

Generate data-supported statements only.

Examples:

"Your SQL score improved across your last 3 interviews."

"Communication has improved by 8 points across recent sessions."

"Operating Systems is currently your weakest repeated topic."

Do not state trends without enough observations.


==================================================
ADMIN ROLE
==================================================

Implement real application authorization:

user
admin

Default public registrations to:

user

Users must never be able to promote themselves.

Use explicit schemas.

Prevent mass-assignment vulnerabilities.


==================================================
ADMIN BOOTSTRAP
==================================================

Provide a secure controlled way to designate an admin.

Do NOT hardcode production credentials.

Do not make every database owner automatically an application admin.

Provide documented project-local CLI/bootstrap method or controlled
environment-based initialization.

Never output passwords.


==================================================
ADMIN AREA
==================================================

Create:

/admin
/admin/users
/admin/users/[id]

Only admins may access.

Admin dashboard should show REAL:

total users
active users
total interviews
completed interviews
resume count
scheduled interviews

Admin can:

search users
view safe account details
view profile
view interview history
view resume metadata
activate/deactivate user where safe

Never expose:

hashed_password
JWT
JWT_SECRET
OPENAI_API_KEY
DATABASE_URL
database password
session tokens


==================================================
ADMIN USER DETAIL
==================================================

A user-detail page should safely allow an admin to inspect someone like:

Harshit

and see appropriate:

email
display name
account state
profile
skills
resume metadata
interview history
scores
scheduled interviews

without opening pgAdmin.

Admin should be able to edit only explicitly safe fields.

Do NOT build arbitrary raw database editing into the web UI.


==================================================
FINAL UI/UX PASS
==================================================

Review ALL:

landing
register
login
dashboard
profile
resume
job analysis
interview scheduling
live interview
3D interviewer
voice controls
results
analytics
history
admin

Make it feel like one premium application.

Improve:

spacing
typography
navigation
mobile layout
loading states
empty states
error states
focus behavior
theme consistency
micro-interactions

Avoid unnecessary gradients and animation.


==================================================
ACCESSIBILITY
==================================================

Ensure:

interview works without microphone
interview works without 3D
question is always available as text
controls are keyboard accessible
visible focus states
semantic labels
sufficient contrast
screen-reader-friendly recording state
reduced-motion support


==================================================
TESTING
==================================================

Test:

scheduling
rescheduling
cancellation
timezone-safe persistence
history
analytics calculations
admin authorization
admin denial
role escalation prevention
admin safe response fields
3D fallback
speech synthesis unavailable
voice/text switching

Run full frontend/backend checks.


==================================================
COMMIT
==================================================

Commit:

feat: add scheduling analytics admin and immersive interviewer

Push:

08-analytics-admin-avatar

Fast-forward main.

Push main.


##################################################
MILESTONE 09
BRANCH: 09-production-readiness
##################################################

GOAL:

Make InterviewAI production/deployment ready.

Do NOT deploy externally during this branch.


==================================================
PERFORMANCE
==================================================

Review the new audio and 3D functionality carefully.

Lazy load:

3D interviewer
heavy visualization code
other non-critical bundles

Ensure landing/login/dashboard are not forced to load the full 3D stack.

Check production bundle behavior.


==================================================
AUDIO PRIVACY
==================================================

Document audio handling.

Default privacy expectation:

microphone activates only after user action
recording visibly indicated
tracks stopped when finished
raw recordings not permanently retained unless explicitly necessary
transcripts/evaluation stored according to app behavior

Never silently record.


==================================================
SECURITY REVIEW
==================================================

Review:

authentication
JWT validation
role authorization
admin authorization
password hashing
CORS
resume uploads
audio uploads
file limits
MIME validation
API errors
AI prompt injection
SQL/database access
mass assignment
sensitive response fields
rate abuse
user ownership boundaries

Fix genuine issues.


==================================================
RATE LIMITING
==================================================

Apply practical limits particularly to:

register
login
AI question generation
AI evaluation
audio transcription

Use deployment-friendly design.


==================================================
LOGGING
==================================================

Never log:

passwords
JWTs
database URLs
API keys
raw resume text
raw audio
sensitive transcripts unnecessarily

Log useful operational failures.


==================================================
HEALTH / READINESS
==================================================

Keep:

/health

Add:

/ready

if useful.

Readiness may safely verify database availability.

Never expose secrets.


==================================================
DOCKER
==================================================

Create production-ready Dockerfiles for:

frontend
backend

Use multi-stage builds where appropriate.

Create useful .dockerignore files.

Do not copy:

.env
node_modules
.venv
raw uploads
audio recordings
Git metadata
test caches

Create docker-compose configuration for production-like local testing
if useful.

Do NOT break normal:

npm run dev


==================================================
PRODUCTION DATABASE
==================================================

Keep migrations safe.

Document:

alembic upgrade head

or appropriate deployment procedure.

Never destroy production data automatically.


==================================================
PRODUCTION STORAGE
==================================================

Document that:

local resume/audio storage is development-oriented.

Production should use durable object storage if persistence is required.

Provide storage abstraction/configuration rather than pretending
container filesystem is durable.


==================================================
ENVIRONMENT CONFIGURATION
==================================================

Document placeholders for:

DATABASE_URL
JWT_SECRET
OPENAI_API_KEY
frontend public URL
backend public URL
CORS origins
environment mode
storage settings where applicable

No production secret may be committed.


==================================================
CI
==================================================

Create GitHub Actions workflow.

On appropriate pushes / pull requests run:

frontend lint
frontend typecheck
frontend tests
frontend build
backend tests
backend lint
migration checks

AI/audio tests must use mocks.

CI must not require paid API calls.


==================================================
README / PORTFOLIO DOCUMENTATION
==================================================

Upgrade README substantially.

Explain features including:

AI adaptive interviews
voice or text answers
communication analysis
technical evaluation
scheduled interviews
3D interviewer
analytics
resume/job matching
admin dashboard
AI fallback behavior

Include architecture diagram in text/Mermaid if appropriate.

Include screenshots section placeholders only if actual screenshots are
available or deliberately generated later.

Do not claim deployment exists before it exists.


==================================================
DOCUMENTATION
==================================================

Create/update:

docs/architecture.md
docs/deployment.md
docs/security.md

Explain flow:

Browser
  ↓
Next.js
  ↓
FastAPI
  ↓
PostgreSQL

and:

Microphone
  ↓
Audio/transcription layer
  ↓
Transcript
  ↓
Technical + communication evaluation
  ↓
PostgreSQL analytics

Document 3D avatar as client-side enhancement only.


==================================================
FULL VALIDATION
==================================================

Frontend:

lint
typecheck
tests
production build

Backend:

all tests
Ruff
migration validation
startup checks

Test:

authentication
admin
resume upload
interview
voice fallback
evaluation
analytics
scheduling
3D fallback

No real paid API request required.

If Docker exists:
validate builds.

If Docker is unavailable:
do not install globally.
Report validation not performed.


==================================================
GIT COMPLETION
==================================================

Commit:

chore: prepare InterviewAI for production deployment

Push:

09-production-readiness

Switch to main.

Fast-forward main using --ff-only.

Push main.


==================================================
FINAL GITHUB STATE
==================================================

GitHub should contain:

main
01-foundation-ui
02-database-auth
03-dashboard-profile
04-resume-analysis
05-interview-engine
06-ai-interviewer
07-evaluation-voice
08-analytics-admin-avatar
09-production-readiness

Do not delete previous branches.

main must contain all functionality.


==================================================
FINAL LOCAL STATE
==================================================

Switch to:

main

Ensure:

git status

is clean.

main synchronized with origin/main.


==================================================
FINAL REPORT
==================================================

Report:

BRANCH 07
- commit hash
- evaluation tests
- microphone/voice tests
- communication-analysis tests
- push status

BRANCH 08
- commit hash
- scheduling tests
- analytics tests
- admin authorization tests
- 3D fallback tests
- push status

BRANCH 09
- commit hash
- production build
- backend tests
- security checks
- Docker readiness
- CI configuration
- push status

FINAL:
- main commit hash
- frontend tests/build
- backend total tests
- local npm run dev status
- GitHub branch verification
- current branch
- git status
- remaining warnings
- deployment requirements
- manual configuration still required

Never reveal secrets.

Do not deploy externally yet.

STOP after milestone 09 is complete and main has been pushed.