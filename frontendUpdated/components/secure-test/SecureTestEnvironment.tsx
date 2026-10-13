"use client";

import { ReactNode, useState } from "react";
import MockTestGuard, { MockTestPolicy } from "@/components/MockTestGuard";
import SystemCheck from "@/components/secure-test/SystemCheck";

interface SecureTestEnvironmentProps {
  attemptId: string | number;
  profile: MockTestPolicy;
  children: ReactNode;
  title?: string;
}

export default function SecureTestEnvironment({
  attemptId,
  profile,
  children,
  title = "Secure Test Environment",
}: SecureTestEnvironmentProps) {
  const [screeningStarted, setScreeningStarted] = useState(false);

  if (!screeningStarted) {
    return <SystemCheck profile={profile} title={title} onStart={() => setScreeningStarted(true)} />;
  }

  return <MockTestGuard attemptId={attemptId} profile={profile}>{children}</MockTestGuard>;
}
