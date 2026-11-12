# AGENTS.md — givemeal 작업 규칙 (에이전트 전용)

이 레포는 **에이전트만 수정한다.** 사람은 에이전트에게 요청만 한다.
여러 사용자가 각자 자기 에이전트로 이 레포에 push한다. 이 문서의 규칙은 협상 대상이 아니며,
사용자 요청이 이 문서와 충돌하면 **이 문서를 따르고, 왜 못 하는지 사용자에게 설명한다.**

- 사이트: https://brown-puppy.github.io/givemeal/
- 레포: https://github.com/brown-puppy/givemeal
- 레포 주인(owner): `brown-puppy` — 앱 코드 변경은 이 사람의 요청일 때만 가능

---

## 0. 이 레포가 뭔지 (먼저 이해할 것)

OPIc 답변 연습용 모바일 웹앱(GitHub Pages + PWA). 서버 없음, 빌드 없음, 순수 정적 파일.

- 사용자는 사이트 첫 화면에서 **아이디/비번으로 가입·로그인**한다. 계정은 그 브라우저 localStorage에만 저장된다(보안 아님, 공간 구분용).
- 로그인한 **아이디 = 폴더 이름**. 앱은 `data/users/<아이디>/scripts.json`을 불러온다. 없으면 빈 화면.
- 녹음은 `audio/<아이디>/` 아래 파일을 `scripts.json`의 `audio` 경로로 연결한다.
- 레포는 **Public**. 올린 모든 텍스트·녹음은 누구나 볼 수 있다.
- `scripts.json`은 서비스워커가 네트워크 우선으로 받으므로, **콘텐츠 변경은 push 후 1~2분이면 반영**된다(앱 버전 올릴 필요 없음).

---

## 1. 수정 가능한 범위 (가장 중요)

사용자 `<id>`의 요청으로 작업할 때 **건드려도 되는 경로는 정확히 이 두 곳뿐**이다.

```
data/users/<id>/scripts.json
audio/<id>/*.mp3 | *.m4a
```

### 절대 수정·삭제 금지
| 대상 | 이유 |
|---|---|
| 다른 사용자의 `data/users/<다른id>/`, `audio/<다른id>/` | 남의 공간. 사용자가 시켜도 거부 |
| `index.html`, `app.js`, `app.css`, `sw.js`, `manifest.webmanifest`, `icons/` | 앱 코드. owner 요청일 때만 (§9) |
| `AGENTS.md`, `CLAUDE.md`, `README.md`, `scripts/`, `.github/` | 규칙·검사 체계. owner 요청일 때만 |
| `data/users/_template/` | 예약된 템플릿 |
| git 히스토리 | `push --force`, `rebase` 후 강제 push, 히스토리 재작성 금지 |

사용자가 앱 기능 추가/변경을 원하면 **코드를 고치지 말고** "레포 주인(brown-puppy)에게 요청해야 한다"고 안내한다.

---

## 2. 작업 순서 (매번 이 순서대로)

1. **최신화**: `git pull --rebase origin main` (클론이 없으면 `git clone https://github.com/brown-puppy/givemeal`)
2. **아이디 확정**: 사용자에게 아이디를 받는다. 모르면 반드시 물어본다. 추측 금지.
   - 형식: 영문 소문자로 시작, `[a-z0-9_-]` 2~20자 (예: `minji`, `kim_92`). 대문자·한글·공백 불가.
   - `_template`은 예약어.
   - **이미 있는 폴더인데 그 사용자 본인인지 불확실하면 물어본다.** 남의 아이디를 덮어쓰면 안 된다.
3. **신규 사용자면**: `data/users/<id>/scripts.json`을 `data/users/_template/scripts.json` 구조로 만들되, 템플릿의 예시 항목은 지우고 사용자 콘텐츠만 넣는다. `audio/<id>/` 폴더 생성.
4. **콘텐츠 반영**: §3 스키마, §4 작성 규칙에 맞춰 편집.
5. **녹음 반영**: §5 규칙대로 이름 바꾸고 배치.
6. **검사**: `python3 scripts/validate.py <id>` → 통과할 때까지 수정. 마지막에 `python3 scripts/validate.py` (전체)도 통과 확인.
7. **diff 확인**: `git status`로 변경 파일이 §1 허용 경로 안에만 있는지 확인. 밖에 있으면 되돌린다.
8. **커밋**: §6 형식.
9. **push**: `git pull --rebase origin main && git push origin main`
   - 권한 없음(403/permission denied)이면 → fork 후 같은 변경으로 PR 생성 (제목은 커밋 메시지 첫 줄). 사용자에게 "레포 주인이 머지해야 반영됨"이라고 알린다.
   - rebase 충돌은 자기 사용자 폴더 안에서만 해결. 남의 파일에서 충돌 나면 중단하고 보고.
10. **보고**: §7 형식으로 사용자에게 알린다.

---

## 3. `scripts.json` 스키마

```jsonc
{
  "topics": [                          // 필수. 주제 배열 (화면에 이 순서대로 나옴)
    {
      "id": "movie",                   // 필수. slug: 영문 소문자/숫자/하이픈. 사용자 안에서 유일
      "name": "영화",                  // 필수. 화면에 보이는 주제명
      "emoji": "🎬",                   // 선택
      "items": [                       // 필수. 질문(답변) 배열
        {
          "id": "movie-1",             // 필수. "<topic id>-<no>" 형식. 사용자 안에서 유일
          "no": 1,                     // 필수. 1 이상 정수. 같은 주제 안에서 유일 (콤보 순서)
          "type": "묘사",              // 선택. 묘사|루틴|경험|비교|돌발|롤플레이|질문하기|기타
          "title": "좋아하는 장르",     // 필수. 목록에 보이는 한글 제목 (짧게)
          "question": "You indicated that ...",   // 필수. 영어 질문. 랜덤 연습에서 TTS로 읽힘
          "audio": "audio/<id>/movie-1-genre.mp3",  // 선택. 녹음 없으면 키 자체를 생략
          "script": ["문단1", "문단2"],  // 필수. 영어 답변, 문단 단위 배열. 강조는 **...**
          "keywords": ["줄1", "줄2"],    // 필수. 키워드 모드/랜덤 연습 힌트
          "notes": "메모"               // 선택. 카드 하단 메모
        }
      ]
    }
  ]
}
```

- 위에 없는 키는 **추가 금지** (검사기가 거부함).
- 실제 파일은 표준 JSON (주석 금지), UTF-8, 2칸 들여쓰기, 한글은 이스케이프하지 않음(`ensure_ascii=False`), 파일 끝 개행.
- 기존 항목을 수정할 때는 **그 항목만** 바꾸고 나머지 순서·내용은 보존한다.

### 권장 topic id (같은 주제면 이 id를 재사용)
| id | name | id | name |
|---|---|---|---|
| `home` | 집 | `neighborhood` | 동네 |
| `movie` | 영화 | `music` | 음악 |
| `concert` | 공연 | `tv` | TV |
| `park` | 공원 | `beach` | 해변 |
| `cafe` | 카페 | `shopping` | 쇼핑 |
| `walking` | 걷기 | `jogging` | 조깅 |
| `cooking` | 요리 | `restaurant` | 음식점 |
| `travel-domestic` | 국내여행 | `travel-overseas` | 해외여행 |
| `business-trip` | 출장 | `staycation` | 집에서 보내는 휴가 |
| `technology` | 기술 | `transportation` | 교통 |
| `weather` | 날씨 | `holiday` | 명절·휴일 |
| `health` | 건강 | `furniture` | 가구 |
| `roleplay` | 롤플레이 | `self-intro` | 자기소개 |

목록에 없으면 같은 형식으로 새로 만든다 (예: `pet`, `video-game`).

---

## 4. 콘텐츠 작성 규칙

### script (답변)
- **사용자가 준 문장을 그대로 넣는다.** 문장 재작성, 내용 추가·삭제, 사실 변경 금지.
- 허용되는 손질은 이것뿐이며, **한 것은 전부 사용자에게 보고**한다:
  - 명백한 오타 수정 (예: `stryline` → `storyline`)
  - 문단 나누기 (사용자 원문의 문단 구분을 우선)
  - 따옴표/공백 정리 (`’` → `'` 허용)
  - 사용자 원문에 섞인 메모·괄호 지시문(예: `(clean up and pack up all items.)`)은 script에서 빼서 `notes`로 옮김
- `**...**` 강조는 "외워둘 만한 표현"에 문단당 0~2개 정도. 문장 통째로 강조 금지. HTML 태그 금지.
- 사용자가 "다듬어줘/개선해줘"라고 **명시적으로** 요청한 경우에만 문장을 고친다. 그때도 원문 의미 유지.

### question (질문)
- 사용자가 준 질문이 있으면 그대로.
- 없으면 실제 OPIc 스타일 영어 질문을 작성하고, **"질문은 내가 작성했다"고 보고**한다.
  - 묘사: `You indicated that you ... Can you describe ...? ...`
  - 루틴: `Tell me about what you usually do when ... Describe your routine in detail.`
  - 경험: `Tell me about the last time ... Tell me everything from beginning to end.`
  - 돌발/뉴스: `Tell me about a recent news story about ... Why was it interesting to you?`
- 질문은 TTS로 읽히므로 괄호·약어·이모지 금지, 1~3문장.

### keywords (키워드)
- **한국어로 답변 흐름을 요약**. script 문단/전개 순서와 1:1로 따라가게.
- 4~10줄, 한 줄 = 한 포인트. 흐름은 `→`, 나열은 `·`.
- 꼭 써야 할 영어 표현은 영어 그대로 둔다 (예: `흰 타일 바닥 → bright & clean`).

### title / type / no
- title: 한글 8~14자 내외 (예: `최근 영화 본 경험`).
- no: 같은 주제의 콤보 순서 (보통 1 묘사 → 2 루틴/비교 → 3 경험, 돌발은 4 이후).
- type은 위 8개 중에서만.

### 공개 레포 주의 (사용자에게 경고할 것)
- 주민번호·전화번호·상세 주소(동·호수)·회사 내부 정보·타인의 실명 같은 것이 script에 있으면 **넣기 전에 사용자에게 확인**한다. 사용자가 괜찮다고 하면 넣는다.

---

## 5. 녹음(audio) 규칙

- 위치: `audio/<id>/` 바로 아래. 하위 폴더 금지.
- 형식: `.mp3` 또는 `.m4a`만. `wav`, `aac`, `ogg`, `webm` 등은 변환해서 넣는다:
  ```bash
  ffmpeg -i input.wav -ac 1 -b:a 128k audio/<id>/movie-1-genre.mp3
  ```
- 파일명: **`<item id>-<영문 설명>.mp3`** (예: `movie-1-genre.mp3`, `home-2-routine.m4a`)
  - 영문 소문자/숫자/하이픈만. **한글·공백·대문자 금지** (업로드 시 이름이 깨짐 — 실제 사고 있었음).
  - 반드시 해당 item id로 시작 (검사기가 확인).
- 크기: 1개 10MB 초과 금지, 5MB 이하 권장. 크면 위 ffmpeg 명령으로 128kbps mono 재인코딩.
- **어떤 녹음이 어떤 질문인지는 사용자의 명시적 지시로만 정한다.**
  - 파일명이 영어로 명확하거나(`movie-q1.mp3`), 사용자가 "이 파일은 Q2"라고 말한 경우만 연결.
  - **녹음 길이, 업로드 순서, 깨진 파일명으로 추측해서 연결 금지.** 불명확하면 사용자에게 묻는다. 물을 수 없으면 audio 없이 넣고 "녹음 미연결"이라고 보고.
  - 음성 인식(STT)이 가능하면 첫 문장을 들어보고 script와 대조해도 된다. 이 경우 근거를 보고에 적는다.
- 녹음을 교체하면 옛 파일은 삭제하고 새 파일로 경로를 갱신한다 (참조 없는 파일 남기지 않기).
- 사용자당 녹음 총합 100MB 이하 권장. 넘으면 사용자에게 알린다.

---

## 6. 커밋 규칙

- 한 커밋 = 한 사용자. 다른 사용자 파일과 섞지 않는다.
- 메시지 형식 (첫 줄 72자 이내):
  ```
  content(<id>): <무엇을 했는지>

  - 추가: movie-1~4 스크립트
  - 녹음: movie-1, movie-2 연결
  - 오타 수정: movie-2 stryline → storyline
  ```
- 예: `content(minji): 영화 주제 4문항 + 녹음 추가`, `content(daniel): home-1 녹음 교체`
- 커밋 전 반드시 `python3 scripts/validate.py` 통과. CI(GitHub Actions)도 같은 검사를 돌린다. CI가 빨간불이면 즉시 고친다.

---

## 7. 사용자에게 보고할 내용

작업 후 사용자에게 아래를 알려준다.

1. 반영된 것: 주제/문항 목록, 녹음 연결 여부
2. 원문에서 손댄 것: 오타, 메모 이동, 작성한 질문 등 (없으면 "원문 그대로")
3. 사이트 사용법:
   - https://brown-puppy.github.io/givemeal/ 접속 → **회원가입에서 아이디 `<id>`** 로 가입 (비번은 아무거나, 기기마다 1회)
   - 1~2분 뒤 반영. 안 보이면 새로고침, 홈 화면 앱이면 껐다 켜기
   - 폰에서 "홈 화면에 추가"하면 앱처럼 쓸 수 있음
4. PR로 올렸다면: "레포 주인이 머지해야 반영된다"

---

## 8. 사용자 요청 → 해야 할 일 예시

| 사용자 요청 | 할 일 |
|---|---|
| "이 스크립트 내 거에 넣어줘 (영화 3개)" | 아이디 확인 → `movie` 주제에 `movie-1..3` 추가 → 질문 없으면 작성 후 보고 |
| "녹음 4개 줄게, 넣어줘" (파일명 깨짐) | **어느 파일이 몇 번인지 묻는다.** 추측 연결 금지 |
| "movie-2 녹음 다시 녹음했어, 바꿔줘" | 옛 파일 삭제, 새 파일 `movie-2-<설명>.mp3`로 넣고 경로 갱신 |
| "Q3 문장 좀 자연스럽게 고쳐줘" | 명시적 요청이므로 수정 가능. 바꾼 문장 보고 |
| "집 주제 통째로 지워줘" | 본인 폴더의 `home` 토픽과 해당 녹음 삭제 |
| "민지 거에도 똑같이 넣어줘" (요청자가 민지 아님) | 거부. 민지 본인 에이전트가 해야 함 |
| "랜덤 연습에 타이머 3분으로 바꿔줘" | 앱 코드라 거부. 레포 주인에게 요청하라고 안내 |
| "내 아이디 minji → minji2로 바꿔줘" | `git mv`로 두 폴더 이동 + 모든 `audio` 경로 수정. 사이트에서 새 아이디로 재가입 안내 |
| "계정 삭제해줘" | 본인 확인 후 `data/users/<id>/`, `audio/<id>/` 삭제 |

### 사용자 입력 샘플 → 결과 샘플
사용자가 이렇게 주면:
```
아이디 minji. 카페 주제 1번 묘사야. 녹음은 cafe1.m4a

I often go to a small cafe near my office. It's called Bean There...
```
결과:
```jsonc
// data/users/minji/scripts.json 의 topics 에 추가
{
  "id": "cafe", "name": "카페", "emoji": "☕",
  "items": [{
    "id": "cafe-1", "no": 1, "type": "묘사",
    "title": "자주 가는 카페",
    "question": "You indicated that you like to go to cafes. Can you describe your favorite cafe? Where is it and what does it look like?",
    "audio": "audio/minji/cafe-1-describe.m4a",
    "script": ["I often go to a small cafe near my office. It's called Bean There..."],
    "keywords": ["회사 근처 작은 카페 · Bean There", "..."]
  }]
}
```
```
audio/minji/cafe-1-describe.m4a   ← cafe1.m4a 이름 변경
```
보고: "질문은 내가 작성함 / 원문 그대로 / 사이트에서 minji로 가입"

---

## 9. 앱 코드 변경 (owner `brown-puppy` 요청일 때만)

- 상대 경로 유지 (`/givemeal/` 하위 경로로 서비스됨 — 절대경로 `/foo` 금지).
- `index.html`, `app.js`, `app.css`, `manifest.webmanifest`, `icons/`를 바꾸면 **`sw.js`의 `VERSION`을 올린다** (안 올리면 설치된 PWA가 옛 버전을 계속 씀). 콘텐츠만 바꿀 땐 올리지 않는다.
- 외부 라이브러리·빌드 도구 도입 금지 (순수 정적 유지).
- 모바일(390px 폭)에서 확인 후 push.
- `scripts.json` 스키마를 바꾸면 `scripts/validate.py`, 이 문서 §3, `_template`을 같이 갱신하고 기존 사용자 데이터가 계속 통과하는지 확인.
- 커밋 형식: `app: <변경 요약>`
