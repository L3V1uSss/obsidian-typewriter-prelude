# Typewriter Prelude for Obsidian

[中文说明](#中文说明) | [English](#english)

---

## 中文说明

这是 Obsidian 桌面端的打字机沉浸式码字插件，设计基于 [Chaosnap/Typewriter-Nocturne](https://github.com/Chaosnap/Typewriter-Nocturne)，高度还原了原作的效果。衷心感谢原作者 Chaosnap 以 MIT 协议开源了出色的纸张着色器、灯光 rig 与打字机美学设计。本插件并非在 Obsidian 内嵌原 Electron 终端，而是保留 Obsidian 的 Markdown / CodeMirror 编辑器，在其周围重建纸张、机械字车、灯光与音效体验，且全程本地运行，不加载远程脚本、图片、字体或音频。

### 视觉与听觉呈现

- 六种程序化纸面质感（葱皮纸、棉纸、条纹纸、亚麻纸、羊皮纸、夜间纸）与三种场景氛围（Paper & Ink、Midnight Study、Moonlit Poetry），实时生成纤维、织纹与做旧斑驳，正文保持清晰锐利
- 随光标移动的聚光（聚焦、台灯、窗格日影）、受限的纸面光晕、低强度浮尘，以及支持 0–500 强度调节的纯净滤镜与北海道蓝调时分
- **阅读与编辑双模式无缝体验**：阅读模式下自动隐藏 3D 打字机模型，完整保留纸面材质、环境阴影与独立灯光风格；采用双舞台缓存与防闪烁过渡，切换视图零延迟、不闪原背景
- **便捷灯光控制**：支持一键开/关台灯与纸面光照并双向同步状态；关灯时彻底熄灭所有光源、光晕与浮尘，同时完整保留当前纸面阴影与滤镜质感
- 底部呈现带卷边纸张的滚筒、导杆、逐字距齿条、红黑色带、字车灯头与 `PRELUDE` 烫银铭牌，随击键产生微动并横向追踪光标
- 细墨线光标紧贴打字线居中滚动，支持当前行聚焦与减少动画
- 合成字杆点击、滚筒敲击、金属共鸣、回车滑动与边铃音效，带房间混响与声像随动；中文输入法组合击键即时发声且空格选词不重复触发；支持标准机械、柔和机械、电报机等五种音色。

### 最近更新

- **阅读模式适配与无缝切换**：阅读模式自动收起 3D 机台并支持独立灯光风格；引入编辑/阅读双舞台缓存与 CSS 垫底过渡，消除模式切换时的背景闪烁与模型重建延迟。
- **灯光开关与关灯滤镜优化**：新增全局灯光开关按钮与设置页双向状态同步；关灯后彻底关闭所有聚光束、光晕与浮尘，同时保持与开灯一致的阴影与滤镜效果。
- **文案与默认配置精简**：精简设置界面文案与灯光风格命名（聚焦 / 台灯 / 窗格日影），优化音色列表排序（新增「柔和机械」并提前「电报机」），默认启用更清爽的葱皮纸与柔和机械音色组合。

### 部分截图
  <img width="955" height="1057" alt="屏幕截图 2026-11-27 185320" src="https://github.com/user-attachments/assets/2187b903-7f81-49df-af4d-c8376007158b" />
  <img width="947" height="1062" alt="屏幕截图 2026-11-27 185443" src="https://github.com/user-attachments/assets/7a099aef-2a93-40aa-8fd1-496d3a92e265" />
  <img width="945" height="1072" alt="屏幕截图 2026-11-27 185525" src="https://github.com/user-attachments/assets/5b195da3-e0e5-4947-a7ff-19640de98561" />


### 安装与使用

#### 1. 插件市场
前往插件市场搜索“typewriter-prelude”下载安装。

#### 2. 手动安装
<img width="675" height="581" alt="image" src="https://github.com/user-attachments/assets/205b0070-2de4-40ab-a997-ce35821fd42d" />

下载源代码 zip，解压后放入 `<你的库>/.obsidian/plugins/`，在 Obsidian 第三方插件中启用后，进入设置开启打字机环境即可。支持通过命令、快捷键或编辑器右上角台灯按钮切换打字机写作模式、滑轨动态灯光、机械打字音效、当前行聚焦，以及将光标移回打字机位置。

### 致谢与授权

本插件的纸张着色器、纸面材质、灯光 rig 与 `GlowLayer` 基于 MIT 协议开源的 [Typewriter Nocturne](https://github.com/Chaosnap/Typewriter-Nocturne) 移植并适配 Obsidian，上游 MIT 许可文本见 `UPSTREAM-LICENSE.txt`。本插件为独立适配版本，与上游作者无隶属或背书关系。

---

## English

A desktop Obsidian writing environment adapted from and inspired by [Chaosnap/Typewriter-Nocturne](https://github.com/Chaosnap/Typewriter-Nocturne). Heartfelt thanks to Chaosnap for creating the original Typewriter Nocturne and open-sourcing its paper shader, light rig, and 3D typewriter craftsmanship under the MIT license.

This version is a native adaptation for Obsidian and CodeMirror 6. It does not run a nested Electron app and does not load remote scripts, images, fonts, or audio.

### Visual & Audio Effects

- Six procedural paper surfaces (onionskin, cotton rag, laid, linen, parchment, and night paper) and three room palettes (Paper & Ink, Midnight Study, and Moonlit Poetry) with shader-generated fibers, weave, and aging mottling while keeping editor text sharp
- Caret-following illumination (Focus, Desk Lamp, and Window Sunlight), clipped paper glow, subtle dust motes, and clean or Hokkaido blue-hour paper filters with adjustable 0–500 strength
- **Seamless Reading & Editing Modes**: Automatically hides the 3D typewriter model in Reading mode while preserving paper textures, ambient shadows, and an independent lighting style; powered by dual-stage caching and anti-flash transitions for instant, flicker-free switching
- **Quick Lamp Control**: One-click lamp toggle with two-way state sync; turning off the lamp extinguishes all light beams, glow, and dust motes while retaining the active paper shadow and filter tone
- A mechanical carriage assembly featuring platen and curled paper, guide rods, rack, ribbon, carriage lamp, and a silver-foil `PRELUDE` badge that reacts to keystrokes and tracks the caret horizontally
- A narrow ink-style caret centered near the typing line, with optional current-line focus and reduced motion
- Synthesized key clicks, platen thumps, metallic ring, carriage return, and margin bell with room response and stereo panning; immediate IME keystroke audio without duplicate Space triggers; five sound profiles including Standard Mechanical, Soft Mechanical, and Vintage Telegraph

### Recent Updates

- **Reading Mode Adaptation & Seamless Switching**: Automatically hides the 3D carriage in Reading mode with an independent lighting preset; added dual-stage caching and CSS transition cushions to eliminate background flashes and model re-initialization lag when switching views.
- **Global Lamp Toggle & Lights-Off Shadow Sync**: Added a header lamp toggle with bidirectional settings UI sync; turning off the lamp cleanly disables all light sources, glow, and dust while preserving consistent paper shadows and filter shading.
- **Streamlined UI & Defaults**: Refined lighting style labels (Focus / Desk Lamp / Window Sunlight), reordered sound profiles (renaming to *Soft Mechanical* at #2 and moving *Telegraph* to #3), and updated default presets to Onionskin paper with Soft Mechanical audio.

### ScreenShots
  <img width="952" height="1065" alt="屏幕截图 2026-11-27 192524" src="https://github.com/user-attachments/assets/6c1eb455-a670-4af8-a36c-69cb9ff46b6c" />
  <img width="942" height="1072" alt="屏幕截图 2026-11-27 192548" src="https://github.com/user-attachments/assets/9e8b3194-d878-424f-bcef-529d84dc2e01" />
  <img width="948" height="1066" alt="屏幕截图 2026-11-27 192559" src="https://github.com/user-attachments/assets/f88d873c-28aa-4441-9fde-216c3f4dc0a3" />


### Installation & Usage
<img width="675" height="581" alt="image" src="https://github.com/user-attachments/assets/205b0070-2de4-40ab-a997-ce35821fd42d" />

Download the source code ZIP, extract it into `<Your Vault>/.obsidian/plugins/`, enable it under Obsidian's Community plugins, and then turn on the typewriter environment in its settings. You can use commands, hotkeys, or the top-right lamp button to toggle typewriter writing mode, rail dynamic lighting, mechanical typing sounds, and focus current line, as well as move the cursor back to the typewriter position.

### Attribution & License

Paper lighting, paper surfaces, the light rig, and `GlowLayer` are adapted from [Typewriter Nocturne](https://github.com/Chaosnap/Typewriter-Nocturne) by Chaosnap under the MIT License (`UPSTREAM-LICENSE.txt`). This project is an independent adaptation and is not affiliated with or endorsed by the upstream author.
