import hmac
import json
import re
from http.cookies import SimpleCookie

from fastapi import HTTPException
from starlette.responses import JSONResponse

from product.accounts import (
    CSRF_COOKIE,
    SESSION_COOKIE,
    current_user,
    find_session,
    require_owner,
    validate_body_refs,
)


class ProductBoundary:
    """One request boundary covers legacy routes, streams and protected files."""

    def __init__(self, app, origins):
        self.app, self.origins = app, set(origins)

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        path, method = scope["path"], scope["method"]
        headers = dict(scope["headers"])
        cookie = SimpleCookie()
        try:
            cookie.load(headers.get(b"cookie", b"").decode())
        except Exception:
            pass
        token = cookie[SESSION_COOKIE].value if SESSION_COOKIE in cookie else ""
        account = find_session(token)
        reset = current_user.set(account)
        try:
            private = path.startswith(("/api/", "/code/")) and path not in {
                "/api/health",
                "/api/auth/me",
                "/api/auth/register",
                "/api/auth/login",
            }
            if method != "OPTIONS" and private and not account:
                raise HTTPException(401, "请先登录")
            if method not in {"GET", "HEAD", "OPTIONS"} and path.startswith("/api/"):
                origin = headers.get(b"origin", b"").decode().rstrip("/")
                if origin not in self.origins:
                    raise HTTPException(403, "请求来源无效")
                submitted = headers.get(b"x-csrf-token", b"").decode()
                expected = (
                    account["csrf"]
                    if account
                    else (cookie[CSRF_COOKIE].value if CSRF_COOKIE in cookie else "")
                )
                if not expected or not submitted or not hmac.compare_digest(expected, submitted):
                    raise HTTPException(403, "安全验证已过期，请刷新页面重试")
            if account:
                for pattern, kind in (
                    (r"^/api/project/([^/]+)(?:/|$)", "project"),
                    (r"^/api/sessions/([^/]+)$", "project"),
                    (r"^/api/tasks/([^/]+)(?:/|$)", "task"),
                    (r"^/api/sandbox/history/([^/]+)$", "sandbox"),
                ):
                    match = re.match(pattern, path)
                    if match and match[1] != "start":
                        require_owner(kind, match[1])
                if (path == "/api/config" and method == "PUT") or (
                    path == "/api/sessions" and method == "DELETE"
                ):
                    if account["role"] != "admin":
                        raise HTTPException(403, "需要管理员权限")
            received_bytes = 0
            max_body = (
                (
                    502
                    if path == "/api/upload_media"
                    else 27
                    if path.endswith("/upload_image")
                    else 22
                    if path == "/api/upload_file"
                    else 2
                )
                * 1024
                * 1024
            )

            async def limited_receive():
                nonlocal received_bytes
                message = await receive()
                if message["type"] == "http.request":
                    received_bytes += len(message.get("body", b""))
                    if received_bytes > max_body:
                        raise HTTPException(413, "上传或请求内容过大")
                return message

            replay = limited_receive
            if (
                account
                and method in {"POST", "PUT", "PATCH"}
                and b"application/json" in headers.get(b"content-type", b"")
                and not path.startswith("/api/auth/")
                and path != "/api/config"
            ):
                body = b""
                while True:
                    message = await limited_receive()
                    if message["type"] == "http.disconnect":
                        return
                    body += message.get("body", b"")
                    if len(body) > 2 * 1024 * 1024:
                        raise HTTPException(413, "请求内容过大")
                    if not message.get("more_body", False):
                        break
                try:
                    validate_body_refs(json.loads(body or b"{}"))
                except json.JSONDecodeError:
                    raise HTTPException(400, "请求格式无效")
                consumed = False

                async def replay():
                    nonlocal consumed
                    if not consumed:
                        consumed = True
                        return {"type": "http.request", "body": body, "more_body": False}
                    return await receive()

            async def secure_send(message):
                if message["type"] == "http.response.start":
                    message["headers"] += [
                        (b"x-content-type-options", b"nosniff"),
                        (b"referrer-policy", b"same-origin"),
                    ]
                    if private or path.startswith("/api/auth/"):
                        message["headers"].append((b"cache-control", b"no-store"))
                await send(message)

            await self.app(scope, replay, secure_send)
        except HTTPException as exc:
            await JSONResponse(
                {"detail": exc.detail},
                status_code=exc.status_code,
                headers={"Cache-Control": "no-store"},
            )(scope, receive, send)
        finally:
            current_user.reset(reset)
