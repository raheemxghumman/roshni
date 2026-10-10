# One container for Hugging Face Spaces (Docker SDK): builds the React frontend, then serves it
# and the FastAPI backend together on port 7860. Add the API keys as Space secrets.
FROM node:22-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
RUN useradd -m -u 1000 user
WORKDIR /home/user/app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY --chown=user backend/app backend/app
COPY --chown=user data/samples data/samples
COPY --chown=user data/openstax data/openstax
COPY --chown=user eval/results eval/results
COPY --from=web --chown=user /web/dist frontend/dist
RUN mkdir -p data/cache && chown -R user data
USER user
ENV PORT=7860 DEMO_MODE=false
EXPOSE 7860
WORKDIR /home/user/app/backend
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
