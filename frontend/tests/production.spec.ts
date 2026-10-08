import { test, expect } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { mockWorkspace } from "./workspace-fixtures";

const chunks = path.join(process.cwd(), ".next", "static", "chunks");
const heavyChunks = readdirSync(chunks)
  .filter((file) => file.endsWith(".js"))
  .filter((file) => {
    const content = readFileSync(path.join(chunks, file), "utf8");
    return content.includes("WebGLRenderer") || content.includes("recharts-surface");
  });

for (const route of ["/", "/login", "/dashboard"]) {
  test(`${route} keeps heavy visualization bundles off the initial route`, async ({ page }) => {
    expect(heavyChunks.length).toBeGreaterThanOrEqual(2);
    await mockWorkspace(page);
    const requests = new Set<string>();
    page.on("request", (request) => requests.add(new URL(request.url()).pathname.split("/").at(-1) ?? ""));
    const response = await page.goto(route);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByRole("button", { name: /Switch to .* mode/ })).toBeVisible();
    for (const chunk of heavyChunks) expect(requests.has(chunk)).toBe(false);
    expect(response?.headers()["x-frame-options"]).toBe("DENY");
    expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response?.headers()["permissions-policy"]).toContain("microphone=(self)");
  });
}

test("failed 3D module download preserves the interview and text draft", async ({ page }) => {
  const threeChunks = heavyChunks.filter((file) => readFileSync(path.join(chunks, file), "utf8").includes("WebGLRenderer"));
  expect(threeChunks.length).toBeGreaterThan(0);
  await mockWorkspace(page);
  await page.route("**/api/interviews/bundle-fallback", (route) => route.fulfill({ json: {
    id: "bundle-fallback", role: "Backend Developer", difficulty: "Intermediate", status: "in_progress",
    question_count: 1, answered_count: 0, ai_enabled: false, current_sequence: 1,
    questions: [{ id: "q1", sequence: 1, question_text: "Explain database indexing and its trade-offs.", category: "dbms", difficulty: "Intermediate", source: "question_bank", answer_text: "", answered_at: null }],
  } }));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => Object.defineProperty(navigator, "hardwareConcurrency", { value: 8 }));
  for (const chunk of threeChunks) await page.route(`**/${chunk}`, (route) => route.abort("failed"));
  await page.goto("/interviews/bundle-fallback");
  const answer = page.getByLabel("Your answer", { exact: true });
  await answer.fill("My text draft remains available while optional 3D fails.");
  await page.getByRole("checkbox", { name: "Enable 3D interviewer" }).check();
  await expect(page.getByText("3D rendering unavailable", { exact: false })).toBeVisible();
  await expect(answer).toHaveValue("My text draft remains available while optional 3D fails.");
  await expect(page.getByRole("button", { name: "Finish interview" })).toBeEnabled();
});
