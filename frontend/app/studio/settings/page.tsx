"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserRound, Check, LogOut, Loader2 } from "lucide-react";
import { useAuth } from "@/components/product/AuthProvider";
import { apiJson, jsonBody } from "@/lib/api";
export default function Settings() {
  const { user, refresh, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = new FormData(e.currentTarget).get("name");
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await apiJson("/api/auth/profile", jsonBody("PATCH", { name }));
      await refresh();
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="yx-workspace">
      <header className="yx-workspace-header">
        <div>
          <p className="yx-eyebrow">YOUR ACCOUNT</p>
          <h1>账户设置</h1>
          <p className="yx-muted">管理你的个人信息与登录状态。</p>
        </div>
      </header>
      <section className="yx-account-panel">
        <div className="yx-account-heading">
          <span className="yx-avatar yx-avatar-large">
            {user?.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <h2>{user?.name}</h2>
            <p>{user?.role === "admin" ? "管理员" : "个人工作室"}</p>
          </div>
        </div>
        <form onSubmit={save}>
          <label className="yx-field">
            昵称
            <input
              name="name"
              defaultValue={user?.name}
              required
              maxLength={40}
            />
          </label>
          <label className="yx-field">
            注册邮箱
            <input value={user?.email || ""} readOnly aria-readonly="true" />
          </label>
          <p className="yx-muted yx-account-date">
            加入映序：
            {user &&
              new Date(user.created_at * 1000).toLocaleDateString("zh-CN")}
          </p>
          {error && (
            <p className="yx-error" role="alert">
              {error}
            </p>
          )}
          <div className="yx-save-row">
            <button className="yx-button" disabled={busy}>
              {busy && <Loader2 size={16} className="animate-spin" />}保存资料
            </button>
            {saved && (
              <span className="yx-success" role="status">
                <Check size={16} />
                资料已保存
              </span>
            )}
          </div>
        </form>
      </section>
      <section className="yx-session-panel">
        <UserRound size={22} />
        <div>
          <h2>登录状态</h2>
          <p>退出后，需要重新登录才能访问你的作品与素材。</p>
        </div>
        <button
          className="yx-button yx-secondary"
          onClick={async () => {
            try {
              await logout();
              router.replace("/login");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <LogOut size={16} />
          退出登录
        </button>
      </section>
    </div>
  );
}
