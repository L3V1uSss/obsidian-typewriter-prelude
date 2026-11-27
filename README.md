# Typewriter Prelude for Obsidian

[中文说明](#中文说明) | [English](#english)

---

## 中文说明

这是Obsidian 桌面端的打字机沉浸式码字插件，设计基于 [Chaosnap/Typewriter-Nocturne](https://github.com/Chaosnap/Typewriter-Nocturne)，高度还原了原作的效果。衷心感谢原作者 Chaosnap 以 MIT 协议开源了出色的纸张着色器、灯光 rig 与打字机美学设计。本插件并非在 Obsidian 内嵌原 Electron 终端，而是保留 Obsidian 的 Markdown / CodeMirror 编辑器，在其周围重建纸张、机械字车、灯光与音效体验，且全程本地运行，不加载远程脚本、图片、字体或音频。

### 视觉与听觉呈现

- 六种程序化纸面质感（葱皮纸、棉纸、条纹纸、亚麻纸、羊皮纸、夜间纸）与三种场景氛围（Paper & Ink、Midnight Study、Moonlit Poetry），实时生成纤维、织纹与做旧斑驳，正文保持清晰锐利
- 随光标移动的聚光、受限的纸面光晕、低强度浮尘，以及支持 0–500 强度调节的纯净滤镜与北海道蓝调时分
- 底部呈现带卷边纸张的滚筒、导杆、逐字距齿条、红黑色带、字车灯头与 `PRELUDE` 烫银铭牌，随击键产生微动并横向追踪光标
- 细墨线光标紧贴打字线居中滚动，支持当前行聚焦与减少动画
- 合成字杆点击、滚筒敲击、金属共鸣、回车滑动与边铃音效，带房间混响与声像随动；中文输入法组合击键即时发声且空格选词不重复触发；新增复古电报机音色。

### 安装与使用

将 `typewriter-prelude` 放入 `<你的库>/.obsidian/plugins/`，在 Obsidian 第三方插件中启用后，进入设置开启打字机环境即可。支持通过命令或快捷键切换打字机写作模式、滑轨动态灯光、机械打字音效、当前行聚焦，以及将光标移回打字机位置。

### 致谢与授权

本插件的纸张着色器、纸面材质、灯光 rig 与 `GlowLayer` 基于 MIT 协议开源的 [Typewriter Nocturne](https://github.com/Chaosnap/Typewriter-Nocturne) 移植并适配 Obsidian，上游 MIT 许可文本见 `UPSTREAM-LICENSE.txt`。本插件为独立适配版本，与上游作者无隶属或背书关系。

---

## English

A desktop Obsidian writing environment adapted from and inspired by [Chaosnap/Typewriter-Nocturne](https://github.com/Chaosnap/Typewriter-Nocturne). Heartfelt thanks to Chaosnap for creating the original Typewriter Nocturne and open-sourcing its paper shader, light rig, and 3D typewriter craftsmanship under the MIT license.

This version is a native adaptation for Obsidian and CodeMirror 6. It does not run a nested Electron app and does not load remote scripts, images, fonts, or audio.

### Visual & Audio Effects

- Six procedural paper surfaces (onionskin, cotton rag, laid, linen, parchment, and night paper) and three room palettes (Paper & Ink, Midnight Study, and Moonlit Poetry) with shader-generated fibers, weave, and aging mottling while keeping editor text sharp
- Caret-following illumination, clipped paper glow, subtle dust motes, and clean or Hokkaido blue-hour paper filters with adjustable 0–500 strength
- A mechanical carriage assembly featuring platen and curled paper, guide rods, rack, ribbon, carriage lamp, and a silver-foil `PRELUDE` badge that reacts to keystrokes and tracks the caret horizontally
- A narrow ink-style caret centered near the typing line, with optional current-line focus and reduced motion
- Synthesized key clicks, platen thumps, metallic ring, carriage return, and margin bell with room response and stereo panning; immediate IME keystroke audio without duplicate Space triggers; plus a vintage telegraph sound effect[cite: 9]

### Installation & Usage

Place `typewriter-prelude` into `<Vault>/.obsidian/plugins/`, enable it in Community plugins, and turn on the writing environment in its settings. Commands and hotkeys can toggle typewriter mode, rail lighting, typing sounds, focus current line, and recenter the cursor[cite: 9].

### Attribution & License

Paper lighting, paper surfaces, the light rig, and `GlowLayer` are adapted from [Typewriter Nocturne](https://github.com/Chaosnap/Typewriter-Nocturne) by Chaosnap under the MIT License (`UPSTREAM-LICENSE.txt`). This project is an independent adaptation and is not affiliated with or endorsed by the upstream author[cite: 9].