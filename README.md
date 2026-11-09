# SOUL WRAPPED 2026 공개 투표

기존 화면과 후보 명단을 유지한 정적 웹페이지입니다. 누구나 로그인 없이 투표할 수 있습니다. 투표는 Vercel 서버 함수를 거쳐 Google Sheet에 저장되고, 같은 브라우저의 재제출은 거부됩니다. 브라우저 저장 공간을 지우거나 다른 기기를 사용하면 다시 투표할 수 있으므로 **사람별 1인 1표를 보장하지 않습니다.**

각 투표 화면에서는 후보를 선택해야 다음 화면으로 갈 수 있습니다. 마지막 요약 화면의 **확정하기**를 누르면 투표를 저장하고, 저장에 성공한 경우에만 마지막 페이지로 이동합니다.

## 기존 배포를 업데이트할 때

1. Google 스프레드시트의 **확장 프로그램 → Apps Script**에서 기존 코드를 최신 [`apps-script.gs`](apps-script.gs)로 전부 교체하고 저장합니다. 스크립트 속성 `SPREADSHEET_ID`와 `VOTE_SHARED_SECRET`는 그대로 둡니다.
2. `setup()`을 다시 한 번 실행합니다. 이번 버전은 `응답_공개`와 `집계_공개` 탭을 새로 만듭니다. 이전 `회원`, `응답_자동`, `집계_자동` 탭은 건드리지 않으며 투표 처리에 사용하지 않습니다.
3. Apps Script **배포 → 배포 관리 → 수정 → 새 버전**으로 웹 앱을 업데이트합니다. 실행 사용자는 **나**, 액세스 권한은 **모든 사용자**여야 합니다. 아직 웹 앱을 배포하지 않았다면 새 배포를 만듭니다.
4. Vercel 프로젝트 환경 변수 `APPS_SCRIPT_URL`(Apps Script의 `/exec` 주소)과 `VOTE_SHARED_SECRET`(스크립트 속성과 동일한 값)을 유지합니다. `GOOGLE_CLIENT_ID`는 더 이상 필요 없으므로 제거할 수 있습니다. GitHub 변경이 Vercel에 배포되고 환경 변수 변경도 반영됐는지 확인합니다.
5. 사이트에서 전체 부문을 선택하고 테스트 투표를 제출합니다. `응답_공개`에 한 행이 추가되고 `집계_공개`에 득표수가 표시되어야 합니다. 같은 브라우저에서 다시 제출하면 거부되어야 합니다.

## 새로 설치할 때

- `VOTE_SHARED_SECRET`는 `openssl rand -hex 32`로 생성하고 Apps Script **프로젝트 설정 → 스크립트 속성** 및 Vercel **Secret** 환경 변수에 동일하게 입력합니다. GitHub에는 올리지 않습니다.
- Apps Script 속성 `SPREADSHEET_ID`에는 대상 시트 URL의 `/d/`와 `/edit` 사이 값을 입력합니다. `setup()`을 실행한 뒤 웹 앱으로 배포합니다.
- Vercel은 GitHub 저장소를 연결하고 프레임워크 **Other**, 출력 디렉터리 `public`을 사용합니다. 정적 페이지는 `public/index.html`, 서버 함수는 `api/vote.js`입니다.
- 화면이나 후보를 수정했다면 `soul-wrapped.src.html`을 고친 뒤 `python3 build.py`를 실행하고 생성된 `public/index.html`, `api/candidates.json`을 함께 커밋합니다.
