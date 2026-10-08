#!/usr/bin/env bash
set -euo pipefail

studio_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export UV_CACHE_DIR="$studio_root/.cache/uv"
export UV_PYTHON_INSTALL_DIR="$studio_root/.tools/python"

for studio_tool in node npm uv; do
  if ! command -v "$studio_tool" >/dev/null 2>&1; then
    echo "缺少 $studio_tool，请先安装 Node.js 和 uv。"
    exit 1
  fi
done

node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 20 || (major === 20 && minor < 9)) { console.error("需要 Node.js 20.9 或更高版本。"); process.exit(1); }'

studio_python="${PYTHON_BIN:-3.12}"
if [[ -z "${PYTHON_BIN:-}" && -x "$studio_root/backend/.venv/bin/python" ]]; then
  studio_python="$studio_root/backend/.venv/bin/python"
fi

cd "$studio_root/backend"
uv sync --frozen --extra dev --python "$studio_python"
if [[ ! -f config.yaml ]]; then
  cp config.yaml.example config.yaml
fi

cd "$studio_root/frontend"
npm ci --ignore-scripts --no-audit --no-fund --cache "$studio_root/.cache/npm"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "尚未安装 FFmpeg：网页可以启动，拼接成片前需要安装 FFmpeg。"
fi

echo "依赖安装完成。在项目目录运行 ./start.sh 注册体验；管理员创建和模型配置见 README.md。"
