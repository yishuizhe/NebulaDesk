# NebulaDesk

[![CI](https://github.com/yishuizhe/NebulaDesk/actions/workflows/ci.yml/badge.svg)](https://github.com/yishuizhe/NebulaDesk/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/yishuizhe/NebulaDesk)](https://github.com/yishuizhe/NebulaDesk/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Prompt-shaped living wallpapers for macOS and Windows.

NebulaDesk turns a short vibe prompt into a cinematic, animated desktop scene. It runs fully local: no account, no API key, no cloud renderer. Type a phrase, generate a seeded nebula, tune the motion, export a PNG, save a preset, or send the scene into a desktop wallpaper window.

## Why it exists

Most wallpaper apps make you browse a catalog. NebulaDesk makes the wallpaper feel authored by the user:

- prompt to living scene in one click
- shareable scene seeds
- local procedural renderer
- desktop wallpaper mode
- cross-platform Electron build target
- no backend to operate

## Features

- Prompt-driven palette, motion, gravity, grain, and particle field
- Real-time canvas renderer with cinematic glow, rings, starfield, and film grain
- Export current frame as PNG
- Save and load `.nebula.json` presets
- Copy a compact scene seed for sharing
- macOS wallpaper window prototype
- Windows build target included

## Quick Start

```bash
npm install
npm start
```

## Checks

```bash
npm run check
```

## Build

macOS:

```bash
npm run build:mac
```

Windows:

```bash
npm run build:win
```

Build outputs are written to `dist/`.

## Roadmap

- native Windows WorkerW wallpaper attachment
- scene gallery with one-click remix
- audio-reactive mode
- screen recording export
- signed releases
- community preset feed

## License

MIT
