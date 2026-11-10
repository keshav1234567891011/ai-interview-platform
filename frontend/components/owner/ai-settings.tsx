"use client";
import { useRef, useState } from "react";
import { KeyRound, ShieldCheck, PlugZap } from "lucide-react";
import { aiReasonLabels } from "@/lib/ai-diagnostics";
import { api, ApiError } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import type { AISettings } from "@/lib/ai-settings-types";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { WorkspaceState } from "../ui/workspace-state";

export function OwnerAISettings() {
  const resource = useResource<AISettings>("/owner/ai-settings");
  if (!resource.data || resource.loading || resource.error) return <WorkspaceState loading={resource.loading} error={resource.error} retry={resource.reload} />;
  return <AISettingsPanel settings={resource.data} onSaved={resource.setData} />;
}

function AISettingsPanel({ settings, onSaved }: { settings: AISettings; onSaved: (data: AISettings) => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const geminiInFlight = useRef(false);
  const [testingGemini, setTestingGemini] = useState(false);
  const [geminiFeedback, setGeminiFeedback] = useState<{ error: boolean; message: string } | null>(null);
  async function testGeminiConnection() {
    if (geminiInFlight.current || busy) return;
    geminiInFlight.current = true;
    setTestingGemini(true);
    setBusy(true);
    setGeminiFeedback({ error: false, message: "Testing Gemini connection..." });
    try {
      const result = await api<{ status: string; model?: string }>("/owner/ai-settings/test-gemini", {
        method: "POST", signal: AbortSignal.timeout(35000),
      });
      const messages: Record<string, string> = {
        connected: "Gemini connection successful. The configured model generated a valid synthetic response. No candidate data was sent.",
        authentication_failed: "Gemini rejected the API key. Check the backend GEMINI_API_KEY and its API restrictions.",
        rate_limited: "Gemini quota exhausted or rate limit reached. Wait for your free-tier quota to reset or check limits in Google AI Studio. Billing was not enabled; no model was switched.",
        timeout: "Gemini connection timed out. Try again later; interview fallback remains available.",
        provider_unavailable: "Gemini could not return a valid response. Check your network and try again later. Interview fallback remains available.",
        request_rejected: "Gemini rejected the synthetic generation request. Check the configured model and API project restrictions; no billing or model changes were made.",
        model_unavailable: "The configured Gemini model is unavailable for this project. Check model access in Google AI Studio.",
        not_configured: "Gemini is not configured. Set GEMINI_API_KEY in backend/.env and restart the backend.",
        disabled: "The AI provider is disabled. Enable it and save provider settings before testing.",
      };
      onSaved({ ...settings, gemini_last_test_status: result.status, gemini_last_test_at: new Date().toISOString() });
      setGeminiFeedback({ error: result.status !== "connected", message: `${result.model || settings.gemini_model || "Gemini"}: ${messages[result.status] || "Gemini returned an unexpected connection status. Try again later."}` });
    } catch (err) {
      setGeminiFeedback({ error: true, message: err instanceof ApiError && err.status === 429
        ? "Connection test request limit reached. Wait a minute before testing again. This local limit does not verify Gemini quota."
        : err instanceof Error ? err.message : "Gemini connection failed. Please try again later." });
    } finally {
      geminiInFlight.current = false;
      setTestingGemini(false);
      setBusy(false);
    }
  }
  const [enabled, setEnabled] = useState(settings.enabled);
  const [textModel, setTextModel] = useState(settings.text_model);
  const [transcriptionModel, setTranscriptionModel] = useState(settings.transcription_model);
  async function mutate(path: string, method: string, payload?: object): Promise<boolean> {
    setBusy(true); setError(""); setNotice("");
    try { const result = await api<AISettings>(path, { method, ...(payload ? { body: JSON.stringify(payload) } : {}) }); onSaved(result); setNotice("AI settings saved. Subsequent requests use the updated configuration."); return true; }
    catch (err) { setError(err instanceof Error ? err.message : "Could not save AI settings."); return false; }
    finally { setBusy(false); }
  }
  async function saveKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const element = event.currentTarget; const values = new FormData(element);
    if (values.get("api_key") !== values.get("confirm_api_key")) { setError("API key and confirmation must match."); return; }
    if (await mutate("/owner/ai-settings/key", "PUT", Object.fromEntries(values.entries()))) element.reset();
  }
  async function testConnection() {
    setBusy(true); setError(""); setNotice("");
    try { const response = await api<{ status: string }>("/owner/ai-settings/test", { method: "POST" }); const labels: Record<string, string> = { connected: "Connected. Selected model metadata is accessible; generation and billing were not tested.", authentication_failed: "Authentication failed. Replace the credential or check its permissions.", rate_limited: "Rate limited. Wait before testing again.", provider_unavailable: "Provider unavailable. Deterministic interview fallback remains available.", model_unavailable: "A selected model is unavailable for this provider account.", not_configured: "No usable credential configured. Deterministic fallback is active.", disabled: "AI provider is disabled. Enable it before testing." }; setNotice(labels[response.status] || "Connection could not be verified."); }
    catch (err) { setError(err instanceof Error ? err.message : "Connection could not be verified."); }
    finally { setBusy(false); }
  }
  return <><div className="workspace-heading"><div><p className="eyebrow">OWNER · AI CONFIGURATION</p><h1>AI, under your control.</h1><p>Manage provider access without exposing credentials to your team.</p></div></div>
    <Card className="workspace-panel"><h2>Gemini interviews</h2><p>{settings.gemini_model || "Server-configured model"} / {settings.gemini_available ? (settings.gemini_last_test_status === "connected" ? "Configured; last test successful" : settings.gemini_last_test_status ? "Configured; last test failed" : "Configured; live connection unverified") : "Unavailable / fallback mode"}</p><p>Last synthetic test: {settings.gemini_last_test_status === "connected" ? "Gemini connection successful" : settings.gemini_last_test_status || "Not tested"}{settings.gemini_last_test_at ? ` / ${new Date(settings.gemini_last_test_at).toLocaleString()}` : ""}</p><p>Set GEMINI_API_KEY only on the backend using an unbilled Google project. Saved OpenAI keys below are separate. This test consumes one Gemini request using synthetic input.</p><Button type="button" aria-describedby="gemini-connection-feedback" aria-busy={testingGemini} disabled={busy || !settings.gemini_available} onClick={() => void testGeminiConnection()}>{testingGemini ? "Testing Gemini connection..." : "Test Gemini connection"}</Button><div id="gemini-connection-feedback" aria-live="polite" aria-atomic="true">{geminiFeedback && <p className={geminiFeedback.error ? "form-error" : "success-message"} role={geminiFeedback.error ? "alert" : "status"}>{geminiFeedback.message}</p>}</div></Card><Card className="workspace-panel"><h2>Recent AI pacing and fallback</h2><p className="fine-note">The latest 100 events for this model. Pacing delays preserve drafts; daily budgets and provider failures use fallback. Limits remain two AI turns per minute and twenty per day.</p>{settings.gemini_diagnostics?.length ? <ul>{settings.gemini_diagnostics.map(item => <li key={`${item.operation}-${item.reason}`}>{item.operation}: {aiReasonLabels[item.reason] || "Provider error"} ({item.count})</li>)}</ul> : <p>No recorded AI pacing or fallback events for this model.</p>}</Card><div className="report-metrics"><Card className="workspace-stat"><span>Legacy OpenAI</span><strong>{settings.enabled ? "Enabled" : "Disabled"}</strong><small>{settings.configured ? "Credential configured" : "Not configured"}</small></Card><Card className="workspace-stat"><span>Credential source</span><strong>{settings.credential_source === "database" ? "Encrypted database" : settings.credential_source === "environment" ? "Environment" : "None"}</strong></Card><Card className="workspace-stat"><span>Safe fallback</span><strong>{settings.fallback_active ? "Active" : "Available"}</strong><small>Practice remains usable without AI</small></Card></div>
    <div className="workspace-two-columns report-section"><Card className="workspace-panel"><div className="panel-header"><h2>Provider switch & legacy OpenAI models</h2><PlugZap size={20} aria-hidden="true" /></div><form onSubmit={event => { event.preventDefault(); void mutate("/owner/ai-settings", "PUT", { enabled, text_model: textModel, transcription_model: transcriptionModel }); }} aria-busy={busy}><label className="avatar-choice"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} disabled={busy} />Enable AI provider</label><p className="fine-note">Disabling AI prevents use of both database and environment credentials for subsequent requests.</p><div className="field"><label htmlFor="ai-text-model">Legacy OpenAI text model (unused by interviews)</label><select id="ai-text-model" value={textModel} onChange={event => setTextModel(event.target.value)} disabled={busy}>{settings.text_models.map(model => <option key={model}>{model}</option>)}</select></div><div className="field"><label htmlFor="ai-transcription-model">Transcription model</label><select id="ai-transcription-model" value={transcriptionModel} onChange={event => setTranscriptionModel(event.target.value)} disabled={busy}>{settings.transcription_models.map(model => <option key={model}>{model}</option>)}</select></div><Button type="submit" disabled={busy}>Save provider settings</Button></form><div className="admin-edit-panel"><Button variant="secondary" disabled={busy || !settings.enabled || !settings.configured} onClick={() => void testConnection()}>Test Connection</Button><p className="fine-note">Makes explicit provider metadata requests only. It does not generate text, send candidate data or transcribe audio.</p></div></Card>
    <Card className="workspace-panel"><div className="panel-header"><h2>Legacy OpenAI credential</h2><KeyRound size={20} aria-hidden="true" /></div><p className="panel-copy">Database key: {settings.database_key_present ? "Configured" : "Not Configured"}. Saved keys are never displayed or pre-filled.</p>{settings.encryption_status !== "ready" && <p className="form-error" role="status">{settings.encryption_status === "unreadable" ? "The saved credential could not be decrypted. Ask the operator to restore the original encryption key or deliberately replace the saved credential." : "Configure a valid server SETTINGS_ENCRYPTION_KEY to manage encrypted credentials."}</p>}
    <form onSubmit={saveKey} aria-busy={busy}><div className="field"><label htmlFor="new-api-key">New API key</label><input id="new-api-key" name="api_key" type="password" autoComplete="off" spellCheck={false} minLength={20} maxLength={512} required disabled={busy || settings.encryption_status === "missing" || settings.encryption_status === "invalid"} /></div><div className="field"><label htmlFor="confirm-api-key">Confirm new API key</label><input id="confirm-api-key" name="confirm_api_key" type="password" autoComplete="off" spellCheck={false} minLength={20} maxLength={512} required disabled={busy || settings.encryption_status === "missing" || settings.encryption_status === "invalid"} /></div><Button type="submit" disabled={busy || settings.encryption_status === "missing" || settings.encryption_status === "invalid"}>{settings.database_key_present ? "Replace API Key" : "Save API Key"}</Button></form><div className="admin-edit-panel"><Button variant="secondary" disabled={busy || !settings.database_key_present || settings.encryption_status === "missing" || settings.encryption_status === "invalid"} onClick={() => { if (window.confirm("Remove the encrypted database key? An environment credential will be used if present and AI is enabled; otherwise practice uses deterministic fallback.")) void mutate("/owner/ai-settings/key", "DELETE"); }}>Remove database API Key</Button><p className="fine-note">Removing the database key never edits the environment key. Disable the provider to stop all AI use.</p></div></Card></div>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="success-message" role="status">{notice}</p>}
    <Card className="workspace-panel report-section"><div className="panel-header"><h2>Private by design</h2><ShieldCheck size={20} aria-hidden="true" /></div><p className="panel-copy">Only the owner can manage these controls. Credentials use authenticated encryption before storage. Audit events contain action names and safe account identifiers.</p><p className="fine-note">Last updated: {settings.updated_at ? new Date(settings.updated_at).toLocaleString() : "Using environment defaults; no owner changes yet"}</p></Card></>;
}
