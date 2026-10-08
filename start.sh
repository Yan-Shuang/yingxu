#!/usr/bin/env bash
set -euo pipefail

studio_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
studio_python="$studio_root/backend/.venv/bin/python"

if [[ ! -x "$studio_python" || ! -d "$studio_root/frontend/node_modules/next" ]]; then
  echo "依赖未安装完成，请先运行 ./setup.sh。"
  exit 1
fi

exec "$studio_python" "$studio_root/scripts/dev.py"
