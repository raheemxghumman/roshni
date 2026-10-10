"""YouTube links, timestamps, transcript parts and page relevance (no network calls)."""
import pytest

from app.errors import AppError
from app.services import youtube

VID = "dQw4w9WgXcQ"


@pytest.mark.parametrize("url", [
    f"https://www.youtube.com/watch?v={VID}", f"https://youtube.com/watch?v={VID}&t=42s", f"youtube.com/watch?v={VID}",
    f"https://m.youtube.com/watch?v={VID}&feature=share", f"https://youtu.be/{VID}", f"https://youtu.be/{VID}?si=abc&t=10",
    f"https://www.youtube.com/shorts/{VID}", f"https://www.youtube.com/embed/{VID}", f"https://www.youtube.com/live/{VID}?feature=x",
    f"https://www.youtube-nocookie.com/embed/{VID}", f"https://www.youtube.com/watch?v={VID}&list=PL123", f"  {VID}  ", VID,
])
def test_video_links(url):
    assert youtube.video_id(url) == VID


@pytest.mark.parametrize("url", ["https://vimeo.com/12345", "https://www.youtube.com/playlist?list=PL123", "https://www.youtube.com/@channel",
                                  "https://www.youtube.com/watch?v=short", "not a link", "https://evil.com/watch?v=" + VID, ""])
def test_bad_links(url):
    with pytest.raises(AppError) as e:
        youtube.video_id(url)
    assert e.value.code == "BAD_URL"


@pytest.mark.parametrize("value,expected", [("1:05", 65), ("0:08:20", 500), (90, 90), ("90", 90), ("garbage", 10), ("0:01", 10), ("99:00", 500)])
def test_parse_time_clamps_into_part(value, expected):
    assert youtube.parse_time(value, 10, 500) == expected


def test_fmt():
    assert youtube.fmt(65) == "1:05" and youtube.fmt(3723) == "1:02:03"
    assert youtube.parse_time("1:02:03", 0, 9999) == 3723


def test_long_videos_are_capped():
    segs = [{"start": i * 5.0, "end": i * 5.0 + 5, "text": "word " * 60} for i in range(1000)]
    parts, truncated = youtube.split_parts(segs)
    assert len(parts) == youtube.MAX_PARTS and truncated
    short, truncated = youtube.split_parts(segs[:10])
    assert len(short) == 1 and not truncated


def test_stamped_transcript_has_markers():
    text = youtube.stamped([{"start": 0, "end": 5, "text": "Hello"}, {"start": 25, "end": 30, "text": "Water evaporates"}])
    assert "[0:00]" in text and "[0:25]" in text


def test_relevance():
    lesson = {"sections": [{"heading": "The Water Cycle", "text": "Water moves by evaporation, condensation and precipitation. Plants add vapour by transpiration."}]}
    seg = lambda text: {"segments": [{"text": text}], "key_terms": []}  # noqa: E731
    on = youtube.relevance(seg("Evaporation lifts vapour. Condensation forms clouds. Precipitation falls as rain. Transpiration from plants."), lesson)
    assert on["related"] and "evaporation" in on["matched"]
    off = youtube.relevance(seg("Today we review smartphones, their cameras, processors and batteries, plus wireless chargers."), lesson)
    assert not off["related"]
