const tokenKey = "nrgs_admin_jwt";

export function getToken(): string | null {
  return localStorage.getItem(tokenKey);
}

export function setToken(t: string) {
  localStorage.setItem(tokenKey, t);
}

export function clearToken() {
  localStorage.removeItem(tokenKey);
}

export async function jfetch<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const { auth = true, ...rest } = options;
  const h: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (auth) {
    const t = getToken();
    if (t) h.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(path, { ...rest, headers: { ...h, ...rest.headers } });
  if (res.status === 401) {
    clearToken();
    throw new Error("Session expired. Log in again.");
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j: { detail?: string | { msg: string }[] } = await res.json();
      if (typeof j.detail === "string") msg = j.detail;
      else if (Array.isArray(j.detail)) msg = j.detail.map((x) => x.msg).join(", ");
    } catch {
      /* noop */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type");
  if (ct?.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as T;
}

export function downloadWithAuth(path: string) {
  const t = getToken();
  return fetch(path, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
}
