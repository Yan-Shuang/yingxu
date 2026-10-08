import re
import secrets
import sqlite3
import time
import uuid

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from product import accounts as a

router = APIRouter(prefix="/api/auth", tags=["Accounts"])


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=12, max_length=128)
    name: str = Field(default="", max_length=40)


class Profile(BaseModel):
    name: str = Field(min_length=1, max_length=40)


def email_value(value):
    email = value.strip().lower()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise HTTPException(422, "请输入有效的邮箱地址")
    return email


@router.get("/me")
async def me(request: Request, response: Response):
    account = a.current_user.get()
    csrf = account["csrf"] if account else secrets.token_urlsafe(32)
    response.set_cookie(
        a.CSRF_COOKIE, csrf, httponly=False, max_age=a.SESSION_TTL, **a.cookie_options()
    )
    return {"user": a.public_user(account) if account else None, "csrf_token": csrf}


@router.post("/register", status_code=201)
async def register(req: Credentials, request: Request, response: Response):
    ip = request.client.host if request.client else "unknown"
    a.rate_limit("register:" + ip, 60, 3600)
    email = email_value(req.email)
    name = req.name.strip() or email.split("@")[0]
    account_id = uuid.uuid4().hex
    try:
        with a.database() as db:
            db.execute(
                "INSERT INTO users VALUES(?,?,?,?,?,?)",
                (account_id, email, name, a.password_hash(req.password), "member", time.time()),
            )
            row = db.execute("SELECT * FROM users WHERE id=?", (account_id,)).fetchone()
    except sqlite3.IntegrityError:
        raise HTTPException(409, "这个邮箱已注册，请直接登录")
    a.set_session(response, account_id)
    return {"user": a.public_user(row)}


@router.post("/login")
async def login(req: Credentials, request: Request, response: Response):
    ip = request.client.host if request.client else "unknown"
    a.rate_limit("login-ip:" + ip, 30, 900)
    email = email_value(req.email)
    a.rate_limit("login-email:" + email, 10, 900)
    with a.database() as db:
        row = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    # Same expensive work for unknown addresses avoids a fast account probe.
    valid = (
        a.check_password(req.password, row["password_hash"])
        if row
        else bool(a.password_hash(req.password)) and False
    )
    if not valid:
        raise HTTPException(401, "邮箱或密码不正确")
    a.set_session(response, row["id"])
    return {"user": a.public_user(row)}


@router.post("/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get(a.SESSION_COOKIE, "")
    with a.database() as db:
        db.execute("DELETE FROM auth_sessions WHERE token_hash=?", (a.hash_token(token),))
    response.delete_cookie(a.SESSION_COOKIE, **a.cookie_options())
    response.delete_cookie(a.CSRF_COOKIE, **a.cookie_options())
    return {"success": True}


@router.patch("/profile")
async def update_profile(req: Profile):
    name = req.name.strip()
    if not name:
        raise HTTPException(422, "请输入昵称")
    with a.database() as db:
        db.execute("UPDATE users SET name=? WHERE id=?", (name, a.user()["id"]))
        row = db.execute("SELECT * FROM users WHERE id=?", (a.user()["id"],)).fetchone()
    return {"user": a.public_user(row)}
