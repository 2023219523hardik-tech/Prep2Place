"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import ProctoringGuard from "@/components/ProctoringGuard";
import ScoreGauge from "@/components/ScoreGauge";
import AIVoiceOrb, { OrbState } from "@/components/interview/AIVoiceOrb";
import CodingChallengePanel from "@/components/interview/CodingChallengePanel";
import { useMicLevel } from "@/lib/useMicLevel";
import { useSpeechSynthesis } from "@/lib/useSpeechSynthesis";

interface CodingChallengeInfo {
  problemId: number; title: string; statement: string; constraints: string[]; difficulty: string;
  methodName: string; returnType: string;
  examples: { title: string; input: string; output: string }[];
  templates: Record<string, string>;
  supportedLanguages: { id: string; name: string; version: string; editorLanguage: string; template: string; executionMode: string }[];
  savedCode: string | null; savedLanguage: string | null; deadline: string; status: string;
}
interface QuestionResponse {
  questionId: number; text: string; category: string; difficulty: string;
  type?: "TEXT" | "CODING"; codingChallenge?: CodingChallengeInfo | null;
}
interface AnswerEvaluation {
  questionId: number; correctness: number; relevance: number; depth: number; clarity: number;
  grammar: number; confidence: number; structure: number; weightedScore: number; feedback: string;
}
interface SessionResponse { sessionId: number; status: string; questionsAnswered: number; totalQuestions: number; }
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type ChatMessageRole = "agent" | "user";
interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  timestamp: Date;
  type?: "intro" | "question" | "answer-feedback" | "outro";
}

function WaveformButton({ listening, onToggle }: { listening: boolean; onToggle: () => void }) {
  const bars = 8;
  return (
    <button
      onClick={onToggle}
      type="button"
      className={`relative flex items-center justify-center gap-1 h-11 px-4 rounded-xl border transition-all ${
        listening
          ? "bg-premium-gradient text-white border-transparent shadow-premium"
          : "bg-white text-slate-600 border-slate-200 hover:border-premium-300"
      }`}
    >
      <div className={`flex items-end gap-0.5 h-5 ${listening ? "opacity-100" : "opacity-60"}`}>
        {Array.from({ length: bars }).map((_, i) => (
          <span
            key={i}
            className={`wave-bar w-0.5 rounded-full ${listening ? "bg-white" : "bg-premium-500"}`}
            style={{
              height: `${40 + i * 8}%`,
              animationDelay: `${i * 0.08}s`,
              animationPlayState: listening ? "running" : "paused",
            }}
          />
        ))}
      </div>
      <span className="text-xs font-semibold ml-1.5">
        {listening ? "Listening…" : "Tap to speak"}
      </span>
    </button>
  );
}

function AgentAvatar({ pulsing }: { pulsing?: boolean }) {
  return (
    <div className={`relative flex-shrink-0 ${pulsing ? "ring-pulse" : ""}`}>
      <div
        className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold font-display shadow-card"
        style={{ background: "linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)" }}
      >
        A
      </div>
    </div>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const map: Record<string, string> = {
    Easy: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Medium: "bg-amber-50 text-amber-700 border-amber-200",
    Hard: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={`chip border ${map[difficulty] || "bg-slate-50 text-slate-700 border-slate-200"}`}>
      {difficulty}
    </span>
  );
}

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-slate-500 font-medium">{label}</span>
        <span className="font-bold text-slate-700">{Math.round(pct)}</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function InterviewSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [question, setQuestion] = useState<QuestionResponse | null>(null);
  const [answer, setAnswer] = useState("");
  const [interimAnswer, setInterimAnswer] = useState(""); // Section 11: rendered distinctly from confirmed text
  const [evaluation, setEvaluation] = useState<AnswerEvaluation | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [noMoreQuestions, setNoMoreQuestions] = useState(false);
  const [error, setError] = useState("");
  const [completing, setCompleting] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [sttUnsupported, setSttUnsupported] = useState(false);

  // Section 11: check speech-recognition support once, up front, so the "voice only" empty-state
  // message is accurate even before the candidate's first attempt to use the mic.
  useEffect(() => {
    const hasSpeechRecognition = typeof window !== "undefined" &&
      Boolean((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);
    if (!hasSpeechRecognition) setSttUnsupported(true);
  }, []);
  const [agentTyping, setAgentTyping] = useState(false);
  const [agentMode, setAgentMode] = useState<"speaking" | "listening" | "analyzing" | "evaluated">("listening");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [proctoringReady, setProctoringReady] = useState(false);
  const [sessionTerminated, setSessionTerminated] = useState(false);
  const sessionTerminatedRef = useRef(false);
  const [sessionInfo, setSessionInfo] = useState<SessionResponse | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const initialQuestionSessionRef = useRef<string | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const silenceIntervalRef = useRef<number | null>(null);
  const questionStartTimeRef = useRef<number | null>(null);
  const [silenceCountdown, setSilenceCountdown] = useState<number | null>(null);

  const { speak, cancel: cancelSpeech } = useSpeechSynthesis();

  const handleTermination = useCallback(() => {
    sessionTerminatedRef.current = true;
    setSessionTerminated(true);
    if (silenceIntervalRef.current) {
      window.clearInterval(silenceIntervalRef.current);
      silenceIntervalRef.current = null;
    }
    setSilenceCountdown(null);
    if (autoAdvanceTimerRef.current) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    setIsListening(false);
    setAgentTyping(false);
    setAgentMode("listening");
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.stop();
        (recognitionRef.current as any).abort?.();
      } catch {}
      recognitionRef.current = null;
    }
    cancelSpeech();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.pause();
        window.speechSynthesis.cancel();
      } catch {}
    }
    setQuestion(null);
  }, [cancelSpeech]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  useEffect(() => { scrollToBottom(); }, [messages, agentTyping]);

  // Section 9: Interview timer starts strictly AFTER proctoring verification is complete and stops on termination
  useEffect(() => {
    if (!proctoringReady || sessionTerminated) return;
    const timer = window.setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [proctoringReady, sessionTerminated]);

  useEffect(() => {
    api.get<SessionResponse>(`/api/interviews/${sessionId}`).then((session) => {
      if (session.status === "EXITED") {
        router.replace("/interview");
        return;
      }
      if (
        session.status === "TERMINATED_VIOLATION" ||
        session.status === "VIOLATION_DETECTED" ||
        session.status === "CANCELLED" ||
        session.status === "ADMIN_TERMINATED"
      ) {
        handleTermination();
      }
      setSessionInfo(session);
    }).catch(() => undefined);
  }, [sessionId, handleTermination]);

  // Section 8 (abandonment): periodic heartbeat so the backend sweeper doesn't reap an active session.
  // Explicit exit is only performed when the candidate manually clicks "Exit interview".
  useEffect(() => {
    if (sessionTerminated) return;
    const heartbeat = window.setInterval(() => {
      api.post(`/api/interviews/${sessionId}/heartbeat`).catch(() => undefined);
    }, 30_000);
    return () => {
      window.clearInterval(heartbeat);
    };
  }, [sessionId, sessionTerminated]);

  useEffect(() => {
    if (sessionTerminated || !question || question.type === "CODING") return;
    speak(question.text, () => {
      if (sessionTerminatedRef.current) return;
      setAgentMode("listening");
      startListening();
    });
    // Section 7: speak() internally handles chunking, voice selection, and the Chrome
    // keep-alive workaround - this effect no longer talks to speechSynthesis directly.
    setAgentMode("speaking");
    return () => cancelSpeech();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.questionId, sessionTerminated]);

  // IMPORTANT: useMicLevel (and any effect depending on it) must be called unconditionally,
  // above the `if (loading...) return <LoadingState />` guard further down. Calling it after
  // that early return meant it was skipped on the very first render (loading=true) and then
  // called on every render after - a classic "Rendered more hooks than during the previous
  // render" violation that reproduced on every single interview session. Never move this back
  // below a conditional return.
  const micLevel = useMicLevel(isListening);

  // Section 10: the actual VAD (voice-activity-detection) signal - raw mic amplitude, not just
  // speech-recognition transcript events, which can lag or miss quiet/partial speech entirely.
  // Any amplitude above the noise floor while the mic is live resets the silence clock, exactly
  // like real speech resetting it via the transcript path above.
  const MIC_VAD_THRESHOLD = 0.08;
  useEffect(() => {
    if (!isListening) return;
    if (micLevel > MIC_VAD_THRESHOLD) {
      armSilenceTimer(() => answer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micLevel, isListening]);

  function pushMessage(msg: Omit<ChatMessage, "id" | "timestamp">) {
    if (sessionTerminatedRef.current) return;
    setMessages((prev) => [...prev, { ...msg, id: `${msg.role}-${Date.now()}-${Math.random()}`, timestamp: new Date() }]);
  }

  // Initial greeting only once proctoring checks have passed
  useEffect(() => {
    if (!proctoringReady || sessionTerminated) return;
    const t = setTimeout(() => {
      if (sessionTerminatedRef.current) return;
      pushMessage({
        role: "agent",
        type: "intro",
        content:
          "Hi, I'm Arya, your interviewer today! 🎯 I'll guide you through a series of questions designed to assess your skills. Remember to speak clearly and take your time. Ready when you are!",
      });
    }, 400);
    return () => clearTimeout(t);
  }, [proctoringReady, sessionTerminated]);

  async function loadNextQuestion() {
    if (sessionTerminatedRef.current) return;
    setLoading(true);
    setEvaluation(null);
    setAnswer(""); setInterimAnswer("");
    setError("");
    setAgentTyping(true);
    try {
      const q = await api.get<QuestionResponse>(`/api/interviews/${sessionId}/next-question`);
      if (sessionTerminatedRef.current) return;
      setQuestion(q);
      questionStartTimeRef.current = Date.now();
      setNoMoreQuestions(false);
      setSessionInfo((prev) => prev ? { ...prev, questionsAnswered: answeredCount, totalQuestions: prev.totalQuestions } : prev);
      if (q.type === "CODING") {
        // Section 9: the domain coding challenge is its own embedded panel, not a chat turn -
        // no spoken question, no "type your answer" prompt.
        setAgentTyping(false);
        return;
      }
      setTimeout(() => {
        if (sessionTerminatedRef.current) return;
        setAgentTyping(false);
        pushMessage({
          role: "agent",
          type: "question",
          content: `Alright! Here's your next question:\n\n**${q.text}**\n\n_Category: ${q.category} · Difficulty: ${q.difficulty}_`,
        });
      }, 700);
    } catch (e) {
      if (sessionTerminatedRef.current) return;
      setAgentTyping(false);
      if (e instanceof ApiError && e.status === 400) {
        setNoMoreQuestions(true);
        pushMessage({
          role: "agent",
          type: "outro",
          content:
            "Great job — you've answered all available questions for this session! 🎉 Feel free to finish the interview now to see your full report.",
        });
      } else if (e instanceof ApiError && e.status === 409) {
        setError(e.message || "Interview cannot start until all proctoring checks are completed.");
      } else {
        setError(e instanceof ApiError ? e.message : "Failed to load question");
      }
    } finally {
      if (!sessionTerminatedRef.current) {
        setLoading(false);
      }
    }
  }

  // Section 1: Strictly load first question ONLY once proctoring checks are fully verified
  useEffect(() => {
    if (!proctoringReady || sessionTerminated) return;
    if (initialQuestionSessionRef.current === sessionId) return;
    initialQuestionSessionRef.current = sessionId;
    loadNextQuestion();
  }, [sessionId, proctoringReady, sessionTerminated]);

  function clearAutoAdvanceTimer() {
    if (autoAdvanceTimerRef.current) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }

  function goToNextQuestionNow() {
    clearAutoAdvanceTimer();
    loadNextQuestion();
  }

  async function submitAnswer(forcedTranscript?: string, autoSkipped?: boolean) {
    if (sessionTerminatedRef.current || !question) return;
    const userAnswer = (forcedTranscript !== undefined ? forcedTranscript : answer).trim();
    // A manual click with nothing typed/spoken does nothing; the 10-second silence auto-submit
    // (forcedTranscript is always provided there, even as "") is allowed through regardless,
    // since an unanswered question should still advance the interview rather than get stuck.
    if (!userAnswer && forcedTranscript === undefined) return;
    clearSilenceTimer();
    // Section 10: the auto-skip path is labeled distinctly from a plain empty submit, so the
    // transcript/report honestly shows *why* no answer was recorded, not just that one wasn't.
    const displayAnswer = userAnswer || (autoSkipped ? "(no answer — auto-skipped after 10s of silence)" : "(no answer given)");
    pushMessage({ role: "user", content: displayAnswer });
    setAnswer(""); setInterimAnswer("");
    setSubmitting(true);
    setAgentMode("analyzing");
    setAgentTyping(true);
    setError("");
    try {
      const res = await api.post<AnswerEvaluation>(`/api/interviews/${sessionId}/answers`, {
        questionId: question.questionId, transcript: userAnswer,
        durationSeconds: questionStartTimeRef.current ? (Date.now() - questionStartTimeRef.current) / 1000 : null,
      });
      if (sessionTerminatedRef.current) return;
      setEvaluation(res);
      setAnsweredCount((c) => c + 1);
      setAgentMode("evaluated");

      const score = Math.round(res.weightedScore);
      const snippet = res.feedback.length > 180 ? res.feedback.slice(0, 177) + "…" : res.feedback;
      const praise = score >= 85 ? "Excellent work!" : score >= 70 ? "Great answer!" : score >= 50 ? "Good effort!" : "Let's work through this.";

      setTimeout(() => {
        if (sessionTerminatedRef.current) return;
        setAgentTyping(false);
        pushMessage({
          role: "agent",
          type: "answer-feedback",
          content: `${praise} You scored **${score}/100**. Here's my feedback:\n\n> ${snippet}\n\nMoving on to the next question.`,
        });
        // Hands-free flow: automatically advance rather than waiting for a button click,
        // unless the interview has been paused/exited in the meantime.
        autoAdvanceTimerRef.current = window.setTimeout(() => {
          if (sessionTerminatedRef.current) return;
          if (sessionInfo?.status !== "PAUSED" && sessionInfo?.status !== "EXITED") loadNextQuestion();
        }, 1200);
      }, 900);
    } catch (e) {
      if (sessionTerminatedRef.current) return;
      setAgentTyping(false);
      setError(e instanceof ApiError ? e.message : "Failed to submit answer");
    } finally {
      if (!sessionTerminatedRef.current) {
        setSubmitting(false);
      }
    }
  }

  async function finishInterview() {
    setCompleting(true);
    setAgentTyping(true);
    setError("");
    clearSilenceTimer();
    clearAutoAdvanceTimer();
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
    try {
      await api.post(`/api/interviews/${sessionId}/submit`);
      setTimeout(() => {
        setAgentTyping(false);
        router.push(`/interview/${sessionId}/report`);
      }, 500);
    } catch (e) {
      setAgentTyping(false);
      setError(e instanceof ApiError ? e.message : "Failed to complete interview");
    } finally {
      setCompleting(false);
    }
  }

  async function pauseInterview() {
    await api.post<SessionResponse>(`/api/interviews/${sessionId}/pause`).then(setSessionInfo);
    clearSilenceTimer();
    clearAutoAdvanceTimer();
    setIsListening(false);
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
    pushMessage({ role: "agent", content: "Interview paused. Your progress is saved. Use Resume when you are ready." });
  }

  async function resumeInterview() {
    await api.post<SessionResponse>(`/api/interviews/${sessionId}/resume`).then(setSessionInfo);
    pushMessage({ role: "agent", content: "Welcome back. We can continue from the current question." });
  }

  async function exitInterview() {
    if (!window.confirm("Exit and save this interview? You can resume later.")) return;
    setError("");
    setCompleting(true);
    try {
      await api.post<SessionResponse>(`/api/interviews/${sessionId}/exit`).then(setSessionInfo);
      clearSilenceTimer();
      clearAutoAdvanceTimer();
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
      router.push("/interview");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to exit interview");
    } finally {
      setCompleting(false);
    }
  }

  const SILENCE_TIMEOUT_SECONDS = 10; // Section 10: was 5s and had no visible indicator - now matches spec exactly

  function clearSilenceTimer() {
    if (silenceIntervalRef.current) {
      window.clearInterval(silenceIntervalRef.current);
      silenceIntervalRef.current = null;
    }
    setSilenceCountdown(null);
  }

  function armSilenceTimer(getCurrentAnswer: () => string) {
    if (sessionTerminatedRef.current) return;
    clearSilenceTimer();
    let remaining = SILENCE_TIMEOUT_SECONDS;
    setSilenceCountdown(remaining);
    silenceIntervalRef.current = window.setInterval(() => {
      if (sessionTerminatedRef.current) {
        clearSilenceTimer();
        return;
      }
      remaining -= 1;
      setSilenceCountdown(remaining);
      if (remaining <= 0) {
        clearSilenceTimer();
        recognitionRef.current?.stop();
        setIsListening(false);
        // 10 continuous seconds of silence: auto-submit whatever was transcribed so far (or
        // move on with no answer at all) - the candidate doesn't need to click anything, and
        // this is logged the same way as the manual "no answer given" path.
        submitAnswer(getCurrentAnswer(), true);
      }
    }, 1000);
  }

  function startListening() {
    if (sessionTerminatedRef.current) return;
    const BrowserSpeechRecognition = ((window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition);
    if (!BrowserSpeechRecognition) {
      // Section 11: no typed fallback is offered here on purpose - spoken answers are the only
      // answer mechanism for this interview. If the browser genuinely can't do speech
      // recognition, the honest answer is "use a different browser," not a silent typing escape
      // hatch that would undermine the whole point of this section.
      setSttUnsupported(true);
      setError("Speech recognition is not available in this browser. Please switch to Chrome or Edge to continue this interview.");
      return;
    }
    setAnswer(""); setInterimAnswer("");
    const recognition = new BrowserSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      if (sessionTerminatedRef.current) return;
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalTranscript += result[0].transcript;
        else interimTranscript += result[0].transcript;
      }
      const combined = `${finalTranscript}${interimTranscript ? ` ${interimTranscript}` : ""}`.trim();
      setAnswer(combined);
      setInterimAnswer(interimTranscript.trim());
      // Any new transcribed speech resets the silence clock - only a genuine pause ends the turn.
      // (Raw audio amplitude also resets it independently - see the micLevel effect below, which
      // is the actual VAD signal; this transcript-based reset is a second, complementary signal
      // since speech-recognition results can lag a beat behind the audio itself.)
      armSilenceTimer(() => combined);
    };
    recognition.onerror = () => setError("Microphone transcription had trouble hearing you — check your mic and try again.");
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setAgentMode("listening");
    // Start the silence clock immediately too, in case the candidate says nothing at all.
    armSilenceTimer(() => answer);
  }

  function toggleVoiceInput() {
    if (isListening) {
      clearSilenceTimer();
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    startListening();
  }



  const totalQuestions = sessionInfo?.totalQuestions || 15;
  const time = `${Math.floor(elapsedSeconds / 60).toString().padStart(2, "0")}:${(elapsedSeconds % 60).toString().padStart(2, "0")}`;
  const statusText = agentMode === "speaking" ? "Speaking..." : agentMode === "analyzing" ? "Analyzing your answer..." : agentMode === "evaluated" ? "Answer evaluated" : "Listening...";
  const orbState: OrbState = agentMode === "speaking" ? "speaking" : agentMode === "analyzing" ? "thinking" : agentMode === "listening" && isListening ? "listening" : "idle";
  // Note: violation/integrity/filler counts and the camera/screen/mic status dots are NOT
  // duplicated here. ProctoringGuard renders the single, authoritative monitoring bar for all
  // of that (Section 2: "no candidate should ever see two different/contradictory violation
  // counts on screen at once") - this row only holds interview-flow controls that belong to
  // this page (timer, question progress, exit).

  return (
    <ProctoringGuard
      sessionId={sessionId}
      onProctoringReady={() => setProctoringReady(true)}
      onTerminated={handleTermination}
    >
      {proctoringReady && loading && !question && messages.length <= 1 ? (
        <LoadingState label="Loading question..." />
      ) : (
      <div className="mx-auto flex h-full max-w-[1400px] flex-col gap-3">
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm text-xs font-semibold text-slate-600">
          <span>Interview Time: {time}</span>
          <span>Question: {Math.max(answeredCount + (question ? 1 : 0), 1)} / {totalQuestions}</span>
          <button
            onClick={exitInterview}
            disabled={completing || submitting}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Exit interview
          </button>
        </div>

        {question?.type === "CODING" && question.codingChallenge ? (
          <div className="min-h-0 flex-1">
            <CodingChallengePanel
              sessionId={sessionId}
              challenge={question.codingChallenge}
              onComplete={() => { setQuestion(null); loadNextQuestion(); }}
            />
          </div>
        ) : (
        <div className="min-h-0 flex-1 grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* LEFT: Chat conversation with agent */}
        <div className="lg:col-span-3 card flex min-h-0 flex-col overflow-hidden p-0 shadow-premium">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AgentAvatar pulsing />
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-slate-800 font-display">Arya</p>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <p className="text-xs text-slate-500">AI Interviewer · {statusText}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge bg-premium-50 text-premium-700 border border-premium-200">
                Session #{sessionId.slice(0, 6)}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto chat-scroll px-5 py-5 space-y-4 bg-gradient-to-b from-slate-50/50 to-white">
            {messages.map((m) => (
              m.role === "agent" ? (
                <div key={m.id} className="flex gap-3 items-start animate-fade-in">
                  <AgentAvatar />
                  <div className="max-w-[80%] space-y-1">
                    <div className="agent-bubble whitespace-pre-wrap">{m.content}</div>
                    <span className="text-[10px] text-slate-400 pl-1">
                      {m.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex gap-3 items-start justify-end animate-fade-in">
                  <div className="max-w-[80%] space-y-1">
                    <div className="user-bubble whitespace-pre-wrap">{m.content}</div>
                    <span className="text-[10px] text-slate-400 pr-1 block text-right">
                      {m.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-slate-800 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    YOU
                  </div>
                </div>
              )
            ))}

            {agentTyping && (
              <div className="flex gap-3 items-start animate-fade-in">
                <AgentAvatar />
                <div className="agent-bubble">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-premium-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-premium-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-premium-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    <span className="ml-2 text-xs text-slate-500 font-medium">Arya is thinking…</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {error && (
            <div className="px-5 pt-3">
              <ErrorState message={error} />
            </div>
          )}

          <div className="border-t border-slate-100 p-4 bg-white/70 backdrop-blur-sm space-y-3">
            {!noMoreQuestions && question && !evaluation && (
              <div className="space-y-3">
                {/* Section 11: spoken answers only - this used to be an editable textarea a
                    candidate could type into directly, bypassing voice entirely. It's now a
                    read-only live transcript of what the speech recognizer has captured; the
                    only way content appears here is by speaking. */}
                <div
                  className="input h-24 overflow-y-auto whitespace-pre-wrap text-sm bg-slate-50 cursor-default select-text"
                  aria-live="polite"
                  role="status"
                >
                  {answer ? (
                    <span>
                      {interimAnswer ? answer.slice(0, answer.length - interimAnswer.length).trimEnd() : answer}
                      {interimAnswer && (
                        <span className="text-slate-400 italic"> {interimAnswer}</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      {isListening
                        ? "Listening — start speaking your answer..."
                        : sttUnsupported
                        ? "Voice recognition isn't available in this browser — try Chrome or Edge."
                        : "Tap the mic and speak your answer."}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <WaveformButton listening={isListening} onToggle={toggleVoiceInput} />
                  <div className="flex items-center gap-3">
                    {isListening && (
                      <span className="text-xs text-slate-400">Pauses auto-submit — or finish now:</span>
                    )}
                    <button
                      onClick={() => submitAnswer()}
                      disabled={submitting || !answer.trim()}
                      className="btn-primary text-sm"
                    >
                      {submitting ? "Evaluating…" : "Submit Spoken Answer →"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!noMoreQuestions && question && evaluation && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">Answer submitted — moving to the next question automatically…</p>
                <div className="flex gap-2">
                  <button onClick={goToNextQuestionNow} className="btn-primary text-sm">Skip Ahead Now →</button>
                  <button onClick={pauseInterview} className="btn-secondary text-sm">Pause</button>
                  <button onClick={exitInterview} className="btn-secondary text-sm">Exit</button>
                  <button onClick={finishInterview} disabled={completing} className="btn-primary text-sm">
                    {completing ? "Submitting…" : "Submit Interview"}
                  </button>
                </div>
              </div>
            )}

            {noMoreQuestions && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-slate-600">All done! 🎉 Finish the interview to see your full report.</p>
                <button onClick={pauseInterview} className="btn-secondary text-sm">Pause</button>
                {sessionInfo?.status === "PAUSED" && <button onClick={resumeInterview} className="btn-secondary text-sm">Resume</button>}
                <button onClick={exitInterview} className="btn-secondary text-sm">Exit Interview</button>
                <button onClick={finishInterview} disabled={completing} className="btn-primary text-sm">
                  {completing ? "Submitting…" : "Submit & View Report"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Question info + metrics */}
        <div className="lg:col-span-2 min-h-0 space-y-4 overflow-y-auto pr-1">
          {/* AI Interviewer voice panel — Siri/ChatGPT-style animated orb */}
          <div className="card flex flex-col items-center py-6 shadow-card bg-gradient-to-b from-white to-slate-50">
            <AIVoiceOrb state={orbState} audioLevel={micLevel} size={140} />
            <p className="mt-3 text-sm font-bold text-slate-700 font-display">Arya</p>
            <p className="text-xs text-slate-500">{statusText}</p>
            {isListening && (
              <p className="mt-2 text-[11px] text-emerald-600 font-medium">
                🎙 Listening for your voice — speak your answer
              </p>
            )}
            {/* Section 10: subtle countdown so the candidate knows they're about to be
                auto-skipped for silence - only becomes visually urgent in the last few seconds. */}
            {isListening && silenceCountdown != null && silenceCountdown <= 10 && (
              <p className={`mt-1 text-[11px] font-semibold ${silenceCountdown <= 3 ? "text-red-500 animate-pulse" : "text-slate-400"}`}>
                {silenceCountdown <= 3
                  ? `Auto-skipping in ${silenceCountdown}s if no answer...`
                  : `Silent for a while — auto-skip in ${silenceCountdown}s`}
              </p>
            )}
          </div>

          {/* Question card */}
          <div className="card space-y-4 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-1">Current Question</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {question?.category && (
                    <span className="chip bg-premium-50 text-premium-700 border-premium-200">
                      {question.category}
                    </span>
                  )}
                  {question?.difficulty && <DifficultyBadge difficulty={question.difficulty} />}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Progress</p>
                <p className="text-lg font-bold font-display gradient-text">
                  {answeredCount}
                  <span className="text-slate-400 text-sm font-medium"> Qs</span>
                </p>
              </div>
            </div>

            {question && !evaluation && (
              <div className="bg-gradient-to-br from-premium-50 to-accent-50 border border-premium-100 rounded-2xl p-5">
                <p className="font-bold text-slate-800 leading-relaxed">{question.text}</p>
              </div>
            )}

            {question && evaluation && (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-premium-50 to-accent-50 border border-premium-100 rounded-2xl p-5">
                  <p className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">Question</p>
                  <p className="font-semibold text-slate-700 leading-relaxed text-sm">{question.text}</p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <p className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">Feedback</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{evaluation.feedback}</p>
                </div>
              </div>
            )}

            {noMoreQuestions && !evaluation && (
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5 text-center">
                <div className="text-4xl mb-2">🎉</div>
                <p className="font-bold text-emerald-800">All Questions Completed!</p>
                <p className="text-sm text-emerald-700 mt-1">Finish the interview to view your report</p>
              </div>
            )}
          </div>

          {/* Score & Metrics card */}
          {evaluation ? (
            <div className="card space-y-5 shadow-card">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider font-bold text-slate-400">Last Answer Score</p>
                <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Answered
                </span>
              </div>
              <div className="flex items-center justify-center">
                <ScoreGauge score={evaluation.weightedScore} label="Score" />
              </div>
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <MetricBar label="Correctness" value={evaluation.correctness} color="linear-gradient(90deg, #10b981, #059669)" />
                <MetricBar label="Clarity" value={evaluation.clarity} color="linear-gradient(90deg, #06b6d4, #0e7490)" />
                <MetricBar label="Depth" value={evaluation.depth} color="linear-gradient(90deg, #8b5cf6, #6d28d9)" />
                <MetricBar label="Structure" value={evaluation.structure} color="linear-gradient(90deg, #f59e0b, #d97706)" />
                <MetricBar label="Confidence" value={evaluation.confidence} color="linear-gradient(90deg, #ec4899, #db2777)" />
                <MetricBar label="Grammar" value={evaluation.grammar} color="linear-gradient(90deg, #6366f1, #4f46e5)" />
              </div>
            </div>
          ) : (
            <div className="card space-y-4 shadow-card">
              <p className="text-xs uppercase tracking-wider font-bold text-slate-400">Awaiting Answer</p>
              <div className="bg-slate-50 rounded-2xl p-6 text-center space-y-3 border border-slate-100">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-premium-gradient flex items-center justify-center shadow-premium">
                  <span className="text-white text-3xl">💬</span>
                </div>
                <div>
                  <p className="font-bold text-slate-800">Type your answer in the chat</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    When you submit, Arya will grade your answer on correctness, clarity, depth, structure, confidence, and grammar.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white rounded-xl p-3 border border-slate-100 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Tip 1</p>
                  <p className="text-slate-600 mt-1 font-medium">Be specific</p>
                </div>
                <div className="bg-white rounded-xl p-3 border border-slate-100 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Tip 2</p>
                  <p className="text-slate-600 mt-1 font-medium">Use STAR</p>
                </div>
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="card shadow-card space-y-3">
            <p className="text-xs uppercase tracking-wider font-bold text-slate-400">Shortcuts</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px] font-bold text-slate-700">Enter</kbd>
                <p className="text-slate-600 mt-1 font-medium">Send answer</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px] font-bold text-slate-700">⇧ Enter</kbd>
                <p className="text-slate-600 mt-1 font-medium">New line</p>
              </div>
            </div>
          </div>
        </div>
        </div>
        )}
      </div>
      )}
    </ProctoringGuard>
  );
}


