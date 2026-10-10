#!/usr/bin/env bash
# Offline check that the copied Candide sources are still byte-identical to the upstream git blobs
# recorded in contracts/candide/SOURCES.txt (written by scripts/fetch-candide-sources.sh).
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
status=0
tail -n +3 "$HERE/contracts/candide/SOURCES.txt" | while read -r upstream _ path; do
  got=$(git hash-object "$HERE/contracts/candide/${path#contracts/}")
  if [ "$got" = "$upstream" ]; then echo "OK        $path"; else echo "MODIFIED  $path"; exit 1; fi
done || status=1
exit $status
