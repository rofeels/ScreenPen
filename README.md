# ScreenPen

> English | [한국어](./README.ko.md)

ScreenPen is a free, creator-focused desktop screen recorder and editor with drawing overlays, auto-zoom, cursor effects, chroma key, and more — built for polished videos out of the box.

![ScreenPen demo](./recordlydemo.gif)

## Features

- Screen recording with macOS and Windows capture paths
- **Drawing overlay** — annotate while recording
- **Click / keystroke / laser pointer** visual effects
- Automatic zoom regions and cursor motion polish
- Webcam overlay with **chroma key** support
- Timeline-based editing
- Export to MP4 and GIF
- Project save/load (`.screenpen`, with legacy `.screencraft` / `.recordly` / `.openscreen` support)
- Multi-language UI (Korean, English, Spanish, Chinese)

## Download / Build

### macOS local build

```bash
git clone https://github.com/rofeels/ScreenPen.git
cd ScreenPen
npm install
npm run build:mac
```

The built app will be created under `release/`.

For local install:

```bash
cp -R release/mac-arm64/ScreenPen.app /Applications/ScreenPen.app
```

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

- Repo: https://github.com/rofeels/ScreenPen
- Issues: https://github.com/rofeels/ScreenPen/issues

## Attribution

ScreenPen is built upon the work of:
- [Recordly](https://github.com/webadderall/Recordly) by webadderall (original project)
- [ScreenCraft](https://github.com/NewTurn2017/ScreenCraft) by NewTurn2017 (Korean fork)

## License

MIT
