---
name: kakaotalk-auto-mac
description: Use when the user wants to install, run, troubleshoot, or operate the macOS KakaoTalk automation tool from this repo. Handles Homebrew install, old tap conflicts, CLI/TUI/GUI launch, and basic verification.
---

# KakaoTalk Auto Mac

Use this skill when the task is about installing or using the macOS KakaoTalk automation app in this repository.

## What this skill covers

- Homebrew install for `kakao-auto`
- Resolving old tap conflicts such as `youngwoojung/kakao-auto`
- Launching CLI/TUI with `kakao-auto tui`
- Launching GUI with `kakao-auto gui`
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
kakao-auto tui
kakao-auto gui
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

If the user asked for CLI, prefer:

```bash
kakao-auto tui
```

If the user asked for desktop UI, prefer:

```bash
kakao-auto gui
```

## Guidance

- Prefer Homebrew install over `git clone` unless the user explicitly wants source checkout.
- If the user only wants CLI, still do the Homebrew install first, then run `kakao-auto tui`.
- If GUI launches on macOS as `Electron`, explain that this is expected for the current build.
- If KakaoTalk automation fails, check Accessibility permission before changing code.
