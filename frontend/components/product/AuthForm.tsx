"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { apiJson, jsonBody } from "@/lib/api";
import { useAuth } from "./AuthProvider";
import GeometricArt from "./GeometricArt";
export default function AuthForm({ register = false }: { register?: boolean }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const search = useSearchParams();
  const { refresh } = useAuth();
  const rawNext = search.get("next") || "/studio";
  const next =
    rawNext.startsWith("/") &&
    !rawNext.startsWith("//") &&
    !rawNext.includes("\\")
      ? rawNext
      : "/studio";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setError("");
    if (register && values.get("password") !== values.get("confirm")) {
      setError("两次输入的密码不一致");
      return;
    }
    setBusy(true);
    try {
      await apiJson(
        `/api/auth/${register ? "register" : "login"}`,
        jsonBody("POST", {
          email: values.get("email"),
          password: values.get("password"),
          name: values.get("name") || "",
        }),
      );
      await refresh();
      router.replace(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="yx-auth-page">
      <div className="yx-auth-story">
        <Link href="/" className="yx-brand">
          <Image width={38} height={38} src="/brand.svg" alt="" />
          <span>
            映序<small>YINGXU STUDIO</small>
          </span>
        </Link>
        <GeometricArt compact />
        <div className="yx-auth-story-copy">
          <p className="yx-eyebrow">A PLACE FOR YOUR IMAGINATION</p>
          <h2>
            让灵感，
            <br />
            自由成形。
          </h2>
          <p>在映序，开始你的下一段创作。</p>
        </div>
        <span className="yx-auth-art-label">A LITTLE IDEA. A NEW WORLD.</span>
      </div>
      <div className="yx-auth-content">
        <Link href="/" className="yx-back-link">
          ← 返回官网
        </Link>
        <div className="yx-auth-form">
          <p className="yx-eyebrow">YOUR PERSONAL STUDIO</p>
          <h1>{register ? "创建你的工作室" : "欢迎回到映序"}</h1>
          <p className="yx-muted">
            {register
              ? "让第一个灵感，在这里开始。"
              : "接着上次的灵感，继续创作。"}
          </p>
          <form onSubmit={submit}>
            {register && (
              <label className="yx-field">
                昵称
                <input
                  name="name"
                  autoComplete="nickname"
                  placeholder="怎么称呼你"
                  required
                  maxLength={40}
                />
              </label>
            )}
            <label className="yx-field">
              邮箱
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                maxLength={254}
              />
            </label>
            <label className="yx-field">
              密码
              <div className="yx-password">
                <input
                  name="password"
                  type={show ? "text" : "password"}
                  autoComplete={register ? "new-password" : "current-password"}
                  placeholder={register ? "至少 12 个字符" : "输入你的密码"}
                  required
                  minLength={12}
                  maxLength={128}
                />
                <button
                  type="button"
                  aria-label={show ? "隐藏密码" : "显示密码"}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {register && (
              <label className="yx-field">
                确认密码
                <input
                  name="confirm"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="再次输入密码"
                  required
                  minLength={12}
                  maxLength={128}
                />
              </label>
            )}
            {error && (
              <p className="yx-error" role="alert">
                {error}
              </p>
            )}
            <button className="yx-button yx-full" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" size={18} /> : null}
              {register ? "创建账户并进入" : "登录工作室"}
              {!busy && <ArrowRight size={18} />}
            </button>
          </form>
          <p className="yx-auth-switch">
            {register ? "已经有账户？" : "还没有账户？"}{" "}
            <Link
              href={`${register ? "/login" : "/register"}?next=${encodeURIComponent(next)}`}
            >
              {register ? "直接登录" : "创建我的工作室"}
            </Link>
          </p>
          <p className="yx-auth-note">作品与素材仅在你的账户内可见。</p>
        </div>
        <span className="yx-auth-copyright">映序 · 让灵感，成为影像。</span>
      </div>
    </div>
  );
}
