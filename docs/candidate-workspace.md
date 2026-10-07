# Candidate workspace

Milestone 03 stores one profile per account and canonical skills through a normalized many-to-many association. GET requests return defaults for profiles that have not been saved; updates create the profile and replace its skill selection transactionally. The API never accepts another user's ID when updating a profile.

Profile completion measures four supplied fields: display name, target role, experience level, and technical skills. It is not interview readiness, an evaluation score, or a hiring prediction. The dashboard starts with an honest empty interview history. It includes next steps derived from the candidate's actual profile and no invented performance statistics.

The professional summary is optional and limited to 1,200 characters. No address, phone number, demographic information, or other unnecessary personal data is requested. Account email is read-only. Destructive account operations are outside this milestone.

Browser tests verify responsive dark/light layouts, accessibility, profile submission, and retriable failures. API tests verify ownership isolation, validation, profile persistence, and protected workspace access. The generated Next.js type declaration is ignored because dev/build tooling regenerates it; source files remain version-controlled.
