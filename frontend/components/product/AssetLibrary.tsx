"use client";
/* eslint-disable @next/next/no-img-element -- Private media must use the viewer's session cookies. */
import { useEffect, useRef, useState } from "react";
import {
  Upload,
  Layers3,
  FileText,
  Download,
  Trash2,
  X,
  Loader2,
  Film,
} from "lucide-react";
import { apiJson } from "@/lib/api";
interface Asset {
  id: string;
  name: string;
  kind: string;
  size: number;
  created_at: number;
  url: string;
  source: string;
}
export default function AssetLibrary() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Asset | null>(null);
  const [removing, setRemoving] = useState<Asset | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  async function load() {
    try {
      const data = await apiJson<{ assets: Asset[] }>("/api/product/assets");
      setAssets(data.assets);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let live = true;
    void apiJson<{ assets: Asset[] }>("/api/product/assets")
      .then((data) => {
        if (live) setAssets(data.assets);
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
  async function upload(file: File) {
    setBusy(true);
    setError("");
    const form = new FormData();
    form.append("file", file);
    const doc = /\.(pdf|docx?|txt|md)$/i.test(file.name);
    try {
      await apiJson(doc ? "/api/upload_file" : "/api/upload_media", {
        method: "POST",
        body: form,
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  const items = assets.filter((a) => filter === "all" || a.kind === filter);
  return (
    <div className="yx-workspace">
      <header className="yx-workspace-header">
        <div>
          <p className="yx-eyebrow">YOUR CREATIVE MATERIALS</p>
          <h1>素材库</h1>
          <p className="yx-muted">把参考、灵感和创作成果，收进自己的空间。</p>
        </div>
        <button
          className="yx-button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? (
            <Loader2 size={17} className="animate-spin" />
          ) : (
            <Upload size={17} />
          )}
          {busy ? "正在上传…" : "上传素材"}
        </button>
        <input
          ref={fileRef}
          type="file"
          aria-label="选择上传素材"
          hidden
          accept=".png,.jpg,.jpeg,.webp,.bmp,.mp4,.mov,.avi,.mkv,.webm,.pdf,.docx,.doc,.txt,.md"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </header>
      <div
        className="yx-upload-zone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!busy && e.dataTransfer.files[0])
            void upload(e.dataTransfer.files[0]);
        }}
      >
        <span className="yx-icon-box">
          <Upload size={22} />
        </span>
        <div>
          <h3>让素材准备就绪</h3>
          <p>
            拖入一个文件，或点击上传素材。图像与视频最大 500 MB，文档最大 20
            MB。
          </p>
          <small>
            支持 PNG、JPG、WebP、BMP，MP4、MOV、AVI、MKV、WebM，以及
            PDF、Word、TXT、MD。
          </small>
        </div>
      </div>
      <div className="yx-list-heading">
        <div className="yx-tabs" role="group" aria-label="素材类型">
          {[
            ["all", "全部"],
            ["image", "图像"],
            ["video", "视频"],
            ["document", "文档"],
          ].map(([v, label]) => (
            <button
              key={v}
              className={filter === v ? "is-active" : ""}
              onClick={() => setFilter(v)}
            >
              {label}
              <span>
                {assets.filter((a) => v === "all" || a.kind === v).length}
              </span>
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p className="yx-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="yx-muted">正在加载素材…</p>
      ) : items.length ? (
        <div className="yx-asset-grid">
          {items.map((a) => (
            <article key={a.id} className="yx-asset-card">
              <button
                className="yx-asset-preview"
                onClick={() => setSelected(a)}
                aria-label={`预览 ${a.name}`}
              >
                {a.kind === "image" ? (
                  <img src={a.url} alt={a.name} />
                ) : a.kind === "video" ? (
                  <>
                    <video src={a.url} preload="metadata" />
                    <Film size={30} />
                  </>
                ) : (
                  <FileText size={36} strokeWidth={1.2} />
                )}
              </button>
              <div className="yx-asset-info">
                <h3 title={a.name}>{a.name}</h3>
                <p>
                  {a.kind === "image"
                    ? "图像"
                    : a.kind === "video"
                      ? "视频"
                      : "文档"}{" "}
                  · {formatSize(a.size)}
                </p>
                <div>
                  <span>
                    {new Date(a.created_at * 1000).toLocaleDateString("zh-CN")}
                  </span>
                  <a
                    href={`${a.url}?download=true`}
                    aria-label={`下载 ${a.name}`}
                  >
                    <Download size={15} />
                  </a>
                  {a.source === "upload" && (
                    <button
                      aria-label={`删除 ${a.name}`}
                      onClick={() => setRemoving(a)}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="yx-empty">
          <span className="yx-empty-icon">
            <Layers3 size={30} strokeWidth={1.3} />
          </span>
          <h3>
            {filter === "all"
              ? "素材库，还在等你的第一份灵感"
              : "这里还没有这类素材"}
          </h3>
          <p>上传参考图像、视频或文档，为下一部作品做好准备。</p>
          <button
            className="yx-button yx-secondary"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <Upload size={16} />
            上传第一份素材
          </button>
        </div>
      )}
      {selected && (
        <div className="yx-modal-backdrop">
          <div
            className="yx-modal yx-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-label="素材预览"
          >
            <button
              className="yx-modal-close"
              aria-label="关闭预览"
              onClick={() => setSelected(null)}
            >
              <X size={20} />
            </button>
            <h2>{selected.name}</h2>
            {selected.kind === "image" ? (
              <img src={selected.url} alt={selected.name} />
            ) : selected.kind === "video" ? (
              <video src={selected.url} controls autoPlay />
            ) : (
              <div className="yx-document-preview">
                <FileText size={48} />
                <p>下载后查看文档内容。</p>
              </div>
            )}
            <a className="yx-button" href={`${selected.url}?download=true`}>
              <Download size={17} />
              下载素材
            </a>
          </div>
        </div>
      )}
      {removing && (
        <div className="yx-modal-backdrop">
          <div
            className="yx-modal"
            role="dialog"
            aria-modal="true"
            aria-label="删除素材"
          >
            <h2>删除这份素材？</h2>
            <p className="yx-muted">
              删除“{removing.name}”后，使用它作为参考的创作可能需要重新上传。
            </p>
            <div className="yx-modal-actions">
              <button
                className="yx-button yx-secondary"
                onClick={() => setRemoving(null)}
              >
                保留素材
              </button>
              <button
                className="yx-button yx-danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await apiJson(`/api/product/assets/${removing.id}`, {
                      method: "DELETE",
                    });
                    setRemoving(null);
                    await load();
                  } catch (e) {
                    setError((e as Error).message);
                    setRemoving(null);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
