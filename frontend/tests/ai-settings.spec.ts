import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { mockWorkspace, testUser, testAISettings } from "./workspace-fixtures";

test.beforeEach(async ({ page }) => {
  await mockWorkspace(page);
  await page.route("**/api/auth/me", route => route.fulfill({ json: { ...testUser, role: "owner" } }));
  await page.route("**/api/owner/ai-settings", route => route.fulfill({ json: testAISettings }));
});

test("owner stores and replaces a key, inputs clear and saved keys never appear", async ({ page }) => {
  let state = { ...testAISettings }; let received: Record<string, string> = {};
  await page.route("**/api/owner/ai-settings/key", route => {
    received = route.request().postDataJSON();
    state = { ...state, configured: true, database_key_present: true, credential_source: "database", fallback_active: false };
    return route.fulfill({ json: state });
  });
  await page.goto("/owner/ai-settings");
  const secret = "sk-" + randomBytes(36).toString("base64url");
  await expect(page.getByLabel("New API key", { exact: true })).toHaveValue("");
  await page.getByLabel("New API key", { exact: true }).fill(secret);
  await page.getByLabel("Confirm new API key", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "Save API Key", exact: true }).click();
  await expect(page.getByText("AI settings saved.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("New API key", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Confirm new API key", { exact: true })).toHaveValue("");
  await expect(page.getByRole("button", { name: "Replace API Key", exact: true })).toBeVisible();
  expect(received.api_key === secret && received.confirm_api_key === secret).toBe(true);
  expect(await page.locator("body").innerText()).not.toContain(secret);
});

test("mismatched key confirmation prevents submission and server errors remain actionable", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/owner/ai-settings/key", route => { requests++; return route.fulfill({ status: 503, json: { detail: "Settings encryption unavailable. Ask the operator to check it." } }); });
  await page.goto("/owner/ai-settings");
  const first = "sk-" + randomBytes(36).toString("hex");
  await page.getByLabel("New API key", { exact: true }).fill(first);
  await page.getByLabel("Confirm new API key", { exact: true }).fill("sk-" + randomBytes(36).toString("hex"));
  await page.getByRole("button", { name: "Save API Key", exact: true }).click();
  await expect(page.locator(".form-error[role=alert]")).toContainText("must match"); expect(requests).toBe(0);
  await page.getByLabel("Confirm new API key", { exact: true }).fill(first);
  await page.getByRole("button", { name: "Save API Key", exact: true }).click();
  await expect(page.locator(".form-error[role=alert]")).toContainText("encryption unavailable");
});

test("owner models and disabling provider are explicit server-validated updates", async ({ page }) => {
  let payload: Record<string, unknown> = {};
  await page.route("**/api/owner/ai-settings", route => {
    if (route.request().method() === "PUT") { payload = route.request().postDataJSON(); return route.fulfill({ json: { ...testAISettings, ...payload, fallback_active: true } }); }
    return route.fulfill({ json: testAISettings });
  });
  await page.goto("/owner/ai-settings"); await page.getByLabel("Text model", { exact: true }).selectOption("gpt-5-nano"); await page.getByLabel("Transcription model", { exact: true }).selectOption("gpt-4o-transcribe"); await page.getByRole("checkbox", { name: "Enable AI provider" }).uncheck();
  await page.getByRole("button", { name: "Save provider settings" }).click();
  await expect(page.getByText("AI settings saved.", { exact: false })).toBeVisible();
  expect(payload).toEqual({ enabled: false, text_model: "gpt-5-nano", transcription_model: "gpt-4o-transcribe" });
  await expect(page.getByRole("button", { name: "Test Connection" })).toBeDisabled();
});

test("connection tests are deliberate and removing the database key preserves fallback", async ({ page }) => {
  await page.route("**/api/owner/ai-settings", route => route.fulfill({ json: { ...testAISettings, configured: true, database_key_present: true, credential_source: "database" } }));
  let tested = false;
  await page.route("**/api/owner/ai-settings/test", route => { tested = true; return route.fulfill({ json: { status: "connected" } }); });
  await page.route("**/api/owner/ai-settings/key", route => { expect(route.request().method()).toBe("DELETE"); return route.fulfill({ json: testAISettings }); });
  await page.goto("/owner/ai-settings"); expect(tested).toBe(false);
  await page.getByRole("button", { name: "Test Connection" }).click();
  await expect(page.getByText("Connected.", { exact: false })).toBeVisible(); expect(tested).toBe(true);
  page.once("dialog", dialog => dialog.accept()); await page.getByRole("button", { name: "Remove database API Key" }).click();
  await expect(page.getByRole("button", { name: "Remove database API Key" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save API Key", exact: true })).toBeVisible();
});

for (const role of ["user", "admin"]) test(`${role} cannot open owner AI settings`, async ({ page }) => {
  await page.route("**/api/auth/me", route => route.fulfill({ json: { ...testUser, role, permissions: ["users.view", "users.manage", "analytics.view"] } }));
  let accessed = false; await page.route("**/api/owner/ai-settings", route => { accessed = true; return route.fulfill({ status: 403 }); });
  await page.goto("/owner/ai-settings"); await expect(page.getByRole("heading", { name: "Owner access required." })).toBeVisible(); expect(accessed).toBe(false);
});

test("missing encryption configuration blocks key inputs but keeps deterministic controls", async ({ page }) => {
  await page.route("**/api/owner/ai-settings", route => route.fulfill({ json: { ...testAISettings, encryption_status: "missing" } }));
  await page.goto("/owner/ai-settings"); await expect(page.getByLabel("New API key", { exact: true })).toBeDisabled(); await expect(page.getByRole("button", { name: "Save API Key", exact: true })).toBeDisabled(); await expect(page.getByRole("button", { name: "Save provider settings" })).toBeEnabled();
});
