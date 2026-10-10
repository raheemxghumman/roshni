# Deploying Roshni (free, about 10 minutes)

One Hugging Face Space runs everything: the root `Dockerfile` builds the React app and serves it from the FastAPI backend on port 7860. Vercel is optional.

## Hugging Face Space (recommended)
1. https://huggingface.co → **New Space** → name `roshni` → SDK **Docker** → template **Blank** → hardware **CPU basic (free)** → **Public** → Create.
2. Space **Settings → Variables and secrets → New secret**:
   - `GEMINI_API_KEY`
   - `GROQ_API_KEY`
   - `GEMINI_API_KEYS` and `GROQ_API_KEYS`: the extra keys, comma separated (copy the lines from your local `.env`). They are rotated when one is rate-limited.
   - `DEEPSEEK_API_KEY` (optional paid backup, capped)
   - optional: `DEMO_MODE` = `false`
3. Push this repo to the Space (an HF access token with *write* permission is the password):
   ```bash
   git remote add space https://huggingface.co/spaces/<your-hf-username>/roshni
   git push space main
   ```
   The README's front matter (`sdk: docker`, `app_port: 7860`) tells Hugging Face how to run it.
4. Wait for **Building → Running**, then open `https://<your-hf-username>-roshni.hf.space`. The five sample lessons load on first start from `data/samples/`.

## Notes
- **Free Spaces sleep after a period without visits.** Open the URL 10 minutes before judging.
- **The Space's disk is not permanent.** Lessons uploaded there disappear on restart; the samples come back automatically.
- **Free-tier limits are per API key.** GPT-OSS 120B on Groq allows about 200k tokens a day, which is roughly 10 fresh pages. The app falls back to Gemini models automatically. For the demo, rely on the samples plus one live upload.
- **If the build fails,** run the app locally: `cd backend && bash run_dev.sh`, then open http://127.0.0.1:8000 (build the frontend once with `cd frontend && npm run build`).

## Vercel (optional, frontend only)
Import the repo → root directory `frontend` → framework Vite → environment variable `VITE_API_BASE_URL=https://<your-hf-username>-roshni.hf.space`. CORS already allows `*.vercel.app`.
