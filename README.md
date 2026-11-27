# Typewriter Prelude for Obsidian

**Typewriter Prelude** is a desktop Obsidian writing environment adapted from and inspired by [Chaosnap/Typewriter-Nocturne](https://github.com/Chaosnap/Typewriter-Nocturne). Heartfelt thanks to **Chaosnap** for creating the original Typewriter Nocturne and open-sourcing its remarkable paper shader, light rig, and 3D typewriter craftsmanship under the MIT license.

This plugin is a native adaptation for Obsidian and CodeMirror 6. It does not run a nested Electron app and does not load remote scripts, images, fonts, or audio.

## Included Features

- Six WebGL 2 paper surfaces: onionskin, cotton rag, laid, linen, parchment, and night paper. The shader generates fibers, felt, laid lines, linen weave, and aged mottling without image assets.
- Three room palettes: Paper & Ink, Midnight Study, and Moonlit Poetry.
- Live Three.js 3D machine model rather than a 2D drawing: platen and curled paper, frame, guide rods, per-column rack, red/black ribbon, sliding carriage lamp, and base. Its front badge reads `PRELUDE` in a crisp, bright silver-foil treatment using classic serif typography (`Cinzel` / `Bodoni MT` / `Didot` / `Georgia` fallback); no font is bundled or fetched remotely.
- Paper lighting ports the upstream light rig, two-pass paper shader, and GlowLayer. The beam uses distance falloff, Lambert response, and a soft cone; a multiply canvas shades the rendered page per pixel, keeping editor text crisp. A separate, restrained screen glow stays clipped to the paper.
- Paper filters offer a clean look and a Hokkaido blue-hour tint, with an adjustable 0–500 strength slider affecting the paper's ambient light and color only. Directional lighting comes from the source light model rather than a painted triangular shadow.
- The caret's default scroll target sits just above the paper bail, close to the moving type head; the height remains adjustable without scrolling text into the machine mask.
- The lower ruler and machine lettering are centered on the editor.
- Paper relief and edge shading come from the surface shader; low-intensity dust and bulb glow are separate effects.
- The text font inherits Obsidian's active theme. The caret is styled as a narrow, softly bleeding vintage ink stroke.
- Subtle rail-carriage response on key strikes, with reduced-motion support.
- **Procedural Mechanical & Telegraph Audio**:
  - Four mechanical typewriter voices (`Standard`, `Portable`, `Electric`, `Whisper`) pre-rendered via `OfflineAudioContext` with live Web Audio synthesis fallback, stereo panning, and subtle room reverb.
  - **Telegraph (Morse Code) voice**: synthesizes authentic 650 Hz telegraph tones and metallic key contacts in real time from typed characters, with adjustable speed (12–40 WPM), a lightweight sequential playback queue, and an optional **Interrupt on continuous typing** toggle.
  - No recorded sound files or remote audio are used.
- **Full IME Support**: composition keystrokes trigger typewriter and complete Morse code sounds as they are entered (via physical keycode resolution and full-width punctuation mapping); choosing a candidate with Space does not defer or duplicate the typing sound.
- Adjustable light intensity and beam style, procedural paper glow, and dust motes.
- Focus-current-line and reduce-motion settings.

## Install Manually

1. Unzip the package.
2. Move the `typewriter-prelude` folder into `<Vault>/.obsidian/plugins/`.
3. In Obsidian, open **Settings → Community plugins**, then enable **Typewriter Prelude**.
4. Open **Settings → Typewriter Prelude** and enable the writing environment.

The plugin folder must contain `manifest.json`, the bundled `main.js`, and `styles.css` directly. Obsidian loads `main.js` as its fixed entry.
Plugin source lives under `src/`; to rebuild it, run `npm install` and then `npm run build:plugin` in the plugin folder.

## Commands

- Toggle typewriter writing mode
- Toggle cursor-following rail light
- Toggle mechanical typing sounds
- Toggle focus current line
- Move cursor to typewriter position

## Important Compatibility Note

Obsidian does not expose the complete CodeMirror view geometry through its stable public `Editor` API. For caret pixel geometry and viewport positioning, this plugin uses the desktop `MarkdownView.editor.cm` bridge, guarded at runtime. If Obsidian changes this internal bridge, caret-following rail and light positioning may need an update.

The plugin is desktop-only because caret geometry uses the desktop `MarkdownView.editor.cm` bridge. The full machine is rendered locally with WebGL; if WebGL is unavailable, the plugin logs a warning and falls back to the Canvas 2D rail. Paper lighting requires WebGL 2; if unavailable, it logs a warning and leaves the paper at its plain palette color rather than applying a blurred light pool over text.

## Upstream Attribution & License

The paper-light shader, paper surfaces, light rig, GlowLayer, and 3D machine geometry are adapted from **Typewriter Nocturne** by **Chaosnap**, licensed under MIT: https://github.com/Chaosnap/Typewriter-Nocturne

See `UPSTREAM-LICENSE.txt` for the upstream MIT license text. This Obsidian plugin is an independent adaptation and is not affiliated with or endorsed by the upstream author.