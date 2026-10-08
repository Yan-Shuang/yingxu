import { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const HOP_HEADERS = [
  "connection",
  "keep-alive",
  "transfer-encoding",
  "content-length",
  "host",
  "upgrade",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
];
async function proxy(request: NextRequest) {
  const backend = (
    process.env.BACKEND_API_URL || "http://127.0.0.1:8000"
  ).replace(/\/$/, "");
  const headers = new Headers(request.headers);
  for (const name of HOP_HEADERS) headers.delete(name);
  // Avoid compressed upstream streams and preserve the browser Origin and session cookies.
  headers.set("accept-encoding", "identity");
  try {
    const upstream = await fetch(
      `${backend}${request.nextUrl.pathname}${request.nextUrl.search}`,
      {
        method: request.method,
        headers,
        body: ["GET", "HEAD"].includes(request.method)
          ? undefined
          : request.body,
        redirect: "manual",
        cache: "no-store",
        signal: request.signal,
        duplex: "half",
      } as RequestInit & { duplex: "half" },
    );
    const resultHeaders = new Headers(upstream.headers);
    for (const name of HOP_HEADERS) resultHeaders.delete(name);
    resultHeaders.delete("set-cookie");
    for (const cookie of upstream.headers.getSetCookie())
      resultHeaders.append("set-cookie", cookie);
    return new Response(upstream.body, {
      status: upstream.status,
      headers: resultHeaders,
    });
  } catch {
    return Response.json(
      { detail: "暂时无法连接创作服务，请稍后重试" },
      { status: 502 },
    );
  }
}
export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
