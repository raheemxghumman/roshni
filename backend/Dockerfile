# Hugging Face Spaces (Docker SDK) — serves the FastAPI backend on port 7860.
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
ENV CACHE_DIR=/app/cache
RUN mkdir -p /app/cache

EXPOSE 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
