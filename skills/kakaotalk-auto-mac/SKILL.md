---
name: kakaotalk-auto-mac
description: Use when the user wants to install, run, troubleshoot, or operate the macOS KakaoTalk automation tool from this repo. Covers Homebrew install, old tap conflicts, CLI/TUI/GUI launch, command selection, and the main automation capabilities.
---

# KakaoTalk Auto Mac

Use this skill when the task is about installing or using the macOS KakaoTalk automation app in this repository.

## What this skill covers

- Homebrew install for `kakao` / `kakao-auto`
- Resolving old tap conflicts such as `youngwoojung/kakao-auto`
- Listing rooms with `kakao-auto rooms`
- Launching CLI/TUI with `kakao-auto tui`
- Launching GUI with `kakao-auto gui`
- Running one-off sends with `kakao-auto instant <json>`
- Choosing whether TUI, GUI, or instant mode is the best fit
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
kakao rooms
kakao tui
kakao gui
kakao instant examples/send-now.sample.json
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
command -v kakao
kakao --help
```

## Command guide

Use these commands depending on the user request:

- List rooms sorted by recent activity:

```bash
kakao rooms
```

- List rooms as JSON:

```bash
kakao rooms --json
```

- List more rooms:

```bash
kakao rooms --limit 100
```

- Interactive terminal UI:

```bash
kakao tui
```

- Desktop app:

```bash
kakao gui
```

- One-off send from a JSON payload:

```bash
kakao instant examples/send-now.sample.json
```

## When to choose each mode

- Use `rooms` when the user asks for current chat rooms, wants them sorted by recent activity, or asks "지금 어떤 채팅방 있는지 날짜 순으로 알려줘".
- Use `tui` when the user wants terminal-first operation, quick testing, room selection, or message analysis from the terminal.
- Use `gui` when the user wants visual room selection and a desktop control panel.
- Use `instant` when the user already has a payload file or wants reproducible scripted sending.

## Main capabilities

- Read KakaoTalk room list from the macOS app
- Sort room list by recent activity
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
kakao tui
```

### Show rooms sorted by recent activity

```bash
kakao rooms
```

### Install and launch GUI

```bash
brew tap youngwoohome/kakaotalk-cli https://github.com/youngwoohome/kakaotalk-cli
brew install youngwoohome/kakaotalk-cli/kakao-auto
kakao gui
```

### Run one-off send

```bash
kakao instant examples/send-now.sample.json
```

### Verify install before doing anything else

```bash
command -v kakao
kakao --help
```

## Guidance

- Prefer Homebrew install over `git clone` unless the user explicitly wants source checkout.
- If the user only wants CLI, still do the Homebrew install first, then run `kakao tui`.
- If GUI launches on macOS as `Electron`, explain that this is expected for the current build.
- If KakaoTalk automation fails, check Accessibility permission before changing code.
- If the user asks what the tool can do, list the actual commands and capabilities before discussing installation details.
- When the user already has the tool installed, skip install and go straight to the requested command.
