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
required_version='2026.08.19'
installed_version="$(yt-dlp --version)"
if [[ "$installed_version" < "$required_version" ]]; then
  echo "yt-dlp $installed_version is too old; need $required_version or newer." >&2
  echo 'Upgrade in a venv: pip install -U "yt-dlp[default]"' >&2
  echo 'Or: brew upgrade yt-dlp' >&2
  exit 1
fi
runtime_args=()
if ! command -v deno >/dev/null; then
  command -v node >/dev/null || { echo 'Install node or deno for the YouTube JavaScript challenge.' >&2; exit 1; }
  runtime_args=(--js-runtimes node)
fi
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$repo_dir/public/audio"
task_tmp="$(mktemp -d "${TMPDIR:-/tmp}/fratty-audio.XXXXXX")"
trap 'rm -rf -- "$task_tmp"' EXIT
yt-dlp "${runtime_args[@]}" --no-playlist --playlist-items 1 --no-progress --extract-audio --audio-format mp3 --audio-quality 2 --output "$task_tmp/track.%(ext)s" -- "$track_url"
ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of default=noprint_wrappers=1 "$task_tmp/track.mp3"
if [[ -f "$repo_dir/public/audio/fratty-pipeline.mp3" ]]; then
  cp "$repo_dir/public/audio/fratty-pipeline.mp3" "$repo_dir/public/audio/fratty-pipeline.previous.mp3"
fi
mv "$task_tmp/track.mp3" "$repo_dir/public/audio/fratty-pipeline.mp3"
echo 'Song ready: public/audio/fratty-pipeline.mp3. Reload PIPELINE; press LET’S RIOT to start looping audio.'
