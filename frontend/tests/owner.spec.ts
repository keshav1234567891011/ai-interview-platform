import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { testUser, mockWorkspace, testProfile } from "./workspace-fixtures";
import { randomBytes } from "node:crypto";
const permissions = ["users.view", "users.manage", "interviews.view", "resumes.view", "analytics.view", "support.manage"];
const owner = { ...testUser, role: "owner", permissions, display_name: "Application Owner" };
const admin = { ...testUser, id: "admin-validation", role: "admin", display_name: "Delegated Admin", permissions: ["users.view"], email: "delegated@example.com", password_change_required: true };
const secret = () => `Validation7-${randomBytes(24).toString("hex")}`;

async function mocks(page: Page, current = owner) {
  await mockWorkspace(page);
  await page.route("**/api/auth/me", route => route.fulfill({ json: current }));
  await page.route("**/api/owner/audit**", route => route.fulfill({ json: [{ id: "event-1", actor_id: owner.id, target_id: admin.id, action: "admin_created", created_at: owner.created_at }] }));
  await page.route("**/api/owner/ai-settings", route => route.fulfill({ json: { configured: false, model: "configured-model", management: "environment" } }));
  await page.route("**/api/owner/admins?**", route => route.fulfill({ json: [admin] }));
}

for (const width of [375, 1440]) for (const view of ["owner", "owner/admins", "owner/admins/new", "owner/security", "change-password"]) {
  test(`${view} accessible at ${width}px in both themes`, async ({ page }) => {
    await mocks(page); await page.emulateMedia({ reducedMotion: "reduce" }); await page.setViewportSize({ width, height: 1000 }); await page.goto(`/${view}`);
    await expect(page.locator(".workspace-heading h1")).toBeVisible();
    for (const theme of ["dark", "light"]) {
      if (theme === "light") await page.getByRole("button", { name: "Switch to light mode" }).click();
      expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) }))).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}

for (const role of ["owner", "admin"]) {
  test(`${role} temporary login immediately opens password change and blocks workspace rendering`, async ({ page }) => {
    const pending = { ...owner, role, password_change_required: true };
    await mocks(page, pending);
    await page.goto("/owner/admins"); await expect(page).toHaveURL(/\/change-password$/);
    await expect(page.getByRole("heading", { name: "Make this account yours." })).toBeVisible();
    await page.goto("/login"); await page.route("**/api/auth/login", route => route.fulfill({ json: pending }));
    await page.getByLabel("Email address").fill("temporary@example.com"); await page.getByLabel("Password", { exact: true }).fill(secret()); await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/change-password$/);
  });
}

for (const role of ["owner", "admin"]) {
  test(`${role} normal login reaches correct role workspace`, async ({ page }) => {
    const current = { ...owner, role };
    await mocks(page, current); await page.route("**/api/auth/login", route => route.fulfill({ json: current }));
    await page.route("**/api/admin", route => route.fulfill({ json: { total_users: 2 } }));
    await page.goto("/login"); await page.getByLabel("Email address").fill("role-validation@example.com"); await page.getByLabel("Password", { exact: true }).fill(secret()); await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(role === "owner" ? /\/owner$/ : /\/admin$/);
  });
}

test("owner password change validates confirmation then refreshes session", async ({ page }) => {
  let current = { ...owner, password_change_required: true };
  await mocks(page, current); await page.route("**/api/auth/me", route => route.fulfill({ json: current }));
  let changed = false;
  await page.route("**/api/auth/change-password", route => { changed = true; current = { ...owner, password_change_required: false }; return route.fulfill({ json: current }); });
  await page.goto("/change-password"); await page.getByLabel("Current password", { exact: true }).fill(secret());
  const chosen = secret(); await page.getByLabel("New password", { exact: true }).fill(chosen); await page.getByLabel("Confirm new password", { exact: true }).fill(secret());
  await page.getByRole("button", { name: "Change password", exact: true }).click(); await expect(page.locator(".form-error[role=alert]")).toContainText("must match"); expect(changed).toBe(false);
  await page.getByLabel("Confirm new password", { exact: true }).fill(chosen); await page.getByRole("button", { name: "Change password", exact: true }).click(); await expect(page).toHaveURL(/\/owner$/); expect(changed).toBe(true);
});

test("owner creates scoped admin without redisplaying the temporary password", async ({ page }) => {
  await mocks(page); let received: Record<string, unknown> = {};
  await page.route("**/api/owner/admins", route => { received = route.request().postDataJSON(); return route.fulfill({ status: 201, json: admin }); });
  await page.goto("/owner/admins/new"); await page.getByLabel("Full Name", { exact: true }).fill("Delegated Admin"); await page.getByLabel("Email", { exact: true }).fill(admin.email);
  const temporary = secret(); await page.getByLabel("Temporary Password", { exact: true }).fill(temporary); await page.getByLabel("Confirm Temporary Password", { exact: true }).fill(temporary);
  await page.getByRole("checkbox", { name: "View users", exact: true }).check(); await page.getByRole("button", { name: "Create Admin", exact: true }).click(); await expect(page).toHaveURL(/\/owner\/admins\?created=1$/);
  await expect(page.getByRole("status")).toHaveText("Admin account created."); expect(received.permissions).toEqual(["users.view"]); expect(await page.locator("body").innerText()).not.toContain(temporary); await expect(page.locator("input[type=password]")).toHaveCount(0);
});

test("owner edits permissions, resets credentials and revokes delegation", async ({ page }) => {
  await mocks(page); let current = { ...admin }; const actions: string[] = [];
  await page.route("**/api/owner/admins?**", route => route.fulfill({ json: current.role === "admin" ? [current] : [] }));
  await page.route("**/api/owner/admins/admin-validation/*", route => {
    const action = route.request().url().split("/").at(-1)!; actions.push(action);
    if (action === "permissions") current = { ...current, permissions: route.request().postDataJSON().permissions };
    if (action === "revoke") current = { ...current, role: "user" };
    if (action === "reset-password") { const data = route.request().postDataJSON(); expect(Object.keys(data).sort()).toEqual(["confirm_password", "password"]); return route.fulfill({ status: 204 }); }
    return route.fulfill({ json: current });
  });
  await page.goto("/owner/admins"); await page.getByRole("button", { name: "Edit Admin Permissions" }).click(); await page.getByRole("checkbox", { name: "View application analytics" }).check(); await page.getByRole("button", { name: "Save permissions" }).click();
  await expect(page.locator(".skill-chips")).toContainText("analytics.view"); await page.getByRole("button", { name: "Reset Admin Password" }).click(); const temporary = secret(); await page.getByLabel("New temporary password", { exact: true }).fill(temporary); await page.getByLabel("Confirm temporary password", { exact: true }).fill(temporary); await page.getByRole("button", { name: "Set temporary password" }).click(); await expect(page.getByRole("status")).toContainText("must choose a new password");
  page.once("dialog", dialog => dialog.accept()); await page.getByRole("button", { name: "Revoke Admin" }).click(); await expect(page.getByRole("heading", { name: "Careful delegation starts here." })).toBeVisible(); expect(actions).toEqual(["permissions", "reset-password", "revoke"]);
});

test("delegated admin cannot enter owner control center or edit without manage permission", async ({ page }) => {
  await mocks(page, { ...admin, password_change_required: false }); await page.goto("/owner/admins/new"); await expect(page.getByRole("heading", { name: "Owner access required." })).toBeVisible(); await expect(page.getByRole("link", { name: "Delegated admins", exact: true })).toHaveCount(0);
  await page.route(`**/api/admin/users/${testUser.id}`, route => route.fulfill({ json: { user: testUser, profile: testProfile, interviews: [], resumes: [], scheduled: [] } })); await page.goto(`/admin/users/${testUser.id}`); await expect(page.getByRole("button", { name: "Save safe fields" })).toBeDisabled(); await expect(page.getByRole("checkbox", { name: "Account active" })).toBeDisabled();
});
