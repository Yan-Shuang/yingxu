let csrfPending: Promise<void> | null = null;
function cookieToken() {
  if (typeof document === "undefined") return "";
  return (
    document.cookie
      .split("; ")
      .find((v) => v.startsWith("yx_csrf="))
      ?.slice(8) || ""
  );
}
export async function apiFetch(
  input: RequestInfo | URL,
  options: RequestInit = {},
): Promise<Response> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    if (!cookieToken()) {
      csrfPending ||= fetch("/api/auth/me", {
        credentials: "same-origin",
        cache: "no-store",
      })
        .then(() => undefined)
        .finally(() => {
          csrfPending = null;
        });
      await csrfPending;
    }
    headers.set("X-CSRF-Token", decodeURIComponent(cookieToken()));
  }
  return fetch(input, {
    ...options,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
}
export async function apiJson<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await apiFetch(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload.detail === "string"
        ? payload.detail
        : response.status === 422
          ? "请检查填写内容，密码至少需要 12 个字符"
          : "操作失败，请稍后重试",
    );
  }
  return payload as T;
}
export function jsonBody(method: string, values: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  };
}
