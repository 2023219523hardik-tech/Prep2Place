"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth, AuthUser } from "@/lib/auth";
import Link from "next/link";

type Status = "loading" | "success" | "error" | "needsEmail";

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<PageFallback title="Preparing sign-in" />}>
      <OAuthCallbackPageContent />
    </Suspense>
  );
}

function OAuthCallbackPageContent() {
  const searchParams = useSearchParams();
  const { setAuthFromOAuth } = useAuth();

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");

  // Prevent React StrictMode / re-render from processing OAuth twice.
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const handleCallback = async () => {
      try {
        const errParam = searchParams.get("error");

        if (errParam) {
          setStatus("error");

          if (errParam === "oauth_failed") {
            setError(
              "OAuth sign-in failed. Please try again or use email/password."
            );
          } else {
            try {
              setError(decodeURIComponent(errParam));
            } catch {
              setError(errParam);
            }
          }

          return;
        }

        const accessToken = searchParams.get("accessToken");
        const refreshToken = searchParams.get("refreshToken");
        const userId = searchParams.get("userId");
        const email = searchParams.get("email");
        const fullName = searchParams.get("fullName");
        const role = searchParams.get("role");

        const premium = searchParams.get("premium") === "true";
        const emailVerified = searchParams.get("emailVerified") === "true";
        const isNewUser = searchParams.get("isNewUser") === "true";
        const needsEmailParam = searchParams.get("needsEmail") === "true";

        console.log("[OAuth] Callback received", {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          userId,
          email,
          role,
          emailVerified,
          isNewUser,
          needsEmailParam,
        });

        if (!accessToken || !refreshToken || !userId || !email || !role) {
          console.error("[OAuth] Missing callback parameters");
          setStatus("error");
          setError("Missing OAuth response parameters. Please try signing in again.");
          return;
        }

        const parsedUserId = Number.parseInt(userId, 10);

        if (Number.isNaN(parsedUserId)) {
          setStatus("error");
          setError("Invalid user information received from OAuth.");
          return;
        }

        let decodedEmail = email;
        let decodedFullName = fullName || "OAuth User";

        try {
          decodedEmail = decodeURIComponent(email);

          if (fullName) {
            decodedFullName = decodeURIComponent(fullName);
          }
        } catch (decodeError) {
          console.warn("[OAuth] URL decoding failed, using raw values", decodeError);
        }

        const user: AuthUser = {
          userId: parsedUserId,
          email: decodedEmail,
          fullName: decodedFullName,
          role,
          premium,
          emailVerified,
        };

        console.log("[OAuth] User authenticated:", user);

        await setAuthFromOAuth({
          accessToken,
          refreshToken,
          user,
        });

        console.log("[OAuth] Auth state persisted");

        if (needsEmailParam) {
          setStatus("needsEmail");
          return;
        }

        if (!emailVerified) {
          setStatus("success");
          const verifyUrl = `/verify-email?pending=true&email=${encodeURIComponent(user.email)}`;
          console.log("[OAuth] Redirecting to:", verifyUrl);
          window.location.replace(verifyUrl);
          return;
        }

        const destination = isNewUser ? "/profile?onboarding=true" : "/dashboard";
        console.log("[OAuth] Redirecting to:", destination);
        setStatus("success");
        window.location.replace(destination);
      } catch (e) {
        console.error("[OAuth] Callback processing failed:", e);
        setStatus("error");
        if (e instanceof Error) {
          setError(e.message);
        } else {
          setError("Failed to complete sign-in. Please try again.");
        }
      }
    };

    handleCallback();
  }, [searchParams, setAuthFromOAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="bg-white rounded-3xl shadow-lg border border-slate-200 p-8 md:p-10 text-center">
          <div className="mb-6 inline-flex items-center gap-3">
            <img src="/logo-icon-64.png" alt="Prep2Place" className="w-12 h-12 rounded-2xl" />
            <div className="text-left">
              <div className="font-display text-2xl font-bold tracking-tight text-slate-950">
                Prep<span className="text-teal-500">2</span>Place
              </div>
            </div>
          </div>

          {status === "loading" && (
            <div className="py-8">
              <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-teal-500" />
              <h2 className="font-display text-2xl font-bold text-slate-900">Signing you in…</h2>
              <p className="mt-2 text-sm text-slate-500">Finalizing your account session.</p>
            </div>
          )}

          {status === "needsEmail" && (
            <div className="py-6">
              <h2 className="font-display text-2xl font-bold text-slate-900">Almost there</h2>
              <p className="mt-2 text-sm text-slate-600">We need your email address to complete your account setup.</p>
              <Link href="/register" className="btn-primary mt-6 block w-full">Continue sign up</Link>
            </div>
          )}

          {status === "error" && (
            <div className="py-6">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
                <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                </svg>
              </div>
              <h2 className="font-display text-2xl font-bold text-slate-900">Sign in issue</h2>
              <p className="mt-2 text-sm text-slate-600">{error || "Something went wrong."}</p>
              <Link href="/login" className="btn-secondary mt-6 block w-full">Try again</Link>
            </div>
          )}

          {status === "success" && (
            <div className="py-6">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 13l4 4L19 3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="font-display text-2xl font-bold text-slate-900">Redirecting…</h2>
              <p className="mt-2 text-sm text-slate-600">You are being sent to your destination.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PageFallback({ title }: { title: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-teal-500" />
        <p className="font-display text-2xl font-bold text-slate-900">{title}</p>
      </div>
    </div>
  );
}