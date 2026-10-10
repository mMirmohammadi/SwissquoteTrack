#!/usr/bin/env bash
# Copies the Candide SocialRecoveryModule sources VERBATIM from the commit that Safe's
# safe-modules release tag recovery/v0.1.0 pins (modules/recovery/package.json ->
# "candide-contracts": "github:5afe/CandideWalletContracts#113d3c059e039e332637e8f686d9cbd505f1e738").
# Only the import closure of SocialRecoveryModule.sol is copied. No file is edited.
set -euo pipefail
COMMIT=113d3c059e039e332637e8f686d9cbd505f1e738
HERE="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
git -C "$TMP" init -q
git -C "$TMP" remote add origin https://github.com/5afe/CandideWalletContracts
git -C "$TMP" fetch -q --depth 1 origin "$COMMIT"
git -C "$TMP" checkout -q FETCH_HEAD
FILES="contracts/interfaces/ISafe.sol contracts/interfaces/IModuleManager.sol contracts/interfaces/IGuardManager.sol contracts/interfaces/IOwnerManager.sol contracts/interfaces/IFallbackManager.sol contracts/modules/social_recovery/SocialRecoveryModule.sol contracts/modules/social_recovery/storage/GuardianStorage.sol contracts/modules/social_recovery/storage/IGuardianStorage.sol"
: > "$HERE/contracts/candide/SOURCES.txt"
echo "Copied verbatim from https://github.com/5afe/CandideWalletContracts at commit $COMMIT" >> "$HERE/contracts/candide/SOURCES.txt"
echo "format: <git blob sha in upstream commit> <git hash-object of local copy> <path>" >> "$HERE/contracts/candide/SOURCES.txt"
for f in $FILES; do
  dest="$HERE/contracts/candide/${f#contracts/}"
  mkdir -p "$(dirname "$dest")"
  cp "$TMP/$f" "$dest"
  up=$(git -C "$TMP" rev-parse "HEAD:$f")
  loc=$(git hash-object "$dest")
  [ "$up" = "$loc" ] || { echo "MISMATCH $f"; exit 1; }
  echo "$up $loc $f" >> "$HERE/contracts/candide/SOURCES.txt"
done
rm -rf "$TMP"
cat "$HERE/contracts/candide/SOURCES.txt"
