# MDWriter Release Operations

## Distribution Channels
- `appx`: Microsoft packaging channel, suitable for signed installation deployment.
- `portable`: no installer, direct executable distribution for official website.

Single repository is sufficient. Keep both channels in one codebase and one CI pipeline.

## Current Rollout Phase
- Phase 1 (now): Store/AppX first. License mode is `store` (no custom activation flow).
- Phase 2 (later): Official website portable sales with cloud-function license activation/rebind.

## Build Commands
- `npm run package:win:appx`
- `npm run package:win:appx:store`
- `npm run package:win:portable`
- `npm run package:win:dual`

## GitHub Actions
Workflow file: `.github/workflows/windows-dual-release.yml`
- Tag push (`v*`) triggers both channels.
- CI uploads artifacts and attaches them to GitHub Release.

Store-first workflow file: `.github/workflows/windows-store-release.yml`
- Tag push (`v*`) builds and uploads only AppX in `store` license mode.

## Signing
AppX should be signed.
Configure repository secrets:
- `CSC_LINK`: certificate file or base64 content.
- `CSC_KEY_PASSWORD`: certificate password.

If signing is unavailable, AppX installation trust may fail on user machines.

## China Network Strategy
- Keep GitHub Release as global source of truth.
- Sync release artifacts to Tencent OSS/COS for mainland download acceleration.
- Website download buttons can route by region to GitHub or OSS.

## Channel and Rollback Policy
- Stable channel: normal releases, default user channel.
- Beta channel: pre-release testing versions.
- Rollback rule: never replace an existing version file; publish a higher patch version that reverts bad changes.
- Emergency rollback process:
  1. Stop update rollout (remove bad release from update feed).
  2. Publish hotfix patch version.
  3. Mark bad version as blocked in updater metadata.

## Updater Note
Portable channel typically uses manual update prompts/download replacement.
AppX update behavior is different from NSIS/electron-updater flow. Validate your chosen update feed separately before production rollout.
