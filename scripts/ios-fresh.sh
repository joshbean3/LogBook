#!/usr/bin/env bash
# Rebuild the iPhone app for your own phone from the latest pushed code, checking every step, so a stale build can't
# slip through. This is the development build: it includes Strava. The App Store build is `pnpm ios:release`.
# Usage (from the repo root): pnpm ios:fresh
set -euo pipefail
cd "$(dirname "$0")/.."
say() { printf '\n\033[1m%s\033[0m\n' "$1"; }
fail() { printf '\n\033[31mStopped: %s\033[0m\n' "$1"; exit 1; }

branch=$(git branch --show-current)
[ -n "$branch" ] || fail "you are not on a branch. Run: git switch main"
say "1/7  Getting the latest code ($branch)"
git pull --ff-only || fail "couldn't update $branch. Check your connection. If local changes block it, run: git stash, then pnpm ios:fresh, then git stash pop"
want=$(git rev-parse --short HEAD)
echo "On commit $want"

say "2/7  Installing packages"
pnpm install || fail "pnpm install failed (see above)."

say "3/7  Building the shared package"
pnpm --filter @logbook/shared build || fail "the shared build failed (see above)."

say "4/7  Building the app for iPhone (with Strava)"
VITE_FEATURE_STRAVA=1 pnpm --filter @logbook/web build:ios || fail "the app build failed. Paste the red lines above to Claude."
grep -rqs "$want" apps/web/dist/assets || fail "the new build doesn't carry commit $want. Paste this message to Claude."
node scripts/release-check.mjs bundle apps/web/dist --strava || fail "the build holds a developer screen (see above)."
echo "Build carries commit $want"

say "5/7  Copying the build into the iOS project"
(cd apps/web && npx cap sync ios) || fail "cap sync failed (see above)."
grep -rqs "$want" apps/web/ios/App/App/public/assets || fail "the iOS project didn't get the new build. Paste this message to Claude."

say "6/7  Writing the Debug Info.plist (adds the logbook:// link Strava returns through)"
node scripts/ios-dev-plist.mjs || fail "couldn't write Info-Dev.plist (see above)."

say "7/7  Opening Xcode"
(cd apps/web && npx cap open ios)
printf '\n\033[32mReady.\033[0m In Xcode: Shift+Cmd+K, then Run. In the app, Settings > About should read "Version ... (%s)".\n' "$want"
