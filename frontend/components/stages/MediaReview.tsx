"use client";

/* Private generated media is served through the authenticated asset route. */
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Download, Film, ImagePlus, Loader2, Pencil, RefreshCw, Save, X, ZoomIn } from "lucide-react";
import { assetUrl, assetVersionLabel } from "./utils";
import ImageLightbox from "./ImageLightbox";

export interface ReviewItem {
  id: string;
  name: string;
  description: string;
  selected: string;
  versions: string[];
  index?: number;
  episode?: number;
  episode_title?: string;
  duration?: number;
  status?: "pending" | "done" | "failed" | "running";
}

interface MediaReviewProps {
  kind: "image" | "video";
  items: ReviewItem[];
  episodeTitles: Record<number, string>;
  getSelected: (item: ReviewItem) => string;
  descriptions: Record<string, string>;
  editingIds: Set<string>;
  savingIds: Set<string>;
  regeneratingIds: Set<string>;
  uploadingIds?: Set<string>;
  canEdit: boolean;
  isStageRunning: boolean;
  allowRetry: boolean;
  retryBlocked?: (id: string) => boolean;
  onDescription: (id: string, value: string) => void;
  onEdit: (id: string) => void;
  onCancel: (id: string) => void;
  onSave: (id: string) => void;
  onRetry: (id: string) => void;
  onSelect: (id: string, path: string) => void;
  onUpload?: (id: string, file: File) => void;
}

function MediaPreview({ kind, path, name, onZoom }: { kind: "image" | "video"; path: string; name: string; onZoom: () => void }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="yx-media-empty"><div className="yx-empty-ring" /><h3>文件暂时无法预览</h3><p>你可以尝试下载原文件，或切换其他版本。</p></div>;
  return kind === "image" ? <button className="yx-image-preview" onClick={onZoom} aria-label={`放大查看${name}`}><img src={assetUrl(path)} alt={name} onError={() => setFailed(true)} /><span><ZoomIn size={15} />放大查看</span></button> : <video key={path} src={assetUrl(path)} controls preload="metadata" aria-label={name} onError={() => setFailed(true)} />;
}

export default function MediaReview(props: MediaReviewProps) {
  const { kind, items, getSelected, episodeTitles } = props;
  const [activeId, setActiveId] = useState("");
  const [episode, setEpisode] = useState("all");
  const [lightbox, setLightbox] = useState<string[] | null>(null);
  const episodes = [...new Set(items.map((item) => item.episode || 1))].sort((a, b) => a - b);
  const filtered = items.filter((item) => episode === "all" || String(item.episode || 1) === episode);
  const current = filtered.find((item) => item.id === activeId) || filtered[0];
  if (!current) return null;
  const pathFor = (item: ReviewItem) => getSelected(item) || item.versions?.[0] || "";
  const path = pathFor(current);
  const versions = [...new Set([...(current.versions || []), ...(path ? [path] : [])])];
  const position = filtered.findIndex((item) => item.id === current.id);
  const editing = props.editingIds.has(current.id);
  const saving = props.savingIds.has(current.id);
  const uploading = props.uploadingIds?.has(current.id) || false;
  const generating = props.regeneratingIds.has(current.id) || current.status === "running" || (props.isStageRunning && !path && current.status !== "failed");
  const blocked = props.retryBlocked?.(current.id) || false;
  const complete = items.filter((item) => pathFor(item)).length;
  const failed = items.filter((item) => item.status === "failed").length;
  const episodeNumber = current.episode || 1;
  const episodeTitle = episodeTitles[episodeNumber] || current.episode_title;
  const label = kind === "image" ? "画面" : "片段";
  const retry = () => props.onRetry(current.id);
  const retryDisabled = generating || props.isStageRunning || saving || editing || blocked || uploading;
  const status = generating ? "生成中" : current.status === "failed" ? (path ? "本次未完成" : "未完成") : path ? "已就绪" : "待生成";

  return (
    <section className="yx-media-review">
      <div className="yx-review-heading">
        <label>片段目录<select aria-label="按剧集筛选片段" value={episode} onChange={(event) => setEpisode(event.target.value)}><option value="all">全部剧集</option>{episodes.map((number) => <option key={number} value={number}>第 {number} 集{episodeTitles[number] ? ` · ${episodeTitles[number]}` : ""}</option>)}</select></label>
        <span>{complete} / {items.length} 已就绪{failed ? ` · ${failed} 项未完成` : ""}</span>
      </div>
      <div className="yx-review-layout">
        <aside className="yx-inspector">
          <div className="yx-inspector-heading"><h3>{current.name || `${label} ${position + 1}`}</h3><span className={`yx-media-status${current.status === "failed" ? " is-incomplete" : ""}`}>{status}</span></div>
          <p className="yx-inspector-meta">第 {episodeNumber} 集{episodeTitle ? ` · ${episodeTitle}` : ""}{current.duration ? ` / ${current.duration}s` : ""}</p>
          <label className="yx-prompt-label" htmlFor={`prompt-${current.id}`}>{kind === "image" ? "画面描述" : "镜头与动作"}</label>
          {editing ? <textarea id={`prompt-${current.id}`} className="yx-prompt-editor" value={props.descriptions[current.id] ?? current.description} onChange={(event) => props.onDescription(current.id, event.target.value)} aria-label="编辑片段描述" /> : <div className="yx-prompt-text">{current.description || "这个片段还没有描述。"}</div>}
          {props.canEdit && <div className="yx-prompt-actions">{editing ? <><button className="yx-text-link" onClick={() => props.onSave(current.id)} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}保存描述</button><button className="yx-text-link" onClick={() => props.onCancel(current.id)} disabled={saving}><X size={14} />取消</button></> : <button className="yx-text-link" onClick={() => props.onEdit(current.id)} disabled={props.isStageRunning || generating}><Pencil size={14} />编辑描述</button>}</div>}
          <div className="yx-inspector-controls">
            {props.allowRetry && <button className="yx-button yx-full" onClick={retry} disabled={retryDisabled}>{generating ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}{generating ? "正在生成" : path ? "生成新版本" : "生成这个片段"}</button>}
            {props.onUpload && <label className={`yx-button yx-secondary yx-full yx-upload-control${uploading || props.isStageRunning || generating ? " is-disabled" : ""}`}>{uploading ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}{uploading ? "正在上传" : "上传自己的图片"}<input type="file" accept="image/png,image/jpeg,image/webp" aria-label="上传此片段的参考图" disabled={uploading || props.isStageRunning || generating} onChange={(event) => { const file = event.target.files?.[0]; if (file) props.onUpload?.(current.id, file); event.target.value = ""; }} /></label>}
          </div>
          {blocked && <div className="yx-review-note"><strong>先准备首帧参考图</strong><p>这个片段还没有参考图。回到参考图阶段生成或上传一张图片，再继续。</p></div>}
          {current.status === "failed" && !blocked && <div className="yx-review-note"><strong>这一步暂时没有完成</strong><p>{path ? "已有版本仍可查看和使用。" : "描述已保留。"}请检查模型服务和可用额度，处理后再重试。</p></div>}
          {!blocked && current.status !== "failed" && <p className="yx-review-hint">每次生成都会保留版本。选择满意的版本，继续下一步。</p>}
        </aside>
        <div className="yx-review-media">
          <div className="yx-viewer">
            <div className="yx-viewer-stage">
              {path ? <MediaPreview key={`${kind}:${path}`} kind={kind} path={path} name={current.name} onZoom={() => setLightbox([path])} /> : <div className="yx-media-empty">{generating ? <Loader2 size={34} className="animate-spin" /> : <div className="yx-empty-ring" />}<h3>{generating ? "灵感正在成形" : blocked ? "等待首帧画面" : current.status === "failed" ? "画面等待继续" : "下一帧，由你开启"}</h3><p>{generating ? "生成完成后，新的版本会出现在这里。" : blocked ? "先完成参考图，再让这个片段动起来。" : current.status === "failed" ? "这次生成没有完成，你的故事和描述已经保留。" : "生成或上传素材后，在这里查看你的作品。"}</p>{props.allowRetry && !blocked && !generating && <button className="yx-button yx-secondary yx-small" disabled={retryDisabled} onClick={retry}><RefreshCw size={14} />继续生成</button>}</div>}
            </div>
            <div className="yx-viewer-footer"><strong>{current.name}</strong><div>{path && <a href={assetUrl(path)} download className="yx-text-link"><Download size={14} />下载</a>}<button aria-label="上一个片段" disabled={position <= 0} onClick={() => setActiveId(filtered[position - 1].id)}><ArrowLeft size={16} /></button><span>{position + 1} / {filtered.length}</span><button aria-label="下一个片段" disabled={position >= filtered.length - 1} onClick={() => setActiveId(filtered[position + 1].id)}><ArrowRight size={16} /></button></div></div>
          </div>
          {versions.length > 0 && <div className="yx-versions"><span>保留版本</span>{versions.map((version, index) => <button key={version} aria-pressed={path === version} onClick={() => props.onSelect(current.id, version)} disabled={props.isStageRunning || generating || saving}>{path === version && <Check size={12} />}{assetVersionLabel(version, index)}</button>)}</div>}
          <div className="yx-thumbnails-heading"><span>{label}一览</span><small>点击切换预览</small></div>
          <div className="yx-media-thumbnails">{filtered.map((item, index) => {
            const thumbPath = pathFor(item);
            const itemBusy = props.regeneratingIds.has(item.id) || item.status === "running";
            return <button key={item.id} aria-pressed={current.id === item.id} aria-label={`${item.name}，${itemBusy ? "生成中" : item.status === "failed" ? "未完成" : thumbPath ? "已就绪" : "待生成"}`} onClick={() => setActiveId(item.id)}>
              <div className="yx-thumbnail-picture">{thumbPath && kind === "image" ? <img src={assetUrl(thumbPath)} alt="" loading="lazy" /> : itemBusy ? <Loader2 size={21} className="animate-spin" /> : thumbPath ? <Film size={24} /> : <div className="yx-mini-ring" />}<span>{String(item.index || index + 1).padStart(2, "0")}</span></div>
              <div className="yx-thumbnail-caption"><strong>{item.name}</strong><small>{itemBusy ? "生成中" : item.status === "failed" ? "未完成" : thumbPath ? "已就绪" : "待生成"}</small></div>
            </button>;
          })}</div>
        </div>
      </div>
      {lightbox && <ImageLightbox images={lightbox} initialIndex={0} onClose={() => setLightbox(null)} />}
    </section>
  );
}
