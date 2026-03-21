---
name: kakaotalk-auto-mac
description: Use when the user wants to install, run, troubleshoot, or operate the macOS KakaoTalk automation tool from this repo. Covers Homebrew install, old tap conflicts, CLI/TUI/GUI launch, command selection, and the main automation capabilities.
---

# KakaoTalk Auto Mac

Use this skill when the task is about installing or using the macOS KakaoTalk automation app in this repository.

## What this skill covers

- Homebrew install for `kakao-auto`
- Resolving old tap conflicts such as `youngwoojung/kakao-auto`
- Listing rooms with `kakao-auto rooms`
- Analyzing room content with `kakao-auto analyze`
- Launching CLI/TUI with `kakao-auto tui`
- Launching GUI with `kakao-auto gui`
- Running one-off sends with `kakao-auto instant <json>`
- Choosing whether rooms, analyze, TUI, GUI, or instant mode is the best fit
- Verifying that KakaoTalk and macOS Accessibility prerequisites are in place

## Prerequisites

- macOS
- `/Applications/KakaoTalk.app`
- Accessibility permission for the terminal app:
  - `시스템 설정 > 개인정보 보호 및 보안 > 손쉬운 사용`

## Default install flow

Run these commands in order:

```bash
brew tap youngwoohome/kakaotalk-cli https://github.com/youngwoohome/kakaotalk-cli
brew install youngwoohome/kakaotalk-cli/kakao-auto
```

Then launch one of:

```bash
kakao-auto rooms
kakao-auto analyze --room "YOUTH FOUNDER CLUB" --limit 120 --focus "고객 니즈"
kakao-auto tui
kakao-auto gui
kakao-auto instant examples/send-now.sample.json
```

## If install conflicts with an old tap

If Homebrew reports duplicate formulae or conflicts involving `youngwoojung/kakao-auto`, clean it up with:

```bash
brew uninstall kakao-auto
brew untap youngwoojung/kakao-auto
brew tap youngwoohome/kakaotalk-cli https://github.com/youngwoohome/kakaotalk-cli
brew install youngwoohome/kakaotalk-cli/kakao-auto
```

## Verification

After install, verify with:

```bash
command -v kakao-auto
kakao-auto --help
```

## Command guide

Use these commands depending on the user request:

- List rooms sorted by recent activity:

```bash
kakao-auto rooms
```

- Analyze a room and summarize recent messages:

```bash
kakao-auto analyze --room "YOUTH FOUNDER CLUB" --limit 120 --focus "고객 니즈"
```

- List rooms as JSON:

```bash
kakao-auto rooms --json
```

- List more rooms:

```bash
kakao-auto rooms --limit 100
```

- Interactive terminal UI:

```bash
kakao-auto tui
```

- Desktop app:

```bash
kakao-auto gui
```

- One-off send from a JSON payload:

```bash
kakao-auto instant examples/send-now.sample.json
```

## When to choose each mode

- Use `rooms` when the user asks for current chat rooms, wants them sorted by recent activity, or asks "지금 어떤 채팅방 있는지 날짜 순으로 알려줘".
- Use `analyze` when the user asks for a specific room's recent messages to be summarized, organized, or filtered by theme.
- Use `tui` when the user wants terminal-first operation, quick testing, room selection, or message analysis from the terminal.
- Use `gui` when the user wants visual room selection and a desktop control panel.
- Use `instant` when the user already has a payload file or wants reproducible scripted sending.

## Main capabilities

- Read KakaoTalk room list from the macOS app
- Sort room list by recent activity
- Read recent messages from a specific room
- Highlight links, contacts, and notable long-form content
- Select one or more rooms
- Send text messages
- Attach files through the macOS file picker flow
- Store local send history
- Run through TUI or GUI

## Typical workflows

### Install and launch TUI

```bash
brew tap youngwoohome/kakaotalk-cli https://github.com/youngwoohome/kakaotalk-cli
brew install youngwoohome/kakaotalk-cli/kakao-auto
kakao-auto tui
```

### Show rooms sorted by recent activity

```bash
kakao-auto rooms
```

### Analyze a room from the terminal

```bash
kakao-auto analyze --room "YOUTH FOUNDER CLUB" --limit 120 --focus "고객 니즈"
```

### Install and launch GUI

```bash
brew tap youngwoohome/kakaotalk-cli https://github.com/youngwoohome/kakaotalk-cli
brew install youngwoohome/kakaotalk-cli/kakao-auto
kakao-auto gui
```

### Run one-off send

```bash
kakao-auto instant examples/send-now.sample.json
```

### Verify install before doing anything else

```bash
command -v kakao-auto
kakao-auto --help
```

## Guidance

- Prefer Homebrew install over `git clone` unless the user explicitly wants source checkout.
- If the user only wants CLI, still do the Homebrew install first, then run `kakao-auto tui`.
- If GUI launches on macOS as `Electron`, explain that this is expected for the current build.
- If KakaoTalk automation fails, check Accessibility permission before changing code.
- If the user asks what the tool can do, list the actual commands and capabilities before discussing installation details.
- When the user already has the tool installed, skip install and go straight to the requested command.
