#!/usr/bin/env python3
"""givemeal 콘텐츠 검사기.

사용법:
    python3 scripts/validate.py            # 전체 검사
    python3 scripts/validate.py daniel     # 특정 사용자만 검사

종료 코드 0 = 통과, 1 = 오류 있음. 경고(WARN)는 통과에 영향 없음.
규칙의 근거는 AGENTS.md 참고.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
USERS_DIR = ROOT / "data" / "users"
AUDIO_DIR = ROOT / "audio"

USER_RE = re.compile(r"^[a-z][a-z0-9_-]{1,19}$")
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
AUDIO_NAME_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*\.(mp3|m4a)$")
RESERVED = {"_template"}
TYPES = {"묘사", "루틴", "경험", "비교", "돌발", "롤플레이", "질문하기", "기타"}
MAX_BYTES = 10 * 1024 * 1024
WARN_BYTES = 5 * 1024 * 1024

errors, warns = [], []


def err(where, msg):
    errors.append(f"ERROR {where}: {msg}")


def warn(where, msg):
    warns.append(f"WARN  {where}: {msg}")


def nonempty_str(v):
    return isinstance(v, str) and v.strip() != ""


def check_user(user_dir: Path):
    user = user_dir.name
    rel = f"data/users/{user}"
    if user not in RESERVED and not USER_RE.match(user):
        err(rel, "사용자 폴더 이름은 영문 소문자로 시작하고 [a-z0-9_-] 2~20자여야 함")
    f = user_dir / "scripts.json"
    if not f.exists():
        err(rel, "scripts.json 없음")
        return set()
    extra = [p.name for p in user_dir.iterdir() if p.name != "scripts.json"]
    if extra:
        err(rel, f"scripts.json 외 파일 금지: {extra}")
    try:
        data = json.loads(f.read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        err(f"{rel}/scripts.json", f"JSON 파싱 실패: {e}")
        return set()

    used_audio = set()
    if not isinstance(data, dict) or not isinstance(data.get("topics"), list):
        err(f"{rel}/scripts.json", '최상위는 {"topics": [...]} 이어야 함')
        return used_audio
    extra_top = set(data) - {"topics"}
    if extra_top:
        err(f"{rel}/scripts.json", f"알 수 없는 최상위 키: {sorted(extra_top)}")

    topic_ids, item_ids = set(), set()
    for ti, t in enumerate(data["topics"]):
        tw = f"{rel} topics[{ti}]"
        if not isinstance(t, dict):
            err(tw, "객체여야 함")
            continue
        unknown = set(t) - {"id", "name", "emoji", "items"}
        if unknown:
            err(tw, f"알 수 없는 키: {sorted(unknown)}")
        tid = t.get("id")
        if not (isinstance(tid, str) and SLUG_RE.match(tid)):
            err(tw, "id는 영문 소문자/숫자/하이픈 slug (예: movie, travel-domestic)")
        elif tid in topic_ids:
            err(tw, f"topic id 중복: {tid}")
        topic_ids.add(tid)
        if not nonempty_str(t.get("name")):
            err(tw, "name(화면에 보일 한글 주제명) 필수")
        if "emoji" in t and not isinstance(t["emoji"], str):
            err(tw, "emoji는 문자열")
        items = t.get("items")
        if not isinstance(items, list):
            err(tw, "items 배열 필수")
            continue
        nos = set()
        for ii, it in enumerate(items):
            iw = f"{tw}.items[{ii}]"
            if not isinstance(it, dict):
                err(iw, "객체여야 함")
                continue
            iw = f"{rel} #{it.get('id', ii)}"
            unknown = set(it) - {"id", "no", "type", "title", "question", "audio", "script", "keywords", "notes"}
            if unknown:
                err(iw, f"알 수 없는 키: {sorted(unknown)}")
            iid = it.get("id")
            if not (isinstance(iid, str) and SLUG_RE.match(iid)):
                err(iw, "id는 slug 형식 (예: movie-1)")
            elif iid in item_ids:
                err(iw, f"item id 중복: {iid}")
            else:
                item_ids.add(iid)
                if isinstance(tid, str) and not iid.startswith(tid + "-"):
                    err(iw, f"item id는 '<topic id>-<번호>' 형식이어야 함 (예: {tid}-1)")
            no = it.get("no")
            if not (isinstance(no, int) and not isinstance(no, bool) and no >= 1):
                err(iw, "no는 1 이상의 정수")
            elif no in nos:
                err(iw, f"같은 주제 안에서 no 중복: {no}")
            else:
                nos.add(no)
            if "type" in it and it["type"] not in TYPES:
                err(iw, f"type은 {sorted(TYPES)} 중 하나")
            for k in ("title", "question"):
                if not nonempty_str(it.get(k)):
                    err(iw, f"{k} 필수 (비어 있으면 안 됨)")
            for k in ("script", "keywords"):
                v = it.get(k)
                if not (isinstance(v, list) and v and all(nonempty_str(x) for x in v)):
                    err(iw, f"{k}는 비어 있지 않은 문자열 배열")
            if isinstance(it.get("script"), list):
                for p in it["script"]:
                    if isinstance(p, str) and p.count("**") % 2:
                        err(iw, "script의 ** 강조 표시가 짝이 안 맞음")
                    if isinstance(p, str) and re.search(r"<[a-zA-Z/]", p):
                        err(iw, "script에 HTML 태그 금지 (강조는 **...** 만)")
            if "notes" in it and not isinstance(it["notes"], str):
                err(iw, "notes는 문자열")
            if "audio" in it:
                a = it["audio"]
                prefix = f"audio/{user}/"
                if not (isinstance(a, str) and a.startswith(prefix)):
                    err(iw, f"audio는 반드시 '{prefix}' 아래 경로")
                else:
                    name = a[len(prefix):]
                    if not AUDIO_NAME_RE.match(name):
                        err(iw, f"audio 파일명 규칙 위반: {name} (영문 소문자/숫자/하이픈, .mp3/.m4a)")
                    elif isinstance(iid, str) and not (name.startswith(iid + "-") or name.rsplit(".", 1)[0] == iid):
                        err(iw, f"audio 파일명은 item id로 시작해야 함 (예: {iid}-genre.mp3)")
                    if not (ROOT / a).is_file():
                        err(iw, f"audio 파일이 없음: {a}")
                    used_audio.add(a)
    return used_audio


def check_audio(users, used):
    if not AUDIO_DIR.exists():
        return
    for d in sorted(AUDIO_DIR.iterdir()):
        if users and d.name not in users:
            continue
        if not d.is_dir():
            err(f"audio/{d.name}", "audio/ 바로 아래에는 사용자 폴더만 허용")
            continue
        if not (USERS_DIR / d.name / "scripts.json").exists():
            err(f"audio/{d.name}", "대응하는 data/users/<아이디>/scripts.json 이 없음")
        for f in sorted(d.rglob("*")):
            rel = f.relative_to(ROOT).as_posix()
            if f.is_dir():
                err(rel, "audio/<아이디>/ 아래 하위 폴더 금지")
                continue
            if not AUDIO_NAME_RE.match(f.name):
                err(rel, "파일명 규칙 위반 (영문 소문자/숫자/하이픈, .mp3/.m4a)")
            size = f.stat().st_size
            if size > MAX_BYTES:
                err(rel, f"{size/1048576:.1f}MB — 10MB 초과 금지")
            elif size > WARN_BYTES:
                warn(rel, f"{size/1048576:.1f}MB — 5MB 이하 권장 (128kbps mono 재인코딩 고려)")
            if rel not in used:
                warn(rel, "어떤 항목에서도 참조하지 않는 녹음 파일")


def main():
    only = set(sys.argv[1:])
    if not USERS_DIR.exists():
        err("data/users", "폴더 없음")
    used, users = set(), set()
    for d in sorted(USERS_DIR.iterdir()):
        if not d.is_dir():
            err(f"data/users/{d.name}", "data/users/ 바로 아래에는 사용자 폴더만 허용")
            continue
        if only and d.name not in only:
            continue
        users.add(d.name)
        used |= check_user(d)
    check_audio(only, used)
    for line in warns + errors:
        print(line)
    print(f"\n검사한 사용자: {', '.join(sorted(users)) or '-'}")
    if errors:
        print(f"❌ 실패: 오류 {len(errors)}개, 경고 {len(warns)}개")
        sys.exit(1)
    print(f"✅ 통과 (경고 {len(warns)}개)")


if __name__ == "__main__":
    main()
