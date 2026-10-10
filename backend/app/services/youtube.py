"""YouTube link -> captions -> study notes with timestamps. Fact Guard checks every note against the captions.

Only the video's own captions are used (no audio download), via youtube-transcript-api; title from YouTube oEmbed.
"""
from __future__ import annotations

import html
import json
import re
from urllib.parse import parse_qs, urlparse

import httpx
from wordfreq import zipf_frequency
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api import _errors as yt_errors

from ..config import fill, load_prompt
from ..errors import AppError
from . import factguard
from .llm_clients import family, gemini_json, text_json

ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
YT_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtu.be",
            "youtube-nocookie.com", "www.youtube-nocookie.com"}
PART_CHARS = 9000  # transcript characters per notes call (about 8-10 minutes of speech)
MAX_PARTS = 6  # notes cover at most the first ~60 minutes, so a 3-hour video can't use up the free quota
MIN_WORDS = 40
NOISE_RE = re.compile(r"\[(?:music|applause|laughter|♪+|silence|inaudible|foreign)[^\]]*\]|♪+|>>", re.I)
LANG_ORDER = {"auto": ["en", "en-US", "en-GB", "ur", "hi", "ps"], "en": ["en", "en-US", "en-GB"], "ur": ["ur", "hi"], "ps": ["ps"], "hi": ["hi", "ur"]}


def video_id(url: str) -> str:
    """Accepts watch, youtu.be, shorts, embed, live and mobile links (with or without https://, timestamps, extra params)."""
    raw = (url or "").strip()
    if ID_RE.fullmatch(raw):
        return raw
    if not re.match(r"^[a-z]+://", raw, re.I):
        raw = "https://" + raw
    try:
        parsed = urlparse(raw)
    except ValueError as e:
        raise AppError("BAD_URL", "That doesn't look like a YouTube link.") from e
    host = (parsed.hostname or "").lower()
    if host not in YT_HOSTS:
        raise AppError("BAD_URL", "Only YouTube links are supported, for example https://www.youtube.com/watch?v=...")
    parts = [p for p in parsed.path.split("/") if p]
    candidate = ""
    if host.endswith("youtu.be"):
        candidate = parts[0] if parts else ""
    elif parts and parts[0] in ("shorts", "embed", "live", "v", "e"):
        candidate = parts[1] if len(parts) > 1 else ""
    else:
        candidate = (parse_qs(parsed.query).get("v") or [""])[0]
    if ID_RE.fullmatch(candidate):
        return candidate
    if "list" in parse_qs(parsed.query) or (parts and parts[0] in ("playlist", "channel", "c", "user") or (parts and parts[0].startswith("@"))):
        raise AppError("BAD_URL", "That's a playlist or channel link. Open one video and copy its link instead.")
    raise AppError("BAD_URL", "That doesn't look like a link to a YouTube video.")


def metadata(vid: str) -> dict:
    """Title and channel from oEmbed. A failure here is not fatal: captions are what matter."""
    try:
        r = httpx.get("https://www.youtube.com/oembed", params={"url": f"https://www.youtube.com/watch?v={vid}", "format": "json"}, timeout=10)
        if r.status_code == 404:
            raise AppError("VIDEO_UNAVAILABLE", "This video doesn't exist or has been removed.", 404)
        if r.status_code == 200:
            d = r.json()
            return {"title": d.get("title") or "YouTube video", "author": d.get("author_name") or ""}
    except httpx.HTTPError:
        pass
    return {"title": "YouTube video", "author": ""}


def captions(vid: str, language: str = "auto") -> dict:
    """Best caption track: requested language first, people-made before auto-generated, any track as a last resort."""
    api = YouTubeTranscriptApi()
    try:
        tracks = list(api.list(vid))
        wanted = LANG_ORDER.get(language, LANG_ORDER["auto"])
        ranked = sorted(tracks, key=lambda t: (
            next((i for i, code in enumerate(wanted) if t.language_code.lower().startswith(code.lower())), 99), t.is_generated))
        if not ranked:
            raise AppError("NO_CAPTIONS", "This video has no captions, so Roshni can't make notes from it. Try another video.", 422)
        track = ranked[0]
        fetched = track.fetch()
    except AppError:
        raise
    except (yt_errors.TranscriptsDisabled, yt_errors.NoTranscriptFound) as e:
        raise AppError("NO_CAPTIONS", "This video has no captions, so Roshni can't make notes from it. Try another video.", 422) from e
    except (yt_errors.VideoUnavailable, yt_errors.VideoUnplayable, yt_errors.InvalidVideoId) as e:
        raise AppError("VIDEO_UNAVAILABLE", "This video is private, removed or not playable.", 404) from e
    except yt_errors.AgeRestricted as e:
        raise AppError("VIDEO_UNAVAILABLE", "This video is age-restricted, so its captions can't be read.", 422) from e
    except (yt_errors.RequestBlocked, yt_errors.IpBlocked, yt_errors.PoTokenRequired) as e:
        raise AppError("YOUTUBE_BLOCKED", "YouTube is refusing requests from this server right now. Try again later, or run Roshni on a laptop.", 503, True) from e
    except yt_errors.CouldNotRetrieveTranscript as e:
        raise AppError("NO_CAPTIONS", "YouTube didn't return captions for this video. Try another video.", 422) from e
    except (httpx.HTTPError, OSError) as e:
        raise AppError("YOUTUBE_BLOCKED", "Couldn't reach YouTube. Check the internet connection and try again.", 503, True) from e
    except Exception as e:  # noqa: BLE001 - YouTube sent something the caption reader couldn't parse
        raise AppError("NO_CAPTIONS", "YouTube didn't send readable captions for this video. Try again in a minute, or use another video.", 502, True) from e

    segments = []
    for s in fetched.snippets:
        text = NOISE_RE.sub(" ", html.unescape(s.text or "")).replace("\n", " ")
        text = re.sub(r"\s+", " ", text).strip()
        if text:
            segments.append({"start": round(float(s.start), 2), "end": round(float(s.start) + float(s.duration or 0), 2), "text": text})
    words = sum(len(s["text"].split()) for s in segments)
    if words < MIN_WORDS:
        raise AppError("NO_TEXT_FOUND", "This video has too little speech in its captions to make notes from.", 422)
    return {"segments": segments, "language": fetched.language_code, "language_name": fetched.language,
            "generated": bool(fetched.is_generated), "duration": segments[-1]["end"] if segments else 0, "words": words}


GEMINI_SECONDS = 20 * 60  # when Gemini transcribes, it covers the first 20 minutes (keeps the free quota safe)


def gemini_transcript(vid: str) -> dict:
    """Fallback when YouTube blocks this server or the video has no captions: Gemini opens the public video
    itself (Google's servers are not blocked) and writes a timestamped transcript of what is said."""
    try:
        data, model = gemini_json(load_prompt("video_transcribe.txt"), video_url=f"https://www.youtube.com/watch?v={vid}",
                                  video_seconds=GEMINI_SECONDS)
    except AppError as e:
        if e.code == "RATE_LIMITED":
            raise AppError("RATE_LIMITED", "The free AI quota for transcribing videos is busy. Please try again in a minute.", 429, True) from e
        raise AppError("NO_CAPTIONS", "This video couldn't be transcribed. It may be private, too long, or have no speech.", 422) from e
    segments, last = [], -1.0
    for seg in data.get("segments") or []:
        if not isinstance(seg, dict):
            continue
        text = re.sub(r"\s+", " ", NOISE_RE.sub(" ", html.unescape(str(seg.get("text") or "")))).strip()
        start = parse_time(seg.get("start"), 0, GEMINI_SECONDS)
        if text and start >= last:  # keep time order; drop anything that jumps backwards
            segments.append({"start": round(start, 2), "end": round(start, 2), "text": text})
            last = start
    for a, b in zip(segments, segments[1:]):
        a["end"] = b["start"]
    if segments:
        segments[-1]["end"] = segments[-1]["start"] + 10
    words = sum(len(s["text"].split()) for s in segments)
    if words < MIN_WORDS:
        raise AppError("NO_TEXT_FOUND", "This video has too little speech to make notes from.", 422)
    lang = str(data.get("language") or "en")[:8]
    return {"segments": segments, "language": lang, "language_name": f"{lang.upper()} transcript by {model}",
            "generated": True, "duration": segments[-1]["end"], "words": words, "source": "gemini",
            "truncated_at": GEMINI_SECONDS if segments[-1]["start"] >= GEMINI_SECONDS - 60 else None}


def captions_or_transcript(vid: str, language: str = "auto") -> dict:
    """YouTube's own captions first (exact and free); Gemini's transcript when YouTube refuses or has none."""
    try:
        return {**captions(vid, language), "source": "youtube"}
    except AppError as e:
        if e.code not in ("YOUTUBE_BLOCKED", "NO_CAPTIONS"):
            raise
        return gemini_transcript(vid)


def fmt(seconds: float) -> str:
    s = int(seconds)
    return f"{s // 3600}:{s % 3600 // 60:02d}:{s % 60:02d}" if s >= 3600 else f"{s // 60}:{s % 60:02d}"


def parse_time(value, low: float, high: float) -> float:
    """'3:05', '1:02:03', 185 or '185' -> seconds, clamped into the part it belongs to."""
    secs = None
    if isinstance(value, (int, float)):
        secs = float(value)
    elif isinstance(value, str):
        v = value.strip()
        if re.fullmatch(r"\d+(\.\d+)?", v):
            secs = float(v)
        elif re.fullmatch(r"\d{1,2}(:\d{1,2}){1,2}", v):
            secs = 0.0
            for p in v.split(":"):
                secs = secs * 60 + int(p)
    if secs is None:
        return low
    return min(max(secs, low), high)


def split_parts(segments: list[dict]) -> tuple[list[list[dict]], bool]:
    parts, current, size = [], [], 0
    for seg in segments:
        current.append(seg)
        size += len(seg["text"]) + 1
        if size >= PART_CHARS:
            parts.append(current)
            current, size = [], 0
    if current:
        parts.append(current)
    return parts[:MAX_PARTS], len(parts) > MAX_PARTS


def stamped(part: list[dict]) -> str:
    """Transcript with a [m:ss] marker roughly every 20 seconds, so notes can cite where they come from."""
    out, last = [], -999.0
    for seg in part:
        if seg["start"] - last >= 20:
            out.append(f"\n[{fmt(seg['start'])}] ")
            last = seg["start"]
        out.append(seg["text"] + " ")
    return "".join(out).strip()


def plain(part: list[dict]) -> str:
    return " ".join(s["text"] for s in part)


def notes_for_part(part: list[dict]) -> tuple[dict, str]:
    low, high = part[0]["start"], part[-1]["end"]
    data, model = text_json(fill(load_prompt("video_notes.txt"), transcript=stamped(part)), "rewrite", max_tokens=1800)
    sections = []
    for sec in data.get("sections") or []:
        if not isinstance(sec, dict):
            continue
        start = parse_time(sec.get("start"), low, high)
        notes = []
        for n in sec.get("notes") or []:
            text = n.get("text") if isinstance(n, dict) else n
            text = re.sub(r"\s+", " ", str(text or "")).strip()
            if text:
                notes.append({"text": text[:300], "start": parse_time(n.get("start"), low, high) if isinstance(n, dict) else start})
        if notes:
            sections.append({"heading": str(sec.get("heading") or "Notes").strip()[:100], "start": start, "notes": notes[:8]})
    terms = [{"term": str(t.get("term")).strip(), "meaning": str(t.get("meaning") or "").strip()}
             for t in data.get("key_terms") or [] if isinstance(t, dict) and t.get("term")]
    return {"sections": sections, "key_terms": terms[:8]}, model


def check_notes(transcript: str, notes: list[str], writer_model: str) -> tuple[list[dict], str]:
    """One verdict per numbered note: supported (with a quote that really is in the captions), changed or unsupported."""
    numbered = "\n".join(f"{i}. {n}" for i, n in enumerate(notes, start=1))
    try:
        data, model = text_json(fill(load_prompt("notes_check.txt"), transcript=transcript[:14000], notes=numbered),
                                "check", avoid_family=family(writer_model), max_tokens=3000)
    except AppError as e:
        if e.code == "FACTGUARD_UNAVAILABLE":
            return [{"status": "unchecked", "evidence": "", "note": "Fact Guard was busy"} for _ in notes], ""
        raise
    verdicts = {}
    for v in data.get("verdicts") or []:
        if isinstance(v, dict) and str(v.get("n", "")).strip().isdigit():
            verdicts[int(str(v["n"]).strip())] = v
    out = []
    for i in range(1, len(notes) + 1):
        v = verdicts.get(i) or {}
        status = v.get("status") if v.get("status") in ("supported", "changed", "unsupported") else "unchecked"
        evidence = str(v.get("evidence") or "").strip()
        if status == "supported" and not factguard.evidence_ok(evidence, transcript):
            status = "unsupported"  # the quote must really be in the captions
        out.append({"status": status, "evidence": evidence, "note": str(v.get("note") or "").strip()[:200]})
    return out, model


def make_notes(segments: list[dict]) -> dict:
    parts, truncated = split_parts(segments)
    all_sections, terms, models, checkers, rounds = [], [], set(), set(), {"checked": 0, "repaired": 0}
    for part in parts:
        notes, model = notes_for_part(part)
        models.add(model)
        flat = [n for sec in notes["sections"] for n in sec["notes"]]
        transcript = plain(part)
        if flat:
            verdicts, checker = check_notes(transcript, [n["text"] for n in flat], model)
            checkers.add(checker)
            for n, v in zip(flat, verdicts):
                n.update(v)
            rounds["checked"] += len(flat)
            flagged = [i for i, n in enumerate(flat) if n["status"] in ("changed", "unsupported")]
            if flagged:
                repair(flat, flagged, transcript, model, rounds)
        for sec in notes["sections"]:
            sec["notes"] = [n for n in sec["notes"] if n.get("status") != "dropped"]  # the repair round found these weren't said
        all_sections += [sec for sec in notes["sections"] if sec["notes"]]
        seen = {t["term"].lower() for t in terms}
        terms += [t for t in notes["key_terms"] if t["term"].lower() not in seen]
    flat = [n for sec in all_sections for n in sec["notes"]]
    kept = sum(n["status"] == "supported" for n in flat)
    unchecked = sum(n["status"] == "unchecked" for n in flat)
    status = "unavailable" if flat and unchecked == len(flat) else "green" if flat and kept == len(flat) else "amber" if flat else "no_facts"
    return {"notes": all_sections, "key_terms": terms[:12], "truncated": truncated,
            "covered_until": parts[-1][-1]["end"] if parts else 0,
            "factguard": {"status": status, "kept": kept, "total": len(flat), "repaired": rounds["repaired"],
                          "checker_model": ", ".join(sorted(c for c in checkers if c))},
            "models": {"notes": ", ".join(sorted(models)), "checker": ", ".join(sorted(c for c in checkers if c))}}


def repair(flat: list[dict], flagged: list[int], transcript: str, model: str, rounds: dict) -> None:
    """One repair round: flagged notes are rewritten from the captions (or dropped), then checked again."""
    items = [{"n": k + 1, "note": flat[i]["text"], "problem": flat[i]["status"], "detail": flat[i].get("note", "")} for k, i in enumerate(flagged)]
    try:
        data, _ = text_json(fill(load_prompt("notes_repair.txt"), transcript=transcript[:14000], flagged_json=json.dumps(items, ensure_ascii=False)),
                            "rewrite", max_tokens=1200)
    except AppError:
        return
    fixes = {int(str(f.get("n")).strip()): f for f in data.get("fixed") or [] if isinstance(f, dict) and str(f.get("n", "")).strip().isdigit()}
    changed = []
    for k, i in enumerate(flagged):
        fix = fixes.get(k + 1)
        if not fix:
            continue
        if fix.get("drop"):
            flat[i]["dropped"] = True
            continue
        text = re.sub(r"\s+", " ", str(fix.get("text") or "")).strip()
        if text:
            flat[i]["text"] = text[:300]
            changed.append(i)
    if changed:
        verdicts, _ = check_notes(transcript, [flat[i]["text"] for i in changed], model)
        for i, v in zip(changed, verdicts):
            flat[i].update(v)
        rounds["repaired"] += sum(1 for i in changed if flat[i]["status"] == "supported")
    # remove notes the repair round decided to drop (they weren't in the video)
    for i in sorted((i for i in flagged if flat[i].get("dropped")), reverse=True):
        flat[i]["status"] = "dropped"


def relevance(video: dict, lesson: dict) -> dict:
    """Does the video talk about this page? Plain code: the video's topic words (its key terms plus its less common
    words) are looked up in the page's text. An unrelated video gets a warning, not a refusal."""
    page = " ".join((s.get("heading") or "") + " " + (s.get("text") or "") for s in lesson.get("sections") or []).lower()
    page_words = {w.rstrip("s") for w in re.findall(r"[a-z][a-z\-]{3,}", page)}
    if not page_words:
        return {"share": None, "matched": [], "related": True}
    counts: dict[str, int] = {}
    for w in re.findall(r"[a-z][a-z\-]{4,}", " ".join(s["text"] for s in video.get("segments") or []).lower()):
        if zipf_frequency(w, "en") < 4.2:  # topic words, not everyday ones
            counts[w] = counts.get(w, 0) + 1
    topic = [w for w, _ in sorted(counts.items(), key=lambda kv: -kv[1])[:25]]
    topic += [k["term"].lower() for k in video.get("key_terms") or [] if " " not in k["term"]]
    topic = list(dict.fromkeys(topic))
    if not topic:
        return {"share": None, "matched": [], "related": True}
    matched = [w for w in topic if w.rstrip("s") in page_words]
    share = len(matched) / len(topic)
    return {"share": round(share, 2), "matched": matched[:12], "related": share >= 0.2 or len(matched) >= 4}
