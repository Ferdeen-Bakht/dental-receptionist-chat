import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mic, PhoneOff, Phone, Loader2, MessageSquare, User, Bot } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BrightSmile Dental — AI Receptionist" },
      { name: "description", content: "Call our AI dental receptionist any time to book appointments, ask about services, or get clinic info." },
      { property: "og:title", content: "BrightSmile Dental — AI Receptionist" },
      { property: "og:description", content: "Call our AI dental receptionist any time to book appointments, ask about services, or get clinic info." },
    ],
  }),
  component: Index,
});

const WEBHOOK_URL = "https://tamatoscloud.app.n8n.cloud/webhook/6404fe0f-aa6a-4e5a-a71c-81a6fcb606af";

type CallState = "idle" | "listening" | "thinking" | "speaking";

interface ChatMessage {
  role: "user" | "ai";
  text: string;
  time: string;
}

function Index() {
  const [state, setState] = useState<CallState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptBufferRef = useRef<string>("");
  const inCall = state !== "idle";

  useEffect(() => {
    if (!inCall) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [inCall]);

  const nowTime = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const addMessage = (role: "user" | "ai", text: string) => {
    setMessages((prev) => [...prev, { role, text, time: nowTime() }]);
  };

  const cleanup = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    transcriptBufferRef.current = "";
  };

  const endCall = () => {
    cleanup();
    setState("idle");
    setElapsed(0);
  };

  const startSpeechRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      if (finalTranscript) {
        transcriptBufferRef.current += finalTranscript + " ";
      }
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      console.error("Speech recognition error:", e.error);
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const stopSpeechRecognition = () => {
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    const text = transcriptBufferRef.current.trim();
    transcriptBufferRef.current = "";
    return text;
  };

  const startListening = async () => {
    setError(null);
    try {
      let stream = streamRef.current;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
      }
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const userText = stopSpeechRecognition();
        if (userText) {
          addMessage("user", userText);
        } else {
          addMessage("user", "(audio message)");
        }
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size > 0) void sendToWebhook(blob);
      };
      recorder.start();
      startSpeechRecognition();
      setState("listening");
    } catch (e) {
      console.error(e);
      setError("Microphone access denied");
      setState("idle");
    }
  };

  const sendToWebhook = async (audioBlob: Blob) => {
    setState("thinking");
    try {
      const form = new FormData();
      form.append("data", audioBlob, "user-input.webm");
      form.append("file", audioBlob, "user-input.webm");

      const res = await fetch(WEBHOOK_URL, { method: "POST", body: form });
      if (!res.ok) throw new Error(`Webhook returned ${res.status}`);

      const contentType = res.headers.get("content-type") || "";
      let audioUrl: string | null = null;
      let responseText: string | null = null;

      if (contentType.includes("audio") || contentType.includes("octet-stream")) {
        const blob = await res.blob();
        audioUrl = URL.createObjectURL(blob);
      } else if (contentType.includes("application/json")) {
        const json = await res.json();
        const b64 = json.audio || json.audioContent || json.data;
        const url = json.url || json.audioUrl;
        if (url) audioUrl = url;
        else if (typeof b64 === "string") audioUrl = `data:audio/mpeg;base64,${b64}`;

        // Extract text from common response fields
        responseText =
          json.text ||
          json.message ||
          json.response ||
          json.transcript ||
          json.content ||
          json.reply ||
          json.answer ||
          null;
      } else {
        const blob = await res.blob();
        if (blob.size > 0) audioUrl = URL.createObjectURL(blob);
      }

      if (responseText) {
        addMessage("ai", responseText);
      } else {
        addMessage("ai", "(AI voice response)");
      }

      if (!audioUrl) throw new Error("No audio in response");

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      setState("speaking");
      audio.onended = () => {
        if (streamRef.current) void startListening();
        else setState("idle");
      };
      await audio.play();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Something went wrong");
      setState("listening");
    }
  };

  const startCall = async () => {
    setElapsed(0);
    setMessages([]);
    await startListening();
  };

  const stopAndSend = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state === "recording") rec.stop();
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const statusLabel = {
    idle: "Tap to call our AI receptionist",
    listening: "Listening…",
    thinking: "Thinking…",
    speaking: "Speaking…",
  }[state];

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden px-6 py-10"
      style={{ background: "var(--gradient-bg)" }}
    >
      <div
        className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full opacity-40 blur-3xl"
        style={{ background: "oklch(0.78 0.12 195)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-24 h-[28rem] w-[28rem] rounded-full opacity-30 blur-3xl"
        style={{ background: "oklch(0.82 0.08 220)" }}
      />

      <header className="relative z-10 flex w-full max-w-5xl items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground">B</div>
          <span className="font-semibold tracking-tight text-foreground">BrightSmile Dental</span>
        </div>
        <nav className="hidden gap-8 text-sm text-muted-foreground sm:flex">
          <a href="#" className="hover:text-foreground">Services</a>
          <a href="#" className="hover:text-foreground">About</a>
          <a href="#" className="hover:text-foreground">Contact</a>
        </nav>
      </header>

      <section className="relative z-10 flex w-full max-w-2xl flex-1 flex-col items-center justify-center text-center">
        <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          AI Receptionist — Available 24/7
        </span>
        <h1 className="text-balance text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
          Book your visit by simply <span className="italic text-primary">talking</span>.
        </h1>
        <p className="mt-4 max-w-md text-balance text-muted-foreground">
          Speak naturally with our AI dental receptionist to schedule appointments, ask about treatments, or get directions.
        </p>

        <div className="mt-12 flex flex-col items-center gap-6">
          <div className="relative flex h-44 w-44 items-center justify-center">
            {inCall && (
              <>
                <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                <span className="absolute inset-4 animate-ping rounded-full bg-primary/15 [animation-delay:200ms]" />
              </>
            )}
            <div
              className="relative flex h-36 w-36 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.72_0.13_210)] text-primary-foreground"
              style={{ boxShadow: "var(--shadow-glow)" }}
            >
              {state === "thinking" ? (
                <Loader2 className="h-12 w-12 animate-spin" />
              ) : state === "speaking" ? (
                <div className="flex items-end gap-1.5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className="w-1.5 rounded-full bg-primary-foreground"
                      style={{
                        height: `${14 + (i % 3) * 10}px`,
                        animation: `pulse 1s ease-in-out ${i * 0.12}s infinite`,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <Mic className="h-12 w-12" />
              )}
            </div>
          </div>

          <div className="min-h-[3rem]">
            <p className="text-sm font-medium text-foreground">{statusLabel}</p>
            {inCall && <p className="mt-1 font-mono text-xs text-muted-foreground">{formatTime(elapsed)}</p>}
            {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          </div>

          <div className="flex items-center gap-4">
            {!inCall ? (
              <button
                onClick={startCall}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                style={{ boxShadow: "var(--shadow-soft)" }}
              >
                <Phone className="h-4 w-4" /> Start call
              </button>
            ) : (
              <>
                {state === "listening" && (
                  <button
                    onClick={stopAndSend}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
                  >
                    Send
                  </button>
                )}
                <button
                  onClick={endCall}
                  className="inline-flex items-center gap-2 rounded-full bg-destructive px-6 py-3 text-sm font-medium text-destructive-foreground transition hover:opacity-90"
                >
                  <PhoneOff className="h-4 w-4" /> End
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <footer className="relative z-10 mt-8 text-xs text-muted-foreground">
        © {new Date().getFullYear()} BrightSmile Dental Clinic
      </footer>

      {/* Conversation Transcript Panel */}
      {messages.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex max-h-[60vh] w-[22rem] flex-col rounded-2xl border border-border bg-card/90 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Conversation</span>
            <span className="ml-auto text-xs text-muted-foreground">{messages.length} messages</span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <div className="flex flex-col gap-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      msg.role === "user"
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <User className="h-3.5 w-3.5" />
                    ) : (
                      <Bot className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-border px-4 py-2">
            <p className="text-[10px] text-muted-foreground">
              {state === "listening"
                ? "Listening… speak now"
                : state === "thinking"
                ? "AI is thinking…"
                : state === "speaking"
                ? "AI is speaking…"
                : "Call ended"}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
