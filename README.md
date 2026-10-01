# SIAL 2026 부스 노트

사내 전시 조사용 웹앱입니다. GitHub Pages + Supabase로 돌아갑니다.

## 올리는 법
1. 이 폴더의 **모든 파일**을 저장소 최상단에 올립니다
2. Settings → Pages → Branch `main` / 폴더 `/ (root)` → Save
3. 1~2분 뒤 `https://<계정>.github.io/<저장소>/` 로 열립니다

## 구성
- `index.html` — 앱 전체
- `config.js` — Supabase 주소와 공개 키
- `supabase-shim.js` — 로그인·저장·사진 연결
- `*.json` — 출품사 DB, 홀 도면, 구역, 세션
- `map.png`, `sempio.png` — 이미지

## 주의
- Supabase 무료 프로젝트는 **1주일 미접속 시 자동 정지**됩니다. 주 1회는 열어 주세요.
- `config.js`의 키는 공개용입니다. `service_role` 키는 절대 넣지 마세요.
