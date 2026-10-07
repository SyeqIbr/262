# Keylight

A cinematic piano visualizer for MIDI files that runs in the browser. Drop in a `.mid` file and it plays on a recorded grand piano while threads of light fall onto the keys. Above them is a painted, living landscape in the spirit of hand-painted anime films: clouds sail past, wind moves through the grass, and the camera slowly drifts. When the song ends, the camera tilts up into the sky and "fin" appears.

## Run it

Open `index.html` in Chrome, Edge or Safari. There's nothing to install and no build step, and it works offline (fonts fall back to system fonts).

A demo piece ("Late Light", written in code for this project) loads on start. Press play.

## Scenes

| Key | Scene | What's there |
|---|---|---|
| 1 | **Hilltop** | A lone tree on a summer hill with a girl and her cat sitting under it, her hair and scarf moving in the wind |
| 2 | **Seaside town** | A hillside town above a sparkling sea, with cypress trees and a lighthouse |
| 3 | **Forest of light** | Giant trunks fading into the haze, sunbeams through the canopy, a stone lantern |
| A | **Auto** | Picks the scene from the song title (words like *sea*, *forest*, *moon* or *wind*), or from its mood |

**Time of day** follows the song's mood: bright and busy songs get a summer day, calm major songs get golden hour, minor songs with motion get dusk, and slow minor songs get a starry night with fireflies and lit windows. You can also pick one yourself.

**How the music moves the scene:**
- The loudness sets the wind, so the grass surges, the tree sways and the clouds speed up.
- Bass notes send gusts rolling across the field.
- High notes send a flock of birds across the sky.
- Every note releases a petal or a glowing light from its key that rides the wind up into the scene.

**Classic** keeps the original four styles: Aurora, Sumi ink, Constellation and Dusk.

## Controls

- **Space**: play or pause. **← / →**: jump 5 seconds.
- **1–3 / A**: switch scene. **H**: hide the controls (Esc brings them back). **F**: fullscreen.
- **Frame shape**: 9:16 (TikTok, 1080×1920), 16:9, 1:1, or fill the window.
- **Keys**: fit the keyboard to the song's range, or always show all 88.
- **Speed / Fall**: playback speed, and how many seconds of notes are visible before they land.

## Saving

- **Record video** restarts the song and records it with the piano audio, including the closing shot. Chrome and Safari save `.mp4`; Firefox saves `.webm`. Keep the tab in front while it records.
- **Save picture** saves the current frame as a PNG.

## Where to find MIDI files

Search "<song name> piano midi". MuseScore, BitMidi and similar sites have files for most songs. Piano arrangements look best. Drum tracks are skipped automatically.

## How it's built

| File | What it does |
|---|---|
| `js/ghibli.js` | The painted scenes: sky, cumulus clouds, mountains, hills, town, forest, trees, sunbeams, wind-blown grass, birds, petals, the keyboard, and the camera with its closing shot. |
| `js/painter.js` | Shape and colour helpers, and the canvas grain texture. |
| `js/midi.js` | MIDI parser (tempo changes, running status, sustain pedal, SMPTE timing), the demo song, and the song analysis behind Auto. |
| `js/audio.js` | Piano playback from recorded samples, with an oscillator synth as the fallback. |
| `piano-samples.js` | 29 grand-piano notes, one every three semitones, about 2 MB. From [tonejs-instrument-piano-mp3](https://www.npmjs.com/package/tonejs-instrument-piano-mp3) (MIT). |
| `js/classic.js` | The Classic styles. |
| `js/app.js` | Playback clock, controls, recording and saving. |

**Why it's light to run:** the scenery is painted once into layered images when you pick a scene, time of day or song, which takes about a tenth of a second. Each frame only slides those layers for depth and draws the moving parts: grass blades, petals, birds and light. The preview renders at your screen's size, and recording switches to the full 1080×1920 frame.
