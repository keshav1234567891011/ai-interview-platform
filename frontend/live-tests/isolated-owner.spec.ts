import { test, expect, type Page } from "@playwright/test";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";

test("isolated real owner login, admin delegation and encrypted AI controls", async ({ page, browser }) => {
  const root = path.resolve(__dirname, "../..");
  const frontendURL = String(test.info().project.use.baseURL ?? "http://localhost:3000");
  const secret = () => `${randomBytes(32).toString("base64url")}A9`;
  const ownerPassword = secret(); const adminTemporary = secret(); const adminChosen = secret();
  const child = spawn(path.join(root, "backend/.venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python"), [path.join(root, "scripts/isolated_owner_server.py")], { cwd: root, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  child.stderr.on("data", () => {}); // No raw server diagnostics in reports.
  let stage = "isolated backend startup";
  const adminContext = await browser.newContext();
  try {
    const port = await new Promise<number>((resolve, reject) => {
      let buffered = "";
      const timer = setTimeout(() => reject(new Error("Isolated startup timed out")), 15_000);
      child.once("error", () => { clearTimeout(timer); reject(new Error("Isolated startup failed")); });
      child.stdout.on("data", chunk => { buffered += String(chunk); if (!buffered.includes("\n")) return; try { const handshake = JSON.parse(buffered.split("\n")[0]); clearTimeout(timer); resolve(handshake.port); } catch { clearTimeout(timer); reject(new Error("Isolated startup failed")); } });
      child.stdin.write(JSON.stringify({ email: "isolated-owner@example.com", password: ownerPassword }) + "\n");
    });
    async function proxy(target: Page) {
      await target.route("**/api/**", async route => {
        const requested = new URL(route.request().url());
        const response = await route.fetch({ url: `http://127.0.0.1:${port}${requested.pathname}${requested.search}` });
        await route.fulfill({ response });
      });
    }
    await proxy(page);
    stage = "owner login";
    await page.goto(frontendURL + "/login"); await page.getByLabel("Email address").fill("isolated-owner@example.com"); await page.getByLabel("Password", { exact: true }).fill(ownerPassword); await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page).toHaveURL(/\/owner$/);
    stage = "admin creation";
    await page.goto(frontendURL + "/owner/admins/new"); await page.getByLabel("Full Name", { exact: true }).fill("Isolated Delegated Admin"); await page.getByLabel("Email", { exact: true }).fill("isolated-admin@example.com"); await page.getByLabel("Temporary Password", { exact: true }).fill(adminTemporary); await page.getByLabel("Confirm Temporary Password", { exact: true }).fill(adminTemporary); await page.getByRole("checkbox", { name: "View users", exact: true }).check(); await page.getByRole("button", { name: "Create Admin", exact: true }).click(); await expect(page.getByText("Admin account created.", { exact: true })).toBeVisible();
    stage = "admin first password change";
    const adminPage = await adminContext.newPage(); await proxy(adminPage);
    await adminPage.goto(frontendURL + "/login"); await adminPage.getByLabel("Email address").fill("isolated-admin@example.com"); await adminPage.getByLabel("Password", { exact: true }).fill(adminTemporary); await adminPage.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(adminPage).toHaveURL(/\/change-password$/); await adminPage.getByLabel("Current password", { exact: true }).fill(adminTemporary); await adminPage.getByLabel("New password", { exact: true }).fill(adminChosen); await adminPage.getByLabel("Confirm new password", { exact: true }).fill(adminChosen); await adminPage.getByRole("button", { name: "Change password", exact: true }).click(); await expect(adminPage).toHaveURL(/\/admin$/);
    stage = "permission revocation";
    await page.goto(frontendURL + "/owner/admins"); await page.getByRole("button", { name: "Edit Admin Permissions" }).click(); await page.getByRole("checkbox", { name: "View users", exact: true }).uncheck(); await page.getByRole("button", { name: "Save permissions" }).click(); await expect(page.getByText("No permissions assigned", { exact: true })).toBeVisible(); await adminPage.goto(frontendURL + "/admin/users"); await expect(adminPage.getByRole("heading", { name: "User viewing permission required." })).toBeVisible(); await adminPage.goto(frontendURL + "/owner/ai-settings"); await expect(adminPage.getByRole("heading", { name: "Owner access required." })).toBeVisible();
    stage = "encrypted key configuration";
    await page.goto(frontendURL + "/owner/ai-settings"); const key = "sk-" + randomBytes(32).toString("base64url"); await page.getByLabel("New API key", { exact: true }).fill(key); await page.getByLabel("Confirm new API key", { exact: true }).fill(key); await page.getByRole("button", { name: "Save API Key", exact: true }).click(); await expect(page.getByLabel("New API key", { exact: true })).toHaveValue(""); await expect(page.getByText("Encrypted database", { exact: true })).toBeVisible();
    stage = "mocked metadata probe";
    await page.getByRole("button", { name: "Test Connection" }).click(); await expect(page.getByText("Connected.", { exact: false })).toBeVisible();
    stage = "disable and remove key";
    await page.getByRole("checkbox", { name: "Enable AI provider" }).uncheck(); await page.getByRole("button", { name: "Save provider settings" }).click(); await expect(page.getByRole("button", { name: "Test Connection" })).toBeDisabled(); page.once("dialog", dialog => dialog.accept()); await page.getByRole("button", { name: "Remove database API Key" }).click(); await expect(page.getByRole("button", { name: "Save API Key", exact: true })).toBeVisible(); await page.reload(); await expect(page.getByRole("checkbox", { name: "Enable AI provider" })).not.toBeChecked();
    console.log("Isolated owner/admin login, mandatory admin password change, permission revocation and encrypted AI controls: passed. No real owner account or paid provider used.");
  } catch {
    throw new Error(`Isolated owner acceptance failed during ${stage}; private details suppressed.`);
  } finally {
    await adminContext.close(); child.stdin.end("stop\n");
    if (child.exitCode === null) await new Promise<void>(resolve => { const timer = setTimeout(() => { child.kill(); resolve(); }, 6000); child.once("exit", () => { clearTimeout(timer); resolve(); }); });
  }
});
