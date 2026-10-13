"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import Link from "next/link";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailFallback />}>
      <VerifyEmailPageContent />
    </Suspense>
  );
}

function VerifyEmailPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { verifyEmail, resendVerification, user } = useAuth();

  const token = searchParams.get("token");
  const pending = searchParams.get("pending") === "true";
  const emailParam = searchParams.get("email") || user?.email;

  const [phase, setPhase] = useState<"verifying" | "success" | "error" | "pending">("pending");
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");
  const [resendMsg, setResendMsg] = useState("");
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (token) {
      setPhase("verifying");
      verifyEmail(token)
        .then(() => setPhase("success"))
        .catch((e) => {
          setPhase("error");
          setError(e instanceof ApiError ? e.message : "Invalid or expired link");
        });
    } else if (pending && emailParam) {
      setPhase("pending");
    } else {
      setPhase("error");
      setError("No verification token provided");
    }
  }, [token, pending, emailParam, verifyEmail]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function handleResend() {
    if (!emailParam || countdown > 0) return;
    setIsResending(true);
    setResendMsg("");
    setError("");
    try {
      await resendVerification(emailParam);
      setResendMsg("Verification email sent! Please check your inbox.");
      setCountdown(60);
      setPhase("pending");
    } catch (e) {
      setPhase("pending");
      setError(e instanceof ApiError ? e.message : "Failed to resend");
      setCountdown(60);
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="bg-white rounded-3xl shadow-lg border border-slate-200 p-8 md:p-10 text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-8">
            <img src="/logo-icon-64.png" alt="Prep2Place" className="w-10 h-10 rounded-xl" />
            <span className="font-display font-bold text-2xl tracking-tight">
              Prep<span className="text-teal-500">2</span>Place
            </span>
          </Link>

          {phase === "verifying" && (
            <div className="py-8">
              <div className="w-16 h-16 border-4 border-premium-200 border-t-premium-600 rounded-full animate-spin mx-auto mb-5" />
              <h2 className="font-display font-bold text-2xl text-slate-800 mb-2">Verifying your email…</h2>
              <p className="text-slate-500 text-sm">Just a moment.</p>
            </div>
          )}

          {phase === "success" && (
            <div className="py-6">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="font-display font-bold text-2xl text-slate-800 mb-2">Email verified!</h2>
              <p className="text-slate-500 text-sm mb-6">
                Your email has been confirmed. You can now access all Prep2Place features.
              </p>
              <Link href="/dashboard" className="btn-primary w-full">Go to Dashboard</Link>
            </div>
          )}

          {phase === "pending" && (
            <div className="py-4">
              <div className="w-16 h-16 rounded-full bg-sky-100 flex items-center justify-center mx-auto mb-5">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#0284c7" strokeWidth="2" />
                  <path d="M22 6l-10 7L2 6" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="font-display font-bold text-2xl text-slate-800 mb-2">Check your inbox</h2>
              <p className="text-slate-500 text-sm mb-2">
                We sent a verification link to:
              </p>
              <p className="font-semibold text-slate-800 mb-6 break-all">
                {emailParam || "your email"}
              </p>
              {resendMsg && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
                  {resendMsg}
                </div>
              )}
              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}
              <button
                onClick={handleResend}
                disabled={countdown > 0 || isResending}
                className="btn-secondary w-full mb-3"
              >
                {isResending ? "Sending…" : countdown > 0 ? `Resend in ${countdown}s` : "Resend verification email"}
              </button>
              <div className="mt-6 text-xs text-slate-400 space-y-1">
                <p>• Check your spam / promotions folder if not found.</p>
                <p>• Links expire after 30 minutes.</p>
              </div>
              <div className="mt-6 flex gap-3 flex-col">
                <Link href="/dashboard" className="btn-ghost w-full">Skip for now (limited access)</Link>
                <Link href="/login" className="text-sm text-slate-500 hover:text-slate-700">← Back to sign in</Link>
              </div>
            </div>
          )}

          {phase === "error" && (
            <div className="py-6">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-5">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="font-display font-bold text-2xl text-slate-800 mb-2">Couldn't verify</h2>
              <p className="text-slate-500 text-sm mb-6">{error || "The link may be expired or already used."}</p>
              {emailParam && (
                <button onClick={handleResend} disabled={countdown > 0} className="btn-primary w-full mb-3">
                  {countdown > 0 ? `Resend in ${countdown}s` : "Send a new link"}
                </button>
              )}
              <div className="flex gap-3 flex-col">
                <Link href="/login" className="btn-secondary w-full">Sign in instead</Link>
                <Link href="/register" className="text-sm text-slate-500 hover:text-slate-700">Create a new account</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VerifyEmailFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-teal-500" />
        <p className="font-display text-2xl font-bold text-slate-900">Loading verification page…</p>
      </div>
    </div>
  );
}
