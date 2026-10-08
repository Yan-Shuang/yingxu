FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.12.9 /uv /usr/local/bin/uv
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_LINK_MODE=copy \
    YINGXU_API_HOST=0.0.0.0 YINGXU_CONFIG_PATH=/app/backend/runtime/config.yaml \
    PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-noto-cjk fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY project.json README.md LICENSE ./
COPY backend/pyproject.toml backend/uv.lock ./backend/
WORKDIR /app/backend
RUN uv sync --frozen --no-dev && .venv/bin/python -m playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*
COPY backend/ ./
COPY deploy/backend-entrypoint.sh /usr/local/bin/yingxu-api
RUN useradd --uid 10001 --create-home studio && mkdir -p code/data code/result temp logs runtime \
    && chown -R studio:studio /app/backend /opt/playwright && chmod +x /usr/local/bin/yingxu-api
USER studio
EXPOSE 8000
ENTRYPOINT ["/usr/local/bin/yingxu-api"]
