# macOS Feature Foundation

## Runtime map

- `electron/main.ts` boots the tray app, application menu, single-instance lock, Electron permission handlers, and display-media routing.
- `electron/windows.ts` owns the three BrowserWindow surfaces: HUD overlay, editor, and source selector.
- `electron/preload.ts` exposes the renderer's IPC surface through `window.electronAPI`.
- `electron/ipc/handlers.ts` is the main process service layer for recording, file IO, permissions, project persistence, telemetry, and helper-process lifecycle.
- `electron/native/*.swift` contains the macOS-native helpers for ScreenCaptureKit recording, window enumeration, and cursor assets.
- `src/contexts/I18nContext.tsx` loads locale bundles and provides `t()` / `useScopedT()` in the renderer.

## macOS-native extension points

1. **Capture pipeline**
   - `start-native-screen-recording` / `stop-native-screen-recording` in `electron/ipc/handlers.ts`
   - `ScreenCaptureKitRecorder.swift`
   - Best place for new recording options, capture metadata, or post-processing hooks.
2. **Window and source discovery**
   - `get-sources` and native window enrichment in `electron/ipc/handlers.ts`
   - `ScreenCaptureKitWindowList.swift`
   - Best place for per-app filtering, smart source grouping, and improved source search.
3. **Cursor and interaction telemetry**
   - cursor monitor lifecycle in `electron/ipc/handlers.ts`
   - `NativeCursorMonitor.swift` and `SystemCursorAssets.swift`
   - Best place for click effects, cursor analytics, and smarter auto-zoom heuristics.
4. **Renderer settings / editor behavior**
   - `src/components/video-editor/VideoEditor.tsx`
   - `src/components/video-editor/timeline/TimelineEditor.tsx`
   - Best place for new editing tools, export flows, and localized editor interactions.

## macOS-only simplification targets

1. `electron/ipc/handlers.ts` mixes macOS, Windows, Linux, and FFmpeg fallback branches in a single file. The cleanest future split is `macos.ts`, `windows.ts`, and `shared.ts` service modules behind one registration layer.
2. `electron/preload.ts` still exposes Windows-only IPC calls (`isNativeWindowsCaptureAvailable`, `muxNativeWindowsRecording`). If the app becomes truly macOS-only, these can move behind a macOS-only preload contract.
3. `package.json` still runs Windows helper builds as part of `build:platform-native-helpers`. The scripts already skip on non-Windows hosts, but the build graph remains cross-platform by default.

## Localization status

### Landed foundation

- Korean locale bundles now exist under `src/i18n/locales/ko/`.
- Locale metadata is centralized in `src/i18n/config.ts` so launch/editor language selectors stay in sync.
- Key launch/editor/timeline/export strings now route through the existing namespaces instead of inline English literals.
- `common.app.language` now exists across supported locales, removing a fallback-only path.

### Remaining high-impact i18n hotspots

1. `electron/main.ts`
   - Tray labels, menu labels, and unsaved-changes prompts are still main-process English strings.
2. `electron/ipc/handlers.ts`
   - File picker titles, save/load result messages, and permission-dialog copy are still emitted from the main process.
3. Shared UI primitives such as `src/components/ui/dialog.tsx`
   - Generic accessibility labels like the close button are still static English.

## Suggested next passes

1. Extract `VideoEditor` toast strings and `TimelineEditor` toolbar/empty-state strings into the existing namespace files.
2. Split macOS recording IPC from Windows/Linux branches to reduce risk when adding capture features.
3. Add lightweight tests for locale config / locale loading, plus a renderer-facing smoke check for key hardcoded strings that should stay localized.
