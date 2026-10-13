"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [portalModalOpen, setPortalModalOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="w-8 h-8 border-2 border-premium-500 border-t-transparent rounded-full animate-spin" />
          Loading Prep2Place...
        </div>
      </div>
    );
  }

  if (user) {
    // If user is logged in, the dashboard is their personal dashboard.
    router.replace("/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-premium-100/40 blur-3xl rounded-full -z-0 opacity-70" />

      {/* ========== Navbar ========== */}
      <header
        className={`sticky top-0 z-40 transition-all ${
          scrolled
            ? "bg-white/80 backdrop-blur-xl border-b border-slate-200 shadow-sm"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon-64.png" alt="Prep2Place" className="w-9 h-9 rounded-xl" />
            <span className="font-display font-bold text-xl tracking-tight">
              Prep<span className="text-teal-500">2</span>Place
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-premium-700 transition-colors">Features</a>
            <a href="#proctoring" className="hover:text-premium-700 transition-colors">Proctoring</a>
            <a href="#interview" className="hover:text-premium-700 transition-colors">AI Interview</a>
            <a href="#pricing" className="hover:text-premium-700 transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setPortalModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-sm transition"
            >
              <span>🔑</span>
              <span>Portals</span>
            </button>
            <Link href="/signin" className="btn-ghost hidden sm:inline-flex text-xs font-semibold">Sign in</Link>
            <Link href="/signup" className="btn-primary !py-2 !px-4 text-xs font-semibold">
              Get started free
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      {/* ========== Hero ========== */}
      <section className="relative pt-20 pb-28 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 animate-slide-up">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-premium-50 border border-premium-200 text-premium-700 text-xs font-semibold mb-6">
              <span className="w-2 h-2 rounded-full bg-premium-500 animate-pulse" />
              AI-powered Placement Readiness Platform
            </div>

            <h1 className="font-display font-bold text-5xl md:text-6xl lg:text-7xl tracking-tight leading-[1.05] mb-6">
              Ace your placements with{" "}
              <span className="gradient-text">AI coaching</span>{" "}
              you can trust.
            </h1>

            <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-2xl mb-8">
              Full-stack placement preparation: TUF coding sheets, GFG & IndiaBix aptitude,
              proctored mock interviews with posture and filler-word analysis, and a
              live AI interview agent that listens, responds, and adapts difficulty in real time.
            </p>

            <div className="flex flex-wrap gap-4 mb-10">
              <Link href="/register" className="btn-primary !py-3 !px-6 text-base">
                Start practicing free
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <a href="#features" className="btn-secondary !py-3 !px-6 text-base">
                Explore features
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-premium-50 border border-premium-200 text-premium-700 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-premium-500" /> Coding + aptitude + AI interview
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-50 border border-accent-200 text-accent-700 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-500" /> Proctored mock assessments
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500" /> Evidence-based reports
              </span>
            </div>

            {/* 3-Role Dedicated Enterprise Portal Selector */}
            <div className="mt-8 pt-7 border-t border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                  Select Your Access Portal
                </span>
                <button
                  type="button"
                  onClick={() => setPortalModalOpen(true)}
                  className="text-xs font-semibold text-premium-600 hover:text-premium-700 flex items-center gap-1"
                >
                  View Modal Mode ↗
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Student */}
                <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm hover:border-premium-300 hover:shadow-md transition flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🎓</span>
                      <span className="font-bold text-xs text-slate-900">Student Portal</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight mb-3">
                      Practice coding, mock AI interviews & apply to active drives.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs">
                    <Link href="/signin" className="font-bold text-premium-600 hover:text-premium-700">
                      Sign In →
                    </Link>
                    <span className="text-slate-300">|</span>
                    <Link href="/signup" className="text-slate-500 hover:text-slate-800">
                      Register
                    </Link>
                  </div>
                </div>

                {/* 2. Company Recruiter */}
                <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/40 p-3.5 shadow-sm hover:border-indigo-400 hover:shadow-md transition flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🏢</span>
                      <span className="font-bold text-xs text-indigo-950">Company Admin</span>
                    </div>
                    <p className="text-[11px] text-indigo-900/70 leading-tight mb-3">
                      Post jobs, configure pipelines & monitor live proctored tests.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-indigo-100 text-xs">
                    <Link href="/company-admin/login" className="font-bold text-indigo-600 hover:text-indigo-700">
                      Recruiter Login →
                    </Link>
                    <span className="text-indigo-200">|</span>
                    <Link href="/company-admin/request-access" className="text-indigo-700 hover:text-indigo-900">
                      Request
                    </Link>
                  </div>
                </div>

                {/* 3. Platform Admin */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900 text-white p-3.5 shadow-sm hover:border-slate-700 hover:shadow-md transition flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🛡️</span>
                      <span className="font-bold text-xs text-white">Platform Console</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight mb-3">
                      Placement team operations, company approvals & audits.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-800 text-xs">
                    <Link href="/admin/login" className="font-bold text-teal-400 hover:text-teal-300">
                      Admin Console →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Hero visual: stacked floating cards */}
          <div className="lg:col-span-5 relative h-[520px] hidden lg:block">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-[420px] h-[420px] rounded-full bg-premium-gradient opacity-10 blur-3xl" />
            </div>

            {/* Dashboard preview card */}
            <div className="absolute top-6 left-0 w-[340px] float-card glass rounded-2xl p-5 shadow-card border border-white" style={{ animationDelay: "0s" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-premium-gradient" />
                  <div>
                    <div className="text-xs font-semibold">Placement Readiness</div>
                    <div className="text-[10px] text-slate-500">Updated 2 min ago</div>
                  </div>
                </div>
                <div className="text-xs font-bold text-premium-700 bg-premium-50 px-2 py-1 rounded-full">87%</div>
              </div>
              <div className="space-y-2">
                <Bar label="Coding" value={92} color="bg-premium-500" />
                <Bar label="Aptitude" value={78} color="bg-accent-500" />
                <Bar label="Interview" value={84} color="bg-gold-500" />
              </div>
            </div>

            {/* Interview agent card */}
            <div className="absolute bottom-20 right-0 w-[300px] float-card glass rounded-2xl p-5 shadow-card border border-white" style={{ animationDelay: "1.2s" }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-premium-gradient flex items-center justify-center text-white font-bold text-sm ring-pulse">AR</div>
                </div>
                <div>
                  <div className="text-sm font-bold">Arya · AI Interviewer</div>
                  <div className="text-[10px] text-green-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Listening...
                  </div>
                </div>
              </div>
              <div className="agent-bubble text-xs mb-2">
                Great answer! You covered ACID properties well. Let me raise the bar —
                explain the difference between 2PL and MVCC.
              </div>
              <div className="flex gap-1">
                <div className="h-1.5 flex-1 bg-premium-200 rounded-full" />
                <div className="h-1.5 w-1/3 bg-premium-500 rounded-full animate-pulse" />
              </div>
            </div>

            {/* Proctoring alert card */}
            <div className="absolute bottom-0 left-10 w-[260px] float-card glass rounded-2xl p-4 shadow-card border border-white" style={{ animationDelay: "0.6s" }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="text-xs font-bold text-amber-800">Proctoring</div>
              </div>
              <div className="text-[11px] text-slate-600 leading-snug">
                Posture drift detected · 1 tab switch · 3 filler words ("um, ah, uh") flagged.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== Logos strip ========== */}
      <section className="py-8 border-y border-slate-200 bg-white/60 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-slate-400 mb-6">
            Question banks curated from industry favourites
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-slate-400 font-display font-bold text-lg md:text-xl">
            <span className="opacity-80">Take U Forward</span>
            <span className="opacity-70">GeeksforGeeks</span>
            <span className="opacity-60">IndiaBix</span>
            <span className="opacity-70">LeetCode Style</span>
            <span className="opacity-80">HR & Behavioural</span>
          </div>
        </div>
      </section>

      {/* ========== Features ========== */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <div className="inline-block text-xs font-bold uppercase tracking-wider text-premium-700 bg-premium-50 px-3 py-1 rounded-full mb-4">
              Everything you need
            </div>
            <h2 className="font-display font-bold text-4xl md:text-5xl tracking-tight mb-4">
              One platform. <span className="gradient-text">Complete prep.</span>
            </h2>
            <p className="text-slate-600 text-lg leading-relaxed">
              From your first coding problem to your final HR round — Prep2Place coaches you
              end to end with real-time analysis, adaptive difficulty, and honest reporting.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon="🧠"
              title="Adaptive Coding Practice"
              desc="TUF Striver-style sheets and 1000+ DSA problems ranging from Arrays & Hashing to Graphs & DP. Answer correctly and the system raises the bar automatically."
              accent="from-premium-500 to-indigo-600"
            />
            <FeatureCard
              icon="🧮"
              title="Aptitude Mastery"
              desc="Quant, logical reasoning, and verbal ability questions curated from GFG Aptitude, IndiaBix, and top placement papers. Instant explanations."
              accent="from-accent-500 to-cyan-600"
            />
            <FeatureCard
              icon="🎯"
              title="Skill Gap Analysis"
              desc="Pinpoint weak areas before companies do. Personalised roadmap with micro-steps, recommended resources, and weekly progress nudges."
              accent="from-gold-500 to-orange-500"
            />
            <FeatureCard
              icon="📊"
              title="Placement Readiness Score"
              desc="A single live score combining coding, aptitude, interview, confidence, and communication signals. Watch it climb with every session."
              accent="from-pink-500 to-rose-600"
            />
            <FeatureCard
              icon="📝"
              title="Progress Tracking"
              desc="Initial progress starts at zero. Every submission, answer, and interview is tracked with a clean timeline and shareable reports."
              accent="from-emerald-500 to-teal-600"
            />
            <FeatureCard
              icon="👥"
              title="Admin & Faculty View"
              desc="Co-ordinators can create roles, bulk-upload questions, configure scoring weights, and flag integrity-violating sessions for review."
              accent="from-slate-700 to-ink-800"
            />
          </div>
        </div>
      </section>

      {/* ========== Proctoring deep dive ========== */}
      <section id="proctoring" className="py-24 px-6 bg-gradient-to-b from-white to-premium-50/60">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-block text-xs font-bold uppercase tracking-wider text-premium-700 bg-premium-50 px-3 py-1 rounded-full mb-4">
              Enterprise-grade proctoring
            </div>
            <h2 className="font-display font-bold text-4xl md:text-5xl tracking-tight mb-6 leading-tight">
              Proctored sessions that <span className="gradient-text">see everything.</span>
            </h2>
            <p className="text-slate-600 text-lg mb-8 leading-relaxed">
              Every interview session runs in lockdown with fullscreen enforcement, camera,
              screen share, and microphone capture. Cheating signals are logged, timestamped,
              and attached as frame evidence in your final report.
            </p>

            <ul className="space-y-4">
              <Check label="Filler-word detection" detail="Counts 'a, aa, um, like, you know' to track communication fluency & language proficiency." />
              <Check label="Posture & movement analysis" detail="Monitors slouching, head drift, and frequent movement via webcam frames." />
              <Check label="Context matching with questions" detail="Checks whether the spoken/typed answer actually maps to the question asked." />
              <Check label="Tab switch & window blur capture" detail="Every exit, return, and duration away from the tab is logged with a captured frame." />
              <Check label="Full-screen + copy/paste guard" detail="Right-click, copy/paste, devtools shortcuts, and fullscreen exits are blocked and logged." />
              <Check label="Evidence frames in report" detail="Suspicious events attach a thumbnail of the captured frame for admin review." />
            </ul>
          </div>

          {/* Proctoring dashboard preview */}
          <div className="relative">
            <div className="absolute -inset-6 bg-premium-gradient opacity-5 rounded-[2rem] blur-2xl" />
            <div className="relative card-dark overflow-hidden">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                </div>
                <div className="text-xs font-semibold text-white/60">Session #4829 · Live proctoring</div>
                <div className="chip !border-white/20 !text-white/80 !bg-white/5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> REC
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                <MiniStat label="Integrity" value={62} color="text-red-400" />
                <MiniStat label="Tab switches" value={3} color="text-amber-300" />
                <MiniStat label="Filler words" value={12} color="text-premium-300" />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <MiniStat label="Movement events" value={7} color="text-accent-300" />
                <MiniStat label="Posture flags" value={2} color="text-gold-400" />
              </div>

              <div className="space-y-2 text-xs">
                <EventRow time="14:02:11" text="Filler word pattern: 'a… aa… um' × 3 in one answer" tone="warn" />
                <EventRow time="14:05:47" text="Tab switch detected — 4.2s away. Frame captured." tone="bad" />
                <EventRow time="14:08:33" text="Posture drift: head below baseline for 1.8s" tone="warn" />
                <EventRow time="14:11:02" text="Multiple faces detected in frame. Frame captured." tone="bad" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== AI Interview Agent ========== */}
      <section id="interview" className="py-24 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-16 items-center">
          <div className="lg:col-span-5 order-2 lg:order-1">
            <div className="relative card overflow-hidden bg-gradient-to-br from-white to-premium-50/40">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-2xl bg-premium-gradient flex items-center justify-center text-white font-display font-bold text-lg ring-pulse">A</div>
                  </div>
                  <div>
                    <div className="font-bold">Arya</div>
                    <div className="text-xs text-slate-500">AI Interviewer · Backend Role</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs text-green-700 font-semibold">Live</span>
                </div>
              </div>

              <div className="space-y-3 mb-5 max-h-80">
                <div className="agent-bubble text-sm">
                  Hi Aarav! Thanks for joining today. I&apos;m Arya, and I&apos;ll be your
                  interviewer for this Backend Developer mock. Let&apos;s start with a quick
                  warm-up. Tell me about yourself and your favourite project so far.
                </div>
                <div className="flex justify-end">
                  <div className="user-bubble text-sm max-w-[80%]">
                    Hey Arya! I&apos;m a final-year CSE student, and my favourite project was
                    building a placement tracker with Spring Boot and React —
                    it had JWT auth, real-time charts and...
                  </div>
                </div>
                <div className="agent-bubble text-sm">
                  Nice! Sounds like you used a solid stack. Follow-up — your weighted score on
                  that answer was 82/100, great clarity. Let&apos;s take it up a level.
                  Design a URL shortener that can handle 10,000 writes/sec with 99.99% uptime.
                </div>
              </div>

              {/* Waveform */}
              <div className="flex items-end gap-1 h-10 mb-3 px-2">
                {[12, 24, 18, 30, 22, 36, 28, 40, 32, 24, 18, 28, 22, 34, 26, 40, 30, 20, 14, 22, 28, 18, 12, 20, 26, 16, 10].map((h, i) => (
                  <div
                    key={i}
                    className="w-1 bg-premium-gradient rounded-full animate-pulse"
                    style={{ height: `${h}px`, animationDelay: `${i * 40}ms` }}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button className="flex-1 btn-secondary !py-2.5 text-sm !rounded-full">
                  🎤 Voice input
                </button>
                <button className="btn-primary !py-2.5 !px-5 text-sm !rounded-full">
                  Send
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 order-1 lg:order-2">
            <div className="inline-block text-xs font-bold uppercase tracking-wider text-accent-700 bg-accent-50 px-3 py-1 rounded-full mb-4">
              Meet Arya — your live AI interviewer
            </div>
            <h2 className="font-display font-bold text-4xl md:text-5xl tracking-tight mb-6 leading-tight">
              A live agent that{" "}
              <span className="gradient-text">asks, listens, responds.</span>
            </h2>
            <p className="text-slate-600 text-lg mb-8 leading-relaxed">
              Arya isn&apos;t a simple question list — she&apos;s a conversational agent that
              greets you, poses a question, listens to your spoken answer, evaluates it on the
              fly, gives contextual feedback, and raises the difficulty level when you nail it.
            </p>

            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              <AgentPerk title="Speech-first interaction" body="Speak your answers naturally. Arya transcribes, scores, and replies with voice and text." />
              <AgentPerk title="Adaptive difficulty" body="Nail an EASY → next question bumps to MEDIUM. Crush that → HARD-level follow-ups." />
              <AgentPerk title="Real-time feedback" body="Each answer gets a per-dimension score (correctness, clarity, depth, structure, grammar) plus personalised coaching." />
              <AgentPerk title="Role-aware questions" body="Pick Backend, Frontend, Data Analyst or a custom role — Arya sticks to the relevant question pool." />
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/register" className="btn-primary !py-3 !px-6">
                Try Arya free
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <a href="#pricing" className="btn-secondary !py-3 !px-6">See pricing</a>
            </div>
          </div>
        </div>
      </section>

      {/* ========== Pricing ========== */}
      <section id="pricing" className="py-24 px-6 bg-gradient-to-b from-premium-50/60 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <div className="inline-block text-xs font-bold uppercase tracking-wider text-premium-700 bg-premium-50 px-3 py-1 rounded-full mb-4">
              Simple pricing
            </div>
            <h2 className="font-display font-bold text-4xl md:text-5xl tracking-tight mb-4">
              Start free. <span className="gradient-text">Upgrade when ready.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <PricingCard
              name="Starter"
              price="₹0"
              period="forever"
              highlight={false}
              features={[
                "50 coding problems (TUF easy + medium)",
                "80 aptitude questions (GFG + IndiaBix)",
                "3 AI mock interviews per month",
                "Standard proctoring (tab-switch + face count)",
                "Progress dashboard (starts at 0%)",
              ]}
              cta="Start free"
              href="/register"
            />
            <PricingCard
              name="Pro"
              price="₹499"
              period="/ month"
              highlight={true}
              features={[
                "Full TUF sheet access (1500+ DSA problems)",
                "1800+ aptitude questions, all topics",
                "Unlimited AI mock interviews",
                "Advanced proctoring: posture, fillers, screen share, frame captures",
                "Adaptive difficulty engine (live scaling)",
                "Full report downloads with evidence frames",
                "Priority support",
              ]}
              cta="Go Pro"
              href="/register"
            />
            <PricingCard
              name="College / Batch"
              price="Custom"
              period="pricing"
              highlight={false}
              features={[
                "Everything in Pro, for 50+ students",
                "Admin panel with faculty roles",
                "Bulk question upload & custom job roles",
                "Integrity review queue for flagged sessions",
                "Placement statistics & cohort analytics",
                "SSO / custom subdomain available",
              ]}
              cta="Talk to us"
              href="/register"
            />
          </div>
        </div>
      </section>

      {/* ========== CTA ========== */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto relative">
          <div className="absolute inset-0 bg-premium-gradient rounded-3xl opacity-90" />
          <div className="absolute inset-0 rounded-3xl shadow-premium" />
          <div className="relative rounded-3xl px-8 md:px-16 py-16 text-center text-white">
            <h2 className="font-display font-bold text-4xl md:text-5xl tracking-tight mb-5">
              Your placement journey starts today.
            </h2>
            <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
              Create an account in under 30 seconds. Progress starts at 0, and the first
              question is free. What are you waiting for?
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link href="/register" className="bg-white text-premium-700 hover:bg-premium-50 font-semibold px-6 py-3 rounded-xl transition-colors inline-flex items-center gap-2 shadow-lg">
                Create free account
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link href="/login" className="border border-white/40 hover:bg-white/10 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
                I already have an account
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ========== Footer ========== */}
      <footer className="border-t border-slate-200 py-12 px-6 bg-white">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-icon-64.png" alt="Prep2Place" className="w-9 h-9 rounded-xl" />
              <span className="font-display font-bold text-xl">
                Prep<span className="text-teal-500">2</span>Place
              </span>
            </div>
            <p className="text-sm text-slate-600 max-w-md leading-relaxed">
              An AI-powered placement readiness platform that combines TUF-style coding
              sheets, GFG/IndiaBix aptitude, proctored mock interviews with posture and
              filler-word analysis, and a live conversational AI interviewer.
            </p>
          </div>
          <div>
            <div className="font-bold mb-4 text-slate-800">Product</div>
            <ul className="space-y-2.5 text-sm text-slate-600">
              <li><a href="#features" className="hover:text-premium-700">Features</a></li>
              <li><a href="#proctoring" className="hover:text-premium-700">Proctoring</a></li>
              <li><a href="#interview" className="hover:text-premium-700">AI Interviewer</a></li>
              <li><a href="#pricing" className="hover:text-premium-700">Pricing</a></li>
            </ul>
          </div>
          <div>
            <div className="font-bold mb-4 text-slate-800">Account</div>
            <ul className="space-y-2.5 text-sm text-slate-600">
              <li><Link href="/login" className="hover:text-premium-700">Sign in</Link></li>
              <li><Link href="/register" className="hover:text-premium-700">Create account</Link></li>
              <li><Link href="/admin/login" className="hover:text-premium-700">Admin login</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>© {new Date().getFullYear()} Prep2Place. All rights reserved.</div>
          <div className="flex gap-5">
            <a className="hover:text-slate-800">Privacy</a>
            <a className="hover:text-slate-800">Terms</a>
            <a className="hover:text-slate-800">Contact</a>
          </div>
        </div>
      </footer>

      {/* 3-Role Dedicated Enterprise Portal Selection Modal */}
      {portalModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in"
          onClick={() => setPortalModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8 shadow-2xl relative animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Close Button */}
            <button
              onClick={() => setPortalModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-800 transition"
              aria-label="Close modal"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="text-center mb-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400 text-xl border border-indigo-500/30 mb-3">
                🔑
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Select Authentication Portal</h2>
              <p className="text-xs text-slate-400 mt-1">
                Choose the dedicated portal matching your verified platform role
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Role 1: Student */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 flex flex-col justify-between hover:border-premium-500/50 hover:bg-slate-950 transition">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-premium-500/20 text-premium-400 text-lg mb-3">
                    🎓
                  </div>
                  <h3 className="text-sm font-bold text-white">Student / Candidate</h3>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    Practice coding, aptitude, proctored AI interviews & apply to active placement drives.
                  </p>
                </div>
                <div className="mt-5 space-y-2">
                  <Link
                    href="/signin"
                    onClick={() => setPortalModalOpen(false)}
                    className="block w-full py-2 text-center rounded-xl bg-premium-600 hover:bg-premium-500 text-white text-xs font-bold transition shadow-sm"
                  >
                    Student Sign In →
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setPortalModalOpen(false)}
                    className="block w-full py-2 text-center rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition"
                  >
                    Register Account
                  </Link>
                </div>
              </div>

              {/* Role 2: Company Recruiter */}
              <div className="rounded-2xl border border-indigo-900/50 bg-indigo-950/30 p-5 flex flex-col justify-between hover:border-indigo-500/60 hover:bg-indigo-950/50 transition">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 text-lg mb-3">
                    🏢
                  </div>
                  <h3 className="text-sm font-bold text-indigo-200">Company Recruiter</h3>
                  <p className="text-[11px] text-indigo-300/70 mt-1.5 leading-relaxed">
                    Publish jobs, configure multi-round pipelines, screen resumes & monitor live proctored tests.
                  </p>
                </div>
                <div className="mt-5 space-y-2">
                  <Link
                    href="/company-admin/login"
                    onClick={() => setPortalModalOpen(false)}
                    className="block w-full py-2 text-center rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm"
                  >
                    Company Login →
                  </Link>
                  <Link
                    href="/company-admin/request-access"
                    onClick={() => setPortalModalOpen(false)}
                    className="block w-full py-2 text-center rounded-xl border border-indigo-800/60 bg-indigo-900/40 hover:bg-indigo-900/70 text-indigo-200 text-xs font-semibold transition"
                  >
                    Request Access
                  </Link>
                </div>
              </div>

              {/* Role 3: Platform Admin */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 flex flex-col justify-between hover:border-teal-500/50 hover:bg-slate-950 transition">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/20 text-teal-400 text-lg mb-3">
                    🛡️
                  </div>
                  <h3 className="text-sm font-bold text-white">Platform Console</h3>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    Placement cell administration, company approvals, audit logs, and question bank seeding.
                  </p>
                </div>
                <div className="mt-5 space-y-2">
                  <Link
                    href="/admin/login"
                    onClick={() => setPortalModalOpen(false)}
                    className="block w-full py-2 text-center rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition shadow-sm"
                  >
                    Admin Console →
                  </Link>
                  <span className="block text-center text-[10px] text-slate-500 py-1 font-mono">
                    Invite / Provision Only
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 mb-1">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, desc, accent }: { icon: string; title: string; desc: string; accent: string }) {
  return (
    <div className="card group hover:-translate-y-1 transition-transform hover:shadow-premium/40">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center text-2xl mb-5 shadow-md`}>
        <span className="drop-shadow">{icon}</span>
      </div>
      <h3 className="font-display font-bold text-xl mb-2 group-hover:text-premium-700 transition-colors">{title}</h3>
      <p className="text-slate-600 leading-relaxed text-sm">{desc}</p>
    </div>
  );
}

function Check({ label, detail }: { label: string; detail: string }) {
  return (
    <li className="flex gap-4">
      <div className="shrink-0 w-7 h-7 rounded-full bg-premium-gradient text-white flex items-center justify-center shadow-sm mt-0.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <div className="font-semibold text-slate-900">{label}</div>
        <div className="text-sm text-slate-600 mt-0.5 leading-relaxed">{detail}</div>
      </div>
    </li>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white/5 rounded-xl border border-white/10 p-3">
      <div className="text-[10px] uppercase tracking-wider text-white/50 mb-1">{label}</div>
      <div className={`font-display font-bold text-2xl ${color}`}>{value}</div>
    </div>
  );
}

function EventRow({ time, text, tone }: { time: string; text: string; tone: "warn" | "bad" | "ok" }) {
  const toneStyles = {
    warn: "bg-amber-500/10 border-amber-500/20 text-amber-200",
    bad: "bg-red-500/10 border-red-500/20 text-red-200",
    ok: "bg-emerald-500/10 border-emerald-500/20 text-emerald-200",
  } as const;
  return (
    <div className={`flex gap-3 items-start rounded-lg border px-3 py-2 ${toneStyles[tone]}`}>
      <span className="shrink-0 font-mono text-[10px] opacity-70 mt-0.5">{time}</span>
      <span className="leading-relaxed">{text}</span>
    </div>
  );
}

function AgentPerk({ title, body }: { title: string; body: string }) {
  return (
    <div className="card !p-5 hover:border-premium-200 transition-colors">
      <div className="font-semibold mb-1.5">{title}</div>
      <div className="text-sm text-slate-600 leading-relaxed">{body}</div>
    </div>
  );
}

function PricingCard({
  name, price, period, highlight, features, cta, href,
}: {
  name: string; price: string; period: string; highlight: boolean;
  features: string[]; cta: string; href: string;
}) {
  return (
    <div
      className={`relative rounded-2xl p-8 flex flex-col transition-all ${
        highlight
          ? "bg-ink-900 text-white shadow-premium -translate-y-2 border border-white/10"
          : "bg-white border border-slate-200 shadow-card hover:shadow-premium/40 hover:-translate-y-1"
      }`}
    >
      {highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-premium-gradient text-white text-xs font-bold shadow-lg">
          MOST POPULAR
        </div>
      )}
      <div className={`text-sm font-semibold mb-2 ${highlight ? "text-premium-300" : "text-premium-700"}`}>{name}</div>
      <div className="flex items-baseline gap-1 mb-6">
        <div className="font-display font-bold text-4xl">{price}</div>
        <div className={`text-sm ${highlight ? "text-white/60" : "text-slate-500"}`}>{period}</div>
      </div>
      <ul className="space-y-3 mb-8 flex-1">
        {features.map((f, i) => (
          <li key={i} className="flex gap-3 items-start text-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={`shrink-0 mt-0.5 ${highlight ? "text-premium-400" : "text-premium-600"}`}>
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className={highlight ? "text-white/85" : "text-slate-700"}>{f}</span>
          </li>
        ))}
      </ul>
      <Link href={href} className={highlight ? "btn-primary w-full" : "btn-secondary w-full"}>
        {cta}
      </Link>
    </div>
  );
}
