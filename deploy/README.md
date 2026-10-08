# 映序部署说明

当前交付是可在本地测试的产品与部署源码包，没有发布到公网。前端为 Next.js，后端为单进程 FastAPI，账户存入 SQLite，生成过程仍使用原有编排器。

## 本地 Docker 测试

安装 Docker Engine/Desktop 与 Compose v2 后，在本目录执行：

```bash
cp .env.example .env
docker compose --env-file .env -f compose.yaml up --build -d
docker compose --env-file .env -f compose.yaml ps
```

访问 <http://localhost:3000>。默认只绑定本机 3000 端口，8000 端口只在 Docker 内部可用。首次构建需下载 Node/Python 依赖、FFmpeg 和 Chromium，因此可能耗时较长。

创建管理员，交互输入密码：

```bash
docker compose --env-file .env -f compose.yaml exec backend /app/backend/.venv/bin/python manage.py create-admin --email your-admin@example.com --name 映序管理员
```

管理员在网页“模型服务管理”填写密钥。配置保存在独立 `model_config` 卷内，重建镜像不覆盖已有配置。普通注册账号不会取得管理员权限。

已经注册的站点所有者可由服务器操作员明确授权，无需另建账号：

```bash
docker compose --env-file .env -f compose.yaml exec backend /app/backend/.venv/bin/python manage.py promote-admin --email your-existing-account@example.com
```

只填写确认属于站点管理者的账号。刷新网页后可打开模型服务管理。此命令不会修改其他账户或注册页面的默认权限。

## 后续 HTTPS 上线

需要一个已经指向服务器的域名，以及可以访问的 80/443 端口。在 `.env` 中填入 `YINGXU_DOMAIN`，值只包含域名，例如 `studio.example.com`，然后执行：

```bash
docker compose --env-file .env -f compose.yaml -f compose.https.yaml up --build -d
```

附加配置启用 Caddy、HTTPS Cookie 与域名 Origin 校验。后台仍不对公网开放，网页 3000 端口仍只绑定服务器本机。Caddy 把 HTTPS 请求转发给网页服务并及时转发生成进度流。HTTPS 自动签发的前提是域名解析与端口可达；没有在此电脑上进行证书签发测试。

域名未准备好时，使用本地 Compose 配置即可。不要对 HTTP 预览启用 Secure Cookie，否则浏览器不会发送登录 Cookie。

## 持久化与运行方式

| 卷 | 保存内容 |
| --- | --- |
| `creative_data` | SQLite 账号库、归属表、作品与任务状态、生成文件 |
| `uploaded_media` | 用户上传 |
| `model_config` | 模型密钥与配置 |
| `operator_logs` | 服务器诊断日志 |
| `tls_data`、`tls_config` | HTTPS 配置使用的证书与缓存 |

用 `docker compose down` 停止服务时，保留数据卷。`down -v` 会删除账号、作品、素材和配置，应仅用于确认可以丢弃的测试环境。

使用一个后端实例、一个 Uvicorn 进程。编排状态和活动任务在进程内维护，当前版本不能通过简单增加后端副本实现一致的任务调度。升级前等待正在生成的任务结束，再备份、重建镜像。中途重启的任务不会自动重新扣费重跑，需要用户手动重试。

## 可调整参数

在 `.env` 中修改，重建容器后生效：

- `YINGXU_UPLOAD_QUOTA_MB`：单账号上传空间，默认 2048 MB。
- `YINGXU_DAILY_GENERATIONS`：滚动 24 小时内接收的生成操作数，默认 20。一次操作可能生成多张图或多个片段，不等于固定金额。
- `YINGXU_ORIGIN`：HTTP 预览域名，默认 `http://localhost:3000`。HTTPS 附加配置自动改为配置的域名。
- `YINGXU_SECURE_COOKIES`：本地 HTTP 为 0；HTTPS 附加配置强制为 1。
- `YINGXU_BIND`：默认 `127.0.0.1`，只绑定服务器本机。

服务器没有接受来自前端的自选代理地址或全局模型密钥。用户输入的参考素材需先上传；任意远程媒体 URL 不作为服务器取文件的入口。

## 备份与恢复

备份同时覆盖账户归属与创作文件。先等待任务结束，并短暂停止后端以保持文件与数据库一致。以下命令从 `deploy/` 执行：

```bash
umask 077
mkdir -p backups
docker compose --env-file .env -f compose.yaml stop backend
docker compose --env-file .env -f compose.yaml run --rm --no-deps --entrypoint sh backend -c 'tar -czf /app/backend/runtime/yingxu-backup.tgz -C /app/backend code temp runtime/config.yaml'
docker compose --env-file .env -f compose.yaml cp backend:/app/backend/runtime/yingxu-backup.tgz ./backups/yingxu-backup.tgz
docker compose --env-file .env -f compose.yaml start backend
```

备份包含模型密钥、账号和私人创作，保存在受控位置，不要放在网页公开目录。将备份复制到另一台受控设备，再确认恢复可用。

在空白目标数据卷中恢复可信备份，避免覆盖仍有其他作品的环境：

```bash
docker compose --env-file .env -f compose.yaml stop backend
docker compose --env-file .env -f compose.yaml run --rm --no-deps --user root -v "$PWD/backups:/restore:ro" --entrypoint sh backend -c '
  tar -xzf /restore/yingxu-backup.tgz -C /app/backend
  chown -R studio:studio /app/backend/code /app/backend/temp /app/backend/runtime
'
docker compose --env-file .env -f compose.yaml start backend
```

部署配置中的卷名属于 Compose 项目 `yingxu`；迁移或自定义项目名时同时确认卷映射。

## 验收边界

已经在此电脑验证前端生产构建、TypeScript、新产品页面 ESLint、23 项后端测试，以及 standalone 生产服务器的静态资源、运行时后端地址、两个 Cookie、请求体与实时流转发。此电脑没有 Docker，也没有真实模型密钥；**容器实际构建、HTTPS、付费生成与最终成片尚未验收**。

推荐先进行小范围试用：用两个账号验收登录、作品保存、素材下载与视频拖动进度条，再由管理员配置服务商密钥，测试一部短作品。使用的模型、返回格式和费用以服务商实际结果为准。

此版本没有邮件验证、自助找回密码、订单/充值、按费用计量的额度系统，也没有后台作业队列与多实例调度。邮箱是登录标识；操作员确认身份后可通过 `manage.py reset-password --email ...` 恢复访问。

实现参考：uv 镜像与构建方式参考[官方 Docker 指南](https://docs.astral.sh/uv/guides/integration/docker/)；Next.js 部署使用[官方 standalone 输出](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)。密码哈希参数采用 [OWASP scrypt 建议](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)中的 `N=32768, r=8, p=3` 组合。
