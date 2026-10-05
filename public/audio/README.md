# Local soundtrack

Run `bash scripts/import-song.sh` from the repository root to import the supplied
recording as `public/audio/fratty-pipeline.mp3`. An optional HTTPS URL selects a
source. The script requires ffmpeg and yt-dlp 2026.08.19 or newer; when Deno is
absent it uses Node for the JavaScript runtime.

Upgrade with `brew upgrade yt-dlp`, or `pip install -U "yt-dlp[default]"` inside a
venv. The importer preserves an existing recording as a previous local copy.

MP3 files are Git-ignored. Vite includes them in local builds, so do not publish
or deploy a build containing the recording without separate owner authorization.

When the file is absent, PIPELINE displays SONG FILE MISSING and plays only SFX
with its visual beat clock. There is no synthesized substitute soundtrack.
`npm run check:song` fails when the file is missing; the build warns and succeeds.

The authored grid is 183.96 BPM, 0.32616 seconds per beat, first beat at 0.305
seconds. Use `?metronome=1` and SOUND CHECK to verify timing with your audio setup.
