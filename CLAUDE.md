# CLAUDE.md

이 레포의 모든 작업 규칙은 [AGENTS.md](./AGENTS.md)에 있다. 작업 전에 AGENTS.md를 끝까지 읽고 그대로 따른다.

핵심만 요약 (상세·예외는 AGENTS.md가 우선):
- 수정 가능: `data/users/<요청한 사용자 id>/scripts.json`, `audio/<그 id>/` 뿐
- 앱 코드·다른 사용자 폴더·규칙 파일 수정 금지 (앱 코드는 owner `brown-puppy` 요청일 때만)
- 녹음↔질문 연결은 사용자 지시로만. 길이·순서로 추측 금지
- 커밋 전 `python3 scripts/validate.py` 통과 필수
