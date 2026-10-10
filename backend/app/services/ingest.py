"""Validates uploads: type sniffing, HEIC->JPEG, resize to 1600px, EXIF rotation, PDF text-layer detection."""
from __future__ import annotations

import io
from dataclasses import dataclass, field

import pymupdf
from PIL import Image, ImageOps, UnidentifiedImageError
from pillow_heif import register_heif_opener

from ..config import get_settings
from ..errors import AppError

register_heif_opener()

MAX_SIDE = 1600
MAX_PDF_PAGES = 3
MIN_TEXT_LAYER_CHARS = 200


@dataclass
class Prepared:
    kind: str  # "image" | "pdf"
    images: list[bytes] = field(default_factory=list)  # JPEG bytes, one per page
    text_layer: str | None = None
    pages: int = 1
    warnings: list[str] = field(default_factory=list)


def sniff(data: bytes) -> str | None:
    head = data[:16]
    if head.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if head.startswith(b"\x89PNG"):
        return "png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    if head.startswith(b"%PDF"):
        return "pdf"
    if head[4:8] == b"ftyp" and head[8:12] in (b"heic", b"heix", b"mif1", b"msf1", b"hevc", b"heim", b"heis"):
        return "heic"
    return None


def _to_jpeg(img: Image.Image, warnings: list[str]) -> bytes:
    img = ImageOps.exif_transpose(img)
    if img.mode != "RGB":
        img = img.convert("RGB")
    if min(img.size) < 500:
        warnings.append("This image is small, so some words may be hard to read. A closer photo works best.")
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85, optimize=True)
    return buf.getvalue()


def prepare(data: bytes, filename: str = "") -> Prepared:
    s = get_settings()
    if not data:
        raise AppError("UNSUPPORTED_FILE", "The file is empty. Please choose a photo or PDF of a textbook page.")
    if len(data) > s.max_upload_mb * 1024 * 1024:
        raise AppError("FILE_TOO_LARGE", f"This file is over {s.max_upload_mb} MB. Please use a smaller photo or a shorter PDF.", 413)

    kind = sniff(data)
    if kind is None:
        raise AppError("UNSUPPORTED_FILE", "This file type isn't supported. Upload a JPG, PNG, WEBP, HEIC photo or a PDF.")

    warnings: list[str] = []
    if kind == "pdf":
        return _prepare_pdf(data, warnings)

    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except (UnidentifiedImageError, OSError) as e:
        raise AppError("UNSUPPORTED_FILE", "This image looks damaged and couldn't be opened. Please take the photo again.") from e
    return Prepared(kind="image", images=[_to_jpeg(img, warnings)], warnings=warnings)


def _prepare_pdf(data: bytes, warnings: list[str]) -> Prepared:
    try:
        doc = pymupdf.open(stream=data, filetype="pdf")
    except Exception as e:  # noqa: BLE001
        raise AppError("UNSUPPORTED_FILE", "This PDF couldn't be opened. It may be damaged or password-protected.") from e
    try:
        if doc.needs_pass:
            raise AppError("UNSUPPORTED_FILE", "This PDF is password-protected. Please upload an unlocked copy.")
        if doc.page_count > MAX_PDF_PAGES:
            raise AppError("FILE_TOO_LARGE", f"This PDF has {doc.page_count} pages. Please upload at most {MAX_PDF_PAGES} pages at a time.", 413)

        text = "\n\n".join(page.get_text("text") for page in doc).strip()
        images = []
        for page in doc:
            pix = page.get_pixmap(dpi=150)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            images.append(_to_jpeg(img, []))
        has_text = len(text) >= MIN_TEXT_LAYER_CHARS
        if not has_text:
            warnings.append("This PDF is a scan, so the page was read from its image.")
        return Prepared(kind="pdf", images=images, text_layer=text if has_text else None, pages=doc.page_count, warnings=warnings)
    finally:
        doc.close()
