# KakaoTalk Auto Mac

macOS 전용 KakaoTalk CLI/GUI 자동화 도구다.

## 바로 설치

CLI만 쓸 때:

```bash
git clone https://github.com/youngwoohome/kakaotalk-cli.git
cd kakaotalk-cli
./scripts/install.sh
npm link
kakao-auto tui
```

GUI까지 같이 받으려면:

```bash
git clone https://github.com/youngwoohome/kakaotalk-cli.git
cd kakaotalk-cli
./scripts/install.sh --gui
npm link
kakao-auto gui
```

필수 조건:

- macOS
- `/Applications/KakaoTalk.app`
- `시스템 설정 > 개인정보 보호 및 보안 > 손쉬운 사용`에서 터미널 허용

## 자주 쓰는 명령

```bash
kakao-auto tui
kakao-auto gui
kakao-auto scheduled
kakao-auto instant examples/send-now.sample.json
```

## 설치 메모

- `./scripts/install.sh`
  - CLI만 설치
- `./scripts/install.sh --gui`
  - Electron GUI까지 설치
- `npm link`
  - `kakao-auto` 명령을 전역에서 바로 쓰게 함

## 동작 방식

- KakaoTalk macOS 앱을 직접 조작한다.
- AppleScript + System Events + Swift helper 기반이다.
- 로컬 JSON에 발송 목록과 이력을 저장한다.
- 채팅방 불러오기, 즉시 발송, 파일 첨부, TUI/GUI를 포함한다.

## Homebrew 배포 준비

로컬에서 Brew용 소스 아카이브:

```bash
npm run brew:dist
```

formula 생성:

```bash
npm run brew:formula -- --url https://github.com/<owner>/<repo>/archive/refs/tags/v0.1.0.tar.gz --sha256 <sha256> --homepage https://github.com/<owner>/<repo> --output /opt/homebrew/Library/Taps/<user>/homebrew-kakao-auto/Formula/kakao-auto.rb
```

## 동작 메모

- 열린 채팅방 감지는 현재 열린 KakaoTalk 창 제목 기준이다.
- 방 자동 열기는 검색 단축키 기반의 베스트에포트 방식이다.
- 파일 첨부는 macOS 열기 패널을 조작하는 방식이라 KakaoTalk 버전에 따라 추가 보정이 필요할 수 있다.
