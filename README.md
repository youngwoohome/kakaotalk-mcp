# KakaoTalk Auto Mac

macOS 전용 KakaoTalk 자동발송 앱이다. Windows 복원본을 그대로 옮긴 것이 아니라, `AppleScript + System Events` 기반 드라이버로 다시 구성했다.

## 범위

- 포함:
  - 로컬 발송 목록 저장
  - 예약 발송 루프
  - 즉시 발송
  - 열린 채팅방 감지
  - 선택 방 히스토리 크롤링 및 GUI/TUI 분석
  - 발송 이력 저장
- 방식:
  - KakaoTalk macOS 앱 실행
  - 손쉬운 사용 권한 필요
  - AppleScript UI 스크립팅 사용

## 전제

- macOS 전용
- `/Applications/KakaoTalk.app` 설치 필요
- 손쉬운 사용 권한 필요
  - 시스템 설정 > 개인정보 보호 및 보안 > 손쉬운 사용
  - 터미널 또는 패키징한 앱을 허용

## 설치

### 로컬 설치

기본은 CLI-only 설치로 두는 걸 권장한다:

```bash
./scripts/install.sh
```

GUI까지 같이 받으려면:

```bash
./scripts/install.sh --gui
```

`npm` 명령으로 직접 해도 된다:

```bash
npm run install:cli
```

GUI까지 같이 설치:

```bash
npm run install:gui
```

설정 파일이 필요하면:

```bash
cp .env.example .env
```

기본 저장 경로는 `data/`다.

터미널에서 한 명령으로 쓰려면:

```bash
npm link
kakao-auto
```

또는 링크 없이 로컬 repo에서 바로:

```bash
node ./bin/kakao-auto
```

### Homebrew 배포 준비

로컬에서 Brew용 소스 아카이브를 만들려면:

```bash
npm run brew:dist
```

그러면 `dist/kakao-auto-<version>.tar.gz`가 만들어진다.

그 아카이브 기준으로 formula를 생성하려면:

```bash
npm run brew:formula -- --local-archive dist/kakao-auto-0.1.0.tar.gz --homepage https://example.com/kakao-auto --output /opt/homebrew/Library/Taps/<user>/homebrew-kakao-auto/Formula/kakao-auto.rb
```

Homebrew는 formula 파일 하나만으로 바로 설치되지 않고 `tap repo`가 필요하다. 로컬에서 검증할 때는:

```bash
brew tap-new <user>/kakao-auto
```

그 다음 위 명령으로 tap 안의 formula를 생성한다.

실제 GitHub release로 배포할 때는 tap repo 안의 `Formula/kakao-auto.rb`를 release tarball 기준으로 생성하면 된다. 같은 작업을 스크립트로 하려면:

```bash
npm run brew:formula -- --url https://github.com/<owner>/<repo>/archive/refs/tags/v0.1.0.tar.gz --sha256 <sha256> --homepage https://github.com/<owner>/<repo> --output /opt/homebrew/Library/Taps/<user>/homebrew-kakao-auto/Formula/kakao-auto.rb
```

로컬 formula 설치 테스트:

```bash
brew install <user>/kakao-auto/kakao-auto
```

Brew 설치는 CLI 전용이다. GUI는 Electron이 optional dependency라서 source checkout에서만 바로 쓰는 쪽으로 두었다.

## 실행

```bash
npm run start:gui
```

터미널 UI로 바로 고르면서 보내려면:

```bash
npm run start:tui
```

이제 아래처럼도 가능하다:

```bash
kakao-auto tui
kakao-auto gui
kakao-auto scheduled
kakao-auto instant examples/send-now.sample.json
```

동작 흐름:

- 시작 메뉴에서 `1=메시지 발송`, `2=방 분석` 선택
- 상단 채팅방 일부 불러오기
- `/검색어`로 필터
- `more`로 더 불러오기
- `1,3-5` 형식으로 선택
- 메시지 입력 후 `yes`로 발송
- 방 분석은 선택한 방을 열고 최근 N개 메시지 행을 읽어 링크/소개글/연락처 중심으로 하이라이트

GUI에서도 가능:

- `카카오톡 채팅방 불러오기`
- 채팅방 선택
- `방 분석` 섹션에서 `100/150/200` 선택
- 분석 목적 입력 후 `분석 실행`

## 동작 메모

- 열린 채팅방 감지는 현재 열린 KakaoTalk 창 제목 기준이다.
- 방 자동 열기는 검색 단축키 기반의 베스트에포트 방식이다.
- 오픈채팅 분석은 현재 `최근 N개 메시지 행 tail` 기준이며, 정확한 unread marker부터 읽는 기능은 아직 아니다.
- 파일 첨부는 표준 열기 패널이 뜬다는 가정으로 구현되어 있어, KakaoTalk 버전에 따라 추가 보정이 필요할 수 있다.

## 구조

- `src/macos/automation-driver.js`
  - AppleScript 드라이버
- `src/engine/kakao-send-engine.js`
  - 스케줄/큐/즉시발송 로직
- `src/storage/local-store.js`
  - 발송 목록/이력 저장
- `src/desktop/`
  - Electron GUI
