# Local soundtrack

Run `bash scripts/import-song.sh` from the repository root to import the supplied
recording as `public/audio/fratty-pipeline.mp3`. An optional HTTPS URL selects a
source. The script requires ffmpeg and yt-dlp 2026.08.19 or newer; when Deno is
absent it uses Node for the JavaScript runtime.

Upgrade with `brew upgrade yt-dlp`, or `pip install -U "yt-dlp[default]"` inside a
venv. The importer preserves an existing recording as a previous local copy.

MP3 files are Git-ignored. Vite includes them in local builds, so do not publish
or deploy a build containing the recording without separate owner authorization.

The run plays this song once in full. When it ends, a ColecoVision-style chip EDM
re-arrangement takes over on the same beat grid and loops. Skate school loops the
song's own instrumental intro, the bars before the first verse (`loops.tutorial` in
`src/data/fratty-pipeline.beatmap.json`). The chip version is
derived at runtime in the player's browser from this local file: a Web Worker reads
its key, chords, bass line and melody on the beat grid, then renders them with three
square-wave channels and one noise channel, like the TI SN76489 sound chip. It exists
only in memory; it is never stored, committed or uploaded.

When the file is absent, PIPELINE displays SONG FILE MISSING and plays only SFX: no
song, no chip version, and no other synthesized substitute soundtrack.
`npm run check:song` fails when the file is missing; the build warns and succeeds.

The authored grid is 183.96 BPM, 0.32616 seconds per beat, first beat at 0.305
seconds. Use `?metronome=1` to hear a click on every beat.
