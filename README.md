# KakaoTalk Auto Mac

macOS 전용 KakaoTalk CLI/GUI 자동화 도구다.

## 바로 설치

```bash
brew tap youngwoohome/kakaotalk-cli https://github.com/youngwoohome/kakaotalk-cli
brew install youngwoohome/kakaotalk-cli/kakao-auto
```

## Claude Code MCP 연동

설치 후 한 줄로 Claude Code에 카톡 도구를 등록한다:

```bash
kakao-auto mcp install
```

등록 후 Claude Code를 재시작하면 다음 도구가 자동 활성화된다:

| 도구 | 설명 |
|------|------|
| `list_rooms` | 채팅방 목록 조회 (최근 활동 순) |
| `find_room` | 이름으로 채팅방 검색 (fuzzy match) |
| `send_message` | 채팅방에 메시지 전송 |
| `analyze_room` | 최근 메시지 분석 (sender/body/timestamp 구조화) |

Claude Code에서 바로 자연어로 요청하면 된다:

```text
서정이한테 하이 보내
고양이 논문 방에서 최근 150개 메세지 보고 언급된 논문들 정리해줘
```

MCP 제거:

```bash
kakao-auto mcp remove
```

## 자주 쓰는 명령

```bash
kakao-auto rooms                                          # 채팅방 목록
kakao-auto rooms --json                                   # JSON 출력
kakao-auto analyze --room "방이름" --limit 150 --json    # 메시지 분석
kakao-auto instant examples/send-now.sample.json          # 즉시 발송
kakao-auto tui                                            # 터미널 UI
kakao-auto gui                                            # Electron GUI
```

## 필수 조건

- macOS
- `/Applications/KakaoTalk.app` 설치 및 실행 중
- `시스템 설정 > 개인정보 보호 및 보안 > 손쉬운 사용`에서 터미널 허용

## 소스에서 설치

```bash
git clone https://github.com/youngwoohome/kakaotalk-cli.git
cd kakaotalk-cli
npm install
npm link
kakao-auto mcp install
```

## 동작 방식

- KakaoTalk macOS 앱을 직접 조작한다.
- Swift Accessibility API (native helper) + AppleScript fallback 기반이다.
- MCP 서버는 stdio transport로 Claude Code와 통신한다.
- 로컬 JSON에 발송 목록과 이력을 저장한다.

## 동작 메모

- 열린 채팅방 감지는 현재 열린 KakaoTalk 창 제목 기준이다.
- 방 자동 열기는 검색 단축키 기반의 베스트에포트 방식이다.
- 파일 첨부는 macOS 열기 패널을 조작하는 방식이라 KakaoTalk 버전에 따라 추가 보정이 필요할 수 있다.
