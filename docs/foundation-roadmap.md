# Recordly Foundation Roadmap (macOS-first)

## Runtime map

- **Renderer entry**: `src/main.tsx` mounts `I18nProvider` and `App`, then `App` routes by `windowType` (`hud-overlay`, `source-selector`, `countdown`, `editor`).
- **Renderer windows**: `src/components/launch/LaunchWindow.tsx`, `src/components/launch/SourceSelector.tsx`, `src/components/countdown/CountdownOverlay.tsx`, `src/components/video-editor/VideoEditor.tsx`.
- **Secure boundary**: `electron/preload.ts` exposes the `window.electronAPI` surface used by renderer hooks and components.
- **Main-process orchestration**: `electron/main.ts` owns tray/menu lifecycle; `electron/windows.ts` builds BrowserWindows; `electron/ipc/handlers.ts` implements the IPC command surface.
- **Native macOS helpers**: `electron/native/ScreenCaptureKitRecorder.swift`, `ScreenCaptureKitWindowList.swift`, `SystemCursorAssets.swift`, `NativeCursorMonitor.swift` are compiled by `scripts/build-native-helpers.mjs`.

## macOS-only extension points

1. **Capture features** should enter through `src/hooks/useScreenRecorder.ts` and a dedicated IPC handler in `electron/ipc/handlers.ts`.
2. **New window or overlay surfaces** should be added in `electron/windows.ts` and selected through `src/App.tsx` `windowType` routing.
3. **Editor features** should prefer `src/components/video-editor/*` plus `projectPersistence.ts` when persistence is needed.
4. **Native feature work** should target the Swift helpers first; avoid growing Windows/Linux fallback branches unless cross-platform support is explicitly resumed.

## Current structural friction

- `electron/ipc/handlers.ts` is the main process choke point: capture, permissions, files, cursor telemetry, and countdown are all mixed together.
- `electron/preload.ts` mirrors that monolith as one large bridge surface, which makes feature discovery and contract review harder.
- Localization is available app-wide, but a few editor/timeline/common UI strings still live inline in components.

## Recommended next steps

1. Keep `electron/ipc/handlers.ts` as the registration layer, but extract cursor monitor runtime and source highlight/window-bounds helpers next (`docs/macos-handler-split-review.md`).
2. Keep macOS native helpers as the primary implementation path and treat Windows/Linux branches as isolated compatibility code.
3. Continue migrating renderer literals namespace-by-namespace and keep `npm run i18n:check` green.
4. Add focused tests around any new pure IPC helpers before moving additional process/window side effects behind adapters.
