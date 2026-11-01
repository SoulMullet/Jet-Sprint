#!/usr/bin/env bash
# Add compatibility copies only; existing assets (including WAVs) stay untouched.
set -euo pipefail
cd "$(dirname "$0")/.."
for recording in EngineIdle EngineRev EngineRevDown EngineCruise EngineCruiseLayerOne EngineJump; do
  if [[ -e "public/audio/Engine/$recording.wav" ]]; then continue; fi
  ffmpeg -v error -i "public/audio/Engine/$recording.m4a" \
    -map_metadata -1 -af volume=0.9 -ac 2 -ar 32000 -c:a pcm_s16le "public/audio/Engine/$recording.wav"
done
