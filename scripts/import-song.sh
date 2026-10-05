#!/usr/bin/env bash
# Download a track from a supported public media URL or direct audio URL.
set -euo pipefail
track_url="${1:-https://www.youtube.com/watch?v=lm-CRMQ7jmU}"
usage() {
  echo 'Usage: bash scripts/import-song.sh ["https://...song-page-or-audio-file..."]'
  echo 'Default: https://www.youtube.com/watch?v=lm-CRMQ7jmU (one recording, no playlist)'
}
if [[ $# -eq 1 && "$1" == --help ]]; then usage; exit 0; fi
if [[ $# -gt 1 || "$track_url" != https://* ]]; then usage >&2; exit 2; fi
case "$track_url" in *spotify.com/*|*spotify:*) echo 'Use the song’s original video, Bandcamp page, or direct audio URL.' >&2; exit 2;; esac
command -v yt-dlp >/dev/null || { echo 'Install yt-dlp first: brew install yt-dlp ffmpeg' >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo 'Install ffmpeg first: brew install ffmpeg' >&2; exit 1; }
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$repo_dir/public/audio"
task_tmp="$(mktemp -d "${TMPDIR:-/tmp}/fratty-audio.XXXXXX")"
trap 'rm -rf -- "$task_tmp"' EXIT
yt-dlp --no-playlist --playlist-items 1 --no-progress --extract-audio --audio-format mp3 --audio-quality 2 --output "$task_tmp/track.%(ext)s" -- "$track_url"
ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of default=noprint_wrappers=1 "$task_tmp/track.mp3"
if [[ -f "$repo_dir/public/audio/fratty-pipeline.mp3" ]]; then
  cp "$repo_dir/public/audio/fratty-pipeline.mp3" "$repo_dir/public/audio/fratty-pipeline.previous.mp3"
fi
mv "$task_tmp/track.mp3" "$repo_dir/public/audio/fratty-pipeline.mp3"
echo 'Song ready: public/audio/fratty-pipeline.mp3. Reload Greek Row; press LET’S RIOT to start looping audio.'
