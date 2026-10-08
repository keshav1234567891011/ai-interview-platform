import type { Page } from "@playwright/test";
export const testUser = {
  id: "7e825abb-5c52-45f3-8bf7-e1f3de552d22",
  display_name: "Test Candidate",
  email: "candidate@example.com",
  is_active: true,
  role: "user",
  password_change_required: false,
  permissions: [] as string[],
  last_login_at: null,
  created_at: "2026-01-01T00:00:00Z",
};
export const testSkills = [
  { id: "python", name: "Python", category: "language" },
  { id: "sql", name: "SQL", category: "database" },
];
export const testProfile = {
  ...testUser,
  target_role: "",
  experience_level: "",
  summary: "",
  skills: [],
  completion: 25,
};

export async function mockWorkspace(page: Page) {
  await page.route("**/api/interviews/capabilities", (route) =>
    route.fulfill({ json: { ai_available: false } }),
  );
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: testUser }),
  );
  await page.route("**/api/skills", (route) =>
    route.fulfill({ json: testSkills }),
  );
  await page.route("**/api/profile", (route) =>
    route.fulfill({ json: testProfile }),
  );
  await page.route("**/api/dashboard", (route) =>
    route.fulfill({
      json: { profile: testProfile, recent_interviews: [], interview_count: 0 },
    }),
  );
}
