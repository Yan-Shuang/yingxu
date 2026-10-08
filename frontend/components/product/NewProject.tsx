"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";
import WorkflowPanel from "@/components/WorkflowPanel";
import { apiJson, jsonBody } from "@/lib/api";
const suggestions = [
  {
    title: "山海之间",
    idea: "一位年轻的画师回到故乡，在一幅未完成的山水画里，遇见了童年的自己。以东方水墨风格，讲述记忆与成长。",
    image: "/ui/inspiration-ink.png",
  },
  {
    title: "最后一封星际来信",
    idea: "一位独自留在空间站的宇航员，收到一封来自地球的迟到来信。在浩瀚星空中，他决定完成一个温柔的承诺。",
    image: "/ui/inspiration-space.png",
  },
  {
    title: "猫咪的奇遇日",
    idea: "一只好奇的小猫误入了一家午夜才营业的玩具店，发现玩具们正在排练一场秘密演出。创作温暖幽默的动画短片。",
    image: "/ui/inspiration-cat.png",
  },
];
export default function NewProject() {
  const search = useSearchParams();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [idea, setIdea] = useState(() => search.get("idea") || "");
  const [style, setStyle] = useState("realistic");
  const [ratio, setRatio] = useState("16:9");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (search.get("session")) return <WorkflowPanel />;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await apiJson<{ session_id: string }>(
        "/api/product/projects",
        jsonBody("POST", { title, idea, style, video_ratio: ratio }),
      );
      router.push(`/studio/new?session=${data.session_id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="yx-workspace yx-new-workspace">
      <Link className="yx-back-link" href="/studio">
        <ArrowLeft size={15} />
        返回作品集
      </Link>
      <header className="yx-workspace-header">
        <div>
          <p className="yx-eyebrow">A NEW STORY BEGINS</p>
          <h1>今天，想讲一个什么故事？</h1>
          <p className="yx-muted">先写下你的创意，细节可以在创作中慢慢完善。</p>
        </div>
      </header>
      <div className="yx-new-grid">
        <form className="yx-draft-form" onSubmit={submit}>
          <label className="yx-field">
            作品名称
            <input
              placeholder="为你的故事取个名字"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={80}
            />
          </label>
          <label className="yx-field">
            故事创意
            <textarea
              placeholder="描述故事、角色、场景或你想传达的情绪……"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              required
              maxLength={12000}
              rows={8}
            />
            <span className="yx-field-meta">
              清楚描述你的想法，比写得很长更有帮助。
              <span>{idea.length}/12000</span>
            </span>
          </label>
          <div className="yx-options-heading">
            <SlidersHorizontal size={16} />
            画面方向
          </div>
          <div className="yx-fields-row">
            <label className="yx-field">
              视觉风格
              <select value={style} onChange={(e) => setStyle(e.target.value)}>
                <option value="realistic">电影写实</option>
                <option value="anime">动画风格</option>
                <option value="chinese-ink">东方水墨</option>
                <option value="3d-disney">3D 质感</option>
              </select>
            </label>
            <label className="yx-field">
              画面比例
              <select value={ratio} onChange={(e) => setRatio(e.target.value)}>
                <option value="16:9">16:9 · 横屏叙事</option>
                <option value="9:16">9:16 · 竖屏短片</option>
                <option value="1:1">1:1 · 方形画面</option>
              </select>
            </label>
          </div>
          {error && (
            <p className="yx-error" role="alert">
              {error}
            </p>
          )}
          <div className="yx-draft-submit">
            <p>
              保存为私有作品
              <br />
              <small>进入后可逐步生成和编辑。</small>
            </p>
            <button className="yx-button" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" size={17} /> : null}
              保存并进入创作
              <ArrowRight size={17} />
            </button>
          </div>
        </form>
        <aside className="yx-inspiration-panel">
          <p className="yx-eyebrow">
            <Sparkles size={14} />
            找一点灵感
          </p>
          <h3>
            故事的开头，
            <br />
            也可以很简单。
          </h3>
          <p>选择一个示例作为起点，再写成你的故事。</p>
          {suggestions.map((s) => (
            <button
              key={s.title}
              onClick={() => {
                setTitle(s.title);
                setIdea(s.idea);
              }}
            >
              <Image width={65} height={55} src={s.image} alt="" />
              <span>
                {s.title}
                <small>使用这段创意</small>
              </span>
              <ArrowRight size={16} />
            </button>
          ))}
          <small className="yx-muted">
            示例仅提供创意起点，不是已生成的作品。
          </small>
        </aside>
      </div>
    </div>
  );
}
