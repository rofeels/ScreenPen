# macOS Handler Split Review

This review captures the next low-risk handler extractions after the modular macOS foundation landed. It is intentionally scoped to the two remaining hotspots still concentrated in `electron/ipc/handlers.ts`:

1. native cursor monitor runtime
2. source highlight and window-bounds logic

The goal is to let parallel worktrees move faster without changing IPC channel names or broadening the preload contract.

## Guardrails for the next split

- Keep `ipcMain.handle(...)` registration in `electron/ipc/handlers.ts` for this pass; extract services/helpers first.
- Keep the existing channel names stable so renderer code and preload stay untouched.
- Prefer pure helpers before moving side-effectful process or `BrowserWindow` orchestration.
- Reuse the existing Electron IPC test style (`cursorTelemetry.test.ts`, `macCapture.test.ts`, `sourceSelection.test.ts`) for new seams.

## Target 1: native cursor monitor runtime

### Current responsibilities in `handlers.ts`

- owns runtime state: `nativeCursorMonitorProcess`, `nativeCursorMonitorOutputBuffer`, `currentCursorVisualType`
- parses `STATE:<cursor-type>` stdout lines
- resolves platform-specific helper paths (`ensureNativeCursorMonitorBinary`, `getCursorMonitorExePath`)
- starts/stops the helper process and resets to `"arrow"` on unsupported platforms, errors, or close
- emits telemetry side effects through `sampleCursorStateChange(...)` and `emitCursorStateChanged(...)`

### Recommended extraction boundary

Split the feature into one pure parser and one runtime adapter:

- **pure parser**
  - consume buffered stdout chunks
  - return `{ nextBuffer, nextVisualType, emittedVisualTypes }`
  - ignore unknown cursor labels without mutating runtime state
- **runtime adapter**
  - resolve the helper executable for the current platform
  - own process lifecycle (`spawn`, `stdin.write("stop\\n")`, `kill`)
  - invoke a callback when the visual type changes

This keeps the tricky process management isolated while giving tests a deterministic parser seam.

### High-value tests to add when this extraction lands

- partial stdout chunks are recombined before parsing
- unknown `STATE:` values are ignored
- duplicate cursor states do not emit duplicate telemetry
- error/close paths reset the runtime to `"arrow"`
- missing Windows helper binaries fall back cleanly without throwing

### Risks to preserve

- the runtime currently treats every fatal path as a reset to `"arrow"`; do not weaken that fallback
- `stopNativeCursorMonitor()` writes `"stop\\n"` before killing the process; preserve that order
- deduplication must happen in one place only, or cursor telemetry can double-fire

## Target 2: source highlight and window-bounds logic

### Current responsibilities in `handlers.ts`

- resolves display bounds for screen sources
- parses `xwininfo` output for Linux window bounds
- polls selected window bounds for cursor normalization
- activates/focuses windows before highlight (`osascript`, `wmctrl`, `xdotool`)
- resolves the best bounds candidate for highlight overlays
- creates the temporary highlight `BrowserWindow` and inline HTML payload

### Recommended extraction boundary

Break this area into two focused modules:

- **`sourceBounds`**
  - `getDisplayBoundsForSource(...)`
  - `parseXwininfoBounds(...)`
  - platform-specific bounds resolution (`resolveMacWindowBounds`, `resolveLinuxWindowBounds`)
  - shared fallback selection for screen-vs-window capture
- **`sourceHighlight`**
  - window activation helpers
  - highlight bounds resolution flow for `show-source-highlight`
  - pure geometry/HTML builders for the highlight window

The same bounds utilities should back both `show-source-highlight` and `startWindowBoundsCapture()` so cursor normalization and highlight placement cannot drift apart.

### High-value tests to add when this extraction lands

- `parseXwininfoBounds(...)` accepts valid output and rejects incomplete output
- highlight bounds fall back to display bounds when window bounds are missing or invalid
- highlight geometry applies the expected outer padding
- macOS activation can fail without blocking later bounds fallback
- screen sources bypass window-activation logic entirely

### Risks to preserve

- keep the current fallback order: explicit bounds -> platform window lookup -> display bounds
- avoid constructing `BrowserWindow` in pure tests; test geometry and HTML builders separately
- keep the selected-window polling interval thin so it does not duplicate highlight-only work

## Suggested implementation order

1. extract pure cursor monitor stdout parsing first
2. extract bounds parsing/selection utilities next
3. move process/window side effects behind thin adapters
4. leave the IPC registration layer as the final thin wrapper

This order minimizes merge conflicts and keeps verification failures localized.

## Verification checklist for the split

- `npm run typecheck`
- `npm run i18n:check`
- `npm test`
- `npx biome check docs/macos-handler-split-review.md docs/macos-feature-foundation.md docs/foundation-roadmap.md`

No new locale keys should be required for this refactor-only pass.
