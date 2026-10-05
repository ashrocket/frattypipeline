# Soundtrack

Run `bash scripts/import-song.sh` from the repo root. The default is the supplied
YouTube recording: `https://www.youtube.com/watch?v=lm-CRMQ7jmU`. The regular
YouTube and YouTube Music links share this video ID; their playlist IDs differ.
Pass a URL as the optional first argument to choose another source.
The script needs `yt-dlp` and `ffmpeg` and downloads one track into
`public/audio/fratty-pipeline.mp3`. This file is automatically included in builds.
Use the original video, Bandcamp page, or a direct audio URL; the old Spotify ID
(`33lVSu93J91BDmhfRT7iTA`) is metadata only, not a source of full audio bytes.

Until the file is present, the game labels and plays an original synthesized
instrumental demo loop. The demo is not the Fratty Pipeline recording.
