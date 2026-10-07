# Keylight

A cozy piano visualizer for MIDI files that runs in the browser. Drop in a `.mid` file and it plays on a recorded grand piano while painted brushstroke notes fall onto a hand-painted keyboard. Above the piano is a tiny storybook scene: frogs hop, cats bob along, birds sing, and the scene fills with flowers, mushrooms or lit windows wherever the notes land. At the end everyone takes a bow and falls asleep.

## Run it

Open `index.html` in Chrome, Edge or Safari. There's nothing to install and no build step, and it works offline (fonts fall back to system fonts).

A demo piece ("Late Light", written in code for this project) loads on start. Press play.

## Scenes

| Key | Scene | Who lives there | What the notes grow |
|---|---|---|---|
| 1 | **Cozy room** | A cat on the rug, birds on the windowsill | A border of flowers along the floor |
| 2 | **Garden cottage** | Frogs on lily pads, birds on the fence, a cat by the door | Garden flowers |
| 3 | **Rooftop town** | Cats on the rooftops, birds on the telephone wire | Lit windows, one per note, near the key that played it |
| 4 | **Forest clearing** | Frogs on a stump and a mushroom, birds on a branch, a cat in the bushes | Mushrooms and ferns |
| A | **Auto** | | Picks the scene from the song title (words like *rain*, *garden*, *moon* or *forest*), or from its mood |

**How the creatures react:** frogs hop on the low notes, birds sing the high notes (with little ♪ floating up), and cats nod to the beat and tilt their heads on the middle notes. They sleep until the music starts, bow when it ends, then curl up with little "z"s while the scene dims.

## Paint styles and colours

- **Paint:** watercolor, gouache, crayon or oil pastel. Each repaints the same scene in that medium, on its own paper texture.
- **Colours:** by default the palette matches the song. Major and lively songs get soft pastel, major and calm get warm honey, minor and slow get cozy night, and minor with motion gets rainy lavender, complete with rain. You can also pick one yourself.

**Classic** keeps the original four styles: Aurora, Sumi ink, Constellation and Dusk.

## Controls

- **Space**: play or pause. **← / →**: jump 5 seconds.
- **1–4 / A**: switch scene. **H**: hide the controls (Esc brings them back). **F**: fullscreen.
- **Frame shape**: 9:16 (TikTok, 1080×1920), 16:9, 1:1, or fill the window.
- **Keys**: fit the keyboard to the song's range, or always show all 88.
- **Speed / Fall**: playback speed, and how many seconds of notes are visible before they land.

## Saving

- **Record video** restarts the song and records it with the piano audio, including the bow and bedtime ending. Chrome and Safari save `.mp4`; Firefox saves `.webm`. Keep the tab in front while it records.
- **Save picture** saves the current frame as a PNG.

## Where to find MIDI files

Search "<song name> piano midi". MuseScore, BitMidi and similar sites have files for most songs. Piano arrangements look best. Drum tracks are skipped automatically.

## How it's built

| File | What it does |
|---|---|
| `js/painter.js` | Paints shapes as watercolor (layered translucent washes with wobbly edges), gouache (flat colour with dry-brush streaks), crayon (hatching with a wobbly outline) or oil pastel (waxy strokes with paper showing through), plus the paper textures. |
| `js/scenes.js` | The four scenes and four palettes. |
| `js/storybook.js` | Draws the scene, creatures, growth, falling notes and keyboard, and runs the creature animations and the ending. |
| `js/midi.js` | MIDI parser (tempo changes, running status, sustain pedal, SMPTE timing), the demo song, and the song analysis behind Auto. |
| `js/audio.js` | Piano playback from recorded samples, with an oscillator synth as the fallback. |
| `piano-samples.js` | 29 grand-piano notes, one every three semitones, about 2 MB. From [tonejs-instrument-piano-mp3](https://www.npmjs.com/package/tonejs-instrument-piano-mp3) (MIT). |
| `js/classic.js` | The Classic styles. |
| `js/app.js` | Playback clock, controls, recording and saving. |

**Why it's light to run:** painting is slow, so it only happens when you change the scene, style, colours or song. The scene, keyboard, creatures, flowers and brushstrokes are painted once into cached images (this takes about half a second). Each frame just places those images, which costs well under a millisecond. Flowers that have finished blooming are stamped onto a layer, so a busy song doesn't get slower as the garden fills up.
