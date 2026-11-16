# 계명문화대학교 규정집 AI 검토·개정 지원 시스템

학칙·규정·세칙을 등록하면 AI가 규정 간 상충, 상위 규정·법령 위반, 용어 혼재, 개편 전 조직명 잔존을 찾아내고, 신구조문대비표 형식의 개정안 작성과 심의 기록, 한글(HWPX) 보고서 출력까지 지원하는 웹앱입니다.

- 실행 위치: Claude 아티팩트 (https://claude.ai/artifact/GgtKqjFAcYGDXFaeD5aK5Q)
- 소관: 기획실 규정 담당
- 이 폴더는 Netlify 배포 대상(`public/`) 밖에 있어 기존 성과관리 사이트에 영향을 주지 않습니다.

## 구성

| 경로 | 내용 |
|---|---|
| `app/index.html` | 앱 전체 (단일 HTML, PC·모바일 겸용) |
| `tests/mock.js` | 테스트용 Claude 플랫폼 모의 객체 (저장소·AI·Korean Law 커넥터·내려받기) |
| `tests/run.py` | 전체 업무 흐름 종단 테스트 (39개 항목) |
| `tests/pdftest.py` | 한글 PDF 글자 추출 테스트 |
| `tests/sample_report_example.hwpx` | 앱이 생성하는 HWPX 보고서 견본 (가상 예시 데이터) |
| `vercel/` | Vercel 배포용 프로젝트 (서버 함수 `api/`, 정적 파일 `public/`) |
| `scripts/build_vercel.py` | `app/index.html` → `vercel/public/index.html` 생성 |
| `tests/vercel/` | Vercel판 서버 함수 단위 테스트와 종단 테스트 |

## 메뉴

1. 메인 대시보드 — 등록 규정 수, 지적 건수, AI 종합 의견, 분석 이력
2. 규정 등록 — PDF·TXT 일괄 업로드 또는 본문 붙여 넣기
3. 규정 관리 대장 — 구분, 소관 부서, 최종 개정일, 본문 보기·삭제
4. AI 분석 실행 — 대상 선택, 기준 조직표, **상위 법령 대조(Korean Law 커넥터)**
5. 상충·위계 위반 — 조문 나란히 비교, 상위 법령 조문 원문과 조회 내역
6. 용어 혼재 — 혼용 표현과 권고 표준 용어
7. 조직·부서명 불일치 — 개편 전 명칭과 정비 명칭
8. 개정안 심의 — AI 신구조문대비표, 승인·반려·보류와 의견 기록
9. 보고서 — 한글(HWPX) 내려받기(ZIP), 텍스트 복사, 점검 체크리스트

## 플랫폼 기능 (아티팩트 선언)

| 기능 | 용도 |
|---|---|
| `sample` | Claude AI 분석·개정안 생성 (API 키 불필요) |
| `db` + `user` | 기획실 담당자 간 규정·결과·심의 기록 공유 저장 |
| `mcp` (Korean Law) | 국가법령정보 현행 조문 실시간 조회 → 상위 법령 대조 |
| `downloads` | HWPX 보고서 내려받기 (`.hwpx`가 허용 목록에 없어 ZIP으로 감싸 저장) |

## 상위 법령 대조 동작

1. 앱이 실행 시점에 Korean Law 커넥터의 도구 목록과 입력 형식을 조회합니다.
2. 그 도구들을 AI에 제공하고, AI가 규정 관련 법령(기본: 고등교육법·시행령, 사립학교법·시행령, 교육기본법, 대학등록금에 관한 규칙)을 직접 검색·조회합니다.
3. 조회한 조문만 근거로 상충 여부를 판단하며, 결과에 법령 조문 원문·시행일·조회 내역을 남깁니다.

커넥터가 재연결 필요 상태이면 앱 화면에 안내가 표시되고, 나머지 분석은 그대로 진행됩니다.

## Vercel 배포 (완전 기능판)

`vercel/` 폴더가 Vercel 프로젝트입니다. 앱 화면은 `app/index.html` 원본을 그대로 쓰고, `vercel/public/shim.js`가 Claude 플랫폼 기능을 다음으로 대신합니다.

| 기능 | Claude 아티팩트 | Vercel |
|---|---|---|
| AI 분석·개정안 | Claude 내장 | `api/ai.js` → Anthropic API |
| 상위 법령 대조 | Korean Law 커넥터 | `api/law.js` → 법제처 국가법령정보 Open API |
| 저장 | 공유 저장소 | 각 PC 브라우저(IndexedDB). 서버·GitHub에 규정 원문이 저장되지 않음 |
| 보고서 | HWPX를 ZIP으로 감싸 저장 | `.hwpx` 바로 저장 |
| 접근 통제 | Claude 공유 설정 | 접속 비밀번호(`APP_PASSWORD`) |

### 배포 절차

1. https://vercel.com/new 에서 GitHub 저장소 `Management-performance`를 Import 합니다.
2. **Root Directory**를 `kmcu-regulation-review/vercel`로 지정합니다. Framework Preset은 `Other`, 빌드 명령은 비워 둡니다.
3. **Environment Variables**에 아래 값을 넣고 Deploy를 누릅니다.

| 변수 | 필수 | 내용 |
|---|---|---|
| `APP_PASSWORD` | 필수 | 접속 비밀번호. 비어 있으면 모든 요청을 거부합니다. |
| `ANTHROPIC_API_KEY` | 필수 | https://console.anthropic.com 에서 발급. 사용량만큼 과금됩니다. |
| `LAW_OC` | 필수 | 법제처 Open API 인증키(OC). https://open.law.go.kr 에서 신청. 신청 시 Vercel 배포 주소(도메인)를 등록해야 할 수 있습니다. |
| `ANTHROPIC_MODEL` | 선택 | 기본 `claude-sonnet-5-5` |
| `ANTHROPIC_MODEL_COMPLEX` | 선택 | 교차 검토·상위법 대조용, 기본 `claude-opus-5-5` |

4. 배포가 끝나면 `https://<프로젝트명>.vercel.app` 주소가 생깁니다. 처음 접속하면 비밀번호를 묻습니다.

### 앱을 고친 뒤

`app/index.html`을 고쳤으면 `python3 scripts/build_vercel.py`로 `vercel/public/index.html`을 다시 만든 뒤 커밋합니다.

## 테스트 실행

```bash
pip install playwright
npm install jszip@3.10.1 pdfjs-dist
JSZIP=node_modules/jszip/dist/jszip.min.js CHROME=/usr/bin/google-chrome python3 tests/run.py   # Claude판 39개 항목
PDFJS_DIR=node_modules/pdfjs-dist/legacy/build/ python3 tests/pdftest.py
node tests/vercel/api_unit.mjs                                                                   # 서버 함수 단위 테스트
JSZIP=node_modules/jszip/dist/jszip.min.js python3 tests/vercel/e2e.py                            # Vercel판 17개 항목
```

Vercel판 종단 테스트는 실제 `vercel/api` 코드를 로컬 서버로 띄우고, 외부 API(Anthropic·법제처) 응답만 가짜로 대신합니다. 법제처 응답 형식은 공개 문서 기준으로 맞췄으므로, 첫 배포 후 앱의 「커넥터 연결 확인」 버튼으로 실제 응답을 확인하십시오.

테스트는 실제 Claude 플랫폼 대신 `tests/mock.js`의 모의 객체로 실행됩니다. 실제 AI 응답 품질과 Korean Law 커넥터 연동은 claude.ai에서 별도 확인이 필요합니다.

## 유의사항

- AI 검토 결과는 보조 자료이며, 최종 판단은 학내 규정 제·개정 절차를 따릅니다.
- 이미지로 스캔한 PDF는 글자를 추출할 수 없습니다. HWP 원문을 복사해 붙여 넣으십시오.
- 저장소가 공개(public) 상태이므로 실제 규정 원문이나 개인정보를 이 폴더에 커밋하지 마십시오. 이 폴더에는 앱 코드와 가상 예시 데이터만 있습니다.
- API 키와 비밀번호는 Vercel 환경변수에만 넣고 코드나 `.env` 파일로 커밋하지 마십시오(`vercel/.gitignore`가 `.env*`를 제외합니다).
- Vercel판에서 등록한 규정은 그 PC의 브라우저에만 남습니다. 다른 PC나 브라우저와 공유되지 않으며, 브라우저 데이터를 지우면 함께 삭제됩니다.
