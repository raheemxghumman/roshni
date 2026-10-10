"""Edge-case inputs: empty file, wrong type, huge image, rotated photo, digital vs scanned PDF; plus structure clean-up."""
import io

import pymupdf
import pytest
from PIL import Image

from app.errors import AppError
from app.services import ingest, structure


def _jpeg(w=800, h=1000, **kw) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), "white").save(buf, format="JPEG", **kw)
    return buf.getvalue()


def test_empty_file_rejected():
    with pytest.raises(AppError) as e:
        ingest.prepare(b"")
    assert e.value.code == "UNSUPPORTED_FILE"


def test_wrong_type_rejected():
    with pytest.raises(AppError) as e:
        ingest.prepare(b"PK\x03\x04 this is a docx")
    assert e.value.code == "UNSUPPORTED_FILE"


def test_large_image_resized():
    p = ingest.prepare(_jpeg(4000, 3000))
    img = Image.open(io.BytesIO(p.images[0]))
    assert max(img.size) <= ingest.MAX_SIDE


def test_small_image_warns():
    assert ingest.prepare(_jpeg(300, 400)).warnings


def test_digital_pdf_uses_text_layer():
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_textbox(pymupdf.Rect(50, 50, 550, 800), "Photosynthesis turns light energy into chemical energy. " * 10)
    p = ingest.prepare(doc.tobytes())
    assert p.kind == "pdf" and p.text_layer and len(p.images) == 1


def test_scanned_pdf_has_no_text_layer():
    doc = pymupdf.open()
    doc.new_page()
    p = ingest.prepare(doc.tobytes())
    assert p.text_layer is None and p.warnings


def test_too_many_pdf_pages():
    doc = pymupdf.open()
    for _ in range(5):
        doc.new_page()
    with pytest.raises(AppError) as e:
        ingest.prepare(doc.tobytes())
    assert e.value.code == "FILE_TOO_LARGE"


def test_page_furniture_removed_and_title_kept():
    blocks = [
        {"type": "paragraph", "text": "COLLEGE PHYSICS 2E OPENSTAX"},
        {"type": "heading", "level": 1, "text": "2.3 Time"},
        {"type": "paragraph", "text": "Time is change and it is measured in seconds."},
        {"type": "heading", "level": 2, "text": "Velocity"},
        {"type": "paragraph", "text": "Velocity is displacement divided by time."},
        {"type": "paragraph", "text": "Content from OpenStax, licensed under CC BY 4.0."},
        {"type": "paragraph", "text": "42"},
    ]
    title, sections, _ = structure.build_sections(blocks)
    assert title == "2.3 Time"
    assert [s["heading"] for s in sections] == ["2.3 Time", "Velocity"]
    assert all("OPENSTAX" not in b["text"] and b["text"] != "42" for s in sections for b in s["blocks"])
