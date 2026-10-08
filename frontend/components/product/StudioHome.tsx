"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Plus,
  Film,
  Clapperboard,
  Layers3,
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
  X,
} from "lucide-react";
import { apiJson, jsonBody } from "@/lib/api";
import { useAuth } from "./AuthProvider";
import GeometricArt from "./GeometricArt";
interface Project {
  id: string;
  title: string;
  idea: string;
  date: number;
  current_stage: string;
  status: Record<string, string>;
  meta?: { video_ratio?: string; style?: string };
}
const labels: Record<string, string> = {
  init: "创意草稿",
  idea_expansion: "创意草稿",
  script_generation: "剧本创作",
  character_design: "角色与场景",
  storyboard: "故事分镜",
  reference_generation: "分镜图像",
  video_generation: "视频片段",
  post_production: "后期合成",
};
export default function StudioHome() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [menu, setMenu] = useState("");
  const [editing, setEditing] = useState<Project | null>(null);
  const [removing, setRemoving] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    setLoading(true);
    try {
      const data = await apiJson<{ projects: Project[] }>(
        "/api/product/projects",
      );
      setProjects(data.projects);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let live = true;
    void apiJson<{ projects: Project[] }>("/api/product/projects")
      .then((data) => {
        if (live) setProjects(data.projects);
      })
      .catch((e) => {
        if (live) setError((e as Error).message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);
  const visible = projects.filter((p) =>
    `${p.title} ${p.idea}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="yx-workspace">
      <header className="yx-workspace-header">
        <div>
          <p className="yx-eyebrow">YOUR CREATIVE SPACE</p>
          <h1>我的作品</h1>
          <p className="yx-muted">{user?.name}，让今天的灵感有一个开始。</p>
        </div>
        <Link className="yx-button" href="/studio/new">
          <Plus size={18} />
          新建作品
        </Link>
      </header>
      <section className="yx-studio-banner">
        <div>
          <span className="yx-eyebrow">EVERY STORY STARTS SOMEWHERE</span>
          <h2>
            从一个念头，
            <br />
            到一部作品。
          </h2>
          <p>写下创意，选择风格，逐步完成你的影像。</p>
          <Link href="/studio/new" className="yx-text-link">
            开始新故事
            <ArrowRight size={17} />
          </Link>
        </div>
        <div className="yx-banner-art"><GeometricArt compact /></div>
      </section>
      <div className="yx-list-heading">
        <h2>
          作品集 <span>{projects.length}</span>
        </h2>
        <label className="yx-search">
          <Search size={16} />
          <input
            aria-label="搜索作品"
            placeholder="搜索作品"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      {error && (
        <p className="yx-error" role="alert">
          {error} <button onClick={() => void load()}>重新加载</button>
        </p>
      )}
      {loading ? (
        <p className="yx-muted yx-list-loading">正在打开作品集…</p>
      ) : visible.length ? (
        <div className="yx-project-grid">
          {visible.map((p, i) => (
            <article className="yx-project-card" key={p.id}>
              <div className={`yx-project-cover tone-${i % 3}`}>
                <Clapperboard size={38} strokeWidth={1} />
                <span>{p.meta?.video_ratio || "16:9"}</span>
                <small>{labels[p.current_stage] || "创作中"}</small>
                <div className="yx-card-menu">
                  <button
                    aria-label={`管理作品 ${p.title}`}
                    onClick={() => setMenu(menu === p.id ? "" : p.id)}
                  >
                    <MoreHorizontal size={19} />
                  </button>
                  {menu === p.id && (
                    <div>
                      <button
                        onClick={() => {
                          setEditing(p);
                          setMenu("");
                        }}
                      >
                        <Pencil size={14} />
                        重命名
                      </button>
                      <button
                        onClick={() => {
                          setRemoving(p);
                          setMenu("");
                        }}
                      >
                        <Trash2 size={14} />
                        删除作品
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <Link
                href={`/studio/new?session=${p.id}`}
                className="yx-project-info"
              >
                <h3>{p.title}</h3>
                <p>{p.idea}</p>
                <div>
                  <span>
                    {new Date(p.date * 1000).toLocaleDateString("zh-CN")}
                  </span>
                  <ArrowUpRightIcon />
                </div>
              </Link>
            </article>
          ))}
          <Link className="yx-add-project" href="/studio/new">
            <Plus size={28} strokeWidth={1} />
            <span>新的灵感，新的作品</span>
          </Link>
        </div>
      ) : (
        <div className="yx-empty">
          <span className="yx-empty-icon">
            <Film size={30} strokeWidth={1.3} />
          </span>
          <h3>{search ? "没有找到相关作品" : "你的第一部作品，从这里开始"}</h3>
          <p>
            {search
              ? "换一个关键词试试。"
              : "写下一段故事，映序会为你保存每一步创作。"}
          </p>
          {!search && (
            <Link className="yx-button" href="/studio/new">
              创建第一部作品
              <ArrowRight size={17} />
            </Link>
          )}
        </div>
      )}
      <div className="yx-studio-shortcuts">
        <Link href="/studio/assets">
          <Layers3 size={21} />
          <div>
            <strong>整理创作素材</strong>
            <span>把参考图像和视频，放进自己的素材库。</span>
          </div>
          <ArrowRight size={17} />
        </Link>
        <Link href="/studio/tools">
          <Pencil size={21} />
          <div>
            <strong>试试创作工具</strong>
            <span>用文字、图像和视频，探索新的表达方向。</span>
          </div>
          <ArrowRight size={17} />
        </Link>
      </div>
      {(editing || removing) && (
        <div className="yx-modal-backdrop">
          <div
            className="yx-modal"
            role="dialog"
            aria-modal="true"
            aria-label={editing ? "重命名作品" : "删除作品"}
          >
            <button
              className="yx-modal-close"
              aria-label="关闭对话框"
              onClick={() => {
                setEditing(null);
                setRemoving(null);
              }}
            >
              <X size={20} />
            </button>
            <h2>{editing ? "给作品一个新名字" : "删除这部作品？"}</h2>
            {editing ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  try {
                    const title = new FormData(e.currentTarget).get("title");
                    await apiJson(
                      `/api/product/projects/${editing.id}`,
                      jsonBody("PATCH", { title }),
                    );
                    setEditing(null);
                    await load();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label className="yx-field">
                  作品名称
                  <input
                    name="title"
                    defaultValue={editing.title}
                    required
                    maxLength={80}
                    autoFocus
                  />
                </label>
                <button className="yx-button" disabled={busy}>
                  保存名称
                </button>
              </form>
            ) : (
              <>
                <p className="yx-muted">
                  “{removing?.title}
                  ”的创作记录与生成文件会一并删除，此操作无法撤销。
                </p>
                <div className="yx-modal-actions">
                  <button
                    className="yx-button yx-secondary"
                    onClick={() => setRemoving(null)}
                  >
                    保留作品
                  </button>
                  <button
                    className="yx-button yx-danger"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await apiJson(`/api/sessions/${removing?.id}`, {
                          method: "DELETE",
                        });
                        setRemoving(null);
                        await load();
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    确认删除
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function ArrowUpRightIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path d="M4 12 12 4M4 4h8v8" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
