# kakotalk-mcp

macOS KakaoTalk automation CLI and Claude Code MCP server.

한국어 설명은 아래 [한국어](#한국어) 섹션을 참고하세요.

## English

### What This Package Provides

`kakotalk-mcp` gives you two command surfaces:

- `kakaotalk-cli`: a terminal CLI for KakaoTalk automation
- `kakotalk-mcp`: a Claude Code MCP helper and stdio MCP server

The old `kakao-auto` and `kakao-mcp` commands were removed in `0.4.0` to reduce confusion.

### Install

```bash
npm install -g kakotalk-mcp
```

The package builds a Swift native helper during install. If the build fails, install Xcode Command Line Tools:

```bash
xcode-select --install
```

### Requirements

- macOS
- Node.js 18 or newer
- `/Applications/KakaoTalk.app`
- KakaoTalk must be running
- Accessibility permission for your terminal or Claude Code:
  `System Settings > Privacy & Security > Accessibility`

### CLI Usage

```bash
kakaotalk-cli rooms
kakaotalk-cli rooms --json
kakaotalk-cli analyze --room "Room name" --limit 150 --json
kakaotalk-cli instant examples/send-now.sample.json
kakaotalk-cli scheduled
kakaotalk-cli tui
kakaotalk-cli check
```

`kakaotalk-cli instant` accepts a JSON payload:

```json
{
  "roomNames": ["Test room"],
  "message": "Test message",
  "filePath": "",
  "fileFirst": true
}
```

### Claude Code MCP

Register or remove the MCP server:

```bash
kakotalk-mcp install
kakotalk-mcp remove
```

Restart Claude Code after registration.

`kakotalk-mcp serve` runs the MCP server over stdio. It is registered by `install` and is normally run by Claude Code, not directly by users.

Available MCP tools:

| Tool | Description |
| --- | --- |
| `list_rooms` | List recent KakaoTalk chat rooms |
| `find_room` | Find the exact room name from a partial query |
| `send_message` | Send a message, optionally with a file |
| `analyze_room` | Read recent room messages and return structured sender/body/timestamp data |

Example prompts in Claude Code:

```text
Send "I will be 10 minutes late" to John.
Read the latest 150 messages in the research chat and summarize the papers.
```

### Local Data

CLI and MCP data is stored in `~/.kakaotalk-cli` by default:

- `send-list.json`
- `send-history.json`

You can override the location for CLI commands with `STORE_DIR`:

```bash
STORE_DIR=./data kakaotalk-cli tui
```

### Development

```bash
git clone https://github.com/youngwoohome/kakaotalk-mcp.git
cd kakaotalk-mcp
npm install
npm link
npm run check
kakotalk-mcp install
```

### How It Works

- Swift Accessibility API native helper for the main automation path
- AppleScript fallback for selected UI operations
- MCP server runs over stdio
- CLI and MCP share the same local JSON store

## 한국어

### 제공 기능

`kakotalk-mcp`는 두 가지 명령을 제공합니다.

- `kakaotalk-cli`: 터미널에서 직접 쓰는 카카오톡 자동화 CLI
- `kakotalk-mcp`: Claude Code MCP 등록/해제 및 stdio MCP 서버

혼동을 줄이기 위해 `0.4.0`부터 예전 `kakao-auto`, `kakao-mcp` 명령은 제거했습니다.

### 설치

```bash
npm install -g kakotalk-mcp
```

설치 중 Swift native helper를 빌드합니다. 빌드가 실패하면 Xcode Command Line Tools를 설치하세요.

```bash
xcode-select --install
```

### 필수 조건

- macOS
- Node.js 18 이상
- `/Applications/KakaoTalk.app`
- 카카오톡 실행 중
- 터미널 또는 Claude Code에 손쉬운 사용 권한 허용:
  `시스템 설정 > 개인정보 보호 및 보안 > 손쉬운 사용`

### CLI 사용법

```bash
kakaotalk-cli rooms
kakaotalk-cli rooms --json
kakaotalk-cli analyze --room "방이름" --limit 150 --json
kakaotalk-cli instant examples/send-now.sample.json
kakaotalk-cli scheduled
kakaotalk-cli tui
kakaotalk-cli check
```

`kakaotalk-cli instant`는 JSON payload를 받습니다.

```json
{
  "roomNames": ["테스트방"],
  "message": "테스트 메시지",
  "filePath": "",
  "fileFirst": true
}
```

### Claude Code MCP

MCP 서버 등록/해제:

```bash
kakotalk-mcp install
kakotalk-mcp remove
```

등록 후 Claude Code를 재시작하세요.

`kakotalk-mcp serve`는 stdio MCP 서버를 실행합니다. `install` 명령이 Claude Code에 자동 등록하므로 보통 사용자가 직접 실행할 필요는 없습니다.

사용 가능한 MCP 도구:

| 도구 | 설명 |
| --- | --- |
| `list_rooms` | 최근 카카오톡 채팅방 목록 조회 |
| `find_room` | 일부 이름으로 정확한 채팅방 이름 검색 |
| `send_message` | 메시지 전송, 파일 첨부 선택 가능 |
| `analyze_room` | 최근 메시지를 읽고 sender/body/timestamp 구조로 반환 |

Claude Code 예시:

```text
서정이한테 10분 늦는다고 보내
고양이 논문 방에서 최근 150개 메시지 보고 논문들 정리해줘
```

### 로컬 데이터

CLI와 MCP 데이터는 기본적으로 `~/.kakaotalk-cli`에 저장됩니다.

- `send-list.json`
- `send-history.json`

CLI 명령은 `STORE_DIR`로 저장 위치를 바꿀 수 있습니다.

```bash
STORE_DIR=./data kakaotalk-cli tui
```

### 개발

```bash
git clone https://github.com/youngwoohome/kakaotalk-mcp.git
cd kakaotalk-mcp
npm install
npm link
npm run check
kakotalk-mcp install
```

### 동작 방식

- 주요 자동화 경로는 Swift Accessibility API native helper 사용
- 일부 UI 동작은 AppleScript fallback 사용
- MCP 서버는 stdio transport로 실행
- CLI와 MCP는 같은 로컬 JSON 저장소를 공유
