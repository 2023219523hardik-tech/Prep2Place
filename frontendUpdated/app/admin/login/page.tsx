"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { adminApi, setAdminToken } from "@/lib/adminApi";
import { Icon } from "@/components/ui/Icon";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("admin@placement.io");
  const [password, setPassword] = useState("Admin@123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await adminApi.post<any>("/api/admin/auth/login", { email, password });
      setAdminToken(res.accessToken);
      localStorage.setItem("adminUser", JSON.stringify({ fullName: res.fullName, email: res.email }));
      router.push("/admin/dashboard");
    } catch (err: any) {
      setError(err?.message || "Login failed. Please check credentials.");
    } finally {
      setLoading(false);
    }
  }

  const features = [
    { title: "System Question Vault", desc: "Seed, curate, and archive DSA, SQL, DataFrame, and Technical MCQs" },
    { title: "Enterprise Company Moderation", desc: "Verify employer workspaces and manage multi-stage hiring drives" },
    { title: "Live Proctoring & Telemetry", desc: "Monitor ongoing assessments, student flags, and integrity reports" },
    { title: "Placement Cohort Analytics", desc: "Batch-wide readiness metrics, selection rates, and outcome exports" },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-50">
      {/* Background ambient lighting matching User & Company portals */}
      <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-premium-200/30 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-accent-200/20 blur-3xl rounded-full pointer-events-none" />

      <div className="relative min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-6xl animate-slide-up">
          <div className="grid lg:grid-cols-5 rounded-3xl overflow-hidden shadow-premium/30 border border-slate-200/70 bg-white">
            {/* Left Brand / Features Panel */}
            <div className="lg:col-span-2 relative bg-premium-gradient p-8 md:p-10 text-white overflow-hidden hidden lg:flex flex-col justify-between">
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-10 right-10 w-40 h-40 rounded-full bg-white/20 blur-2xl" />
                <div className="absolute bottom-20 left-0 w-56 h-56 rounded-full bg-accent-400/30 blur-3xl" />
                <div className="absolute top-1/2 right-0 w-32 h-32 rounded-full bg-gold-400/20 blur-2xl" />
              </div>

              <div className="relative z-10">
                <Link href="/" className="flex items-center gap-2.5 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-white/90 flex items-center justify-center p-1">
                    <img src="/logo-icon-64.png" alt="Prep2Place" className="w-full h-full rounded-lg" />
                  </div>
                  <span className="font-display font-bold text-2xl tracking-tight">
                    Prep<span className="text-teal-300">2</span>Place
                  </span>
                </Link>

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-xs font-bold text-teal-200 mb-4 uppercase tracking-wider">
                  <span>🛡️</span>
                  Platform Governance Console
                </div>

                <h2 className="font-display font-bold text-3xl md:text-4xl leading-tight mb-4">
                  Campus recruitment command center.
                </h2>
                <p className="text-white/80 leading-relaxed text-sm md:text-base">
                  Authorized access for university placement officers and platform administrators to manage the placement ecosystem.
                </p>
              </div>

              <div className="relative z-10 space-y-4 my-8">
                {features.map((f, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="shrink-0 w-8 h-8 rounded-lg bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center text-teal-300">
                      <Icon name="check" size={16} strokeWidth={3} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm md:text-base">{f.title}</div>
                      <div className="text-xs md:text-sm text-white/70 mt-0.5">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="relative z-10">
                <div className="flex items-center gap-3 text-xs md:text-sm text-white/70">
                  <div className="flex -space-x-2">
                    {["#8b5cf6", "#06b6d4", "#f59e0b"].map((c, i) => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-white/20" style={{ background: c }} />
                    ))}
                  </div>
                  <span>
                    Secured by{" "}
                    <span className="font-bold text-white">RBAC Token Authorization</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Right Form Panel */}
            <div className="lg:col-span-3 p-8 md:p-12 bg-card-gradient">
              {/* Mobile logo */}
              <div className="flex justify-center lg:hidden mb-8">
                <Link href="/" className="flex items-center gap-2">
                  <img src="/logo-icon-64.png" alt="Prep2Place" className="w-9 h-9 rounded-xl" />
                  <span className="font-display font-bold text-xl tracking-tight">
                    Prep<span className="text-teal-500">2</span>Place
                  </span>
                </Link>
              </div>

              <div className="max-w-md mx-auto">
                <div className="mb-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-premium-50 border border-premium-200 text-premium-700 text-xs font-bold mb-3 uppercase tracking-wider">
                    <span>🛡️</span>
                    Restricted Admin Access
                  </div>
                  <h1 className="font-display font-bold text-2xl md:text-3xl tracking-tight text-slate-900 mb-2">
                    Sign in to <span className="gradient-text">Admin Console</span>
                  </h1>
                  <p className="text-slate-500 text-sm">
                    Placement team and super-admin credentials required to proceed.
                  </p>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 flex items-center gap-2">
                    <span className="font-bold text-red-800">Error:</span> {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Admin Email *
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@placement.io"
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-premium-500/20 focus:border-premium-500 transition placeholder:text-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Password *
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-premium-500/20 focus:border-premium-500 transition placeholder:text-slate-400"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3.5 px-6 rounded-xl bg-premium-gradient text-white font-bold text-sm shadow-premium hover:shadow-premium-hover active:scale-[0.99] transition disabled:opacity-60"
                    >
                      {loading ? "Verifying Credentials..." : "Access Admin Console →"}
                    </button>
                  </div>
                </form>

                {/* Demo preset pill */}
                <div className="mt-6 p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-600">
                  <span className="font-medium">Demo Admin Preset:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail("admin@placement.io");
                      setPassword("Admin@123");
                    }}
                    className="text-premium-600 hover:text-premium-700 font-bold transition hover:underline"
                  >
                    Load Admin Credentials
                  </button>
                </div>

                {/* Security advisory */}
                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-center text-xs text-slate-500 leading-relaxed">
                  <div className="font-semibold text-slate-700 mb-1">Notice to Platform Personnel</div>
                  All login attempts are recorded and monitored. Public registration for administrator roles is disabled by design.
                </div>

                <div className="mt-4 text-center">
                  <Link href="/" className="text-xs text-slate-400 hover:text-slate-600 transition">
                    ← Return to Prep2Place Home
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
