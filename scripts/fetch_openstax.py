"""Downloads short OpenStax excerpts (CC BY 4.0) as plain text and renders each as a printed-looking page image.

Usage:  python scripts/fetch_openstax.py
Output: data/openstax/<slug>.txt   (ground-truth text, used by eval/)
        data/openstax/pages/<slug>.html + .png   (page images used as sample uploads)
Rendering the PNG uses headless Microsoft Edge or Chrome if available.
"""
from __future__ import annotations

import html
import re
import shutil
import subprocess
import sys
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "openstax"
PAGES = OUT / "pages"

SOURCES = [
    ("bio-photosynthesis", "Concepts of Biology", "https://openstax.org/books/concepts-biology/pages/5-1-overview-of-photosynthesis", 330),
    ("bio-cell-theory", "Concepts of Biology", "https://openstax.org/books/concepts-biology/pages/3-1-how-cells-are-studied", 300),
    ("physics-speed", "College Physics 2e", "https://openstax.org/books/college-physics-2e/pages/2-3-time-velocity-and-speed", 300),
    ("chem-states-of-matter", "Chemistry 2e", "https://openstax.org/books/chemistry-2e/pages/1-2-phases-and-classification-of-matter", 300),
    ("earth-water-cycle", "Concepts of Biology", "https://openstax.org/books/concepts-biology/pages/20-2-biogeochemical-cycles", 300),
]


SKIP_HEADINGS = {"Learning Objectives", "Link to Learning", "Career Connection", "Visual Connection", "Concepts in Action",
                 "Evolution Connection", "Everyday Connection", "Art Connection", "Section Summary", "Check Your Understanding"}


class ContentParser(HTMLParser):
    """Collects headings and paragraphs from the book page's main content."""

    def __init__(self) -> None:
        super().__init__()
        self.blocks: list[tuple[str, str]] = []
        self._tag: str | None = None
        self._buf: list[str] = []
        self._skip_tag: str | None = None  # tag that opened the skipped region
        self._skip_depth = 0

    VOID = {"br", "img", "hr", "input", "meta", "link", "source", "wbr", "col", "area", "base", "embed", "param", "track"}

    def handle_starttag(self, tag, attrs):
        if tag in self.VOID:
            return
        a = dict(attrs)
        cls = a.get("class") or ""
        if self._skip_tag:
            if tag == self._skip_tag:
                self._skip_depth += 1
            return
        if tag in ("script", "style", "nav", "figure", "table") or "os-caption" in cls or "learning-objectives" in cls:
            self._skip_tag, self._skip_depth = tag, 1
            return
        if tag in ("h1", "h2", "h3", "p") and self._tag is None:
            self._tag, self._buf = tag, []

    def handle_endtag(self, tag):
        if self._skip_tag:
            if tag == self._skip_tag:
                self._skip_depth -= 1
                if self._skip_depth == 0:
                    self._skip_tag = None
            return
        if self._tag == tag:
            text = re.sub(r"\s+", " ", "".join(self._buf)).strip()
            if text:
                self.blocks.append((tag, text))
            self._tag = None

    def handle_data(self, data):
        if self._tag and not self._skip_tag:
            self._buf.append(data)


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Roshni education project)"})
    return urllib.request.urlopen(req, timeout=30).read().decode("utf-8", errors="replace")


def excerpt(page_html: str, max_words: int) -> tuple[str, list[tuple[str, str]]]:
    main = page_html[page_html.find("<main"):] if "<main" in page_html else page_html
    p = ContentParser()
    p.feed(main)
    title = next((t for tag, t in p.blocks if tag == "h1"), "")
    picked, words = [], 0
    for tag, text in p.blocks:
        if tag == "h1" or "By the end of this section" in text or text.startswith("Access for free"):
            continue
        if tag in ("h2", "h3") and text in SKIP_HEADINGS:
            continue
        if tag == "p" and text.split(" ")[0] in ("Click", "Watch", "Visit", "Explore", "Use"):
            continue
        if tag == "p" and len(text.split()) < 8:
            continue
        picked.append((tag, text))
        if tag == "p":
            words += len(text.split())
        if words >= max_words:
            break
    while picked and picked[-1][0] != "p":
        picked.pop()
    return title, picked


def render_page(slug: str, book: str, title: str, blocks: list[tuple[str, str]]) -> Path:
    body = "".join(f"<h2>{html.escape(t)}</h2>" if tag in ("h2", "h3") else f"<p>{html.escape(t)}</p>" for tag, t in blocks)
    doc = f"""<!doctype html><html><head><meta charset="utf-8"><style>
    body {{ margin:0; background:#fff; }}
    .page {{ width:760px; padding:56px 64px; font-family: Georgia, 'Times New Roman', serif; color:#1a1a1a; font-size:17px; line-height:1.55; }}
    .book {{ font-family: Arial, sans-serif; font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:#666; border-bottom:1px solid #ccc; padding-bottom:6px; }}
    h1 {{ font-family: Arial, sans-serif; font-size:28px; margin:18px 0 14px; }}
    h2 {{ font-family: Arial, sans-serif; font-size:20px; margin:20px 0 8px; }}
    p {{ margin:0 0 12px; text-align:justify; }}
    .foot {{ font-family: Arial, sans-serif; font-size:11px; color:#777; border-top:1px solid #ccc; margin-top:22px; padding-top:6px; }}
    </style></head><body><div class="page"><div class="book">{html.escape(book)} · OpenStax</div>
    <h1>{html.escape(title)}</h1>{body}<div class="foot">Content from OpenStax, licensed under CC BY 4.0.</div></div></body></html>"""
    html_path = PAGES / f"{slug}.html"
    html_path.write_text(doc, encoding="utf-8")
    png = PAGES / f"{slug}.png"
    browser = next((b for b in [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        shutil.which("chromium") or "", shutil.which("google-chrome") or "",
    ] if b and Path(b).exists()), None)
    if browser:
        subprocess.run([browser, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--screenshot={png}",
                        "--window-size=888,1250", html_path.as_uri()], capture_output=True, timeout=60)
    return png


def main() -> None:
    PAGES.mkdir(parents=True, exist_ok=True)
    for slug, book, url, words in SOURCES:
        try:
            title, blocks = excerpt(fetch(url), words)
        except Exception as e:  # noqa: BLE001
            print(f"skip {slug}: {e}", file=sys.stderr)
            continue
        if not blocks:
            print(f"skip {slug}: no content found", file=sys.stderr)
            continue
        text = "\n\n".join(t for _, t in blocks)
        (OUT / f"{slug}.txt").write_text(f"{title}\n\n{text}\n", encoding="utf-8")
        png = render_page(slug, book, title, blocks)
        print(f"{slug}: {len(text.split())} words, page image: {png.exists()}")


if __name__ == "__main__":
    main()
