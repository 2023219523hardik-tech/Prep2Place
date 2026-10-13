"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Icon } from "@/components/ui/Icon";
import { FieldGroup } from "@/components/ui/FieldGroup";
import { useToast } from "@/hooks/useToast";
import { z } from "zod";

const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(1, "Please enter your full name")
      .min(2, "Full name must be at least 2 characters"),
    email: z
      .string()
      .min(1, "Please enter your email")
      .email("Please enter a valid email address"),
    password: z
      .string()
      .min(1, "Please create a password")
      .min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterValidationErrors = Partial<
  Record<"fullName" | "email" | "password" | "confirmPassword", string>
>;

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/+$/, "");

type PasswordStrength = "weak" | "medium" | "strong" | "very-strong" | null;

function getPasswordStrength(pwd: string): PasswordStrength {
  if (!pwd) return null;
  let score = 0;
  if (pwd.length >= 6) score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score++;

  if (score <= 1) return "weak";
  if (score === 2) return "medium";
  if (score === 3) return "strong";
  return "very-strong";
}

const STRENGTH_META: Record<NonNullable<PasswordStrength>, { label: string; color: string; width: string }> = {
  weak: { label: "Weak", color: "bg-red-500", width: "w-1/4" },
  medium: { label: "Medium", color: "bg-amber-500", width: "w-2/4" },
  strong: { label: "Strong", color: "bg-emerald-500", width: "w-3/4" },
  "very-strong": { label: "Very Strong", color: "bg-premium-600", width: "w-full" },
};

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

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<{ general?: string }>({});
  const [validationErrors, setValidationErrors] = useState<RegisterValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();
  const { push: pushToast } = useToast();

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError({});
    setValidationErrors({});

    const parsed = registerSchema.safeParse({ fullName, email, password, confirmPassword });
    if (!parsed.success) {
      const errs: RegisterValidationErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof RegisterValidationErrors;
        if (!errs[key]) errs[key] = issue.message;
      }
      setValidationErrors(errs);
      return;
    }

    setLoading(true);
    try {
      await register(email, password, fullName);
      pushToast({
        variant: "success",
        title: "Account created!",
        description: "Welcome to Prep2Place. Verify your email to get started.",
      });
      router.push("/verify-email?pending=true&email=" + encodeURIComponent(email));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Registration failed. Please try again.";
      setError({ general: message });
      pushToast({
        variant: "error",
        title: "Registration failed",
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
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-premium-200/30 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-accent-200/20 blur-3xl rounded-full pointer-events-none" />

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
                  Sign up to start tracking your progress, take mock interviews, and crush coding problems.
                </p>
              </div>

              <div className="relative z-10 space-y-4 mt-10">
                {features.map((f, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="shrink-0 w-8 h-8 rounded-lg bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                      <Icon name="check" size={16} strokeWidth={3} />
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
                    Built for the full placement journey —{" "}
                    <span className="font-bold text-white">learn, practice, get placed</span>
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
                    Create your <span className="gradient-text">Prep2Place account</span>
                  </h1>
                  <p className="text-slate-500 text-sm md:text-base">
                    Start your placement readiness journey today.
                  </p>
                </div>

                <OAuthButtons mode="register" />

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white/80 backdrop-blur-sm px-4 py-1 text-slate-400 font-semibold uppercase tracking-wider rounded-full">
                      or continue with email
                    </span>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <FieldGroup
                    title="Account Details"
                    description="We'll use these to sign you in and personalize your experience."
                  >
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="fullName" className="label">
                          Name<span className="ml-0.5 text-red-500" aria-hidden="true"> *</span>
                        </label>
                        <div className="relative">
                          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                            <Icon name="user" size={18} />
                          </div>
                          <input
                            id="fullName"
                            className={`input !pl-11 ${validationErrors.fullName ? "!border-red-300 focus:!ring-red-200" : ""}`}
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Rahul Sharma"
                          />
                        </div>
                        {validationErrors.fullName && (
                          <p className="mt-1.5 text-xs font-semibold text-red-600">{validationErrors.fullName}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="email" className="label">
                          Email<span className="ml-0.5 text-red-500" aria-hidden="true"> *</span>
                        </label>
                        <div className="relative">
                          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                            <Icon name="info" size={18} />
                          </div>
                          <input
                            id="email"
                            type="email"
                            className={`input !pl-11 ${validationErrors.email ? "!border-red-300 focus:!ring-red-200" : ""}`}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@college.edu"
                          />
                        </div>
                        {validationErrors.email && (
                          <p className="mt-1.5 text-xs font-semibold text-red-600">{validationErrors.email}</p>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label htmlFor="password" className="label !mb-0">
                            Password<span className="ml-0.5 text-red-500" aria-hidden="true"> *</span>
                          </label>
                          <span className="text-[11px] text-slate-400 font-medium">
                            Min. 6 characters
                          </span>
                        </div>
                        <div className="relative">
                          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                            <Icon name="lock" size={18} />
                          </div>
                          <input
                            id="password"
                            type="password"
                            minLength={6}
                            className={`input !pl-11 ${validationErrors.password ? "!border-red-300 focus:!ring-red-200" : ""}`}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                          />
                        </div>
                        {strength && (
                          <div className="mt-2 space-y-1">
                            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full ${STRENGTH_META[strength].color} ${STRENGTH_META[strength].width} transition-all duration-300`}
                              />
                            </div>
                            <p className="text-[11px] font-semibold text-slate-500">
                              Strength:{" "}
                              <span className={
                                strength === "weak" ? "text-red-600" :
                                strength === "medium" ? "text-amber-600" :
                                strength === "strong" ? "text-emerald-600" : "text-premium-600"
                              }>
                                {STRENGTH_META[strength].label}
                              </span>
                            </p>
                          </div>
                        )}
                        {validationErrors.password && (
                          <p className="mt-1.5 text-xs font-semibold text-red-600">{validationErrors.password}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="confirmPassword" className="label">
                          Confirm Password<span className="ml-0.5 text-red-500" aria-hidden="true"> *</span>
                        </label>
                        <div className="relative">
                          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                            <Icon name="shield" size={18} />
                          </div>
                          <input
                            id="confirmPassword"
                            type="password"
                            className={`input !pl-11 ${validationErrors.confirmPassword ? "!border-red-300 focus:!ring-red-200" : ""}`}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                          />
                        </div>
                        {validationErrors.confirmPassword && (
                          <p className="mt-1.5 text-xs font-semibold text-red-600">{validationErrors.confirmPassword}</p>
                        )}
                      </div>
                    </div>
                  </FieldGroup>

                  {error.general && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm animate-fade-in">
                      <Icon name="alert-circle" size={18} className="shrink-0 mt-0.5" />
                      <span>{error.general}</span>
                    </div>
                  )}

                  <button type="submit" disabled={loading} className="btn-primary w-full !py-3 text-base">
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Creating your account...
                      </>
                    ) : (
                      <>
                        Create free account
                        <Icon name="chevron-right" size={18} />
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
                      Already have an account?
                    </span>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-sm text-slate-600 mb-4">
                    Pick up right where you left off — sign in now.
                  </p>
                  <Link href="/login" className="btn-secondary w-full !py-3 text-sm">
                    Sign in →
                    <Icon name="login" size={16} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
