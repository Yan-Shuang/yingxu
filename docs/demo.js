const stages = {
  story: {
    eyebrow:"01 / STORY BREAKDOWN", title:"叙事拆解", copy:"把一句灵感拆成可审核的结构，而不是直接跳到成片。",
    body:`<div class="story-grid"><article><span>开场</span><h3>退潮后的入口</h3><p>雾中的旧城区露出一座从未出现在地图上的博物馆。</p></article><article><span>转折</span><h3>缺失的录音</h3><p>档案员发现所有展品都指向同一段被删除的城市声纹。</p></article><article><span>结尾</span><h3>把声音交还海面</h3><p>记忆被重新播放，建筑随下一次潮汐缓慢消失。</p></article></div>`
  },
  character: {
    eyebrow:"02 / CHARACTER", title:"人物参考", copy:"先固定角色身份和视觉锚点，再进入镜头设计。",
    body:`<div class="character"><div class="portrait"><i></i><span>示意轮廓</span></div><div><p class="tag">ARCHIVIST · 29</p><h3>林澈</h3><p>城市声音档案员。冷静、敏锐，对缺失的细节保持执着。</p><dl><div><dt>轮廓</dt><dd>防水长外套 / 便携录音机</dd></div><div><dt>色彩</dt><dd>雾蓝 / 灰绿 / 旧铜</dd></div><div><dt>一致性检查</dt><dd>发型、外套长度、设备位置</dd></div></dl></div></div>`
  },
  shots: {
    eyebrow:"03 / SHOT BOARD", title:"分镜编排", copy:"镜头以结构卡片呈现；以下画面块是界面占位，不是模型生成图。",
    body:`<div class="shots">${[["01","远景","海雾与退潮后的街道"],["02","中景","档案员进入倾斜门廊"],["03","特写","录音机波形突然出现"],["04","俯拍","展柜组成潮汐等高线"]].map(([n,t,c])=>`<article><div><i></i></div><span>SHOT ${n} · ${t}</span><p>${c}</p></article>`).join("")}</div>`
  },
  timeline: {
    eyebrow:"04 / TIMELINE", title:"片段时间线", copy:"按叙事节奏安排片段，并在每一步保留人工审核点。",
    body:`<div class="timeline"><div class="ruler"><span>00:00</span><span>00:15</span><span>00:30</span><span>00:45</span></div><div class="track"><b style="--w:24%">建立环境</b><b style="--w:31%">进入博物馆</b><b style="--w:19%">发现录音</b><b style="--w:26%">潮汐回归</b></div><div class="review"><span>人工审核点</span><i></i><span>节奏与连续性确认</span></div></div>`
  }
};

const canvas = document.querySelector("#canvas");
const buttons = [...document.querySelectorAll("[data-stage]")];
function render(key){
  const stage=stages[key];
  canvas.innerHTML=`<header><p class="eyebrow">${stage.eyebrow}</p><h2>${stage.title}</h2><p>${stage.copy}</p></header>${stage.body}`;
  buttons.forEach(button=>button.classList.toggle("active",button.dataset.stage===key));
}
buttons.forEach(button=>button.addEventListener("click",()=>render(button.dataset.stage)));
render("story");
