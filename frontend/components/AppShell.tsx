"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Clapperboard,
  FolderOpen,
  Layers3,
  Sparkles,
  UserRound,
  Menu,
  X,
  ArrowUpRight,
  Settings2,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/components/product/AuthProvider";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, error, refresh, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 800px)");
    const change = () => setMobile(media.matches);
    change();
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  const publicPage = ["/", "/login", "/register"].includes(pathname);
  useEffect(() => {
    if (!publicPage && !loading && !user && !error)
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [publicPage, loading, user, error, pathname, router]);
  if (publicPage) return children;
  if (loading || !user)
    return (
      <div className="yx-loading">
        <Image width={38} height={38} src="/brand.svg" alt="映序" />
        <p>{error || "正在打开你的工作室…"}</p>
        {error && (
          <button className="yx-button" onClick={() => void refresh()}>
            重新连接
          </button>
        )}
      </div>
    );
  if (pathname === "/settings" && user.role !== "admin")
    return (
      <div className="yx-loading">
        <p>模型服务设置由管理员管理</p>
        <Link className="yx-button" href="/studio">
          返回工作室
        </Link>
      </div>
    );
  const nav = [
    {
      href: "/studio",
      label: "我的作品",
      icon: FolderOpen,
      active: pathname === "/studio" || pathname === "/studio/new",
    },
    {
      href: "/studio/assets",
      label: "素材库",
      icon: Layers3,
      active: pathname === "/studio/assets",
    },
    {
      href: "/studio/tools",
      label: "创作工具",
      icon: Sparkles,
      active:
        pathname === "/studio/tools" ||
        pathname.startsWith("/pipelines") ||
        pathname === "/sandbox",
    },
    {
      href: "/studio/settings",
      label: "账户设置",
      icon: UserRound,
      active: pathname === "/studio/settings",
    },
  ];
  return (
    <div className="yx-app">
      <div className="yx-mobile-header">
        <Link href="/studio" className="yx-brand"><Image width={30} height={30} src="/brand.svg" alt="" /><span>映序</span></Link>
        <button
        className="yx-mobile-menu"
        aria-label={open ? "关闭导航" : "打开导航"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      </div>
      {open && (
        <button
          className="yx-scrim"
          aria-label="关闭导航遮罩"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`yx-sidebar ${open ? "is-open" : ""}`}
        aria-hidden={mobile && !open}
        inert={mobile && !open}
      >
        <Link
          href="/studio"
          className="yx-brand"
          onClick={() => setOpen(false)}
        >
          <Image width={38} height={38} src="/brand.svg" alt="" />
          <span>
            映序<small>YINGXU STUDIO</small>
          </span>
        </Link>
        <Link
          href="/studio/new"
          className="yx-button yx-create"
          onClick={() => setOpen(false)}
        >
          <Clapperboard size={17} />
          新建作品<span>＋</span>
        </Link>
        <p className="yx-nav-caption">创作空间</p>
        <nav aria-label="工作室导航">
          {nav.map((item) => (
            <Link
              key={item.href}
              className={`yx-nav-item ${item.active ? "is-active" : ""}`}
              href={item.href}
              onClick={() => setOpen(false)}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="yx-sidebar-bottom">
          <div className="yx-sidebar-note">
            <span className="yx-gold-dot" />
            灵感的下一站，是作品。<small>从故事到画面，保留你的表达。</small>
          </div>
          {user.role === "admin" && (
            <Link className="yx-nav-item" href="/settings">
              <Settings2 size={16} />
              模型服务管理
            </Link>
          )}
          <Link className="yx-nav-item" href="/">
            <ArrowUpRight size={16} />
            映序官网
          </Link>
          <div className="yx-user">
            <span className="yx-avatar">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.role === "admin" ? "管理员" : "个人工作室"}</small>
            </div>
            <button
              aria-label="退出登录"
              title="退出登录"
              onClick={async () => {
                await logout();
                router.replace("/");
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <main className="yx-app-main">{children}</main>
    </div>
  );
}
