# Keylight

A piano visualizer for MIDI files that runs in the browser. Drop in a `.mid` file and it plays the song on a recorded grand piano while the song grows a 3D nature scene, note by note. When the song ends, the camera pulls back to show the finished artwork, and no two songs make the same one.

## Run it

Open `index.html` in Chrome, Edge or Safari. There's no build step. The 3D worlds load three.js from a CDN, so you need an internet connection. Offline, it falls back to the Classic 2D styles.

A demo piece ("Late Light", written in code for this project) loads on start. Press play.

## The worlds

Each note flies as a spark from its key to the spot where it grows something.

| Key | World | What the song makes |
|---|---|---|
| 1 | **Growing tree** | A blossom tree grows behind the piano. Each note opens a blossom in the part of the crown above its key. When the song ends, the petals blow away on the wind. |
| 2 | **Night pond** | Notes drop into moonlit water and open lily pads and lotuses in a golden-angle spiral, the same pattern as sunflower seeds. From above, the finished pond is a mandala unique to the song. |
| 3 | **Flower field** | A piano roll made of flowers. Pitch sets the left-to-right position and time sets the distance from the piano. Longer notes grow taller flowers, and low, middle and high notes grow tulips, daisies and small blossoms. |
| 4 | **Changing seasons** | An island turns from spring to winter over the length of the song. The notes plant a wheel of the year around the tree: angle is time, and distance from the tree is pitch. Blossoms in spring, sunflowers in summer, mushrooms in autumn, ice crystals in winter. |
| A | **Auto** | Picks a world for the song. It reads the title (words like *moon*, *rain*, *spring* or *winter*), detects the key and mode (major or minor), and looks at tempo, note density and length. The reason appears under the song name. |

**Classic 2D** keeps the four original styles: Aurora, Sumi ink, Constellation and Dusk. The reflection that made Aurora and Dusk lag has been rewritten.

## Controls

- **Drag** on the 3D scene to orbit and **scroll** to zoom. The camera takes over again 4 seconds after you let go.
- **Space**: play or pause. **← / →**: jump 5 seconds.
- **1–4 / A**: switch world. **H**: hide the controls (Esc brings them back). **F**: fullscreen.
- **Frame shape**: 9:16 (TikTok, 1080×1920), 16:9, 1:1, or fill the window.
- **Keys**: fit the keyboard to the song's range, or always show all 88.
- **Speed / Fall**: playback speed, and how many seconds of falling notes are visible.

## Saving

- **Record video** restarts the song and records it at full frame size, with the piano audio and the ending reveal included. Chrome and Safari save `.mp4`; Firefox saves `.webm`. Keep the tab in front while it records.
- **Save artwork** renders the finished scene as a 2160-pixel-wide PNG poster with the song title.

## Where to find MIDI files

Search "<song name> piano midi". MuseScore, BitMidi and similar sites have files for most songs. Piano arrangements look best. Drum tracks are skipped automatically.

## How it's built

| File | What it does |
|---|---|
| `js/midi.js` | MIDI parser (tempo changes, running status, sustain pedal, SMPTE timing), the demo song, and the song analysis behind Auto. |
| `js/audio.js` | Piano playback from recorded samples, with damper behaviour and velocity-dependent tone. An oscillator synth takes over if the samples can't load. |
| `piano-samples.js` | 29 grand-piano notes, one every three semitones, trimmed and re-encoded to about 2 MB. From [tonejs-instrument-piano-mp3](https://www.npmjs.com/package/tonejs-instrument-piano-mp3) (MIT). |
| `js/world3d.js` | The 3D engine: three.js scene, instanced 3D keyboard, falling notes, bloom, finishing pass, orbit camera, poster export. |
| `js/worlds.js` | The four nature worlds. |
| `js/classic.js` | The Classic 2D styles. |
| `js/app.js` | Playback clock, controls, recording and saving. |

**Why the 3D worlds run smoothly:** when a song loads, every branch, flower, ripple and spark it will ever grow is built once, tagged with the moment it's born. The GPU reveals and animates each piece from the current song time, so the browser does almost no work per frame. Each kind of object (all the blossoms, all the grass) is one draw call, and seeking backwards simply un-grows the scene.
