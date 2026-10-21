"use client";
import { useState } from "react";
import { KeyRound, ShieldCheck, PlugZap } from "lucide-react";
import { api } from "@/lib/api";
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
    <div className="report-metrics"><Card className="workspace-stat"><span>Provider</span><strong>{settings.enabled ? "Enabled" : "Disabled"}</strong><small>{settings.configured ? "Credential configured" : "Not configured"}</small></Card><Card className="workspace-stat"><span>Credential source</span><strong>{settings.credential_source === "database" ? "Encrypted database" : settings.credential_source === "environment" ? "Environment" : "None"}</strong></Card><Card className="workspace-stat"><span>Safe fallback</span><strong>{settings.fallback_active ? "Active" : "Available"}</strong><small>Practice remains usable without AI</small></Card></div>
    <div className="workspace-two-columns report-section"><Card className="workspace-panel"><div className="panel-header"><h2>Provider & models</h2><PlugZap size={20} aria-hidden="true" /></div><form onSubmit={event => { event.preventDefault(); void mutate("/owner/ai-settings", "PUT", { enabled, text_model: textModel, transcription_model: transcriptionModel }); }} aria-busy={busy}><label className="avatar-choice"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} disabled={busy} />Enable AI provider</label><p className="fine-note">Disabling AI prevents use of both database and environment credentials for subsequent requests.</p><div className="field"><label htmlFor="ai-text-model">Text model</label><select id="ai-text-model" value={textModel} onChange={event => setTextModel(event.target.value)} disabled={busy}>{settings.text_models.map(model => <option key={model}>{model}</option>)}</select></div><div className="field"><label htmlFor="ai-transcription-model">Transcription model</label><select id="ai-transcription-model" value={transcriptionModel} onChange={event => setTranscriptionModel(event.target.value)} disabled={busy}>{settings.transcription_models.map(model => <option key={model}>{model}</option>)}</select></div><Button type="submit" disabled={busy}>Save provider settings</Button></form><div className="admin-edit-panel"><Button variant="secondary" disabled={busy || !settings.enabled || !settings.configured} onClick={() => void testConnection()}>Test Connection</Button><p className="fine-note">Makes explicit provider metadata requests only. It does not generate text, send candidate data or transcribe audio.</p></div></Card>
    <Card className="workspace-panel"><div className="panel-header"><h2>Provider credential</h2><KeyRound size={20} aria-hidden="true" /></div><p className="panel-copy">Database key: {settings.database_key_present ? "Configured" : "Not Configured"}. Saved keys are never displayed or pre-filled.</p>{settings.encryption_status !== "ready" && <p className="form-error" role="status">{settings.encryption_status === "unreadable" ? "The saved credential could not be decrypted. Ask the operator to restore the original encryption key or deliberately replace the saved credential." : "Configure a valid server SETTINGS_ENCRYPTION_KEY to manage encrypted credentials."}</p>}
    <form onSubmit={saveKey} aria-busy={busy}><div className="field"><label htmlFor="new-api-key">New API key</label><input id="new-api-key" name="api_key" type="password" autoComplete="off" spellCheck={false} minLength={20} maxLength={512} required disabled={busy || settings.encryption_status === "missing" || settings.encryption_status === "invalid"} /></div><div className="field"><label htmlFor="confirm-api-key">Confirm new API key</label><input id="confirm-api-key" name="confirm_api_key" type="password" autoComplete="off" spellCheck={false} minLength={20} maxLength={512} required disabled={busy || settings.encryption_status === "missing" || settings.encryption_status === "invalid"} /></div><Button type="submit" disabled={busy || settings.encryption_status === "missing" || settings.encryption_status === "invalid"}>{settings.database_key_present ? "Replace API Key" : "Save API Key"}</Button></form><div className="admin-edit-panel"><Button variant="secondary" disabled={busy || !settings.database_key_present || settings.encryption_status === "missing" || settings.encryption_status === "invalid"} onClick={() => { if (window.confirm("Remove the encrypted database key? An environment credential will be used if present and AI is enabled; otherwise practice uses deterministic fallback.")) void mutate("/owner/ai-settings/key", "DELETE"); }}>Remove database API Key</Button><p className="fine-note">Removing the database key never edits the environment key. Disable the provider to stop all AI use.</p></div></Card></div>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="success-message" role="status">{notice}</p>}
    <Card className="workspace-panel report-section"><div className="panel-header"><h2>Private by design</h2><ShieldCheck size={20} aria-hidden="true" /></div><p className="panel-copy">Only the owner can manage these controls. Credentials use authenticated encryption before storage. Audit events contain action names and safe account identifiers.</p><p className="fine-note">Last updated: {settings.updated_at ? new Date(settings.updated_at).toLocaleString() : "Using environment defaults; no owner changes yet"}</p></Card></>;
}
