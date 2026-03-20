# ScreenCraft Release / CI / Notarization

This repository now uses:

- `verify.yml` for CI verification on pushes and pull requests
- `release.yml` for signed/notarized release builds on tags or manual dispatch

## Required GitHub secrets

### macOS signing

Per the electron-builder signing documentation, macOS signing on CI requires:

- `CSC_LINK` — base64-encoded `Developer ID Application` `.p12`
- `CSC_KEY_PASSWORD` — password for that certificate

Reference:
- electron-builder code signing setup: https://www.electron.build/code-signing.html
- electron-builder macOS signing/notarization: https://www.electron.build/code-signing-mac.html

### macOS notarization

electron-builder enables notarization automatically when one of these secret sets is present:

#### Recommended App Store Connect API key flow

- `APPLE_API_KEY`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER`

#### Alternative Apple ID flow

- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

Reference:
- electron-builder mac configuration: https://www.electron.build/electron-builder.interface.macconfiguration
- Apple Developer ID / notarization overview: https://developer.apple.com/developer-id/
- Apple notarization workflow: https://developer.apple.com/documentation/security/customizing-the-notarization-workflow

## Release flow

### Automatic

Push a tag:

```bash
git tag v1.2.1
git push origin v1.2.1
```

That triggers:

1. signed + notarized macOS x64 build
2. signed + notarized macOS arm64 build
3. GitHub Release publication with generated notes

### Manual

Run the **Release** workflow from GitHub Actions and provide:

- `tag_name`
- optional `release_name`
- whether the release should be a draft / prerelease

## Notes

- Local builds without signing secrets still work, but they are **not notarized**.
- The release workflow intentionally fails early when macOS signing/notarization secrets are missing.
- `build/entitlements.mac*.plist` enables hardened runtime compatibility for Electron/native modules.
- The current release workflow focuses on **notarized macOS distribution first**. Windows/Linux release jobs can be reintroduced after the notarized macOS path is stable.
