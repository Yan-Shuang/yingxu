import Link from "next/link";
import {
  Sparkles,
  Film,
  PersonStanding,
  Mic,
  ArrowUpRight,
  PenLine,
} from "lucide-react";
const tools = [
  {
    href: "/studio/new",
    icon: PenLine,
    number: "01",
    title: "故事创作",
    desc: "从创意到剧本，再到角色、分镜与成片。逐步完成一部属于你的作品。",
    tag: "完整创作流程",
  },
  {
    href: "/pipelines/standard",
    icon: Film,
    number: "02",
    title: "图文短片",
    desc: "把一段文案拆成画面，配合语音与字幕，制作适合分享的叙事短片。",
    tag: "文案 → 短视频",
  },
  {
    href: "/pipelines/action-transfer",
    icon: PersonStanding,
    number: "03",
    title: "动作演绎",
    desc: "上传角色图像与动作参考视频，探索角色动态与镜头表现。",
    tag: "图像 + 动作参考",
  },
  {
    href: "/pipelines/digital-human",
    icon: Mic,
    number: "04",
    title: "数字人口播",
    desc: "从人物形象与表达内容出发，制作口播或产品介绍视频。",
    tag: "人物 → 视频表达",
  },
  {
    href: "/sandbox",
    icon: Sparkles,
    number: "05",
    title: "灵感实验室",
    desc: "单独尝试文字生成、图像理解、图像创作与视频生成，找到新的方向。",
    tag: "自由探索",
  },
];
export default function Tools() {
  return (
    <div className="yx-workspace">
      <header className="yx-workspace-header">
        <div>
          <p className="yx-eyebrow">TOOLS FOR YOUR IMAGINATION</p>
          <h1>创作工具</h1>
          <p className="yx-muted">选择合适的入口，让想法更快往前一步。</p>
        </div>
      </header>
      <div className="yx-tools-grid">
        {tools.map((t, index) => (
          <Link
            key={t.href}
            href={t.href}
            className={`yx-tool-card tone-${index % 3}`}
          >
            <span className="yx-tool-shape" aria-hidden="true" />
            <div className="yx-tool-content">
              <div className="yx-tool-top">
                <t.icon size={23} strokeWidth={1.5} />
                <span>{t.number}</span>
              </div>
              <span className="yx-tool-tag">{t.tag}</span>
              <h2>{t.title}</h2>
              <p>{t.desc}</p>
              <div className="yx-tool-link">
                打开工具
                <ArrowUpRight size={18} />
              </div>
            </div>
          </Link>
        ))}
      </div>
      <p className="yx-tools-note">
        生成工具需启用相应模型服务；你的创作记录只在自己的账户内可见。
      </p>
    </div>
  );
}
