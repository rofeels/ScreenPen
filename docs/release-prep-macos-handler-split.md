# Release Prep: macOS Handler Split

## Candidate scope
This release-prep note covers the macOS-only handler modularization work now present on `main`.

## Included user-visible / developer-visible improvements
- Korean localization foundation added earlier in the series
- stronger i18n structure and source-key validation
- shared Electron IPC contracts for macOS flows
- extracted helper modules for:
  - permissions
  - native helper resolution
  - source selection
  - mac capture config
  - cursor telemetry utilities
  - mac recording lifecycle utilities
  - cursor monitor runtime
  - source highlight
  - window bounds
- expanded Electron unit test coverage

## Verification snapshot
- `npm run verify` ✅
- test files: 17
- tests: 128
- `git status --short` clean at prep time

## Manual release checklist
- [ ] Start native macOS recording
- [ ] Pause / resume native macOS recording
- [ ] Stop recording and open editor
- [ ] Verify cursor monitor behavior in a short capture
- [ ] Verify source highlight overlay on at least one window and one display
- [ ] Verify Korean locale toggle still works on launch/editor surfaces

## Suggested release notes bullets
- Improved internal modularization of macOS recording and source-selection handlers
- Added focused Electron tests for source highlighting, window bounds, cursor monitor runtime, and recording lifecycle helpers
- Strengthened release verification and localization safety checks

## Go / no-go
- **Go** if the manual checklist above passes on macOS
- **No-go** if any native recording lifecycle, highlight overlay, or cursor monitor regression appears
