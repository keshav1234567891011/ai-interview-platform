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
  await expect(page.locator(".voice-panel [role=status]")).toContainText("Recording active");
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


for (const source of ["ai", "deterministic"]) test(`${source} detailed feedback is labeled accurately`, async ({ page }) => {
  await mockWorkspace(page);
  await page.route(`**/api/interviews/${id}/results`, route => route.fulfill({ json: {
    interview: { ...session, status: "completed", answered_count: 1 },
    summary: { score: 75, technical_score: 80, reasoning_score: 70, communication_score: 80,
      evaluated_answers: 1, topics: [], recommended_topics: [] },
    questions: [{ id: "q1", sequence: 1, question: session.questions[0].question_text,
      question_source: "ai", category: "dbms", answer: "Indexes accelerate lookups.", input_mode: "text", evaluation: {
        fallback_reason: source === "deterministic" ? "quota" : null,
        provider_model: source === "ai" ? "gemini-3.1-flash-lite" : null,
        source, score: 75, technical_score: 80, coverage_score: 70, reasoning_score: 70,
        practical_score: 60, communication_score: 80, strengths: ["Explains lookup benefit"],
        weaknesses: ["Omits write cost"], concepts_covered: ["lookup"], concepts_missed: ["write overhead"],
        feedback: "Indexes require maintenance on writes.",
        improvement_suggestion: "Compare read savings with write costs.",
        sample_answer: "An index speeds reads at the cost of extra storage and write maintenance.",
        communication: { word_count: 3, sentence_count: 1, filler_count: 0, fillers_per_100_words: 0,
          frequent_fillers: {}, duration_seconds: null, words_per_minute: null, pace: null, recommendations: [] }
      } }]
  } }));
  await page.goto(`/interviews/${id}/results`);
  await expect(page.getByText(source === "ai" ? "Gemini AI feedback" : "Fallback mode", { exact: false })).toBeVisible();
  await expect(page.getByText("Question source: Gemini AI question")).toBeVisible();
  if (source === "deterministic") {
    await expect(page.getByText("Gemini quota exhausted or rate limited", { exact: true })).toBeVisible();
    await expect(page.locator(".answer-report .eyebrow")).toContainText("Fallback mode / Baseline estimate");
    await expect(page.locator(".answer-report .eyebrow")).not.toContainText("?");
  }
  await expect(page.getByText("Covered concepts: lookup")).toBeVisible();
  await expect(page.getByText("Concepts to revisit: write overhead")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Improved sample answer" })).toBeVisible();
  await page.getByText("Your answer", { exact: true }).click();
  await expect(page.getByText("Indexes accelerate lookups.", { exact: true })).toBeVisible();
  await expect(page.getByText("Coverage 70/100", { exact: false })).toBeVisible();
});


for (const kind of ["ai", "fallback", "mixed"] as const) test(`${kind} report explains its real evaluation sources and separates topics`, async ({ page }) => {
  await mockWorkspace(page);
  const sources = kind === "ai" ? ["ai", "ai", "ai"] : kind === "fallback" ? ["deterministic", "deterministic", "deterministic"] : ["ai", "deterministic", "ai"];
  const questions = sources.map((source, index) => ({ id: `report-${index}`, sequence: index+1,
    question: `Explain a technical trade-off in practice ${index+1}.`, question_source: "ai", category: "dbms",
    answer: "This synthetic example explains the approach and trade-off.", input_mode: "text", evaluation: {
      source, score: 75, technical_score: 80, coverage_score: 70, reasoning_score: 70,
      practical_score: 60, communication_score: 80, strengths: ["Explains a trade-off"], weaknesses: ["Add a measured example"],
      concepts_covered: ["index"], concepts_missed: ["write cost"], feedback: "Indexes require extra maintenance on writes.",
      improvement_suggestion: "Measure the read savings against write maintenance.", sample_answer: "Choose an index when selective reads justify storage and write overhead.",
      provider_model: source === "ai" ? "gemini-3.1-flash-lite" : null,
      communication: { word_count: 10, sentence_count: 1, filler_count: 0, fillers_per_100_words: 0,
        frequent_fillers: {}, duration_seconds: null, words_per_minute: null, pace: null, recommendations: [] },
    } }));
  await page.route(`**/api/interviews/${id}/results`, route => route.fulfill({ json: {
    interview: { ...session, question_count: 3, status: "completed", answered_count: 3 },
    summary: { score: 75, technical_score: 80, reasoning_score: 70, communication_score: 80, evaluated_answers: 3,
      topics: ["aws", "computer-networks", "dbms"].map(topic => ({ topic, score: 75, observations: 1 })),
      recommended_topics: ["aws", "computer-networks", "dbms"] }, questions,
  } }));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/interviews/${id}/results`);
  const note = page.locator("#evaluation-disclaimer");
  if (kind === "ai") { await expect(note).toContainText("All 3 answers received Gemini AI evaluation"); await expect(note).not.toContainText("baseline"); }
  if (kind === "fallback") { await expect(note).toContainText("All 3 answers use baseline estimates"); await expect(note).not.toContainText("received Gemini"); }
  if (kind === "mixed") await expect(note).toContainText("2 answers received Gemini AI evaluation; 1 answer uses a baseline estimate");
  await expect(page.getByText("Scores support interview practice and should not determine hiring decisions.")).toBeVisible();
  await expect(page.getByRole("list", { name: "Recommended improvement areas" }).getByRole("listitem")).toHaveText(["AWS", "Computer Networks", "DBMS"]);
  await expect(page.getByRole("list", { name: "Topic performance" }).getByRole("listitem")).toHaveCount(3);
  expect((await page.getByRole("list", { name: "Recommended improvement areas" }).innerText()).includes("awscomputer")).toBe(false);
  await expect(page.locator(".report-score-grid")).toHaveCount(3);
  if (kind === "ai") await page.screenshot({ path: "test-results/release-gemini-report.png", fullPage: true });
});
