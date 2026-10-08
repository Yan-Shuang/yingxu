#!/bin/sh
set -eu
if [ ! -f "$YINGXU_CONFIG_PATH" ]; then
  cp /app/backend/config.yaml.example "$YINGXU_CONFIG_PATH"
fi
exec /app/backend/.venv/bin/python /app/backend/api_server.py
