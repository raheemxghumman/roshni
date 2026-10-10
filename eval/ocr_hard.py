"""Harsher page-reading test: heavy tilt, blur, dim and uneven light, strong JPEG compression.

Adds a "hard" condition to eval/results/ocr_cer.json (ground truth: the OpenStax source text).
Usage (backend running on :8000): python eval/ocr_hard.py
"""
import io
import json
import random
import re
import sys
import time
import urllib.error
import urllib.request
import uuid

import jiwer
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

from common import OPENSTAX, RESULTS

API = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"


def norm(text: str) -> str:
    text = text.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"').replace("—", "-").replace("–", "-")
    return re.sub(r"\s+", " ", text).strip().lower()


def hard(png) -> bytes:
    rng = random.Random("hard-" + png.stem)
    img = Image.open(png).convert("RGB")
    img = img.rotate(rng.uniform(5, 8) * rng.choice([-1, 1]), expand=True, fillcolor=(120, 110, 95))
    # uneven light: a dark gradient across the page, like a hand's shadow
    shade = Image.new("L", img.size, 0)
    d = ImageDraw.Draw(shade)
    for x in range(img.width):
        d.line([(x, 0), (x, img.height)], fill=int(110 * x / img.width))
    img = Image.composite(Image.new("RGB", img.size, (40, 35, 30)), img, shade)
    img = img.filter(ImageFilter.GaussianBlur(1.6))
    img = ImageEnhance.Brightness(img).enhance(0.7)
    img = ImageEnhance.Contrast(img).enhance(0.75)
    img = img.resize((int(img.width * 0.7), int(img.height * 0.7)))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=38)
    return buf.getvalue()


def upload(name: str, data: bytes) -> dict:
    boundary = uuid.uuid4().hex
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: image/jpeg\r\n\r\n').encode() + data + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(API + "/api/lessons", data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    try:
        return json.load(urllib.request.urlopen(req, timeout=600))
    except urllib.error.HTTPError as e:
        return json.loads(e.read() or b"{}")


def hypothesis(lesson: dict) -> str:
    parts = [lesson["title"]]
    for s in lesson["sections"]:
        if s["heading"] != lesson["title"]:
            parts.append(s["heading"])
        parts.append(s["text"])
    return "\n".join(parts)


scores = []
for txt in sorted(OPENSTAX.glob("*.txt")):
    png = OPENSTAX / "pages" / f"{txt.stem}.png"
    if not png.exists():
        continue
    data = hard(png)
    if txt.stem == "physics-speed":
        (RESULTS / "_hard_example.jpg").write_bytes(data)
    lesson = upload(f"{txt.stem}-hard.jpg", data)
    if "sections" not in lesson:
        print(txt.stem, "FAILED", lesson.get("error"))
        continue
    cer = jiwer.cer(norm(txt.read_text(encoding="utf-8")), norm(hypothesis(lesson)))
    scores.append(cer)
    print(f"{txt.stem:24} hard  CER {cer:.2%}", flush=True)
    if not lesson.get("sample"):
        urllib.request.urlopen(urllib.request.Request(f"{API}/api/lessons/{lesson['id']}", method="DELETE"), timeout=30)
    time.sleep(3)

if scores:
    path = RESULTS / "ocr_cer.json"
    result = json.loads(path.read_text(encoding="utf-8"))
    avg = sum(scores) / len(scores)
    result["hard_cer"] = round(avg, 4)
    result["display"] = f"{1 - avg:.2%} correct on hard photos"
    result["detail"] = (result["detail"].split(" Lower is better.")[0]
                        + f" On deliberately hard photos (6-8° tilt, heavy blur, dim and uneven light, strong JPEG compression) it was {avg:.2%}."
                        + " Lower is better. Ground truth is the OpenStax source text.")
    result["n"] = f"{result['n']} + {len(scores)} hard images"
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
