// Thin helpers for the admin console, reusing the same api client but with admin-scoped storage keys.
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/+$/, "");

export function setAdminToken(token: string) {
  localStorage.setItem("adminAccessToken", token);
}
export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("adminAccessToken") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("token")
  );
}
export function clearAdminToken() {
  localStorage.removeItem("adminAccessToken");
  localStorage.removeItem("adminUser");
}

async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  const token = getAdminToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    const message = typeof data === "object" && data?.message ? data.message : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export const adminApi = {
  get: <T>(path: string) => adminRequest<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) => adminRequest<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) => adminRequest<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) => adminRequest<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T>(path: string) => adminRequest<T>(path, { method: "DELETE" }),
};
