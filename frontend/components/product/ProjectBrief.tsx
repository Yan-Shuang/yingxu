"use client";
import { useEffect, useState } from "react";
import { Check, ChevronDown, PenLine } from "lucide-react";
import { apiJson, jsonBody } from "@/lib/api";
export default function ProjectBrief({
  sessionId,
  onIdeaSaved,
}: {
  sessionId: string;
  onIdeaSaved: (idea: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [idea, setIdea] = useState("");
  const [ready, setReady] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    void Promise.all([
      apiJson<{ meta: { title?: string; idea?: string } }>(
        `/api/project/${sessionId}/status`,
      ),
      apiJson<{ generation_ready: boolean }>("/api/product/status"),
    ])
      .then(([p, s]) => {
        if (live) {
          setTitle(p.meta.title || "未命名作品");
          setIdea(p.meta.idea || "");
          setReady(s.generation_ready);
        }
      })
      .catch((e) => {
        if (live) setError((e as Error).message);
      });
    return () => {
      live = false;
    };
  }, [sessionId]);
  return (
    <div className="yx-project-brief">
      {!ready && (
        <p className="yx-service-note">
          生成服务尚未启用。你的作品已保存，可以先编辑创意，再由管理员启用生成服务。
        </p>
      )}
      <details>
        <summary>
          <PenLine size={14} />
          <span>{title || "作品创意"}</span>
          <small>编辑创意</small>
          <ChevronDown size={15} />
        </summary>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            setSaved(false);
            try {
              await apiJson(
                `/api/product/projects/${sessionId}`,
                jsonBody("PATCH", { title, idea }),
              );
              onIdeaSaved(idea);
              setSaved(true);
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
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={80}
            />
          </label>
          <label className="yx-field">
            故事创意
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              required
              maxLength={12000}
              rows={4}
            />
          </label>
          <p className="yx-muted">
            修改创意会用于下一次剧本生成，已有阶段内容仍保留。
          </p>
          {error && (
            <p className="yx-error" role="alert">
              {error}
            </p>
          )}
          <div className="yx-save-row">
            <button className="yx-button yx-small" disabled={busy}>
              保存创意
            </button>
            {saved && (
              <span className="yx-success" role="status">
                <Check size={14} />
                已保存
              </span>
            )}
          </div>
        </form>
      </details>
    </div>
  );
}
