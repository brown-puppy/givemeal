# givemeal — OPIc 스크립트 노트

내 OPIc 답변 스크립트와 녹음을 모아 폰에서 외우고 연습하는 웹앱.

👉 **https://brown-puppy.github.io/givemeal/**

- 주제별 답변 보기: 전문 / 키워드 / 가리기 모드, 내 녹음 듣기 (속도·반복)
- 랜덤 연습: 질문을 음성으로만 듣고 → 5초 준비 (다시 듣기 1회) → 답변 타이머
- 드라이브: 고른 범위를 순서대로/랜덤으로 질문 → 10초 답해보기 → 내 녹음 자동 연속 재생 (운전·이동 중)
- 사람마다 아이디별로 자기 스크립트만 보임

---

## 내 스크립트 넣는 법

이 레포는 **사람이 직접 고치지 않고, 각자의 AI 에이전트(Claude Code, Codex 등)가 수정**합니다.
에이전트는 레포의 [`AGENTS.md`](./AGENTS.md) 규칙을 따릅니다.

### 1. 아이디 정하기
영문 소문자로 시작, 영문 소문자·숫자·`_`·`-` 2~20자 (대문자는 자동으로 소문자 처리) (예: `minji`, `kim_92`).
이 아이디가 곧 내 공간 이름이고, 사이트 로그인 아이디입니다.

### 2. 레포 쓰기 권한
- **권한을 받은 경우**: 에이전트가 바로 push → 1~2분 뒤 반영
- **권한이 없는 경우**: 에이전트가 fork 후 PR을 올림 → 레포 주인(`brown-puppy`)이 머지하면 반영
- 권한이 필요하면 레포 주인에게 GitHub 아이디를 알려주고 collaborator 초대를 받으세요.

### 3. 에이전트에게 요청하기
레포 주소와 함께 아래처럼 말하면 됩니다. 녹음 파일은 같이 첨부하세요.

**처음 등록 + 스크립트 추가**
```
https://github.com/brown-puppy/givemeal 레포에 내 OPIc 스크립트 넣어줘.
AGENTS.md 규칙 꼭 지켜.
아이디: minji

[영화 1번 - 좋아하는 장르]
I watch various kinds of movies, but my favorite genre is ...

[영화 2번 - 영화 보러 갈 때 루틴]
I usually go to the movies with my friends ...
```

**녹음 추가** (파일명은 영어로 올리는 게 제일 안전)
```
givemeal 레포 minji 계정에 녹음 넣어줘.
movie-q1.mp3 → 영화 1번, movie-q2.mp3 → 영화 2번
```

**수정 / 교체 / 삭제**
```
givemeal 레포 minji 계정에서
- 영화 2번 녹음 새 걸로 바꿔줘 (첨부 파일)
- 집 주제는 통째로 지워줘
```

**질문 문장까지 직접 정하고 싶으면**
```
[집 1번 묘사]
Q: You indicated that you live in an apartment. Can you describe your home?
A: I live in an apartment in ...
```
질문을 안 주면 에이전트가 OPIc 스타일 질문을 만들어 넣고 알려줍니다.

### 4. 사이트에서 보기
1. https://brown-puppy.github.io/givemeal/ 접속
2. **회원가입**에서 1번에서 정한 아이디로 가입 (비번은 아무거나, 기기마다 1번)
3. 폰에서 **홈 화면에 추가**하면 앱처럼 열림
   - iPhone: Safari → 공유 → 홈 화면에 추가
   - Android: Chrome → 메뉴 → 앱 설치 / 홈 화면에 추가

---

## 알아둘 것
- **공개 레포입니다.** 올린 스크립트와 녹음은 누구나 볼 수 있어요. 상세 주소, 전화번호, 회사 내부 얘기 같은 건 넣지 마세요.
- 로그인은 내 공간을 구분하는 용도일 뿐, 보안 기능이 아닙니다.
- 녹음은 mp3/m4a, 1개 5MB 이하 권장. 다른 형식은 에이전트가 변환합니다.
- 앱 기능 변경(타이머, 화면 등)은 레포 주인에게 요청하세요. 에이전트는 앱 코드를 고치지 않습니다.

## 구조 (참고)
```
data/users/<아이디>/scripts.json   # 내 스크립트
audio/<아이디>/*.mp3               # 내 녹음
data/users/_template/              # 새 사용자 템플릿
scripts/validate.py                # 콘텐츠 검사 (CI에서도 실행)
AGENTS.md                          # 에이전트 작업 규칙
```
