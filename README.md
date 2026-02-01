# Tech Radar (Local-first Develope
<img width="1000" height="1287" alt="스크린샷 2026-02-02 06 44 34" src="https://github.com/user-attachments/assets/7b4ed94b-806d-4460-af21-0b3f7ec8a72b" />
r Update Inbox)

[![CI](https://github.com/<OWNER>/<REPO>/actions/workflows/ci.yml/badge.svg)](https://github.com/<OWNER>/<REPO>/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> Replace `<OWNER>/<REPO>` with your GitHub repo path after publishing.

### Badge update quick steps
- `git remote add origin <REPO_URL>`
- `pnpm badges:update`
- `git push -u origin main`

---

## 🇺🇸 Quick Overview (English)

**Tech Radar** is a local-first **Developer Update Inbox** for RSS/Atom sources.
It fetches updates **on demand** into an **Inbox**, lets you **select & save** only what matters into **Posts**, and keeps everything in your **local database** (no full-article republishing).

### Why?
- Staying on top of tech changes daily is hard.
- Generic RSS readers focus on consumption, not decision-making (security/breaking/deprecation).
- You want your saved history to stay local (privacy-first).

### Core workflow
1) **/presets** → load/import sources
2) **/fetch** → run fetch → review Inbox
3) **select & save → /posts** → build your personal knowledge base

### Quickstart (Docker Postgres)
```bash
pnpm -w db:up
cp .env.example .env
pnpm install
pnpm -w db:generate
# (optional, with approval) pnpm -w db:migrate
pnpm -w dev
```

- Web: http://localhost:3002
- API: http://localhost:4002/health

---

## 🇰🇷 소개 (Korean)

Tech Radar는 Local-first Developer Update Inbox입니다.
RSS/Atom 기반 뉴스·회사 테크블로그·릴리즈 노트를 요청 시점에 수집(Inbox) 하고, 필요한 것만 선별 저장(Posts) 하며, 무료 요약(Signals/ContentType) 으로 재탐색 가능한 개인용 보드입니다.

핵심만 10초 요약
- ✅ Run-on-demand: 자동 크론이 아니라 “필요할 때만 수집”
- ✅ Select & Save: Inbox에서 고른 것만 Posts에 저장
- ✅ Local-first: 데이터는 로컬 DB에만(원문 전문 저장 X)
- ✅ 운영 안정성 내장: 캐시/동시성/cleanup로 소스가 많아도 안정적으로

---

## 1. Why (왜 필요한가?)
- 매일 최신 기술 변화를 직접 찾아보기 어렵습니다.
- 일반 RSS 리더는 “읽기” 중심이라 선별 저장 / 업데이트 의사결정 / 재검색에 약합니다.
- 개발자에게 중요한 것은 단순 뉴스가 아니라 security(CVE) / breaking change / deprecated 같은 즉시 대응 신호입니다.
- 내 데이터(무엇을 읽고 저장했는지)를 외부 SaaS가 아니라 내 로컬 DB에만 남기고 싶었습니다.

---

## 2. Core Workflow (3 steps)
1. /presets: 예제 프리셋을 불러오거나 Import
2. /fetch: 수집 실행 → Inbox 확인
3. 선택 & 저장 → /posts: 필요한 것만 보관/재탐색

Inbox는 “검토 큐”, Posts는 “선별 저장된 지식 DB”입니다.

---

## 3. Key Features

### 3-1) Categories & Auto Classification
- 카테고리: AI / FE / BE / DEVOPS / DATA / SECURITY / OTHER
- RSS 카테고리/태그 + 키워드 기반으로 자동 분류합니다.

### 3-2) Presets & Sources
- 소스를 카테고리/언어로 그룹화해 “선택 수집”합니다.
- 소스는 많이 등록해도 괜찮고, 실제 Fetch는 선택된 프리셋/소스만 대상으로 실행합니다.

### 3-3) Import/Export (이식성)
- Preset JSON import/export: 프리셋 공유/복제
- OPML import/export: 기존 RSS 리더 구독 목록 이식

### 3-4) Free Summaries (LLM 없이)
- signals: security / breaking / deprecation / release / perf 등 자동 태깅
- contentType: NEWS / COMPANY_BLOG / RELEASE_NOTE / OTHER
- 타입별로 요약 포맷을 달리해 “읽자마자 판단”이 가능하게 합니다.

### 3-5) Stability & Performance (로컬 운영 내장)
- ETag/Last-Modified(304 캐시)로 변경 없는 소스는 빠르게 스킵
- 글로벌 동시성 + 도메인 동시성 + Adaptive throttling
- 소스별 최대 50개 파싱 후 → 기간 필터 적용(기본 14일)
- cleanup: Inbox 7일 삭제, FetchRun 100개 유지

### 3-6) HTML fallback (Optional)
RSS가 없거나 피드 파싱이 실패하는 경우, (선택적으로) HTML 목록 페이지를 파싱할 수 있습니다.
- 기본: RSS/Atom 우선
- 옵션: HTML fallback 사용 시 목록 페이지를 파싱하고 페이지네이션을 제한적으로 탐색합니다(기본 3페이지)

HTML fallback은 사이트 구조 변경/차단 가능성이 있어 보조 옵션으로 권장합니다.

### 3-7) Local-first Data Policy
- 데이터는 로컬 DB에만 저장
- 원문 HTML은 기본 저장하지 않음
- 저장 시 링크 + 스니펫 + 요약 + 메모 중심으로 가볍고 안전하게 보관

### 3-8) Usage & Source Policy (Important)
Tech Radar는 공개 RSS/Atom 피드의 메타데이터를 수집해 개인 로컬 보드에서 확인하는 도구입니다.
원문을 대체하거나 재배포하는 목적이 아니라, 선별·정리·재탐색(Research Inbox) 용도로 설계되었습니다.
- 수집 범위: 제목/링크/발행일/짧은 스니펫 중심
- 원문 전문 저장/재배포를 목표로 하지 않습니다.
- ToS/robots 정책을 존중하며, paywall/접근 제한 우회 용도로 사용하지 마세요.

This project is intended for personal/local use. It does not republish full articles and links back to original sources.

---

## 4. Quickstart (Docker Postgres) — Recommended

필수: Docker Desktop, Node.js >= 20.19, pnpm

1) DB 실행
```bash
pnpm -w db:up
```

2) 환경변수
```bash
cp .env.example .env
```

예시(Docker 포트 54321):
```
DATABASE_URL="postgresql://techradar:techradar@localhost:54321/tech_radar"
```

3) 설치/준비
```bash
pnpm install
pnpm -w db:generate
# 필요 시(사용자 승인 후) pnpm -w db:migrate
```

4) 실행
```bash
pnpm -w dev
```

접속
- web: http://localhost:3002
- api: http://localhost:4002/health

---

## 5. Quickstart (Existing Postgres) — Alternative

Docker 없이 로컬 Postgres가 있다면 .env의 DATABASE_URL만 로컬 DB로 지정하면 됩니다.

```bash
pnpm install
pnpm -w db:generate
# 필요 시(사용자 승인 후) pnpm -w db:migrate
pnpm -w dev
```

---

## 6. Quick sanity check (3 steps)
1) DB 준비
- Docker: pnpm -w db:up
- 기존 Postgres: .env의 DATABASE_URL 확인

2) 앱 실행
- pnpm -w dev

3) 동작 확인
- /presets → 예제 불러오기 (Woowahan Tech)
- /fetch → 수집 실행 → Inbox 아이템 확인
- 1~2개 선택 저장 → /posts에서 확인

API health check:
```bash
curl http://localhost:4002/health
```

---

## 7. Presets: Example / Import / Export

이 레포는 단일 예제 preset만 제공합니다.
- repo: examples/presets/woowahan.json
- web 정적: apps/web/public/examples/presets/woowahan.json

예제 불러오기:
- /presets → 예제 불러오기 (Woowahan Tech)

나만의 소스 추가:
- /sources에서 직접 추가하거나,
- Preset JSON/OPML로 import 하세요.

Preset JSON Export:
- UI: /presets → Export JSON
- API:
  - GET /v1/presets/:id/export?format=json

Preset JSON Import:
- UI: /presets → Import
- API:
  - POST /v1/presets/import

---

## 8. Configuration

.env.example 주요 설정:
- LOOKBACK_DAYS (default 14, UI에서 1/7/30/180일 선택 시 덮어씀)
- MAX_ITEMS_PER_SOURCE (default 50)
- FETCH_CONCURRENCY (default 6)
- FETCH_DOMAIN_CONCURRENCY (default 2)

HTML fallback:
- HTML_FALLBACK_ENABLED (default true)
- HTML_FALLBACK_MAX_PAGES (default 3)

정리 정책:
- CLEANUP_INBOX_DAYS (default 7)
- CLEANUP_RUN_KEEP (default 100)

---

## 9. Verification (Pre-PR)

```bash
pnpm -w verify
```

또는(개별 실행):
```bash
pnpm -w type-check
pnpm -w lint
pnpm -w db:generate
pnpm --filter @tech-radar/summarizer test
```

db:migrate는 자동 실행하지 않습니다. (필요 시 사용자 승인 후 실행)

---

## 10. Troubleshooting

### /fetch 결과가 0개일 때
- 기간 내 글이 부족할 수 있습니다 → 기간을 30/180일로 늘려보세요.
- 중복 제거/이전에 본 글 제외 옵션 때문에 줄어들 수 있습니다.
- 소스 실패(403/429/timeout)일 수 있습니다 → /sources에서 실패 소스 확인/비활성화
- 일반 URL은 RSS가 없을 수 있습니다 → HTML fallback 옵션이 켜져 있어야 목록 파싱을 시도합니다.

### DB 연결 오류
- docker compose ps에서 DB가 healthy인지 확인
- .env의 DATABASE_URL 포트(54321) 확인

### run이 끝나지 않음
- worker가 실행 중인지 확인 (pnpm -w dev에 포함)

---

## 11. License / Contributing
- MIT License: LICENSE
- preset 공유 PR(예: examples/presets/에 새로운 preset 추가)은 환영합니다.
- 기여 가이드가 있다면 CONTRIBUTING.md를 참고하세요.
