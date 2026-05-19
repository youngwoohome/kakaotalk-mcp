# kakotalk-mcp

[![npm](https://img.shields.io/npm/v/kakotalk-mcp?label=npm&color=cb3837)](https://www.npmjs.com/package/kakotalk-mcp)

macOS KakaoTalk automation CLI and Claude Code MCP server.

한국어 설명은 아래 [한국어](#한국어) 섹션을 참고하세요.

## English

### What This Package Provides

`kakotalk-mcp` gives you two command surfaces:

- `kakaotalk-cli`: a terminal CLI for KakaoTalk automation
- `kakotalk-mcp`: a Claude Code MCP helper and stdio MCP server

The old `kakao-auto` and `kakao-mcp` commands were removed in `0.4.0` to reduce confusion.

### Common Workflows

`kakotalk-mcp` is for automating real KakaoTalk workflows from Claude Code or the terminal.

| Workflow | Use MCP for | Use CLI for |
| --- | --- | --- |
| Send notices to multiple chat rooms | Draft the message, inspect context, and confirm each send | Send one JSON payload to many rooms with `roomNames` |
| Summarize Open Chat activity | Read recent messages and summarize topics, questions, links, and action items | Export recent messages as structured JSON |
| Track a busy room over time | Ask Claude Code to review recent messages repeatedly and maintain a running summary | Run analysis commands from scripts or cron |
| Send files with context | Compose a short note and send it with a file after confirmation | Send a `filePath` and message from a JSON payload |
| Draft safer replies | Read recent context before writing a response | Send only after the payload is explicit |

MCP currently sends to one room per `send_message` call. For bulk sends, use the CLI `instant` command with multiple `roomNames`.

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
| `send_message` | Send a message, optionally with a file. Requires exact room match and user confirmation. |
| `analyze_room` | Read recent room messages and return structured sender/body/timestamp data |

### MCP Safety Model

`send_message` is a side-effecting tool, so it has extra server-side gates:

- The room name must exactly match an existing KakaoTalk room.
- If `KAKAOTALK_MCP_ALLOWED_ROOMS` is set, the room must be in that comma-separated allowlist.
- Messages are limited to 2,000 characters.
- Attachment paths must exist before sending.
- The MCP client must support elicitation, and the user must confirm the send in the elicitation dialog.

Clients may have their own tool approval modes, but this package does not rely on client approval prompts alone. If a client does not support MCP elicitation, `send_message` fails closed. For local testing only, you can bypass the server-side confirmation gate with:

```bash
KAKAOTALK_MCP_ALLOW_UNCONFIRMED_SEND=1 kakotalk-mcp serve
```

Example prompts in Claude Code:

```text
Read the latest 200 messages in the product Open Chat and summarize recurring questions.
Draft a notice for the beta testers room, then send it after I confirm.
Read the latest messages in the study room and extract links, deadlines, and action items.
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

### 주요 사용 흐름

`kakotalk-mcp`는 Claude Code나 터미널에서 실제 카카오톡 작업을 자동화하기 위한 도구입니다.

| 사용 흐름 | MCP로 할 수 있는 일 | CLI로 할 수 있는 일 |
| --- | --- | --- |
| 여러 채팅방에 공지 보내기 | 문구를 작성하고 맥락을 확인한 뒤 각 발송을 승인 | `roomNames`가 들어간 JSON으로 여러 방에 한 번에 발송 |
| 오픈채팅방 흐름 정리 | 최근 메시지를 읽고 주제, 질문, 링크, 할 일 요약 | 최근 메시지를 구조화된 JSON으로 출력 |
| 바쁜 채팅방 트래킹 | Claude Code가 최근 대화를 반복 확인하고 누적 요약 | 스크립트나 cron에서 분석 명령 실행 |
| 파일과 설명 함께 보내기 | 짧은 설명을 작성하고 확인 후 파일과 함께 전송 | JSON payload에 `filePath`와 메시지를 넣어 전송 |
| 답장 초안 만들기 | 최근 대화 맥락을 읽은 뒤 답장 문구 작성 | 명시적인 payload만 직접 전송 |

현재 MCP의 `send_message`는 호출당 한 방에 전송합니다. 여러 방 일괄 발송은 CLI의 `instant` 명령과 여러 `roomNames`를 사용하세요.

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
| `send_message` | 메시지 전송, 파일 첨부 선택 가능. 정확한 방 이름과 사용자 확인 필요 |
| `analyze_room` | 최근 메시지를 읽고 sender/body/timestamp 구조로 반환 |

### MCP 안전 모델

`send_message`는 실제 카카오톡 메시지를 보내는 도구라서 서버 쪽 안전장치를 추가로 적용합니다.

- 채팅방 이름은 실제 카카오톡 방 이름과 정확히 일치해야 합니다.
- `KAKAOTALK_MCP_ALLOWED_ROOMS`가 설정되어 있으면 해당 comma-separated allowlist에 포함된 방만 발송할 수 있습니다.
- 메시지는 최대 2,000자로 제한됩니다.
- 첨부 파일 경로는 실제 존재해야 합니다.
- MCP 클라이언트가 elicitation을 지원해야 하며, 사용자가 확인 dialog에서 승인해야 실제 발송됩니다.

클라이언트 자체의 tool approval mode와 별개로, 이 패키지는 클라이언트 승인 prompt에만 의존하지 않습니다. MCP elicitation을 지원하지 않는 클라이언트에서는 `send_message`가 fail closed로 거부됩니다. 로컬 테스트에서만 서버 쪽 확인 단계를 우회하려면 아래 환경변수를 사용할 수 있습니다.

```bash
KAKAOTALK_MCP_ALLOW_UNCONFIRMED_SEND=1 kakotalk-mcp serve
```

Claude Code 예시:

```text
제품 오픈채팅방 최근 200개 메시지를 읽고 반복되는 질문을 정리해줘
베타 테스터 방에 보낼 공지 문구를 작성하고, 내가 확인하면 보내줘
스터디방 최근 메시지에서 링크, 마감일, 할 일을 뽑아줘
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
