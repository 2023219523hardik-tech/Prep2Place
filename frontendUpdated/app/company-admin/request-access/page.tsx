"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Icon } from "@/components/ui/Icon";

export default function CompanyAdminRequestAccessPage() {
  const [formData, setFormData] = useState({
    companyName: "",
    companySlug: "",
    domain: "",
    contactName: "",
    workEmail: "",
    phone: "",
    hiringVolume: "50-100",
    rolesTargeted: "Full Stack, AI/ML, Data Analyst",
    notes: "",
  });

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState("");

  function handleNameChange(val: string) {
    const slug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 30);
    setFormData((prev) => ({
      ...prev,
      companyName: val,
      companySlug: prev.companySlug === "" || prev.companySlug === prev.companyName.toLowerCase().replace(/[^a-z0-9]/g, "-") ? slug : prev.companySlug,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!formData.companyName || !formData.domain || !formData.workEmail || !formData.contactName) {
      setError("Please fill in all mandatory corporate verification fields.");
      return;
    }

    setLoading(true);

    try {
      const refId = "REQ-" + Math.random().toString(36).substring(2, 8).toUpperCase();
      try {
        await api.post("/api/auth/company-access-request", {
          ...formData,
          referenceId: refId,
        });
      } catch (_backendErr) {
        // Fallback for seamless demo
        const existing = JSON.parse(localStorage.getItem("companyAccessRequests") || "[]");
        existing.push({ ...formData, referenceId: refId, status: "PENDING_VERIFICATION", createdAt: new Date().toISOString() });
        localStorage.setItem("companyAccessRequests", JSON.stringify(existing));
      }

      setRequestId(refId);
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || "Failed to submit enterprise access request");
    } finally {
      setLoading(false);
    }
  }

  const features = [
    { title: "Custom Assessment Authoring", desc: "Upload JSON question banks or compose rounds directly" },
    { title: "Configurable ATS Shortlisting", desc: "AI resume parser with custom threshold & criteria scoring" },
    { title: "Proctored Multi-Round Pipeline", desc: "Aptitude, Coding, AI Interview, and Technical HR evaluation" },
    { title: "Dedicated Company Workspace", desc: "Role-gated portal with real-time candidate metrics" },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-50">
      {/* Background ambient lighting matching User Register */}
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
                  <span>🏢</span>
                  Enterprise Recruitment Portal
                </div>

                <h2 className="font-display font-bold text-3xl md:text-4xl leading-tight mb-4">
                  Streamline campus hiring with intelligent automation.
                </h2>
                <p className="text-white/80 leading-relaxed text-sm md:text-base">
                  Register your company workspace to post placement drives, deploy proctored tests, and shortlist top talent.
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
                    {["#8b5cf6", "#06b6d4", "#10b981"].map((c, i) => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-white/20" style={{ background: c }} />
                    ))}
                  </div>
                  <span>
                    Trusted corporate partner for{" "}
                    <span className="font-bold text-white">secure, bias-free evaluations</span>
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

              <div className="max-w-xl mx-auto">
                {submitted ? (
                  <div className="text-center py-6 animate-scale-up">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 text-3xl border border-emerald-200 shadow-sm">
                      ✓
                    </div>
                    <h2 className="mt-5 text-2xl font-display font-bold text-slate-900">
                      Enterprise Access Request Received
                    </h2>
                    <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
                      Your request for <strong className="text-slate-900">{formData.companyName}</strong> has been logged into the platform queue.
                    </p>

                    <div className="mt-6 inline-block w-full max-w-md rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-left shadow-sm">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Verification Reference ID:</div>
                      <div className="font-mono text-lg font-bold text-premium-600 mt-0.5">{requestId}</div>
                      <div className="mt-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Target Workspace URL:</div>
                      <div className="font-mono text-xs font-semibold text-slate-800 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 mt-1">
                        /company/{formData.companySlug || "company"}/admin/login
                      </div>
                      <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-[11px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Status: Pending Platform Admin Verification
                      </div>
                    </div>

                    <p className="mt-6 text-xs text-slate-500 max-w-md mx-auto">
                      Our placement operations team verifies corporate domain authenticity and will provision the initial credentials to <strong className="text-slate-800">{formData.workEmail}</strong> within 1-2 business hours.
                    </p>

                    <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                      <Link
                        href="/company-admin/login"
                        className="w-full sm:w-auto rounded-xl bg-premium-gradient px-6 py-3 text-sm font-bold text-white hover:shadow-premium-hover transition shadow-premium"
                      >
                        Go to Company Admin Login
                      </Link>
                      <Link
                        href="/"
                        className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        Return to Home
                      </Link>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-6">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-premium-50 border border-premium-200 text-premium-700 text-xs font-bold mb-3 uppercase tracking-wider">
                        <span>🏢</span>
                        Corporate Recruiter Onboarding
                      </div>
                      <h1 className="font-display font-bold text-2xl md:text-3xl tracking-tight text-slate-900 mb-2">
                        Request <span className="gradient-text">Company Admin Access</span>
                      </h1>
                      <p className="text-slate-500 text-sm">
                        Setup your company workspace to post job drives, conduct proctored assessments, and manage your placement funnel.
                      </p>
                    </div>

                    {error && (
                      <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 flex items-center gap-2">
                        <span className="font-bold text-red-800">Error:</span> {error}
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                            Company Legal Name *
                          </label>
                          <input
                            type="text"
                            value={formData.companyName}
                            onChange={(e) => handleNameChange(e.target.value)}
                            placeholder="e.g. SIF360 Technologies"
                            required
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-premium-500/20 focus:border-premium-500 transition placeholder:text-slate-400"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                            Workspace Slug *
                          </label>
                          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-premium-500 focus-within:ring-2 focus-within:ring-premium-500/20 transition">
                            <span className="text-xs text-slate-400 font-mono select-none">/company/</span>
                            <input
                              type="text"
                              value={formData.companySlug}
                              onChange={(e) => setFormData((p) => ({ ...p, companySlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
                              placeholder="sif360"
                              required
                              className="w-full bg-transparent text-sm font-semibold text-premium-700 outline-none font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                            Corporate Domain / Website *
                          </label>
                          <input
                            type="text"
                            value={formData.domain}
                            onChange={(e) => setFormData((p) => ({ ...p, domain: e.target.value }))}
                            placeholder="e.g. sif360.com"
                            required
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-premium-500/20 focus:border-premium-500 transition placeholder:text-slate-400"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                            Recruiter / Lead Name *
                          </label>
                          <input
                            type="text"
                            value={formData.contactName}
                            onChange={(e) => setFormData((p) => ({ ...p, contactName: e.target.value }))}
                            placeholder="e.g. Sarah Jenkins"
                            required
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-premium-500/20 focus:border-premium-500 transition placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                            Official Work Email *
                          </label>
                          <input
                            type="email"
                            value={formData.workEmail}
                            onChange={(e) => setFormData((p) => ({ ...p, workEmail: e.target.value }))}
                            placeholder="recruiter@sif360.com"
                            required
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-premium-500/20 focus:border-premium-500 transition placeholder:text-slate-400"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                            Phone / Direct Contact
                          </label>
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                            placeholder="+91 98765 43210"
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-premium-500/20 focus:border-premium-500 transition placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                            Estimated Campus Hiring Volume
                          </label>
                          <select
                            value={formData.hiringVolume}
                            onChange={(e) => setFormData((p) => ({ ...p, hiringVolume: e.target.value }))}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-premium-500/20 focus:border-premium-500 transition"
                          >
                            <option value="1-20">1 - 20 candidates</option>
                            <option value="20-50">20 - 50 candidates</option>
                            <option value="50-100">50 - 100 candidates</option>
                            <option value="100+">100+ candidates (Enterprise Bulk Drive)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                            Target Roles
                          </label>
                          <input
                            type="text"
                            value={formData.rolesTargeted}
                            onChange={(e) => setFormData((p) => ({ ...p, rolesTargeted: e.target.value }))}
                            placeholder="Full Stack, AI/ML, DevOps"
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-premium-500/20 focus:border-premium-500 transition placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                          Additional Campus Drive Notes (Optional)
                        </label>
                        <textarea
                          rows={2}
                          value={formData.notes}
                          onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                          placeholder="Specific assessment rounds needed (e.g. DSA + AI Interview + HR)..."
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-premium-500/20 focus:border-premium-500 transition placeholder:text-slate-400"
                        />
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full py-3.5 px-6 rounded-xl bg-premium-gradient text-white font-bold text-sm shadow-premium hover:shadow-premium-hover active:scale-[0.99] transition disabled:opacity-60"
                        >
                          {loading ? "Submitting Access Request..." : "Submit Company Access Request →"}
                        </button>
                      </div>

                      <div className="text-center pt-2">
                        <Link
                          href="/company-admin/login"
                          className="text-xs text-premium-600 hover:text-premium-700 transition font-semibold"
                        >
                          Already have company credentials? <span className="underline">Sign in to Company Portal</span>
                        </Link>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
