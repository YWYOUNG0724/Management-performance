# 계명문화대학교 전문대학혁신지원사업단 성과관리시스템 (Netlify 배포판)

자율성과지표 4종의 연차별 목표·실적 대시보드입니다. 접속코드나 수정 PIN 없이 주소만 알면 바로 열람하고 실적을 입력할 수 있습니다. 실적을 입력할 때는 입력자 이름만 받아 수정 이력에 남깁니다.

## 구성

| 경로 | 내용 |
|---|---|
| `public/index.html` | 대시보드 화면 (도넛 그래프, 실적 입력, 성과보고서 내보내기, AI 요약 보고서, 다크 모드) |
| `netlify/functions/api.mjs` | 데이터 조회·저장, 수정 이력 API |
| `netlify/edge-functions/ai-summary.js` | Claude AI 요약 (스트리밍, 선택 기능) |
| `netlify/lib/store.mjs` | Netlify Blobs 저장소 공통 함수 |
| `data/seed.mjs` | 최초 배포 시 사용하는 기본 데이터 |
| `netlify.toml` | Netlify 배포 설정 (빌드 명령 없음) |

## 배포 방법

### 1. GitHub에 올리기
1. GitHub에서 **New repository**를 누르고 저장소를 만듭니다. 비공개(Private)를 권장합니다.
2. **uploading an existing file**을 눌러 이 폴더 안의 파일과 폴더를 모두 끌어다 놓고 **Commit changes**를 누릅니다.
   - `netlify`, `public`, `data` 폴더와 `netlify.toml`, `package.json`이 저장소 최상위에 있어야 합니다.

### 2. Netlify에 연결하기
1. https://app.netlify.com 에 GitHub 계정으로 로그인합니다.
2. **Add new project(site) → Import an existing project → GitHub**을 선택하고 1번에서 만든 저장소를 고릅니다.
3. 빌드 설정은 `netlify.toml`이 자동으로 채웁니다. 그대로 **Deploy**를 누릅니다.
   - Build command: 비워 둠 / Publish directory: `public`
4. 배포가 끝나면 `https://사이트이름.netlify.app` 주소가 생깁니다. **Site configuration → Change site name**에서 이름을 바꿀 수 있습니다.

### 3. (선택) Claude AI 요약 연결
1. https://console.anthropic.com 에서 API 키를 발급받습니다.
2. Netlify **Site configuration → Environment variables**에 다음을 추가합니다.
   - `ANTHROPIC_API_KEY` = 발급받은 키
   - `AI_MODEL` = 사용할 모델 ID (생략하면 `claude-sonnet-5-5`)
3. **Deploys → Trigger deploy**로 다시 배포합니다.
4. 키가 없어도 **자동 분석 요약**은 항상 동작합니다.

이후 GitHub 저장소의 파일을 수정하면 Netlify가 자동으로 다시 배포합니다.

## 데이터 저장 방식
- 실적 데이터는 **Netlify Blobs**(사이트 전용 저장소)에 저장되고, 접속자 모두가 같은 데이터를 봅니다.
- 화면은 30초마다 자동으로 동기화됩니다. 두 사람이 동시에 저장하면 먼저 저장한 내용을 지키고, 나중 사람에게는 다시 입력하라고 안내합니다.
- 저장할 때마다 직전 버전이 `backups/v00001` 형식으로 자동 백업됩니다. Netlify 사이트 메뉴의 **Blobs**에서 확인할 수 있습니다.
- 화면의 **[데이터 백업]**으로 현재 데이터를 JSON 파일로 내려받을 수 있습니다. 정기적으로 받아 두는 것을 권장합니다.
- 데이터를 처음 상태로 되돌리려면 Blobs의 `perf-dashboard` 저장소에서 `data` 항목을 삭제합니다. 그러면 `data/seed.mjs` 기준으로 다시 시작합니다.

## 보안 유의사항 (중요)
- 접속코드와 수정 PIN이 없으므로 **주소를 아는 사람은 누구나 열람하고 수정할 수 있습니다.** 주소는 사업단 내부에만 공유하세요.
- 검색엔진에는 노출되지 않도록 설정되어 있습니다(noindex). 하지만 주소가 외부로 퍼지는 것까지 막지는 못합니다.
- 접근을 제한해야 하면 Netlify의 **Password protection**(유료 요금제)을 켜거나, 사이트 이름을 추측하기 어렵게 바꾸세요.
- 잘못 수정된 경우 수정 이력과 자동 백업으로 확인·복구할 수 있습니다.
- 학생 성명 등 **개인정보는 입력하지 마세요.** AI 요약을 쓸 때는 지표 수치와 비고가 Anthropic API로 전송됩니다.
- AI 요약도 누구나 실행할 수 있으므로 API 사용량이 늘어날 수 있습니다. Anthropic 콘솔에서 월 사용 한도를 설정해 두세요.

## 무료 요금제 참고
- Netlify 무료 요금제의 함수 호출·대역폭 한도 안에서 사업단 규모로 충분히 운영할 수 있습니다. 다만 화면을 여러 대에서 하루 종일 켜 두면 동기화 호출이 늘어나니, 다 쓴 화면은 닫아 주세요.
