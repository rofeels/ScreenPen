# macOS Remaining Risks

## 1) Manual macOS runtime smoke coverage is still required
Automated tests now cover extracted helper modules, but these flows still need manual validation on macOS:
- start / stop native recording
- pause / resume native recording
- native cursor monitor process lifecycle
- source highlight overlay behavior
- selected window bounds refresh during recording

## 2) `electron/ipc/handlers.ts` is smaller but still central
The file is more orchestration-oriented than before, but it still owns:
- IPC registration
- cross-module state coordination
- macOS / Windows branch routing
- recording state transitions

A future split is still desirable if more macOS feature work lands.

## 3) Review lane validated worker-2 result from its commit, not a separately recomputed leader diff
The review worker reported the worker-2 extraction as merge-ready after targeted checks, but the team merge notifications repeatedly referenced the old leader base hash in mailbox messages. Final confidence comes from the post-shutdown leader-side `npm run verify`, not from mailbox wording.

## 4) Full-repo lint debt remains outside the scoped verify command
`npm run verify` is green, but it intentionally scopes lint to the safe, high-signal surfaces. Broader repository lint/legacy warnings still exist and should not be mistaken for this slice being unverified.

## 5) Team merge history is operationally noisy
The team run generated multiple integration notifications and auto-checkpoint commits in worker worktrees. The main branch is clean now, but future team runs should continue to prefer terminal task summaries over repeated integration notices.

## Recommendation
Do a short macOS smoke pass before a public release, even though code-level verification is green.
