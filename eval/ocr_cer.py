"""Character error rate of page reading, against the OpenStax source text (ground truth).

Two conditions per page:
  clean   - the page image as rendered
  photo   - the same image degraded like a phone photo: slight rotation, blur, dimmer light, noise
Usage (backend running on :8000): python eval/ocr_cer.py
"""
import io
import json
import random
import re
import sys
import time
import urllib.request
import uuid
from pathlib import Path

import jiwer
from PIL import Image, ImageEnhance, ImageFilter

from common import OPENSTAX, write

API = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"


def norm(text: str) -> str:
    text = text.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"').replace("—", "-").replace("–", "-")
    return re.sub(r"\s+", " ", text).strip().lower()


def degrade(png: Path) -> bytes:
    rng = random.Random(png.stem)
    img = Image.open(png).convert("RGB")
    img = img.rotate(rng.uniform(-3, 3), expand=True, fillcolor=(235, 232, 225))
    img = img.filter(ImageFilter.GaussianBlur(0.8))
    img = ImageEnhance.Brightness(img).enhance(0.82)
    px = img.load()
    for _ in range(img.width * img.height // 60):
        x, y = rng.randrange(img.width), rng.randrange(img.height)
        v = rng.randint(-40, 40)
        r, g, b = px[x, y]
        px[x, y] = (max(0, min(255, r + v)), max(0, min(255, g + v)), max(0, min(255, b + v)))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=70)
    return buf.getvalue()


def upload(name: str, data: bytes) -> dict:
    boundary = uuid.uuid4().hex
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: image/jpeg\r\n\r\n').encode() + data + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(API + "/api/lessons", data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    try:
        return json.load(urllib.request.urlopen(req, timeout=300))
    except urllib.error.HTTPError as e:
        return json.loads(e.read() or b"{}")


def hypothesis(lesson: dict) -> str:
    parts = [lesson["title"]]
    for s in lesson["sections"]:
        if s["heading"] != lesson["title"]:
            parts.append(s["heading"])
        parts.append(s["text"])
    return "\n".join(parts)


def simplify_seconds(lesson_id: str) -> float | None:
    t = time.perf_counter()
    req = urllib.request.Request(f"{API}/api/lessons/{lesson_id}/simplify", data=json.dumps({"level": "easier"}).encode(), headers={"Content-Type": "application/json"})
    try:
        r = json.load(urllib.request.urlopen(req, timeout=600))
        return time.perf_counter() - t if "factguard" in r else None
    except urllib.error.HTTPError:
        return None


scores = {"clean": [], "photo": []}
read_times, simplify_times = [], []
for txt in sorted(OPENSTAX.glob("*.txt")):
    png = OPENSTAX / "pages" / f"{txt.stem}.png"
    if not png.exists():
        continue
    truth = norm(txt.read_text(encoding="utf-8"))
    for cond, data in (("clean", png.read_bytes()), ("photo", degrade(png))):
        t0 = time.perf_counter()
        lesson = upload(f"{txt.stem}-{cond}.jpg", data)
        if cond == "photo" and "sections" in lesson and not lesson.get("from_cache"):
            read_times.append(time.perf_counter() - t0)
            if len(simplify_times) < 2 and (sec := simplify_seconds(lesson["id"])):
                simplify_times.append(sec)
        if "sections" not in lesson:
            print(f"{txt.stem} {cond}: FAILED {lesson.get('error')}")
            continue
        cer = jiwer.cer(truth, norm(hypothesis(lesson)))
        if cond == "photo" and not lesson.get("sample"):  # remove eval-only lessons so they don't clutter the app
            urllib.request.urlopen(urllib.request.Request(f"{API}/api/lessons/{lesson['id']}", method="DELETE"), timeout=30)
        scores[cond].append(cer)
        print(f"{txt.stem:24} {cond:5} CER {cer:.2%}")
        time.sleep(2)

clean, photo = scores["clean"], scores["photo"]
avg = lambda xs: sum(xs) / len(xs) if xs else None  # noqa: E731
write(
    "ocr_cer",
    title="Page-reading accuracy",
    display=f"{1 - avg(photo):.1%} correct" if photo else "—",
    value=round(avg(photo), 4) if photo else None,
    detail=(f"Character error rate {avg(clean):.2%} on clean pages and {avg(photo):.2%} on pages degraded like phone photos (tilt, blur, dim light, noise). "
            "Lower is better. Ground truth is the OpenStax source text." if clean and photo else "Not enough pages."),
    dataset="OpenStax pages rendered as images, clean and phone-photo-degraded",
    n=f"{len(clean) + len(photo)} page images",
    method="jiwer character error rate vs source text, after normalising quotes and whitespace",
    models="gemini-2.5-flash",
    data_type="real",
)

if read_times:
    write(
        "processing_time",
        title="Time to make a lesson",
        display=f"{avg(read_times) + (avg(simplify_times) or 0):.0f} s per page",
        value=round(avg(read_times) + (avg(simplify_times) or 0), 1),
        detail=(f"Reading a phone-style photo took {avg(read_times):.0f} s on average ({len(read_times)} pages); simplifying with Fact Guard took "
                f"{avg(simplify_times):.0f} s ({len(simplify_times)} pages), including waits for free-tier rate limits. "
                "Adapting one page by hand for three kinds of learner takes a teacher far longer (measure it on-site with a stopwatch)."
                if simplify_times else f"Reading a phone-style photo took {avg(read_times):.0f} s on average."),
        dataset="Fresh uploads of phone-photo-degraded OpenStax pages (no cache)",
        n=f"{len(read_times)} reads, {len(simplify_times)} simplifications",
        method="Wall-clock time of the API calls on the free tiers",
        models="gemini (read), qwen + gpt-oss (simplify + Fact Guard)",
        data_type="real",
    )
