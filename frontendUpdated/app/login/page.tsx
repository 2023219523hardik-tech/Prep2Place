"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { z } from "zod";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters"),
});

type LoginValidationErrors = Partial<Record<"email" | "password", string>>;

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/+$/, "");

function OAuthButtons({ mode }: { mode: "login" | "register" }) {
  const providers = [
    {
      id: "google",
      name: "Google",
      href: `${API_BASE_URL}/oauth2/authorization/google`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
          <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
          <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
          <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
        </svg>
      ),
      bgClass: "bg-white hover:bg-slate-50 border-slate-200 text-slate-700",
    },
    {
      id: "github",
      name: "GitHub",
      href: `${API_BASE_URL}/oauth2/authorization/github`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
      ),
      bgClass: "bg-slate-900 hover:bg-slate-800 border-slate-800 text-white",
    },
  ];

  return (
    <div className="space-y-2.5">
      {providers.map((p) => (
        <Link
          key={p.id}
          href={p.href}
          className={`flex items-center justify-center gap-2.5 w-full py-2.5 rounded-xl border font-semibold text-sm transition-all shadow-sm hover:shadow ${p.bgClass}`}
        >
          {p.icon}
          <span>Continue with {p.name}</span>
        </Link>
      ))}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <LoginFormContent />
    </Suspense>
  );
}

function LoginFormContent() {
  const [email, setEmail] = useState("student@placement.io");
  const [password, setPassword] = useState("Student@123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<LoginValidationErrors>({});
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSessionExpired = searchParams.get("expired") === "true";
  const { push: pushToast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setValidationErrors({});

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errs: LoginValidationErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof LoginValidationErrors;
        if (!errs[key]) errs[key] = issue.message;
      }
      setValidationErrors(errs);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      pushToast({
        variant: "success",
        title: "Signed in",
        description: "Welcome back to Prep2Place.",
      });
      const returnUrl = searchParams.get("returnUrl");
      const destination = returnUrl && returnUrl.startsWith("/") && !returnUrl.startsWith("//") ? returnUrl : "/dashboard";
      router.push(destination);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Login failed. Please try again.";
      setError(message);
      pushToast({
        variant: "error",
        title: "Sign in failed",
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }

  const features = [
    { title: "AI Mock Interviews", desc: "Conversational AI interviewer with real-time scoring" },
    { title: "TUF Coding Sheets", desc: "1500+ DSA problems with adaptive difficulty" },
    { title: "Proctored Sessions", desc: "Enterprise-grade posture & filler-word analysis" },
    { title: "Readiness Score", desc: "Single live metric tracking your placement journey" },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-50">
      <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-premium-200/30 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-accent-200/20 blur-3xl rounded-full pointer-events-none" />

      <div className="relative min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-6xl animate-slide-up">
          <div className="grid lg:grid-cols-5 rounded-3xl overflow-hidden shadow-premium/30 border border-slate-200/70 bg-white">
            <div className="lg:col-span-2 relative bg-premium-gradient p-8 md:p-10 text-white overflow-hidden hidden lg:flex flex-col justify-between">
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-10 right-10 w-40 h-40 rounded-full bg-white/20 blur-2xl" />
                <div className="absolute bottom-20 left-0 w-56 h-56 rounded-full bg-accent-400/30 blur-3xl" />
                <div className="absolute top-1/2 right-0 w-32 h-32 rounded-full bg-gold-400/20 blur-2xl" />
              </div>

              <div className="relative z-10">
                <Link href="/" className="flex items-center gap-2.5 mb-10">
                  <div className="w-10 h-10 rounded-xl bg-white/90 flex items-center justify-center p-1">
                    <img src="/logo-icon-64.png" alt="Prep2Place" className="w-full h-full rounded-lg" />
                  </div>
                  <span className="font-display font-bold text-2xl tracking-tight">
                    Prep<span className="text-teal-300">2</span>Place
                  </span>
                </Link>

                <h2 className="font-display font-bold text-3xl md:text-4xl leading-tight mb-4">
                  Welcome back to your placement journey.
                </h2>
                <p className="text-white/80 leading-relaxed text-sm md:text-base">
                  Sign in to continue tracking your progress, take another mock interview, or crush a few coding problems.
                </p>
              </div>

              <div className="relative z-10 space-y-4 mt-10">
                {features.map((f, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="shrink-0 w-8 h-8 rounded-lg bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-semibold text-sm md:text-base">{f.title}</div>
                      <div className="text-xs md:text-sm text-white/70 mt-0.5">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="relative z-10 mt-10">
                <div className="flex items-center gap-3 text-xs md:text-sm text-white/70">
                  <div className="flex -space-x-2">
                    {["#8b5cf6", "#06b6d4", "#facc15"].map((c, i) => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-white/20" style={{ background: c }} />
                    ))}
                  </div>
                  <span>
                    Built for the full placement journey — <span className="font-bold text-white">learn, practice, get placed</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3 p-8 md:p-12 bg-card-gradient">
              <div className="flex justify-center lg:hidden mb-8">
                <Link href="/" className="flex items-center gap-2">
                  <img src="/logo-icon-64.png" alt="Prep2Place" className="w-9 h-9 rounded-xl" />
                  <span className="font-display font-bold text-xl tracking-tight">
                    Prep<span className="text-teal-500">2</span>Place
                  </span>
                </Link>
              </div>

              <div className="max-w-md mx-auto">
                <div className="mb-8">
                  <h1 className="font-display font-bold text-3xl md:text-4xl tracking-tight mb-2">
                    Sign <span className="gradient-text">in</span>
                  </h1>
                  <p className="text-slate-500 text-sm md:text-base">
                    Continue your placement prep journey right where you left off.
                  </p>
                </div>

                {isSessionExpired && (
                  <div className="mb-6 flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-sm animate-fade-in shadow-xs">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5 text-amber-600">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <div>
                      <div className="font-semibold text-xs uppercase tracking-wider text-amber-700">Session Expired</div>
                      <div className="text-xs text-amber-800/90 mt-0.5 leading-relaxed">
                        Your session has expired. Please sign in again to continue your session.
                      </div>
                    </div>
                  </div>
                )}

                <OAuthButtons mode="login" />

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white/80 backdrop-blur-sm px-4 py-1 text-slate-400 font-semibold uppercase tracking-wider rounded-full">
                      Or use email
                    </span>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="label">Email address</label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="1.8" />
                          <path d="M22 6l-10 7L2 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <input
                        className={`input !pl-11 ${validationErrors.email ? "!border-red-300 focus:!ring-red-200" : ""}`}
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@college.edu"
                        required
                      />
                    </div>
                    {validationErrors.email && (
                      <p className="mt-1.5 text-xs font-semibold text-red-600">{validationErrors.email}</p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="label !mb-0">Password</label>
                      <a className="text-xs font-semibold text-premium-600 hover:text-premium-700 cursor-pointer">Forgot password?</a>
                    </div>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
                          <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      </div>
                      <input
                        className={`input !pl-11 ${validationErrors.password ? "!border-red-300 focus:!ring-red-200" : ""}`}
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                      />
                    </div>
                    {validationErrors.password && (
                      <p className="mt-1.5 text-xs font-semibold text-red-600">{validationErrors.password}</p>
                    )}
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm animate-fade-in">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5">
                        <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>{error}</span>
                    </div>
                  )}

                  <button type="submit" disabled={loading} className="btn-primary w-full !py-3 text-base">
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Signing you in...
                      </>
                    ) : (
                      <>
                        Sign in to Prep2Place
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </>
                    )}
                  </button>
                </form>

                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white/80 backdrop-blur-sm px-4 py-1 text-slate-400 font-semibold uppercase tracking-wider rounded-full">
                      New to Prep2Place?
                    </span>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-sm text-slate-600 mb-4">
                    Start your placement prep today — free. No credit card required.
                  </p>
                  <Link href="/register" className="btn-secondary w-full !py-3 text-sm">
                    Create a free account
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    </svg>
                  </Link>
                </div>

                <div className="mt-8 p-4 rounded-2xl bg-premium-50/60 border border-premium-200/60 text-xs md:text-sm">
                  <div className="flex items-start gap-2.5">
                    <div className="shrink-0 w-7 h-7 rounded-lg bg-premium-gradient text-white flex items-center justify-center">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="text-slate-700">
                      <span className="font-bold text-premium-700">Demo credentials · </span>
                      student@placement.io / Student@123
                      <div className="mt-1">
                        Admin console:{" "}
                        <Link href="/admin/login" className="underline font-semibold text-premium-700 hover:text-premium-800">/admin/login</Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
