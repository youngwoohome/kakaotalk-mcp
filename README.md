# KakaoTalk Auto Mac

macOS 전용 KakaoTalk CLI/GUI 자동화 도구다.

## 바로 설치

처음 설치:

```bash
brew tap youngwoohome/kakaotalk-cli https://github.com/youngwoohome/kakaotalk-cli
brew install youngwoohome/kakaotalk-cli/kakao-auto
```

설치 후 채팅방 목록 확인:

```bash
kakao-auto rooms
```

설치 후 GUI 실행:

```bash
kakao-auto gui
```

## Claude Code에서 바로 시키기

Claude Code에 이렇게 보내면 된다:

```text
Use the `kakaotalk-auto-mac` skill from this repo. If `kakao-auto` is missing, install it with Homebrew and resolve old tap conflicts if needed. Then run `kakao-auto rooms` and tell me the current chat rooms sorted by recent activity.
```

특정 방 최근 내용을 정리시키려면:

```text
Use the `kakaotalk-auto-mac` skill from this repo. I already have it installed. Run `kakao-auto analyze --room "YOUTH FOUNDER CLUB" --limit 120 --focus "중요한 내용"` and summarize the recent messages.
```

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
kakao-auto rooms
kakao-auto analyze --room "YOUTH FOUNDER CLUB" --limit 120 --focus "고객 니즈"
kakao-auto gui
kakao-auto instant examples/send-now.sample.json
kakao-auto tui
```

## 동작 방식

- KakaoTalk macOS 앱을 직접 조작한다.
- AppleScript + System Events + Swift helper 기반이다.
- 로컬 JSON에 발송 목록과 이력을 저장한다.
- 채팅방 목록 조회, 특정 방 최근 내용 분석, 즉시 발송, 파일 첨부, GUI/TUI를 포함한다.

## 동작 메모

- 열린 채팅방 감지는 현재 열린 KakaoTalk 창 제목 기준이다.
- 방 자동 열기는 검색 단축키 기반의 베스트에포트 방식이다.
- 파일 첨부는 macOS 열기 패널을 조작하는 방식이라 KakaoTalk 버전에 따라 추가 보정이 필요할 수 있다.
