import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockWorkspace } from "./workspace-fixtures";
const id = "validation-interview";
const session = { id, role: "Backend Developer", difficulty: "Intermediate", status: "in_progress", question_count: 1, answered_count: 0, ai_enabled: false, current_sequence: 1, questions: [{ id: "q1", sequence: 1, question_text: "Explain database indexing and its trade-offs.", category: "dbms", difficulty: "Intermediate", source: "question_bank", answer_text: "", answered_at: null }] };
async function mockSession(page: import("@playwright/test").Page) {
  await mockWorkspace(page);
  await page.route(`**/api/interviews/${id}`, route => route.fulfill({ json: session }));
}
test("unsupported microphone keeps text available", async ({ page }) => {
  await mockSession(page);
  await page.addInitScript(() => { Object.defineProperty(window, "MediaRecorder", { value: undefined }); });
  await page.goto(`/interviews/${id}`);
  await page.getByRole("button", { name: "Answer with microphone" }).click();
  await expect(page.getByText("Microphone recording is unavailable", { exact: false })).toBeVisible();
  await page.getByLabel("Your answer", { exact: true }).fill("A text explanation remains available.");
  await expect(page.getByRole("button", { name: "Finish interview" })).toBeEnabled();
  await page.getByRole("button", { name: "Answer with text" }).click();
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue("A text explanation remains available.");
});
test("denied permission gives actionable fallback and never activates automatically", async ({ page }) => {
  await mockSession(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: async () => { throw new DOMException("Denied", "NotAllowedError"); } } });
  });
  await page.goto(`/interviews/${id}`);
  await page.getByRole("button", { name: "Answer with microphone" }).click();
  await expect(page.getByText("Not recording", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start recording" }).click();
  await expect(page.locator(".voice-panel [role=alert]")).toContainText("Microphone access was not available");
  await expect(page.getByLabel("Your answer", { exact: true })).toBeEnabled();
});
test("recording is deliberate and tracks stop with playback and discard", async ({ page }) => {
  await mockSession(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", { value: undefined });
    Object.defineProperty(window, "webkitSpeechRecognition", { value: undefined });
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: async () => {
      document.documentElement.dataset.permissionCalls = "1";
      return { getTracks: () => [{ stop: () => { document.documentElement.dataset.tracksStopped = "1"; } }] };
    } } });
    class Recorder {
      state = "inactive"; mimeType = "audio/webm";
      onstop: (() => void) | null = null;
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      start() { this.state = "recording"; }
      stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob(["synthetic audio"], { type: this.mimeType }) }); this.onstop?.(); }
    }
    Object.defineProperty(window, "MediaRecorder", { value: Recorder });
  });
  await page.goto(`/interviews/${id}`);
  await page.getByRole("button", { name: "Answer with microphone" }).click();
  expect(await page.evaluate(() => document.documentElement.dataset.permissionCalls)).toBeUndefined();
  await page.getByRole("button", { name: "Start recording" }).click();
  await expect(page.getByText("Recording active", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(page.locator("audio")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dataset.tracksStopped)).toBe("1");
  await page.getByRole("button", { name: "Discard recording" }).click();
  await expect(page.locator("audio")).toHaveCount(0);
});
for (const width of [375, 1440]) test(`report accessible at ${width}px`, async ({ page }) => {
  await mockWorkspace(page);
  await page.route(`**/api/interviews/${id}/results`, route => route.fulfill({ json: {
    interview: { ...session, status: "completed", answered_count: 1 },
    summary: { score: 56, technical_score: 60, reasoning_score: 55, communication_score: 70, evaluated_answers: 1, topics: [{ topic: "dbms", score: 56, observations: 1 }], recommended_topics: ["dbms"] },
    questions: [{ id: "q1", sequence: 1, question: session.questions[0].question_text, category: "dbms", answer: "An index speeds up lookups.", input_mode: "voice", evaluation: { score: 56, technical_score: 60, reasoning_score: 55, communication_score: 70, source: "deterministic", strengths: ["References indexing"], weaknesses: ["Explain write cost"], concepts_missed: ["query"], feedback: "A baseline estimate of structure and coverage.", improvement_suggestion: "Add a concrete example and a trade-off.", communication: { word_count: 6, sentence_count: 1, filler_count: 0, fillers_per_100_words: 0, frequent_fillers: {}, duration_seconds: 4, words_per_minute: 90, pace: "measured", recommendations: ["Begin with the core definition."] } } }]
  } }));
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/interviews/${id}/results`);
  await expect(page.getByRole("heading", { name: "Your interview report." })).toBeVisible();
  await expect(page.getByText("90 estimated words/min", { exact: false })).toBeVisible();
  for (const theme of ["dark", "light"]) {
    if (theme === "light") await page.getByRole("button", { name: "Switch to light mode" }).click();
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
