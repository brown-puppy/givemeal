#!/usr/bin/env python3
"""녹음 ↔ 스크립트 문장 자동 정렬 (GitHub Actions에서 실행).

각 사용자 data/users/<id>/scripts.json 의 audio가 있는 항목마다
faster-whisper로 단어 타임스탬프를 뽑고, 스크립트 문장과 맞춰
data/users/<id>/timings.json 에 문장별 시작 시간을 기록한다.

- 녹음 파일과 스크립트가 바뀌지 않은 항목은 건너뛴다 (해시 비교).
- timings.json 은 자동 생성 파일. 사람/에이전트가 손으로 고치지 않는다.

사용법:
    python3 scripts/align.py                 # 바뀐 항목만
    python3 scripts/align.py --force         # 전부 다시
    python3 scripts/align.py --user daniel   # 특정 사용자만
"""
import argparse
import difflib
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
USERS = ROOT / "data" / "users"
MODEL = "small.en"
LEAD = 0.15          # 탭했을 때 첫 음절이 잘리지 않게 조금 앞에서 시작
WORD_SEC = 0.32      # 매칭 안 된 단어 보정용 평균 단어 길이

# ---------- 해시 (앱 app.js 의 scriptHash 와 같은 방식이어야 함) ----------
def script_hash(script):
    s = json.dumps(script, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(s.encode("utf-8")).hexdigest()[:16]

def file_hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]

# ---------- 문장 나누기 ----------
SPLIT_RE = re.compile(r'[.!?…]+["\'”’)]*\s+')

def split_sentences(para):
    """문단을 문장으로. 반환: [(start, end)] — 이어 붙이면 문단 전체가 됨.
    ** 강조 표시 안쪽에서는 자르지 않는다."""
    cuts = [0]
    for m in SPLIT_RE.finditer(para):
        pos = m.end()
        if pos >= len(para):
            continue
        if para[:pos].count("**") % 2:   # 강조 구간 안
            continue
        cuts.append(pos)
    cuts.append(len(para))
    return [(a, b) for a, b in zip(cuts, cuts[1:]) if para[a:b].strip()]

# ---------- 단어 정규화 ----------
NUM = {"0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six",
       "7": "seven", "8": "eight", "9": "nine", "10": "ten", "15": "fifteen", "21": "twenty-one"}

def words(text):
    t = text.replace("**", " ").replace("’", "'").replace("‘", "'").lower()
    out = []
    for w in re.findall(r"[a-z0-9]+(?:'[a-z]+)?", t):
        out.append(NUM.get(w, w))
    return out

# ---------- 정렬 ----------
def align_item(script, twords):
    """script: 문단 배열, twords: [(word, start, end)] → (sentences, score)"""
    sents = []       # [p, a, b]
    swords = []      # (norm word, sentence index)
    for p, para in enumerate(script):
        for a, b in split_sentences(para):
            si = len(sents)
            sents.append([p, a, b])
            for w in words(para[a:b]):
                swords.append((w, si))
    tnorm = []
    tmeta = []
    for w, st, en in twords:
        for x in words(w):
            tnorm.append(x)
            tmeta.append((st, en))
    sm = difflib.SequenceMatcher(None, [w for w, _ in swords], tnorm, autojunk=False)
    match = {}
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            match[blk.a + k] = blk.b + k
    score = len(match) / max(1, len(swords))

    # 문장별 시작 시간
    first_idx = {}
    for i, (_, si) in enumerate(swords):
        first_idx.setdefault(si, i)
    starts = [None] * len(sents)
    for si in range(len(sents)):
        idxs = [i for i, (_, s) in enumerate(swords) if s == si]
        for pos, i in enumerate(idxs):
            if i in match:
                starts[si] = max(0.0, tmeta[match[i]][0] - pos * WORD_SEC - LEAD)
                break
    # 단조 증가 + 빈 곳 보간
    known = [(i, t) for i, t in enumerate(starts) if t is not None]
    if not known:
        return None, score
    for i in range(len(starts)):
        if starts[i] is None:
            prev = max((k for k in known if k[0] < i), default=None, key=lambda k: k[0])
            nxt = min((k for k in known if k[0] > i), default=None, key=lambda k: k[0])
            if prev and nxt:
                starts[i] = prev[1] + (nxt[1] - prev[1]) * (i - prev[0]) / (nxt[0] - prev[0])
            elif prev:
                starts[i] = prev[1] + (i - prev[0]) * 3.0
            else:
                starts[i] = max(0.0, nxt[1] - (nxt[0] - i) * 3.0)
    if starts[0] < 1.0:   # 첫 문장이 거의 처음이면 0초부터
        starts[0] = 0.0
    for i in range(1, len(starts)):
        starts[i] = max(starts[i], starts[i - 1] + 0.3)
    out = [[p, a, b, round(t, 2)] for (p, a, b), t in zip(sents, starts)]
    return out, round(score, 3)

# ---------- 오디오 로드 (ffmpeg → 16kHz mono float32) ----------
def load_audio(path):
    import subprocess
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-i", str(path),
                          "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0

# ---------- main ----------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--user")
    args = ap.parse_args()

    model = None
    changed_users = []
    for udir in sorted(USERS.iterdir()):
        if not udir.is_dir() or udir.name.startswith("_"):
            continue
        if args.user and udir.name != args.user:
            continue
        sp = udir / "scripts.json"
        if not sp.exists():
            continue
        data = json.loads(sp.read_text(encoding="utf-8"))
        tp = udir / "timings.json"
        old = json.loads(tp.read_text(encoding="utf-8")) if tp.exists() else {}
        new = {}
        for t in data.get("topics", []):
            for it in t.get("items", []):
                a = it.get("audio")
                if not a or not (ROOT / a).is_file():
                    continue
                ah, sh = file_hash(ROOT / a), script_hash(it["script"])
                prev = old.get(it["id"])
                if prev and not args.force and prev.get("audio") == ah and prev.get("script") == sh and prev.get("model") == MODEL:
                    new[it["id"]] = prev
                    continue
                if model is None:
                    from faster_whisper import WhisperModel
                    print(f"loading {MODEL} ...", flush=True)
                    model = WhisperModel(MODEL, device="cpu", compute_type="int8")
                wav = load_audio(ROOT / a)
                segs, info = model.transcribe(wav, language="en", word_timestamps=True,
                                              beam_size=5, condition_on_previous_text=False, vad_filter=False)
                tw = [(w.word, w.start, w.end) for s in segs for w in (s.words or [])]
                sents, score = align_item(it["script"], tw)
                flag = "  ⚠️ 녹음과 스크립트가 많이 다름" if score < 0.6 else ""
                print(f"{udir.name}/{it['id']}: {len(tw)} words, score {score}{flag}", flush=True)
                if sents is None:
                    continue
                new[it["id"]] = {"audio": ah, "script": sh, "model": MODEL, "score": score,
                                 "duration": round(len(wav) / 16000, 2), "sentences": sents}
        if new != old:
            if new:
                tp.write_text(json.dumps(new, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
            elif tp.exists():
                tp.unlink()
            changed_users.append(udir.name)
    print("changed:", ", ".join(changed_users) or "-")

if __name__ == "__main__":
    sys.exit(main())
