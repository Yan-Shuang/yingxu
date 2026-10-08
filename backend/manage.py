"""Explicit operator actions. Never makes the first registrant an administrator."""

import argparse
import getpass
import time
import uuid

from api.routers.auth import email_value
from product import accounts as a


def main():
    parser = argparse.ArgumentParser(description="映序账户管理（在服务器本地执行）")
    parser.add_argument("action", choices=["create-admin", "promote-admin", "reset-password"])
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", default="映序管理员")
    args = parser.parse_args()
    a.initialize()
    email = email_value(args.email)
    with a.database() as db:
        existing = db.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()
    if args.action == "create-admin" and existing:
        parser.error("该邮箱已经注册。请使用另一个未注册邮箱创建管理员；不会自动升级已有账户。")
    if args.action in {"promote-admin", "reset-password"} and not existing:
        parser.error("账号不存在")
    if args.action == "promote-admin":
        with a.database() as db:
            db.execute("UPDATE users SET role='admin' WHERE id=?", (existing["id"],))
        print("该账户已由本机操作员设为管理员。刷新网页后可进入模型服务管理。")
        return
    password = getpass.getpass("设置密码（至少 12 个字符）：")
    confirm = getpass.getpass("再次输入密码：")
    if len(password) < 12 or len(password) > 128 or password != confirm:
        parser.error("密码需为 12–128 个字符，且两次输入一致")
    with a.database() as db:
        if args.action == "create-admin":
            db.execute(
                "INSERT INTO users VALUES(?,?,?,?,?,?)",
                (
                    uuid.uuid4().hex,
                    email,
                    args.name.strip() or "映序管理员",
                    a.password_hash(password),
                    "admin",
                    time.time(),
                ),
            )
        else:
            db.execute(
                "UPDATE users SET password_hash=? WHERE id=?",
                (a.password_hash(password), existing["id"]),
            )
            db.execute("DELETE FROM auth_sessions WHERE user_id=?", (existing["id"],))
    print("管理员已创建。" if args.action == "create-admin" else "密码已重置，旧登录会话已失效。")


if __name__ == "__main__":
    main()
