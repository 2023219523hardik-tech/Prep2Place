const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/+$/, "");

export class ApiError extends Error {
  status: number;
  data?: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken") || localStorage.getItem("adminAccessToken");
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("refreshToken", refreshToken);
}

export function clearTokens() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
}

export function getStoredUser(): any | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}

export function setStoredUser(user: any) {
  localStorage.setItem("user", JSON.stringify(user));
}

let isRefreshing = false;

export function redirectToLogin(returnUrl?: string) {
  if (typeof window === "undefined") return;
  clearTokens();
  const currentPath = window.location.pathname;
  if (currentPath.startsWith("/login") || currentPath.startsWith("/register")) return;

  const isCompanyAdmin = currentPath.includes("/company/") && currentPath.includes("/admin");
  if (isCompanyAdmin) {
    const slugMatch = currentPath.match(/\/company\/([^/]+)/);
    const slug = slugMatch ? slugMatch[1] : "";
    window.location.href = slug ? `/company/${slug}/admin/login?expired=true` : "/login?expired=true";
    return;
  }

  const query = returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}&expired=true` : "?expired=true";
  window.location.href = `/login${query}`;
}

async function request<T>(path: string, options: RequestInit = {}, skipAuth = false): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  if (!skipAuth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (res.status === 204) return undefined as unknown as T;

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    const message = typeof data === "object" && data?.message ? data.message : `Request failed (${res.status})`;
    const isAuthError =
      res.status === 401 ||
      (res.status === 403 && typeof message === "string" && message.toLowerCase().includes("authentication"));

    if (isAuthError && !skipAuth && !path.includes("/api/auth/")) {
      const refreshToken = typeof window !== "undefined" ? localStorage.getItem("refreshToken") : null;
      if (refreshToken && !isRefreshing) {
        isRefreshing = true;
        try {
          const refreshRes = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          });
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            if (refreshData?.accessToken) {
              setTokens(refreshData.accessToken, refreshData.refreshToken || refreshToken);
              isRefreshing = false;
              return request<T>(path, options, false);
            }
          }
        } catch {
          // Token refresh failed, continue to redirect
        } finally {
          isRefreshing = false;
        }
      }

      // Session expired & refresh not possible: clear and redirect to login
      redirectToLogin(typeof window !== "undefined" ? window.location.pathname : undefined);
    }

    throw new ApiError(message, res.status, data);
  }

  return data as T;
}

/** Fetches a binary resource (e.g. access-controlled violation evidence images) with the same
 *  bearer-token auth as the rest of the client. An <img src> can't carry an Authorization
 *  header, so evidence thumbnails must go through this and be rendered via an object URL. */
async function getBlob(path: string): Promise<Blob> {
  const token = getToken();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_BASE_URL}${path}`, { headers });
  if (!res.ok) throw new ApiError(`Failed to load evidence (${res.status})`, res.status);
  return res.blob();
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown, skipAuth = false) =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }, skipAuth),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  postForm: <T>(path: string, form: FormData) => request<T>(path, { method: "POST", body: form }),
  getBlob,
};

export default API_BASE_URL;
