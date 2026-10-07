#!/usr/bin/env sh
# Set the app version everywhere it appears, then rebuild the CLI.
#   sh tools/version.sh 0.3.0
# Semantic versioning: the owner bumps MAJOR; Claude bumps MINOR (features) and PATCH (fixes).
set -e
cd "$(dirname "$0")/.."
NEW="$1"
echo "$NEW" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$' || { echo "Usage: sh tools/version.sh X.Y.Z[-prerelease]" >&2; exit 1; }
OLD=$(sed -n "s/^export const VERSION = '\(.*\)';/\1/p" js/version.js)
sed -i.bak "s/^export const VERSION = '.*';/export const VERSION = '$NEW';/" js/version.js
sed -i.bak -e "s/Agent Chess v$OLD/Agent Chess v$NEW/g" -e "s/?v=$OLD/?v=$NEW/g" -e "s/>v$OLD</>v$NEW</g" index.html
rm -f js/version.js.bak index.html.bak
sh tools/build.sh
echo "Version $OLD -> $NEW"
