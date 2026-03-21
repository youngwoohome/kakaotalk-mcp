# KakaoTalk Auto Mac

macOS 전용 KakaoTalk CLI/GUI 자동화 도구다.

## 바로 설치

처음 설치:

```bash
brew tap youngwoohome/kakaotalk-cli https://github.com/youngwoohome/kakaotalk-cli
brew install youngwoohome/kakaotalk-cli/kakao-auto
```

설치 후 CLI 실행:

```bash
kakao-auto tui
```

설치 후 GUI 실행:

```bash
kakao-auto gui
```

## Claude Code에서 바로 시키기

Claude Code에 이렇게 보내면 된다:

```text
Install the skill from github repo `youngwoohome/kakaotalk-cli` path `skills/kakaotalk-auto-mac`, then install `kakao-auto` with Homebrew if it is missing, resolve old tap conflicts if needed, verify `kakao-auto --help`, and run `kakao-auto tui`.
```

GUI를 원하면 마지막만 `kakao-auto gui`로 바꾸면 된다.

소스 checkout이 필요할 때:

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

## 동작 방식

- KakaoTalk macOS 앱을 직접 조작한다.
- AppleScript + System Events + Swift helper 기반이다.
- 로컬 JSON에 발송 목록과 이력을 저장한다.
- 채팅방 불러오기, 즉시 발송, 파일 첨부, TUI/GUI를 포함한다.

## 동작 메모

- 열린 채팅방 감지는 현재 열린 KakaoTalk 창 제목 기준이다.
- 방 자동 열기는 검색 단축키 기반의 베스트에포트 방식이다.
- 파일 첨부는 macOS 열기 패널을 조작하는 방식이라 KakaoTalk 버전에 따라 추가 보정이 필요할 수 있다.
