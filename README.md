# kakotalk-mcp

macOS 카카오톡 CLI 자동화 + Claude Code MCP 연동 도구.

## 설치

```bash
npm install -g kakotalk-mcp
```

> Swift native helper 자동 빌드. Xcode Command Line Tools 필요: `xcode-select --install`

GUI 포함:
```bash
npm install -g kakotalk-mcp --include=optional
```

## Claude Code MCP 연동

```bash
kakotalk-mcp install   # 등록
kakotalk-mcp remove    # 제거
```

등록 후 Claude Code 재시작하면 자동 활성화:

| 도구 | 설명 |
|------|------|
| `list_rooms` | 채팅방 목록 조회 |
| `find_room` | 채팅방 이름 검색 (fuzzy match) |
| `send_message` | 메시지 전송 |
| `analyze_room` | 메시지 분석 (sender/body/timestamp) |

Claude Code에서 바로:
```text
서정이한테 하이 보내
고양이 논문 방에서 최근 150개 메세지 보고 논문들 정리해줘
```

## CLI 명령

```bash
kakao-auto rooms                                       # 채팅방 목록
kakao-auto rooms --json                                # JSON 출력
kakao-auto analyze --room "방이름" --limit 150 --json  # 메시지 분석
kakao-auto instant examples/send-now.sample.json       # 즉시 발송
kakao-auto tui                                         # 터미널 UI
kakao-auto gui                                         # Electron GUI
```

## 필수 조건

- macOS
- `/Applications/KakaoTalk.app` 실행 중
- `시스템 설정 > 개인정보 보호 및 보안 > 손쉬운 사용`에서 터미널 허용

## 소스에서 개발

```bash
git clone https://github.com/youngwoohome/kakaotalk-cli.git
cd kakaotalk-cli
npm install
npm link
kakotalk-mcp install
```

## 동작 방식

- Swift Accessibility API (native helper) + AppleScript fallback
- MCP 서버는 stdio transport로 Claude Code와 통신
- 로컬 JSON에 발송 목록과 이력 저장
