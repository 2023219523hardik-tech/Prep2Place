"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

/**
 * Section 4 - mandatory profile gate (UX half; StudentProfileService.requireCompleteProfile on
 * the backend is the actual enforcement - see AssessmentEngineService.startOrResume and
 * InterviewService.startInterview). Renders nothing; it only ever redirects.
 *
 * Routes reachable even with an incomplete profile: the profile page itself (where this sends
 * you), auth pages, and the public landing page. Admins are never gated - this only applies to
 * the STUDENT role.
 */
const ALLOWED_WHILE_INCOMPLETE = ["/profile", "/login", "/register", "/"];

export default function ProfileCompletionGuard() {
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || !user || user.role !== "STUDENT") return;
    if (ALLOWED_WHILE_INCOMPLETE.includes(pathname ?? "")) return;
    let cancelled = false;
    api
      .get<{ profileComplete: boolean }>("/api/students/profile")
      .then((p) => {
        if (!cancelled && !p.profileComplete) {
          router.replace("/profile?onboarding=true");
        }
      })
      .catch(() => {
        // A failed check should never itself lock a student out of the app - fail open here,
        // the real enforcement is server-side on the actual start-session endpoints regardless.
      });
    return () => {
      cancelled = true;
    };
    // Re-run on every navigation (not just once on login) so leaving /profile before finishing
    // it - e.g. via the browser back button - sends the student straight back.
  }, [user, authLoading, pathname, router]);

  return null;
}
