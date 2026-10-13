"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { testsAdminApi } from "@/lib/managedTests";

/**
 * Drop-in panel for the existing Admin Dashboard. Add it below the current cards:
 *
 *   import TestAnalyticsPanel from "@/components/admin/TestAnalyticsPanel";
 *   ...
 *   <TestAnalyticsPanel />
 *
 * It fetches its own data, so the existing dashboard page needs no other change and its current
 * stat cards are untouched.
 */
export default function TestAnalyticsPanel() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [activity, setActivity] = useState<any>(null);
  const [integrity, setIntegrity] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([testsAdminApi.testAnalytics(), testsAdminApi.testActivity(), testsAdminApi.integrity()])
      .then(([a, act, i]) => { setAnalytics(a); setActivity(act); setIntegrity(i); })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="card text-sm text-red-600">Could not load test analytics: {error}</div>;
  if (!analytics) return <div className="card text-sm text-slate-400">Loading test analytics...</div>;

  const cards = [
    ["Total Tests", analytics.totalTests],
    ["Published", analytics.publishedTests],
    ["Active", analytics.activeTests],
    ["University", analytics.universityTests],
    ["Custom", analytics.customTests],
    ["Technical", analytics.technicalTests],
    ["Total Attempts", analytics.totalAttempts],
    ["Avg Score", `${analytics.averageScore}%`],
    ["Avg Accuracy", `${analytics.averageAccuracy}%`],
    ["Pass Rate", `${analytics.passRate}%`],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-medium text-slate-800 mb-3">Test Analytics</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {cards.map(([label, value]) => (
            <div key={label as string} className="card text-center py-4">
              <div className="text-xl font-semibold text-slate-800">{value as any}</div>
              <div className="text-xs text-slate-500">{label as string}</div>
            </div>
          ))}
        </div>
      </div>

      {activity && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="font-medium text-slate-800 mb-2">Today</h3>
            <p className="text-sm text-slate-600">
              {activity.attemptedToday} attempt{activity.attemptedToday === 1 ? "" : "s"} started ·
              {" "}{activity.completedToday} completed
            </p>
            <h4 className="text-sm font-medium text-slate-700 mt-4 mb-1">Recent submissions</h4>
            <ul className="text-sm text-slate-600 space-y-1">
              {(activity.recentSubmissions || []).slice(0, 6).map((s: any) => (
                <li key={s.attemptId} className="flex justify-between">
                  <span>{s.studentName} — {s.testName}</span>
                  <span className={s.passed ? "text-teal-700" : "text-red-600"}>{s.percentage}%</span>
                </li>
              ))}
              {(activity.recentSubmissions || []).length === 0 && <li className="text-slate-400">No submissions yet.</li>}
            </ul>
          </div>

          <div className="card">
            <h3 className="font-medium text-slate-800 mb-2">Most attempted</h3>
            <ul className="text-sm text-slate-600 space-y-1">
              {(activity.mostAttempted || []).map((t: any) => (
                <li key={t.testId} className="flex justify-between">
                  <Link href={`/admin/tests/${t.testId}/attempts`} className="hover:underline">{t.testName}</Link>
                  <span>{t.attempts} · {Math.round(t.averagePercentage)}%</span>
                </li>
              ))}
              {(activity.mostAttempted || []).length === 0 && <li className="text-slate-400">No data yet.</li>}
            </ul>
            <h3 className="font-medium text-slate-800 mt-4 mb-2">Lowest performing</h3>
            <ul className="text-sm text-slate-600 space-y-1">
              {(activity.lowestPerforming || []).map((t: any) => (
                <li key={t.testId} className="flex justify-between">
                  <Link href={`/admin/tests/${t.testId}/attempts`} className="hover:underline">{t.testName}</Link>
                  <span className="text-amber-700">{Math.round(t.averagePercentage)}%</span>
                </li>
              ))}
              {(activity.lowestPerforming || []).length === 0 && <li className="text-slate-400">No data yet.</li>}
            </ul>
          </div>
        </div>
      )}

      {integrity && (
        <div className="card">
          <h3 className="font-medium text-slate-800 mb-2">Integrity</h3>
          <p className="text-sm text-slate-600">
            {integrity.totalViolations} recorded event{integrity.totalViolations === 1 ? "" : "s"} ·
            {" "}{integrity.studentsRequiringReview} attempt(s) worth reviewing ·
            {" "}average integrity score {integrity.averageIntegrityScore}
          </p>
          <ul className="text-sm text-slate-600 mt-2 space-y-1 max-h-48 overflow-y-auto">
            {(integrity.recentViolations || []).map((v: any) => (
              <li key={v.eventId} className="flex justify-between">
                <span>{v.studentName} — {v.eventType}</span>
                <span className="text-xs text-slate-400">{new Date(v.occurredAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500 mt-2">
            Events are signals for review, not conclusions about a student.
          </p>
        </div>
      )}
    </div>
  );
}
