# Build from the repository root: docker build -f backend/Dockerfile .
FROM python:3.14-slim AS dependencies
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_NO_CACHE_DIR=1
WORKDIR /build
COPY backend/requirements.txt ./requirements.txt
COPY backend/constraints.txt ./constraints.txt
RUN python -m venv /opt/venv && /opt/venv/bin/pip install -r requirements.txt

FROM python:3.14-slim AS runtime
ENV PATH="/opt/venv/bin:$PATH" PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 APP_ENV=production
WORKDIR /app/backend
RUN groupadd --system interviewai && useradd --system --gid interviewai interviewai \
    && mkdir -p /app/backend/runtime/uploads /app/backend/runtime/tmp \
    && chown -R interviewai:interviewai /app/backend/runtime
COPY --from=dependencies /opt/venv /opt/venv
COPY backend/app ./app
COPY backend/alembic ./alembic
COPY backend/alembic.ini ./alembic.ini
COPY config/development.json /app/config/development.json
USER interviewai
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('PORT','8000')+'/health', timeout=3)"
# Public access should go through the frontend/reverse proxy; do not trust arbitrary forwarded IPs.
CMD ["python", "-m", "app.serve"]
