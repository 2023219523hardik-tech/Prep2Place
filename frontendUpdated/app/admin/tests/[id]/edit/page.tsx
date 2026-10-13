"use client";

import { useParams } from "next/navigation";
import TestBuilder from "@/components/admin/TestBuilder";

export default function EditTestPage() {
  const params = useParams();
  const id = Number(params?.id);
  if (!id) return null;
  return <TestBuilder testId={id} />;
}
