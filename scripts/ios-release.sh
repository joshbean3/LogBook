#!/usr/bin/env bash
# Build the iPhone app for the App Store from a tagged commit, and refuse to go on if anything a release must not
# carry is there. Usage (from the repo root, on the Mac):
#
#   git tag v1.0.0 && pnpm ios:release
#
# Settings come from the environment, or from a file named .env.release in the repo root (git ignores it):
#
#   VITE_API_ORIGIN=https://api.<your domain>      the server the app talks to (not a fly.dev address)
#   VITE_SITE_ORIGIN=https://<your domain>         where the legal and support pages live (leave out if it is the same)
#   VITE_SUPPORT_EMAIL=<support address>           the address on the support page and in Settings
#
# What it does, in order: checks the tree and the tag, the settings, the legal pages, the privacy sentences and the
# iOS project; installs; builds without Strava; searches the built files; syncs them into the iOS project; checks
# what sync wrote; stamps the version and a rising build number; opens Xcode. docs/launch/release-checklist.md has
# the steps before and after.
set -euo pipefail
cd "$(dirname "$0")/.."

say() { printf '\n\033[1m%s\033[0m\n' "$1"; }
fail() { printf '\n\033[31mStopped: %s\033[0m\n' "$1"; exit 1; }
PBX=apps/web/ios/App/App.xcodeproj/project.pbxproj
SPM=apps/web/ios/App/CapApp-SPM/Package.swift
RESOLVED=apps/web/ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved

if [ -f .env.release ]; then set -a; . ./.env.release; set +a; fi
# Strava is not in the release build, whatever the shell has set
unset VITE_FEATURE_STRAVA

say "1/9  Checking the commit"
tag=$(git describe --exact-match --tags HEAD 2>/dev/null) || fail "this commit has no tag. Tag the release first: git tag v1.0.0"
version=${tag#v}
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "the tag must look like v1.0.0 (got $tag)."
# a clean tree: nothing changed, nothing untracked. The one change allowed is this script's own version stamp from an earlier run.
dirty=$(git status --porcelain | grep -v " $PBX\$" || true)
[ -z "$dirty" ] || fail "the working tree has changes. Commit or stash them, move the tag, and run again:
$dirty"
other=$(git diff -U0 -- "$PBX" | grep '^[+-]' | grep -v '^+++\|^---' | grep -v 'MARKETING_VERSION = \|CURRENT_PROJECT_VERSION = \|LOGBOOK_API_HOST = ' || true)
[ -z "$other" ] || fail "the Xcode project has changes beyond the version stamp (a signing team, perhaps). Commit them, move the tag, and run again:
$other"
commit=$(git rev-parse --short HEAD)
# the build number rises with every release: the number of commits behind this one, unless you give one
if [ -n "${BUILD_NUMBER:-}" ]; then
  build=$BUILD_NUMBER
else
  [ "$(git rev-parse --is-shallow-repository)" = "false" ] || fail "this is a shallow clone, so the commit count is not the real one. Run: git fetch --unshallow (or set BUILD_NUMBER to a number above the last upload)."
  build=$(git rev-list --count HEAD 2>/dev/null) || fail "couldn't count the commits. Set BUILD_NUMBER to a number above the last upload."
fi
[[ "$build" =~ ^[1-9][0-9]*$ ]] || fail "the build number must be a whole number above 0 (got $build)."
echo "Version $version, build $build, commit $commit"

say "2/9  Checking the settings"
node scripts/release-check.mjs env || fail "fix the settings above (.env.release or the environment)."

say "3/9  Checking the legal pages, the privacy sentences and the iOS project"
node scripts/legal-pages.mjs --release || fail "the legal pages are not ready (docs/launch/legal-fields.json)."
node scripts/privacy-claims.mjs --check || fail "a privacy sentence in the app is not in docs/launch/privacy-claims.md. Read it against the code, then list it."
node scripts/release-check.mjs ios || fail "the iOS project is not as agreed (see above)."

say "4/9  Installing packages and checking the acknowledgements"
pnpm install --frozen-lockfile || fail "pnpm install failed (see above)."
# after the install, so it reads the packages this lockfile installs
node scripts/notices.mjs --check || fail "the acknowledgements page does not match the installed packages. Run pnpm notices and commit."

say "5/9  Building the app without Strava"
pnpm --filter @logbook/shared build || fail "the shared build failed (see above)."
pnpm --filter @logbook/web build:ios || fail "the app build failed (see above)."
grep -rqs "$commit" apps/web/dist/assets || fail "the build does not carry commit $commit."

say "6/9  Searching the built files"
node scripts/release-check.mjs bundle apps/web/dist || fail "the build holds something a release must not ship (see above)."
if [ -f apps/web/scripts/check-bundle.mjs ]; then
  node apps/web/scripts/check-bundle.mjs apps/web/dist || fail "the build holds something a release must not ship (see above)."
fi

say "7/9  Copying the build into the iOS project"
(cd apps/web && npx cap sync ios) || fail "cap sync failed (see above)."
grep -rqs "$commit" apps/web/ios/App/App/public/assets || fail "the iOS project did not get the new build."
node scripts/release-check.mjs bundle apps/web/ios/App/App/public || fail "the iOS project holds something a release must not ship (see above)."
node scripts/release-check.mjs capconfig || fail "capacitor.config.json has a development setting (see above)."
node scripts/release-check.mjs spm || fail "the Swift package is missing a plugin (see above)."
git diff --quiet -- "$SPM" || fail "cap sync changed $SPM. Commit the new file, move the tag, and run again."
git ls-files --error-unmatch "$RESOLVED" >/dev/null 2>&1 || fail "$RESOLVED is not committed. Open the project in Xcode once, commit the file, move the tag, and run again."
git diff --quiet -- "$RESOLVED" || fail "$RESOLVED changed. Commit it, move the tag, and run again."

say "8/9  Stamping the version and the AutoFill host"
node scripts/release-check.mjs stamp "$version" "$build" || fail "could not write the version into the Xcode project."

say "9/9  Opening Xcode"
if [ "$(uname)" = "Darwin" ]; then (cd apps/web && npx cap open ios); else echo "Not a Mac: open apps/web/ios/App/App.xcodeproj in Xcode yourself."; fi
printf '\n\033[32mReady: Orby %s (%s), commit %s.\033[0m\n' "$version" "$build" "$commit"
printf 'In Xcode: choose "Any iOS Device", then Product > Archive, then Distribute App.\nIn the app, Settings > About should read "Version %s (%s)".\nThen follow docs/launch/release-checklist.md.\n' "$version" "$commit"
