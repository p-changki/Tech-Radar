# Tech Radar (Local-first Developer Update Inbox)

Tech Radar는 **Local-first Tech Radar / Developer Update Inbox**입니다.  
RSS/Atom 기반 뉴스·회사 테크블로그·릴리즈 노트를 **요청 시점에 수집(Inbox)** 하고, 필요한 것만 **선별 저장(Posts)** 하며, **타입별 무료 요약(Signals/ContentType)** 으로 재탐색 가능한 개인용 보드입니다.

---

## 1. What is this?

**Why (왜 필요한가?)**
- 매일 최신 기술 변화를 직접 찾아보기 어렵습니다.
- 일반 RSS 리더는 “읽기” 중심이라 선별 저장 / 업데이트 의사결정 / 재검색에 약합니다.
- 개발자에게 중요한 것은 단순 뉴스가 아니라 `security(CVE)` / `breaking change` / `deprecated` 같은 즉시 대응 신호입니다.
- 내 데이터(무엇을 읽고 저장했는지)를 외부 SaaS가 아니라 **내 로컬 DB에만** 남기고 싶었습니다.

**일반 RSS 리더와의 차이 (10초 요약)**
1. 자동 크론이 아니라 **요청 시점 수집(run-on-demand)**
2. 모든 글을 저장하지 않고 **선별 저장(Posts)**
3. 뉴스/회사 블로그/릴리즈 노트 **타입별 무료 요약(LLM 없이)**
4. 캐시/동시성/cleanup로 **로컬에서 안정 운영(소스 많아도)**

---

## 2. Core Workflow (3 steps)

1. **/presets**: 예제 프리셋을 불러오거나 Import  
   - 결과: 바로 수집할 수 있는 “소스 묶음”이 준비됩니다.

2. **/fetch**: 수집 실행 → Inbox 확인  
   - 결과: 최신 피드가 Inbox로 모입니다(검토용 임시함).

3. **선택 & 저장 → /posts**  
   - 결과: 필요한 것만 보관함(Posts)에 저장되고 재탐색이 쉬워집니다.

**핵심 철학**: Inbox는 일회성 검토 큐, Posts는 선별 저장된 지식 DB입니다.

---

## 3. Key Features

### 3-1) Presets & Sources
- Preset 시스템: 소스를 카테고리/언어로 그룹화하여 “선택 수집”
- 소스는 많이 등록해도 괜찮고, 실제 Fetch는 선택된 프리셋/소스만 대상으로 실행합니다.
- 카테고리: **AI / FE / BE / DEVOPS / DATA / SECURITY / OTHER**
- RSS 카테고리/태그 + 키워드 기반으로 **자동 분류**합니다.

### 3-2) Import/Export (오픈소스/이식성)
- Preset JSON import/export  
  - 프리셋을 공유/복제하기 쉬움(커뮤니티에 preset 파일 배포 가능)
- OPML import/export  
  - 기존 RSS 리더 구독 목록을 가져오거나(Import), 내보낼 수 있음(Export)

### 3-3) Free Summaries (LLM 없이)
- signals: `security / breaking / deprecation / release / perf` 등 자동 태깅
- contentType: `NEWS / COMPANY_BLOG / RELEASE_NOTE / OTHER`
- 같은 “요약”이 아니라 타입별로 구조를 달리해, 읽는 즉시 판단하기 쉽게 만듭니다.

### 3-4) Stability & Performance (로컬 운영 내장)
- **ETag/Last-Modified(304 캐시)**로 변경 없는 소스는 빠르게 스킵
- 글로벌 동시성 + 도메인 동시성 적용
- 도메인 적응형 동시성(Adaptive)  
  - 느린/불안정 도메인은 자동으로 동시성 1로 낮추고 안정화되면 2로 복구
- 소스별 최대 50개 파싱 후 → 기간 필터 적용(기본 14일)  
  - 큰 피드 때문에 느려지는 문제 방지
- RSS가 없거나 파싱 실패 시 **HTML fallback**으로 목록 페이지를 파싱  
  - 페이지네이션 자동 탐색(기본 3페이지)
- cleanup: Inbox 7일 삭제, FetchRun 100개 유지  
  - 개인용 로컬 DB가 과도하게 커지지 않도록 관리

### 3-5) Local-first Data Policy
- 데이터는 로컬 DB에만 저장
- 원문 HTML은 기본 저장하지 않음
- 저장 시 링크 + 스니펫 + 요약 + 메모 중심으로 가볍고 안전하게 보관

### 3-6) Usage & Source Policy (Important)
Tech Radar는 **공개 RSS/Atom 피드의 메타데이터를 수집**해 개인 로컬 보드에서 확인하는 도구입니다.  
원문을 대체하거나 재배포하는 목적이 아니라, **선별·정리·재탐색(Research Inbox)** 용도로 설계되었습니다.

- **기본 수집 범위**
  - RSS/Atom의 **제목(title) / 링크(link) / 발행일(publishedAt) / 짧은 스니펫(snippet)** 중심
  - 원문 전체(기사 전문/HTML)는 기본 저장하지 않습니다.

- **재배포/저작권 관련**
  - 저장된 항목은 **항상 출처 링크로 이동**할 수 있어야 합니다.
  - 이 프로젝트는 원문 콘텐츠를 복제하여 “내 사이트에서 소비”하도록 만드는 것을 목표로 하지 않습니다.
  - 스니펫 길이가 과도하거나 원문 전문을 저장/재게시하는 형태로 확장하면 저작권/약관 리스크가 커질 수 있습니다.

- **약관(ToS) / robots.txt 존중**
  - 사용자는 각 소스의 이용약관(ToS) 및 접근 정책을 준수해야 합니다.
  - 차단/레이트리밋이 발생하는 소스는 **소스 비활성화(/sources)** 또는 동시성 낮추기를 권장합니다.

- **금지/주의 사항**
  - 로그인/유료벽(paywall) 등 **접근 제한을 우회**하는 용도로 사용하지 마세요.
  - 과도한 대량 요청(빈번한 반복 수집)은 소스 서버에 부담을 줄 수 있으므로 지양합니다.
  - 본 프로젝트는 “요청 시점 수집 + 캐시 + 동시성 제한”을 기본으로 제공하지만, 최종 사용 책임은 사용자에게 있습니다.

_This project is intended for personal/local use. It does not republish full articles and links back to original sources._

---

## 4. Quickstart (Docker Postgres) - Recommended

**필수**: Docker Desktop, Node.js >= 20.19, pnpm

1) DB 실행
```bash
pnpm -w db:up
```

2) 환경변수
```bash
cp .env.example .env
```

DATABASE_URL 예시 (Docker 포트 54321):
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

## 5. Quickstart (Existing Postgres) - Alternative

Docker 없이 로컬 Postgres가 있다면:
- `.env`의 `DATABASE_URL`만 로컬 DB로 지정
- 나머지 흐름 동일

```bash
pnpm install
pnpm -w db:generate
# 필요 시(사용자 승인 후) pnpm -w db:migrate
pnpm -w dev
```

---

## Quick sanity check (3 steps)

1) DB 준비
- Docker 사용: `pnpm -w db:up`
- 기존 Postgres 사용: `.env`의 `DATABASE_URL` 확인

2) 앱 실행
- `pnpm -w dev`

3) 동작 확인
- `/presets` → 예제 불러오기 (Woowahan Tech)
- `/fetch` → 수집 실행 → Inbox 아이템 확인
- 1~2개 선택 저장 → `/posts`에서 확인

API health check:
```
curl http://localhost:4002/health
```

---

## 6. Presets: Load Example / Import / Export

예제 프리셋 위치:
- repo: `examples/presets/woowahan.json`
- web 정적 파일: `apps/web/public/examples/presets/woowahan.json`

UI에서 예제 불러오기:
1. `/presets` → **예제 불러오기 (Woowahan Tech)**

This repo ships with a single example preset. Add your own sources via import or /sources.

Preset JSON Export:
- UI: `/presets`에서 프리셋 선택 → **Export JSON**
- API:
```
GET /v1/presets/:id/export?format=json
```

Preset JSON Import:
- UI: `/presets`에서 Import → 파일 업로드
- API:
```
POST /v1/presets/import
```

Import 옵션(선택):
- `mode=upsert | new`
- `enableImportedSources`
- `overwriteSourceMeta`

Tip: Preset JSON은 “프리셋 마켓”처럼 공유하기 좋습니다.  
(예: woowahan.json)

---

## 7. OPML Import/Export

OPML Export:
- UI: `/presets`에서 **Export OPML**
- API:
```
GET /v1/presets/:id/export?format=opml
```

OPML Import:
- UI: `/presets`에서 OPML 업로드
- API:
```
POST /v1/presets/import
```

카테고리 매핑 규칙:
- OPML `<outline text="AI|FE|BE|DEVOPS|DATA|SECURITY|OTHER">` 아래에 있는 피드들을 해당 카테고리로 매핑
- 카테고리 없음 → 기본 FE로 처리

---

## 8. Configuration

`.env.example` 기준 주요 설정:
- `LOOKBACK_DAYS` (default 14, UI에서 1/7/30/180일로 선택 시 덮어씀)
- `HTML_FALLBACK_ENABLED` (default true, RSS가 없을 때 HTML 파싱 시도)
- `HTML_FALLBACK_MAX_PAGES` (default 3, HTML 페이지네이션 탐색 한도)
- `MAX_ITEMS_PER_SOURCE` (default 50)
- `FETCH_CONCURRENCY` (default 6)
- `FETCH_DOMAIN_CONCURRENCY` (default 2)

도메인 적응형 동시성 기준:
- 실패율 ≥30% 또는 평균 응답 ≥5000ms 또는 연속 실패 ≥3 → 도메인 동시성 1
- 실패율 <20% & 평균 응답 <4000ms & 연속 실패 0 → 2로 복구

정리 정책:
- `CLEANUP_INBOX_DAYS` (default 7)
- `CLEANUP_RUN_KEEP` (default 100)

왜 필요한가?
- RSS 소스가 많아지면 차단/지연이 늘어나므로 동시성 제한과 캐시가 필요합니다.
- Inbox는 일회성 큐이므로 정리(cleanup) 없이는 DB가 빠르게 커집니다.
- 원문 저장을 최소화하면 용량/저작권 리스크가 줄고 운영이 단순해집니다.

---

## 9. Verification (Pre-PR)

```bash
pnpm -w type-check
pnpm -w lint
pnpm -w db:generate
pnpm --filter @tech-radar/summarizer test
```

```
pnpm -w verify
```

`db:migrate`는 자동 실행하지 않습니다. (필요 시 사용자 승인 후 실행)

---

## 10. Troubleshooting

- `/fetch` 결과가 0개일 때
  - 소스가 실패했거나 네트워크 이슈일 수 있습니다.
  - `/sources`에서 소스 활성화 확인
  - “실제 RSS로 수집” 토글을 끄면 더미 모드로 동작합니다.
  - 일반 URL은 **HTML fallback** 토글이 켜져 있어야 목록 파싱이 됩니다.

- DB 연결 오류
  - `docker compose ps`에서 DB가 healthy인지 확인
  - `.env`의 `DATABASE_URL` 포트(54321) 확인

- run이 끝나지 않음
  - worker가 실행 중인지 확인 (pnpm -w dev에 포함)

- generated 파일 추적
  - `.gitignore`에 packages/db/src/generated/, .next/ 등이 포함되어야 함

---

## 11. License / Contributing

- 라이선스 파일이 아직 없습니다. 필요 시 추가하세요.
- preset 공유 PR(예: examples/presets/에 새로운 preset 추가)은 환영합니다.
- 기여 가이드가 있다면 CONTRIBUTING.md를 참고하세요.
