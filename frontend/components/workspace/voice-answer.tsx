"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, Square, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { canRecord, pcmRecording, recognitionConstructor, type Recognition } from "@/lib/voice";
import { useResource } from "@/lib/use-resource";
import { Button } from "../ui/button";
const subscribe = () => () => {};

export function VoiceAnswer({ path, onTranscript, onRecording }: {
  path: string; onTranscript: (text: string, duration: number) => void; onRecording: (value: boolean) => void;
}) {
  const supported = useSyncExternalStore(subscribe, canRecord, () => false);
  const { data } = useResource<{ transcription_available: boolean }>("/interviews/capabilities");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [clip, setClip] = useState<{ blob: Blob; url: string; duration: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const recognizer = useRef<Recognition | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const mounted = useRef(true);
  const transcript = useRef("");
  const callbacks = useRef({ onTranscript, onRecording });
  useEffect(() => { callbacks.current = { onTranscript, onRecording }; }, [onTranscript, onRecording]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
      recognizer.current?.abort();
      callbacks.current.onRecording(false);
    };
  }, []);
  useEffect(() => () => { if (clip) URL.revokeObjectURL(clip.url); }, [clip]);
  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
    recognizer.current?.stop();
    setRecording(false); onRecording(false);
  }
  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - started.current) / 1000);
      setElapsed(seconds);
      if (seconds >= 299) {
        recorder.current?.stop(); stream.current?.getTracks().forEach((track) => track.stop());
        recognizer.current?.stop(); setRecording(false); callbacks.current.onRecording(false);
      }
    }, 500);
    const hide = () => {
      if (document.hidden) {
        recorder.current?.stop(); stream.current?.getTracks().forEach((track) => track.stop());
        recognizer.current?.stop(); setRecording(false); callbacks.current.onRecording(false);
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", hide); };
  }, [recording]);
  async function start() {
    setBusy(true); setError(""); setClip(null); setElapsed(0); transcript.current = ""; onTranscript("", 0);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { media.getTracks().forEach((track) => track.stop()); return; }
      stream.current = media; chunks.current = [];
      const instance = new MediaRecorder(media);
      recorder.current = instance;
      instance.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      instance.onstop = () => {
        media.getTracks().forEach((track) => track.stop());
        if (!mounted.current) return;
        const duration = Math.min(300, Math.max(.1, (Date.now() - started.current) / 1000));
        const blob = new Blob(chunks.current, { type: instance.mimeType });
        setClip({ blob, url: URL.createObjectURL(blob), duration });
        callbacks.current.onTranscript(transcript.current.trim(), duration);
      };
      instance.onerror = () => { media.getTracks().forEach((track) => track.stop()); recognizer.current?.abort(); setRecording(false); onRecording(false); setError("Recording stopped. Please use your text answer or try again."); };
      started.current = Date.now(); instance.start(); setRecording(true); onRecording(true);
      if (!data?.transcription_available) {
        const Constructor = recognitionConstructor();
        if (Constructor) {
          const recognition = new Constructor(); recognizer.current = recognition;
          recognition.continuous = true; recognition.interimResults = false; recognition.lang = "en-US";
          recognition.onresult = (event) => {
            transcript.current = Array.from(event.results).filter((result) => result.isFinal).map((result) => result[0].transcript).join(" ");
            if (!recording && mounted.current) callbacks.current.onTranscript(transcript.current, Math.min(300, Math.max(.1, (Date.now() - started.current) / 1000)));
          };
          recognition.onerror = () => { if (mounted.current) setError("Browser transcription is unavailable. Listen to the recording and enter your transcript below."); };
          try { recognition.start(); } catch { setError("Enter or edit your transcript below after recording."); }
        }
      }
    } catch {
      stream.current?.getTracks().forEach((track) => track.stop());
      setError("Microphone access was not available. Check permission or continue with text.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function transcribe() {
    if (!clip) return;
    setBusy(true); setError("");
    try {
      const form = new FormData(); form.append("file", await pcmRecording(clip.blob), "answer.wav");
      const result = await api<{ text: string; duration_seconds: number }>(path, { method: "POST", body: form });
      onTranscript(result.text, result.duration_seconds);
    } catch (err) { setError(err instanceof Error ? err.message : "Transcription unavailable. Enter your transcript below."); }
    finally { setBusy(false); }
  }
  return <div className="voice-panel">
    <p className="fine-note">Microphone activates only when you start. Recordings stay in this browser unless you choose server transcription. Browser speech recognition may use your browser provider. Review the transcript before submitting.</p>
    {!supported ? <p role="status">Microphone recording is unavailable in this browser. Your text answer is always available.</p> : <>
      <div className="form-actions">
        {recording ? <Button type="button" variant="secondary" onClick={stop}><Square size={16} aria-hidden="true" />Stop recording</Button> : <Button type="button" variant="secondary" disabled={busy} onClick={start}><Mic size={16} aria-hidden="true" />{clip ? "Record again" : "Start recording"}</Button>}
        <span role="status" aria-live="polite">{recording ? `Recording active · ${elapsed}s` : clip ? `Recording ready · ${Math.round(clip.duration)}s` : "Not recording"}</span>
      </div>
      {clip && <><audio controls src={clip.url} aria-label="Review your recording" />
        <div className="form-actions"><Button type="button" variant="ghost" disabled={busy} onClick={() => { setClip(null); transcript.current = ""; onTranscript("", 0); }}><RotateCcw size={14} aria-hidden="true" />Discard recording</Button>
          {data?.transcription_available && <Button type="button" disabled={busy} onClick={transcribe}>{busy ? "Transcribing…" : "Transcribe recording"}</Button>}</div>
        <p className="fine-note">{data?.transcription_available ? "Transcription sends this short recording to the configured provider. This application does not retain the audio." : "Use the browser transcript if available, or enter the transcript below. No server transcription is configured."}</p>
      </>}
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
