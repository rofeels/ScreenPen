# ScreenCraft

> English | [한국어](./README.ko.md)

ScreenCraft is a creator-focused desktop screen recorder and editor for making polished walkthroughs, demos, tutorials, and product videos.

It is a **public fork** of the original [webadderall/Recordly](https://github.com/webadderall/Recordly), and that fork relationship is intentionally preserved.

![ScreenCraft demo](./recordlydemo.gif)

## Download / Build

### Homebrew (recommended)

```bash
brew install --cask NewTurn2017/homebrew-tap/screencraft
```

- Homebrew tap: https://github.com/NewTurn2017/homebrew-tap
- Cask file: https://github.com/NewTurn2017/homebrew-tap/blob/main/Casks/screencraft.rb
- Latest release downloads: https://github.com/NewTurn2017/ScreenCraft/releases/latest

### Direct release download

- Releases: https://github.com/NewTurn2017/ScreenCraft/releases
- Latest: https://github.com/NewTurn2017/ScreenCraft/releases/latest

### macOS local build

```bash
git clone https://github.com/NewTurn2017/ScreenCraft.git
cd ScreenCraft
npm install
npm run build:mac
```

The built app will be created under `release/`.

For local install:

```bash
cp -R release/mac-arm64/ScreenCraft.app /Applications/ScreenCraft.app
```

## Why ScreenCraft?

ScreenCraft keeps the fast recording workflow of the original project while focusing on a cleaner creator workflow:

- screen recording with macOS and Windows capture paths
- automatic zoom regions and cursor motion polish
- webcam overlay support
- timeline-based editing
- export to MP4 and GIF
- project save/load support (`.screencraft`, with legacy `.recordly` / `.openscreen` loading support)

## Development

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm run typecheck
npm test
npm run build:mac
```

## Repository links

- Repo: https://github.com/NewTurn2017/ScreenCraft
- Issues: https://github.com/NewTurn2017/ScreenCraft/issues
- Original upstream: https://github.com/webadderall/Recordly

## Attribution

ScreenCraft is based on the excellent original Recordly work by [webadderall](https://github.com/webadderall).

This repository keeps that lineage visible on purpose.

## License

MIT
