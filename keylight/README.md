# Keylight

A piano visualizer for MIDI files that runs in the browser. Drop in a `.mid` file and it plays the song with a built-in piano sound while notes fall onto a keyboard in one of four visual styles. It can also record the result as a video for TikTok, Reels or Shorts.

## Run it

Open `index.html` in Chrome, Edge or Safari. There's nothing to install and no build step.

A demo piece ("Late Light", written in code for this project) loads on start. Press play.

## Visual styles

| Key | Style | What happens on each note |
|---|---|---|
| 1 | **Aurora** | Light curtains rise from the pressed keys, embers drift up, and everything is mirrored in black glass. |
| 2 | **Sumi ink** | Notes are brush strokes on rice paper. Each one bleeds ink smoke into the paper. Loud notes are painted in red. |
| 3 | **Constellation** | Each note becomes a star that floats up. Notes in a chord get joined by lines, and so do consecutive melody notes, so the music draws its own constellations. Colours follow the circle of fifths, so notes that sound good together get similar colours. |
| 4 | **Dusk** | Notes are silhouettes against a low sun, and the keyboard sits on a lake that ripples when you play. |

## Controls

- **Space**: play or pause
- **← / →**: jump back or forward 5 seconds
- **1–4**: switch style
- **H**: hide the controls (Esc brings them back)
- **F**: fullscreen
- **Frame shape**: 9:16 (TikTok, 1080×1920), 16:9 (1920×1080), 1:1, or fill the window
- **Keys**: fit the keyboard to the song's range (bigger keys) or always show all 88
- **Speed / Fall**: playback speed, and how many seconds of notes are visible before they land

## Recording a video

Click **Record video**. The song restarts from the beginning and records the canvas plus the piano audio, then downloads the file when the song ends (or when you press Stop). Chrome and Safari save `.mp4`. Firefox saves `.webm`. Keep the tab in front while it records.

## Where to find MIDI files

Search "<song name> piano midi". MuseScore, BitMidi and similar sites have files for most popular songs. Piano arrangements look best. Drum tracks are skipped automatically.

## How it works

- **MIDI parser**: hand-written. It handles tempo changes, running status, the sustain pedal (notes keep ringing while it's held) and SMPTE timing.
- **Piano sound**: Web Audio. Each note is two slightly detuned oscillators with piano-like overtones, a filter that darkens as the note fades, a felt-hammer click and a generated room reverb. Low notes ring longer than high ones, like a real piano.
- **Sync**: picture and sound run off the same audio clock, so they stay in time when you change the speed.
