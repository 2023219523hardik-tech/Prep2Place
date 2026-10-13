"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { gameApi, AttemptView, AnswerResult } from "@/lib/gameApi";
import { ApiError } from "@/lib/api";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import { GameHUD } from "@/components/games/GameHUD";
import { ResultScreen } from "@/components/games/ResultScreen";
import { DeductiveBoard } from "@/components/games/boards/DeductiveBoard";
import { SwitchBoard } from "@/components/games/boards/SwitchBoard";
import { GridBoard } from "@/components/games/boards/GridBoard";
import { InductiveBoard } from "@/components/games/boards/InductiveBoard";
import { MotionBoard } from "@/components/games/boards/MotionBoard";
import { MathBoard } from "@/components/games/boards/MathBoard";
import { gameSound } from "@/lib/gameSound";

const LEVEL_LABEL: Record<number, string> = {
  1: "Easy", 2: "Easy+", 3: "Medium", 4: "Medium+", 5: "Hard", 6: "Hard+", 7: "Expert", 8: "Expert+",
};

type Feedback = {
  correct: boolean;
  correctOptionId: string | null;
  correctOptionIds: string[] | null;
  levelUp: boolean;
  previousLevel: number;
  newLevel: number;
};

export default function GamePlayPage() {
  const params = useParams<{ attemptId: string }>();
  const attemptId = Number(params.attemptId);
  const router = useRouter();

  const [attempt, setAttempt] = useState<AttemptView | null>(null);
  const [result, setResult] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const soundOnRef = useRef(true);
  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);
  const [pauseBusy, setPauseBusy] = useState(false);
  const roundStartRef = useRef<number>(Date.now());
  const warnedRef = useRef(false);

  const loadResultIfFinished = useCallback((a: AttemptView) => {
    if (a.status !== "STARTED") {
      gameApi.getResult(a.id).then(setResult).catch(() => {});
      if (a.status === "COMPLETED") gameSound.completion(soundOnRef.current);
    }
  }, []);

  const load = useCallback(() => {
    gameApi
      .getAttempt(attemptId)
      .then((a) => {
        setAttempt(a);
        roundStartRef.current = Date.now();
        warnedRef.current = false;
        setSecondsRemaining(a.currentRound?.timeLimitSeconds ?? 0);
        loadResultIfFinished(a);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load attempt"))
      .finally(() => setLoading(false));
  }, [attemptId, loadResultIfFinished]);

  useEffect(load, [load]);

  // Countdown; auto-submits with no answer (marked incorrect) when time runs out. Frozen while
  // paused or while a round's feedback/level-up transition is on screen.
  useEffect(() => {
    if (!attempt || attempt.status !== "STARTED" || !attempt.currentRound) return;
    if (attempt.paused || feedback) return;
    if (secondsRemaining <= 0) {
      submitAnswer([]);
      return;
    }
    if (secondsRemaining <= 5 && !warnedRef.current) {
      warnedRef.current = true;
      gameSound.timeWarning(soundOn);
    }
    const t = setTimeout(() => setSecondsRemaining((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsRemaining, attempt?.currentRoundIndex, attempt?.paused, feedback]);

  async function submitAnswer(optionIds: string[]) {
    if (!attempt || !attempt.currentRound || submitting || feedback) return;
    setSubmitting(true);
    setError("");
    const responseTimeMs = Date.now() - roundStartRef.current;
    const roundIndex = attempt.currentRoundIndex;
    try {
      const res: AnswerResult = await gameApi.answer(attempt.gameId, roundIndex, optionIds, responseTimeMs);
      const fb: Feedback = {
        correct: res.correct,
        correctOptionId: res.correctOptionId,
        correctOptionIds: res.correctOptionIds,
        levelUp: res.levelUp,
        previousLevel: res.previousLevel,
        newLevel: res.newLevel,
      };
      setFeedback(fb);
      gameSound[res.correct ? "correct" : "incorrect"](soundOn);
      if (res.levelUp) setTimeout(() => gameSound.levelUp(soundOn), 250);

      const delay = res.levelUp ? 1500 : 900;
      setTimeout(() => {
        setFeedback(null);
        setSelected([]);
        setAttempt(res.attempt);
        roundStartRef.current = Date.now();
        warnedRef.current = false;
        setSecondsRemaining(res.attempt.currentRound?.timeLimitSeconds ?? 0);
        setSubmitting(false);
        loadResultIfFinished(res.attempt);
      }, delay);
    } catch (e: any) {
      setError(e.message || "Failed to submit answer");
      setSubmitting(false);
    }
  }

  function handleToggleOption(id: string) {
    const round = attempt?.currentRound;
    if (!round || submitting || feedback) return;
    if (round.answerMode === "SINGLE") {
      setSelected([id]);
      submitAnswer([id]);
      return;
    }
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (next.length === round.requiredSelectionCount) {
        setTimeout(() => submitAnswer(next), 150);
      }
      return next;
    });
  }

  async function togglePause() {
    if (!attempt || pauseBusy) return;
    setPauseBusy(true);
    try {
      const updated = attempt.paused ? await gameApi.resume(attempt.id) : await gameApi.pause(attempt.id);
      setAttempt(updated);
      roundStartRef.current = Date.now();
    } catch (e: any) {
      setError(e.message || "Could not update pause state");
    } finally {
      setPauseBusy(false);
    }
  }

  if (loading) return <LoadingState label="Loading game..." />;
  if (error && !attempt) return <ErrorState message={error} />;
  if (!attempt) return null;

  if (attempt.status !== "STARTED") {
    if (!result) return <LoadingState label="Scoring your attempt..." />;
    return (
      <ResultScreen
        gameName={attempt.gameName}
        result={result}
        onPlayAgain={() => router.push(`/games/play/${attempt.gameId}`)}
        onBackToList={() => router.push("/games")}
      />
    );
  }

  const round = attempt.currentRound;
  if (!round) return <LoadingState label="Loading round..." />;

  const revealCorrectOptionIds = feedback
    ? feedback.correctOptionIds ?? (feedback.correctOptionId ? [feedback.correctOptionId] : null)
    : null;

  const boardProps = {
    round,
    selected,
    onToggleOption: handleToggleOption,
    disabled: submitting || !!feedback || attempt.paused,
    revealCorrectOptionIds,
  };

  return (
    <div className="min-h-[calc(100vh-140px)] flex flex-col justify-center items-center py-6 px-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 shadow-xl bg-white">
        <GameHUD
          gameName={attempt.gameName}
          level={attempt.currentLevel}
          levelLabel={LEVEL_LABEL[attempt.currentLevel] ?? ""}
          score={attempt.score}
          correctCount={attempt.correctCount}
          incorrectCount={attempt.incorrectCount}
          roundNumber={attempt.currentRoundIndex}
          totalRounds={attempt.totalRounds}
          secondsRemaining={secondsRemaining}
          paused={attempt.paused}
          soundOn={soundOn}
          onTogglePause={togglePause}
          onToggleSound={() => setSoundOn((s) => !s)}
        />

        <div className="bg-white px-6 py-8 sm:px-10 flex flex-col items-center justify-center min-h-[480px]">
          {attempt.paused ? (
            <div className="py-16 text-center">
              <p className="text-lg font-semibold text-slate-700">Paused</p>
              <p className="mt-1 text-sm text-slate-500">Your timer is on hold. Resume when you're ready.</p>
              <button
                onClick={togglePause}
                disabled={pauseBusy}
                className="mt-5 rounded-lg bg-premium-600 px-5 py-2.5 font-semibold text-white transition hover:bg-premium-700"
              >
                Resume
              </button>
            </div>
          ) : (
            <>
              {error && <ErrorState message={error} />}

              {feedback?.levelUp && (
                <div className="mb-4 rounded-lg border border-premium-200 bg-premium-50 px-4 py-2.5 text-center text-sm font-semibold text-premium-700">
                  ✓ Correct — Level {feedback.previousLevel} → {feedback.newLevel} — Challenge increased
                </div>
              )}
              {feedback && !feedback.levelUp && (
                <div
                  className={`mb-4 rounded-lg px-4 py-2 text-center text-sm font-semibold ${
                    feedback.correct ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                  }`}
                >
                  {feedback.correct ? "✓ Correct" : "✗ Not quite"}
                </div>
              )}

              <p className="mb-6 font-semibold text-center text-slate-800 text-base max-w-xl">{round.prompt}</p>

              {attempt.gameType === "DEDUCTIVE" && <DeductiveBoard {...boardProps} />}
              {attempt.gameType === "SWITCH" && <SwitchBoard {...boardProps} />}
              {attempt.gameType === "GRID" && <GridBoard {...boardProps} />}
              {attempt.gameType === "INDUCTIVE" && <InductiveBoard {...boardProps} />}
              {attempt.gameType === "MOTION" && <MotionBoard {...boardProps} />}
              {attempt.gameType === "MATH" && <MathBoard {...boardProps} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
