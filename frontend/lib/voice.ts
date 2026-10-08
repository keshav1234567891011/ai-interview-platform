/** Browser enhancement boundary. No permission is requested by capability detection. */
export type Recognition = {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: (() => void) | null; start(): void; stop(): void; abort(): void;
};
export function recognitionConstructor(): (new () => Recognition) | undefined {
  const browser = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}
export function canRecord() {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}
/** Decode on the client, resample to mono 16kHz PCM, validate actual duration again server-side. */
export async function pcmRecording(blob: Blob): Promise<Blob> {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    if (!decoded.duration || decoded.duration > 300) throw new Error("Keep recordings under five minutes.");
    const renderer = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
    const source = renderer.createBufferSource();
    source.buffer = decoded; source.connect(renderer.destination); source.start();
    const audio = (await renderer.startRendering()).getChannelData(0);
    const buffer = new ArrayBuffer(44 + audio.length * 2);
    const view = new DataView(buffer);
    const write = (offset: number, value: string) => [...value].forEach((letter, i) => view.setUint8(offset + i, letter.charCodeAt(0)));
    write(0, "RIFF"); view.setUint32(4, 36 + audio.length * 2, true); write(8, "WAVE"); write(12, "fmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    write(36, "data"); view.setUint32(40, audio.length * 2, true);
    audio.forEach((sample, i) => view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, sample)) * 32767), true));
    return new Blob([buffer], { type: "audio/wav" });
  } finally { await context.close(); }
}
