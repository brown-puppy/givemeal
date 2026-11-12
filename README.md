# givemeal — OPIc 스크립트 노트

모바일용 OPIc 답변 연습 앱 (GitHub Pages + PWA).

## 스크립트 추가
1. 녹음 파일을 `audio/`에 넣는다 (예: `audio/home-2-routine.mp3`)
2. `data/scripts.json`의 해당 주제 `items`에 항목을 추가한다
   - `id`: 고유값 (URL에 쓰임, 예: `home-2`)
   - `script`: 문단 배열. `**굵게**` 표시한 구문은 강조됨
   - `keywords`: 키워드 모드에 보일 줄들
   - `audio`: 녹음 경로 (없으면 생략)
3. commit & push → 1~2분 뒤 반영

새 주제는 `topics`에 `{ "id", "name", "emoji", "items": [] }`를 추가하면 된다.

## 앱 코드를 고쳤을 때
`sw.js`의 `VERSION`을 올려야 폰에 설치된 앱이 새 버전을 받는다.
(스크립트/녹음만 바꾼 경우는 안 올려도 됨)

## 폰에 설치
- iPhone: Safari로 열기 → 공유 → 홈 화면에 추가
- Android: Chrome으로 열기 → 메뉴 → 앱 설치 / 홈 화면에 추가
