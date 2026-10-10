# Deploying Roshni (free, about 15 minutes)

One container runs everything: the root `Dockerfile` builds the React app and serves it from the FastAPI backend.
Learner profiles live in Neon Postgres (`DATABASE_URL`), so they survive restarts. Uploaded lessons do not (the disk resets); the sample lessons come back on every start.

| Option | Use it for | Free plan |
|---|---|---|
| **Hugging Face Space** (recommended) | Everything | 2 vCPU, 16 GB RAM, sleeps after ~48 h without visits, no card |
| Render | Everything (backup) | 512 MB RAM, sleeps after 15 min (about 1 min to wake) |
| Vercel | The website only (optional) | Backend must stay on HF or Render |

## Secrets every option needs
Copy the values from your local `.env` (never commit them):

| Name | Required | Notes |
|---|---|---|
| `GEMINI_API_KEY`, `GEMINI_API_KEYS` | yes | the extra keys line is comma separated; keys rotate when one is rate-limited |
| `GROQ_API_KEY`, `GROQ_API_KEYS` | yes | same |
| `DATABASE_URL` | recommended | pooled Neon connection string (project `roshni`, branch `production`); without it, profiles stay in each browser only |
| `DEEPSEEK_API_KEY` | optional | capped paid backup |
| `API_SECRET` | **leave unset** | if set, the website must be built with the same `VITE_API_SECRET`, otherwise every upload and quiz is refused (and a key built into the website is public anyway) |

## A. Hugging Face Space (recommended)
1. https://huggingface.co → **New Space** → name `roshni` → SDK **Docker** → **Blank** → **CPU basic (free)** → **Public** → Create.
2. Space **Settings → Variables and secrets → New secret**: add the secrets from the table above.
3. Make a write token: huggingface.co → **Settings → Access Tokens → New token → Write**.
4. Upload a clean copy of the repo (tracked files only, so no `.env`, no caches, no `node_modules`). Hugging Face stores the images, PDFs and slides as large files automatically:
   ```bash
   pip install -U huggingface_hub
   hf auth login                        # paste the write token
   cd roshni
   git archive --format=tar HEAD | (mkdir -p ../roshni-space && tar -x -C ../roshni-space)
   hf upload <your-hf-username>/roshni ../roshni-space . --repo-type=space --commit-message "Deploy Roshni"
   ```
   (Plain `git push` to the Space is refused when the repo contains binary files that are not stored as large files, which is why we upload instead.)
5. The Space shows **Building**, then **Running** (first build about 5 minutes). Open the direct address, not the Space page:
   `https://<your-hf-username>-roshni.hf.space`
   The direct address matters for the microphone (voice quiz) and for saved setups (each address has its own browser storage).
6. Check `https://<your-hf-username>-roshni.hf.space/api/health`: `keys` should be true and `profile_store` true.
7. To update later: repeat step 4 (delete `../roshni-space` first).

## B. Render (backup)
1. https://render.com → **New → Web Service** → connect the GitHub repo `roshni`.
2. **Language: Docker**, Dockerfile path `./Dockerfile`, instance type **Free**.
3. **Environment**: add the secrets from the table. Render sets `PORT` itself; the Dockerfile already uses it.
4. Deploy, then open the `onrender.com` address and check `/api/health`.
5. Free instances sleep after 15 minutes: open the site 5 minutes before the demo. 512 MB of memory is tight for large PDFs; prefer photos.

## C. Vercel (optional, website only)
Import the repo → **Root directory** `frontend` → framework **Vite** → environment variable
`VITE_API_BASE_URL=https://<your-hf-username>-roshni.hf.space` (or the Render address) → Deploy.
The backend already allows `*.vercel.app` and `*.hf.space` origins. Note: a setup saved on the Vercel address is separate from one saved on the HF address.

## Before the demo
- Open the deployed site, run **Set up** once, open two samples and finish one quiz, so Home shows "Continue" and "Your next step" (do this on the final address; browser storage is per address).
- Free AI quotas are per key and reset daily. Rely on the samples plus one live upload.
- YouTube often blocks hosted servers: new video links may fail on the deployed site. The sample video works; demo new links from a laptop run.
- If the deploy fails, run locally: `cd backend && bash run_dev.sh`, open http://127.0.0.1:8000 (build the frontend once with `cd frontend && npm run build`).
