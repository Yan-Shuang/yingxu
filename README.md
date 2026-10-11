# 映序 · YINGXU

**让灵感，自由成形。**

一个可以注册使用的 AI 影像工作室，基于你提供的 XiaoYunQue 源码改造。现在包含公开官网、真实账号、个人作品集、素材库、创作工具与管理员模型设置，保留剧本 → 角色与场景 → 分镜 → 参考图 → 视频 → 后期合成的六阶段流程。

## 本地启动

依赖：Node.js 20.9+、npm、uv、Python 3.12。当前工作目录已经安装依赖，直接执行：

```bash
./start.sh
```

打开 <http://127.0.0.1:3000>，点击“开始创作”注册自己的账户。Ctrl+C 同时停止前后端。更换网页端口：`STUDIO_PORT=3001 ./start.sh`。

在另一台电脑或解压后的项目里，先执行 `./setup.sh` 安装依赖。后端默认在 8000 端口。FFmpeg 用于后期合成，Playwright Chromium 用于 HTML 视频模板；Docker 后端镜像包含这两项的安装步骤。

## 可以怎样测试

1. 注册、退出、重新登录，修改昵称。
2. 新建作品，填写名字、创意、风格与比例。保存后进入创作流程，可展开“编辑创意”修改并保存。
3. 回到作品集，搜索、打开或重命名作品。刷新或重启服务后数据仍保留。
4. 在素材库上传图片、视频或文档，预览、下载和筛选。生成的图像与视频会从自己的作品或任务目录收录。
5. 用第二个账号登录，确认它看到独立的作品集和素材库。访问第一个账号的项目、文件或任务链接会返回 404。

没有模型密钥时仍可测试以上功能。生成按钮会明确提示“生成服务尚未配置”，不会伪造成功结果。示例画面标注为视觉灵感示例，作品集显示真实数据。

## 管理员和模型服务

新注册的账户都是普通成员。管理员必须由服务器操作员单独创建，没有默认管理员密码：

```bash
cd backend
.venv/bin/python manage.py create-admin --email your-admin@example.com --name 映序管理员
```

终端会要求输入两次密码，不会把密码写入命令历史。使用一个尚未注册的邮箱。管理员登录后，在侧栏“模型服务管理”填写自己的 API Key，选择对应模型。普通用户只能选择创作参数，不能读取密钥或修改全站配置。

如果操作员希望让已经注册的自己的账号管理模型服务，可在服务器本地明确授权该账号：

```bash
cd backend
.venv/bin/python manage.py promote-admin --email your-existing-account@example.com
```

刷新网页后生效。此操作只能由能操作服务器文件的人员执行，注册页面不会自动授予管理员权限。

### 第一次接通剧本生成

1. 登录[阿里云百炼华北2（北京）密钥管理](https://bailian.console.aliyun.com/cn-beijing/model/settings/api-key)。没有阿里云账号时先注册，按平台要求完成实名认证与服务开通。协议与费用由账号本人确认。
2. 选择华北2（北京），点击“创建 API Key”，归属账号选自己的主账号，业务空间选默认业务空间。可按[官方说明](https://help.aliyun.com/zh/model-studio/get-api-key/)操作。复制密钥，不要把密钥发进聊天。
3. 以映序管理员登录，打开 `/settings`，在 **DashScope** 分组的 **api_key API 密钥** 中粘贴；接口地址保留 `https://dashscope.aliyuncs.com/api/v1`，点击页面的“保存配置”。文本模型保留 `qwen3-max`。
4. 回到刚才的作品，点击“重新生成”。这是实际模型调用，会使用平台额度或产生费用。先运行剧本阶段，确认返回正常后再继续角色与视频阶段。默认图片使用百炼 Wan 2.7 Image。此前创建的作品会保留自己的模型选择；如果图片模型还是 Seedream，在作品的“生成配置”中将文生图和图生图改为 Wan 2.7 Image。

密钥与地域需要一致。设置页保存成功只表示配置已保存；首次生成才会验证密钥权限、模型可用性与额度。

当前默认剧本、分镜、图像和视频模型均使用阿里云百炼（DashScope），可以先配置同一个平台。需要使用 Seedream 等其他模型时，再补充对应平台密钥。请以所选模型在你的服务商账户中的实际可用情况为准。密钥保存在 `backend/config.yaml`，不需要发送到聊天里，也不会进入部署包。

实际 AI 生成涉及模型服务费用。本次没有调用付费模型，完整成片流程仍需配置密钥、FFmpeg 后用真实服务验收。

## 账号与数据

- 密码使用带随机盐的 scrypt 哈希；登录令牌只把哈希存进数据库。
- HttpOnly 登录 Cookie，七天有效，退出或重置密码后会话失效。写操作验证 Origin 与 CSRF Token。
- 作品、任务、实验室记录、上传和媒体访问都校验账号归属，视频文件支持 Range 请求。
- 历史未标记归属的数据不会自动分配给新注册者。原来公开的 `/code` 整目录挂载已取消，账号库和会话 JSON 不会通过媒体路由暴露。
- 默认每个账户最多上传 2 GB 素材，每日最多提交 20 次生成操作。图像/视频单文件最多 500 MB，文档最多 20 MB；失败或取消的已接收生成操作也占次数。这是次数限制，不是按模型账单计算的额度。

数据位置：`backend/code/data/accounts.sqlite3` 保存账号、会话、归属和限流记录；`backend/code/data/sessions/` 与 `backend/code/data/tasks/` 保存创作状态；`backend/code/result/` 保存生成结果；`backend/temp/` 保存上传素材。备份时这些目录必须一起保留。

邮箱目前作为登录名，**尚未接入邮件验证和自助找回密码**。当前版本适合本地测试与小范围试用。操作员可在确认账号归属后运行 `manage.py reset-password --email ...`，该操作会撤销旧会话。

## 部署包

[部署说明](deploy/README.md)包含 Docker Compose、本地容器测试、HTTPS、管理员初始化与备份恢复。生成不含账户、密钥、历史素材和依赖缓存的源码包：

```bash
backend/.venv/bin/python scripts/package.py
```

产物为 `dist/yingxu-product.zip` 和对应 SHA-256 校验文件。此电脑尚未安装 Docker，本次没有实际构建容器镜像；Docker 文件与 Compose 配置已准备，服务器上的容器构建和真实模型生成需要后续验收。

## 代码导航

| 内容 | 文件或目录 |
| --- | --- |
| 品牌名称、简介 | `project.json` |
| 官网、注册、作品集、素材库 | `frontend/components/product/` |
| 登录保护与导航 | `frontend/components/AppShell.tsx` |
| 配色、布局、响应式 | `frontend/app/globals.css` |
| 同源 API 与实时流代理 | `frontend/app/api/[...path]/route.ts` |
| 六阶段界面与编辑 | `frontend/components/WorkflowPanel.tsx`、`frontend/components/stages/` |
| 账号、归属、请求边界、限额 | `backend/product/` |
| 账号与产品 API | `backend/api/routers/auth.py`、`product.py` |
| 六阶段编排与生成 | `backend/core/orchestrator.py`、`backend/core/agents/` |
| 模型与提示词 | `backend/models/`、`backend/prompts/` |
| 部署 | `deploy/` |

## 检查

```bash
PYTHONPATH=backend backend/.venv/bin/pytest -q backend/tests
cd frontend
npm run build
npx tsc --noEmit
npx eslint components/product components/AppShell.tsx 'app/api/[...path]/route.ts' app/studio app/login app/register app/page.tsx lib/api.ts
```

账号测试使用隔离的临时数据库与文件目录，覆盖登录失效、CSRF、两个账号的作品/素材/任务/流隔离、路径与标识校验、上传配额和每日次数限制，不请求真实模型。

产品功能验收（界面改版前）：23 项后端测试通过，生产构建、TypeScript 和新产品页面 ESLint 通过。生产版浏览器实际完成登录、创意保存、受保护图片预览与退出；390 px 手机素材库和导航没有横向溢出。上传、下载及 Range 请求也通过实际接口验证。

生产构建后可再运行同源代理检查，使用临时本地服务验证 Cookie、上传和实时事件流，不调用模型：

```bash
backend/.venv/bin/python scripts/test_proxy.py
```

本次检查的三条进度消息分别在约 0.003、0.405、0.813 秒到达，确认不会等待整个流完成才显示。

## 几何界面更新

2026-10-08：采用冷白、薄荷青和冰蓝；统一官网、登录注册、作品集、素材库、工具与账户页面。参考图和视频阶段改为描述侧栏、大预览、版本选择与片段缩略图，保留原有编辑、上传、选择和重试能力。首页输入的灵感可带入新建作品，注册或登录后继续。

本轮生产构建、TypeScript 和改动组件 ESLint 通过。首页、注册、作品集、新建作品的本地 HTTP 检查通过。使用独立组件样例，在 320、390、768、1048、1440 px 检查首页、注册、有图、失败和缺少参考图的布局，未发现页面横向溢出。这是组件布局验收；因当前浏览器工具无法打开本地站点，本轮没有重新进行真实浏览器的完整交互验收，也没有提交模型生成。

界面截图：`docs/yingxu-fresh-home.png`、`docs/yingxu-fresh-register.png`、`docs/yingxu-fresh-review-fixture.png`。后者使用示例素材与模拟作品数据展示组件布局，不代表实际生成成果。

公开的 [只读样例演示](https://yan-shuang.github.io/yingxu/) 位于 `docs/`。演示只展示工作流和界面结构，使用虚构项目与几何占位画面；它不提供注册、上传或真实生成，不连接模型服务，也不会产生模型调用费用。

## 来源与许可

核心源码来自 `xiaoyunque-main.zip` 中的 `xiaoyunque/xiaoyunque/`。没有带入随包的私人配置、历史生成数据、缓存或 Agent 指令文件。原说明保存在 `docs/UPSTREAM_README.md`，其中路径属于上游工程。

原始 MIT 许可及 XiaoYunQue、Video-Claw / FilmAgent 的版权声明保留在 `LICENSE`。
