# macOS Handler Split Summary

## Scope
This summary captures the final main-branch delta after the macOS-only handler split work, using `3f960a9` as the baseline and the current main HEAD as the comparison point.

## Final diff scope
### Documentation
- `docs/foundation-roadmap.md`
- `docs/macos-feature-foundation.md`
- `docs/macos-handler-split-review.md`

### New IPC helper modules
- `electron/ipc/cursorMonitorRuntime.ts`
- `electron/ipc/sourceHighlight.ts`
- `electron/ipc/windowBounds.ts`

### New tests
- `electron/ipc/cursorMonitorRuntime.test.ts`
- `electron/ipc/sourceHighlight.test.ts`
- `electron/ipc/windowBounds.test.ts`

### Updated integration point
- `electron/ipc/handlers.ts`
- `electron/ipc/macCapture.ts`

## What changed
- `handlers.ts` is now more orchestration-focused and delegates more behavior to extracted helpers.
- Cursor monitor STATE parsing moved behind `cursorMonitorRuntime.ts`.
- Source highlight browser-window configuration and generated HTML moved behind `sourceHighlight.ts`.
- Window bounds parsing/selection moved behind `windowBounds.ts`.
- The extracted seams are covered by focused Electron unit tests.

## Evidence
- `git diff --name-status 3f960a9..HEAD`
- `git diff --stat 3f960a9..HEAD`
- `npm run verify`

## Outcome
The main branch is currently clean (`git status --short` returns no output), verified, and ready for release-prep review.
