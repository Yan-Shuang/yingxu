"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, ArrowUpRight, Pause, Play } from "lucide-react";
import { useAuth } from "./AuthProvider";
import GeometricArt from "./GeometricArt";

const features = [
  { shape: "square", title: "故事，有自己的方向", text: "从一个念头出发，编辑剧本、角色与分镜。" },
  { shape: "circle", title: "画面，有自由的空间", text: "选择风格，打磨参考图，让想象逐帧成形。" },
  { shape: "arc", title: "作品，有完整的旅程", text: "连接视频片段，保存每一步，随时继续创作。" },
];

export default function LandingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [playing, setPlaying] = useState(false);
  const [idea, setIdea] = useState("");
  const target = user ? "/studio/new" : "/register";
  function begin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const destination = `/studio/new${idea.trim() ? `?idea=${encodeURIComponent(idea.trim())}` : ""}`;
    router.push(user ? destination : `/register?next=${encodeURIComponent(destination)}`);
  }
  return (
    <div className="yx-landing">
      <header className="yx-public-header">
        <Link href="/" className="yx-brand"><Image width={36} height={36} src="/brand.svg" alt="" /><span>映序<small>YINGXU</small></span></Link>
        <nav aria-label="官网导航"><a href="#process">创作流程</a><Link href="/studio">创作工作台</Link></nav>
        <div className="yx-header-actions">
          {!user && <Link href="/login">登录</Link>}
          <Link className="yx-button yx-secondary yx-small" href={target}>开始创作<ArrowUpRight size={16} /></Link>
        </div>
      </header>
      <main className="yx-home-content">
        <section className="yx-hero">
          <div className="yx-hero-copy">
            <p className="yx-eyebrow"><span className="yx-dot" />A LITTLE IDEA. A NEW WORLD.</p>
            <h1>让灵感，<br /><span>自由成形。</span></h1>
            <p className="yx-hero-description">一个轻盈、有序的 AI 影像创作空间。<br />从第一行故事，到最后一帧画面，<br />让想象慢慢成为你的作品。</p>
            <div className="yx-hero-actions">
              <Link className="yx-button" href={target}>开启创作<ArrowRight size={18} /></Link>
              <button className="yx-text-link" aria-pressed={playing} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={15} /> : <Play size={15} />}{playing ? "暂停动效" : "几何动效"}</button>
            </div>
            <p className="yx-hero-footnote">独立作品空间<span>·</span>随时保存，继续创作</p>
          </div>
          <GeometricArt playing={playing} />
        </section>
        <form className="yx-home-compose" onSubmit={begin}>
          <div><label htmlFor="home-idea">现在，写下你的第一个灵感</label><textarea id="home-idea" rows={2} maxLength={12000} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="一只猫，在午夜发现了一间会说话的玩具店……" /></div>
          <button className="yx-button" type="submit">进入创作<ArrowRight size={17} /></button>
        </form>
        <section id="process" className="yx-home-system">
          <div className="yx-system-intro"><h2>让创作，<br />自然发生。</h2><p>你的想象，值得被认真展开。</p></div>
          {features.map((feature) => <article key={feature.shape}><div className={`yx-mini-shape ${feature.shape}`} aria-hidden="true" /><h3>{feature.title}</h3><p>{feature.text}</p></article>)}
        </section>
      </main>
      <footer className="yx-footer"><span>YINGXU · 映序</span><p>给灵感一点空间。</p><span>STORIES TAKE SHAPE.</span></footer>
    </div>
  );
}
