#!/usr/bin/env python3
"""녹음 받아쓰기 (확인용, 아무것도 커밋하지 않음).

녹음 파일명이 깨져서 어느 문항인지 모를 때 내용을 확인하는 용도.
GitHub Actions 'transcribe (verify)' 워크플로우에서 실행된다.

    python3 scripts/transcribe.py audio/daniel/*.mp3
"""
import glob
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from align import MODEL, load_audio  # noqa: E402

paths = sorted({p for a in sys.argv[1:] for p in (glob.glob(a) or [a])})
if not paths:
    sys.exit("파일 없음")
from faster_whisper import WhisperModel  # noqa: E402

model = WhisperModel(MODEL, device="cpu", compute_type="int8")
for p in paths:
    wav = load_audio(p)
    segs, _ = model.transcribe(wav, language="en", beam_size=5, condition_on_previous_text=False)
    text = " ".join(s.text.strip() for s in segs)
    print(f"\n=== {p} ({len(wav) / 16000:.1f}s)\n{text}", flush=True)
