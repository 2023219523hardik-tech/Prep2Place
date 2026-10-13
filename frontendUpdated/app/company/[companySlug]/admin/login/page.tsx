"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { companyAdminApi } from "@/lib/jobs";
import { setTokens, ApiError } from "@/lib/api";

export default function CompanyAdminLoginPage() {
  const params = useParams();
  const router = useRouter();
  const companySlug = (params.companySlug as string) || "sif360";

  const [email, setEmail] = useState("admin@sif360.com");
  const [password, setPassword] = useState("Admin@123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const companyDisplayName = companySlug.toUpperCase();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await companyAdminApi.login(companySlug, { email, password });
      
      // Store tokens and company user metadata
      setTokens(res.token, res.refreshToken);
      localStorage.setItem("adminAccessToken", res.token);
      localStorage.setItem("companyAdminUser", JSON.stringify(res.user));
      localStorage.setItem("companyAdminCompany", JSON.stringify(res.company));

      router.push(`/company/${companySlug}/admin/dashboard`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Authentication failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        {/* Company Header */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-bold text-2xl shadow-md">
            {companySlug.charAt(0).toUpperCase()}
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            {companyDisplayName} Admin Portal
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Secure hiring pipeline and candidate management portal
          </p>
        </div>

        {/* Security Notice */}
        <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-900 flex items-start gap-2.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-indigo-600 mt-0.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <div>
            <span className="font-bold">Role-Based Access Control: </span>
            Access is restricted to authorized administrators belonging to <strong className="font-semibold">{companyDisplayName}</strong>.
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-start gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-rose-600 mt-0.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              Admin Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@company.com"
              required
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Authenticating Admin..." : "Sign In to Admin Portal"}
          </button>
        </form>

        {/* Demo Credentials Helper */}
        <div className="mt-6 border-t border-slate-100 pt-4 text-center">
          <p className="text-[11px] text-slate-400">
            Demo Credentials for SIF360: <span className="font-mono text-slate-600">admin@sif360.com / Admin@123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
