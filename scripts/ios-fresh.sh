#!/usr/bin/env bash
# Rebuild the iPhone app from the latest pushed code, checking every step, so a stale build can't slip through.
# Usage (from the repo root): pnpm ios:fresh
set -euo pipefail
BRANCH="claude/ecstatic-euler-l7hmw0"
say() { printf '\n\033[1m%s\033[0m\n' "$1"; }
fail() { printf '\n\033[31mStopped: %s\033[0m\n' "$1"; exit 1; }

say "1/6  Getting the latest code ($BRANCH)"
git fetch origin "$BRANCH" || fail "couldn't reach GitHub. Check your connection."
current=$(git branch --show-current)
if [ "$current" != "$BRANCH" ]; then
  git checkout "$BRANCH" || fail "couldn't switch to $BRANCH. Run: git stash, then try again, then: git stash pop"
fi
git merge --ff-only FETCH_HEAD || fail "your local changes block the update. Run: git stash, then pnpm ios:fresh, then git stash pop"
want=$(git rev-parse --short HEAD)
echo "On commit $want"

say "2/6  Installing packages"
pnpm install || fail "pnpm install failed (see above)."

say "3/6  Building the shared package"
pnpm --filter @logbook/shared build || fail "the shared build failed (see above)."

say "4/6  Building the app for iPhone"
pnpm --filter @logbook/web build:ios || fail "the app build failed. Paste the red lines above to Claude."
grep -rqs "$want" apps/web/dist/assets || fail "the new build doesn't carry commit $want. Paste this message to Claude."
echo "Build carries commit $want"

say "5/6  Copying the build into the iOS project"
(cd apps/web && npx cap sync ios) || fail "cap sync failed (see above)."
grep -rqs "$want" apps/web/ios/App/App/public/assets || fail "the iOS project didn't get the new build. Paste this message to Claude."

say "6/6  Opening Xcode"
(cd apps/web && npx cap open ios)
printf '\n\033[32mReady.\033[0m In Xcode: Shift+Cmd+K, then Run. In the app, Settings should end with "Built %s".\n' "$want"
