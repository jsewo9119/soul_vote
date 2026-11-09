# SOUL WRAPPED 2026 투표 배포

제공된 HTML의 화면과 후보 명단을 유지하고, Vercel 서버 함수에서 한양대 Google Workspace 로그인을 검증한 뒤 지정된 Google Sheet에 투표를 저장합니다. `hd=hanyang.ac.kr` 계정만 허용하고 구글 계정 ID를 기준으로 계정당 한 번만 받습니다. 한양대 전체 계정을 허용하므로 소리울림 회원 여부는 확인하지 않습니다.

## 준비할 값

1. Google Cloud Console에서 **OAuth 웹 클라이언트 ID**를 생성합니다. 승인된 JavaScript 원본에 실제 Vercel 주소(`https://<project>.vercel.app`)와 나중에 쓸 커스텀 도메인을 등록합니다. 로그인 동의 화면의 게시 상태와 테스트 사용자도 확인합니다.
2. 무작위로 생성한 32자 이상의 `VOTE_SHARED_SECRET`를 준비합니다. 이 값을 GitHub 파일에 적지 않습니다.
3. 제공된 스프레드시트의 **확장 프로그램 → Apps Script**에서 `apps-script.gs`를 붙여넣습니다. Apps Script **프로젝트 설정 → 스크립트 속성**에 `VOTE_SHARED_SECRET`와 `SPREADSHEET_ID`를 등록합니다. `SPREADSHEET_ID`는 제공된 시트 URL의 `/d/` 다음 ID입니다.
4. `setup()`을 한 번 실행합니다. 기존 `응답`·`집계`·`설정 방법` 탭은 보존되며, `응답_자동`·`집계_자동` 탭이 생성됩니다. 이전 버전의 `setup()`으로 만든 `회원` 탭은 새 코드에서 사용하지 않습니다.
5. Apps Script를 웹 앱으로 배포합니다. 실행 사용자는 **나**, 액세스 권한은 **모든 사용자**로 설정하고 `/exec` 주소를 복사합니다. URL을 아는 사람이 웹 앱에 접근할 수 있으므로 서버는 공유 비밀키가 없는 요청을 거부합니다.
6. Vercel 프로젝트 환경 변수에 `GOOGLE_CLIENT_ID`, `APPS_SCRIPT_URL`, `VOTE_SHARED_SECRET`를 넣습니다. `APPS_SCRIPT_URL`은 위 `/exec` 주소입니다. 환경 변수 저장 후 재배포합니다.

## 배포와 확인

- 이 폴더를 GitHub의 `jsewo9119/soul_vote` 저장소에 올리고 Vercel에 연결합니다. 정적 웹 파일은 `public/index.html`, 서버 함수는 `api/`에 있습니다.
- 프레임워크 프리셋은 **Other**로 설정하고 출력 디렉터리는 `public`으로 둡니다. `public/index.html`은 이미 생성되어 있으므로 Vercel에서 별도의 빌드 명령은 필요하지 않습니다.
- 화면이나 후보를 수정했다면 `soul-wrapped.src.html`을 고친 뒤 로컬에서 `python3 build.py`를 실행하고 `public/index.html`, `api/candidates.json`도 함께 커밋합니다.
- `/api/config`에서 OAuth 클라이언트 ID가 표시되는지 확인합니다. 한양대 Google Workspace 계정으로 투표하면 `응답_자동`에 한 행, `집계_자동`에 득표 결과가 생겨야 합니다. 같은 계정의 두 번째 제출은 거부됩니다.
- 투표 전 구글 로그인 동의 화면, 개인 Gmail 계정 거부, 중복 계정, 모바일 브라우저를 시험합니다. 테스트 응답을 운영 응답과 섞지 않도록 테스트용 시트를 따로 쓰거나, 운영 시작 전 테스트 행을 정리하세요.

현재 실제 시트 수정, OAuth 클라이언트 생성, Apps Script 및 Vercel 배포는 완료되지 않았습니다.
