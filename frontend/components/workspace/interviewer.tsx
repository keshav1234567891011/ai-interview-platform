"use client";
import dynamic from "next/dynamic";
import { Component, type ReactNode, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Bot, Volume2, VolumeX } from "lucide-react";
import { Button } from "../ui/button";
const Avatar = dynamic(() => import("./avatar-canvas"), { ssr: false, loading: () => <StaticAvatar /> });
const subscribe = (callback: () => void) => { const media = matchMedia("(prefers-reduced-motion: reduce)"); media.addEventListener("change", callback); return () => media.removeEventListener("change", callback); };
const noChange = () => () => {};
function StaticAvatar() { return <div className="static-interviewer" role="img" aria-label="Stylized interviewer illustration"><Bot size={68} strokeWidth={1} aria-hidden="true" /><span>InterviewAI</span></div>; }

class AvatarBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFailure();
  }

  render() {
    return this.state.failed ? <StaticAvatar /> : this.props.children;
  }
}

export function Interviewer({ question, listening, preparing }: { question: string; listening: boolean; preparing: boolean }) {
  const reduced = useSyncExternalStore(subscribe, () => matchMedia("(prefers-reduced-motion: reduce)").matches || (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency < 4), () => true);
  const speechAvailable = useSyncExternalStore(noChange, () => !!window.speechSynthesis && typeof window.SpeechSynthesisUtterance === "function", () => false);
  const [threeD, setThreeD] = useState(false); const [failed, setFailed] = useState(false); const [speaking, setSpeaking] = useState(false); const [error, setError] = useState("");
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const fail = useCallback(() => { setFailed(true); }, []);
  const stop = useCallback(() => { if (utterance.current && "speechSynthesis" in window) { speechSynthesis.cancel(); utterance.current = null; } setSpeaking(false); }, []);
  useEffect(() => { if (listening) { if (utterance.current && "speechSynthesis" in window) speechSynthesis.cancel(); utterance.current = null; } }, [listening]);
  useEffect(() => () => { if (utterance.current && "speechSynthesis" in window) speechSynthesis.cancel(); utterance.current = null; }, [question]);
  function speak() {
    if (!speechAvailable || listening) return;
    stop(); setError("");
    const speech = new SpeechSynthesisUtterance(question); utterance.current = speech;
    speech.rate = .95; speech.onstart = () => setSpeaking(true); speech.onend = () => { setSpeaking(false); utterance.current = null; };
    speech.onerror = () => { setSpeaking(false); setError("Question audio is unavailable. The full question is shown below."); };
    try { speechSynthesis.speak(speech); } catch { setError("Question audio is unavailable. Read the question below."); }
  }
  const state = listening ? "listening" : preparing ? "thinking" : speaking ? "asking" : "idle";
  return <div className="interviewer-room"><div className="interviewer-visual">{threeD && !reduced && !failed ? <AvatarBoundary onFailure={fail}><Avatar state={state} onFailure={fail} /></AvatarBoundary> : <StaticAvatar />}</div><div className="interviewer-controls"><p className="eyebrow">OPTIONAL INTERVIEWER ENHANCEMENT</p><p role="status">{state === "thinking" ? "Preparing next question…" : state === "listening" ? "Listening · recording active" : state === "asking" ? "Reading your question" : "Ready when you are"}</p><div className="form-actions"><Button type="button" variant="secondary" disabled={!speechAvailable || listening || preparing} onClick={speak}><Volume2 size={15} aria-hidden="true" />Read question aloud</Button>{speaking && <Button type="button" variant="ghost" onClick={stop}><VolumeX size={15} aria-hidden="true" />Mute question</Button>}</div><label className="avatar-choice"><input type="checkbox" checked={threeD} disabled={reduced} onChange={event => { setThreeD(event.target.checked); setFailed(false); }} />Enable 3D interviewer</label><p className="fine-note">{failed ? "3D rendering unavailable. The static interviewer keeps your session usable." : reduced ? "Static mode respects reduced motion and devices with limited resources." : "A stylized interface, not a real interviewer. 3D is optional."}{!speechAvailable && " Question audio is unsupported in this browser; use the question text."}</p>{error && <p className="form-error" role="alert">{error}</p>}</div></div>;
}
