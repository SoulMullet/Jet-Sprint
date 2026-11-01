#!/usr/bin/env bash
# Compatibility copies of the user's originals, not replacement audio.
set -euo pipefail
cd "$(dirname "$0")/.."
for recording in EngineCruise EngineRev; do
  ffmpeg -v error -y -i "public/audio/Engine/$recording.m4a" \
    -map_metadata -1 -af volume=0.9 -ac 2 -ar 32000 -c:a pcm_s16le "public/audio/Engine/$recording.wav"
done
