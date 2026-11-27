# Typewriter Prelude for Obsidian

**Typewriter Prelude** 是面向 Obsidian 桌面端的打字机写作环境，改编并致敬开源项目 [Chaosnap/Typewriter-Nocturne](https://github.com/Chaosnap/Typewriter-Nocturne)。衷心感谢原作者 **Chaosnap** 创作了如此精美的纸面着色器、物理灯效与 3D 打字机模型，并以 MIT 协议开源分享。

本插件并非把原 Electron 终端嵌进 Obsidian，而是保留 Obsidian 原生的 Markdown / CodeMirror 6 编辑器，在其周围本地重建纸张材质、3D 机械字车、动态灯光与合成音效，全程不加载任何远程资源。

## 核心特性

- **六种程序化纸张**：葱皮纸、棉纸、条纹纸、亚麻纸、羊皮纸、夜间纸。纸张底色与纤维、绒面、帘纹、亚麻织纹及旧化斑驳均由 WebGL 2 着色器实时生成，不依赖图片文件。
- **三种环境主题**：Paper & Ink、Midnight Study、Moonlit Poetry，决定动态光束的色调与范围。
- **完整 3D 机械机构**：移植上游 Three.js 打字机模型与程序纹理，重现滚筒与纸张卷边、机架、导杆、逐字距齿条、红黑色带、随光标横向移动的字车灯头和底座。正面铭牌采用 `PRELUDE` 高亮冷白烫银与清晰衬线体（优先调用本机 `Cinzel` / `Bodoni MT` / `Didot` / `Georgia` 等衬线字体），不内嵌或远程下载字体。
- **物理纸面灯效**：移植上游灯光 rig、双 pass 纸面着色器和 GlowLayer。聚光按距离衰减、Lambert 法线与软边锥角计算；纸面层以 multiply 逐像素着色，不模糊或重绘编辑区文字；screen 光晕独立限制在纸面范围内。
- **光标与打字线对齐**：默认将当前光标滚动到纸面打字线附近，并限制在纸面文字区内；底部刻度尺与机身铭牌居中于编辑区。
- **纸面滤镜调节**：提供纯净滤镜与北海道蓝调时分两种色调，并可通过 0–500 强度滑条实时调整纸面环境光与色温，不压暗打字机模型。
- **复古墨水光标与机械反馈**：细窄墨线带有轻微晕染细节，正文字体跟随 Obsidian 当前主题；按键时滑块产生轻微高光脉冲，支持减少动画。
- **合成打字与电报音效**：
  - 内置四种机械打字机音色（标准机械、便携式、电动、轻柔敲击），通过 `OfflineAudioContext` 预渲染多组变体并辅以低延迟 Web Audio 播放（支持房间混响与随字车变化的立体声像），离线合成不可用时自动回退实时合成。
  - **新增电报机音色（莫尔斯电码）**：将输入的字母、数字与标点实时合成为老式电报信号音与金属接点声，支持 **12–40 WPM 码速调节**、低性能消耗的**轻量级顺序排队播放**，并提供**「连续输入打断电报音」**开关自由切换播报手感。
  - 全程纯本地合成，不加载任何音频文件或远程资源。
- **完整中文输入法（IME）音效**：输入法组合期间通过物理键码与全角标点映射即时触发打字声与完整莫尔斯电码，选词不延迟、不截断、不重复。
- **写作辅助设置**：可调光标固定高度、灯光风格与亮度、浮尘粒子、当前行聚焦、音量、音色及减少动画。

## 手动安装

1. 解压 ZIP 压缩包。
2. 将 `typewriter-prelude` 文件夹放进你的 Obsidian 库目录：`<库目录>/.obsidian/plugins/`。
3. 打开 Obsidian「设置 → 第三方插件」，启用 **Typewriter Prelude**。
4. 进入「设置 → Typewriter Prelude」，开启打字机写作环境。

插件目录中应直接包含 `manifest.json`、构建后的 `main.js` 和 `styles.css`。Obsidian 固定从 `main.js` 加载插件。

插件源码位于 `src/`；如需自行重新打包，请在插件目录运行 `npm install` 后执行 `npm run build:plugin`。

## 交互命令

- 切换打字机写作模式
- 切换滑轨动态灯光
- 切换机械打字音效
- 切换当前行聚焦
- 将光标移回打字机位置

可以在 Obsidian「设置 → 快捷键」中为上述命令分配快捷键。

## 重要说明

- **仅支持 Obsidian 桌面端**。完整 3D 机械模型依赖本地 WebGL；若设备不支持或禁用了 WebGL，插件会记录警告并回退至 Canvas 2D 滑轨。纸面光照需要 WebGL 2；若不可用，将保留纯色纸张背景而不会覆盖模糊光斑。
- 光标像素坐标依赖 Obsidian 桌面端的 `MarkdownView.editor.cm` 内部接口；若后续 Obsidian 调整该接口，滑轨与灯光跟随可能需要同步适配。

## 上游致谢与许可

纸面光照、纸张着色器、灯光 rig、GlowLayer 与 3D 机身几何体均基于 **Chaosnap** 以 MIT 协议开源的 [Typewriter Nocturne](https://github.com/Chaosnap/Typewriter-Nocturne) 移植与适配。上游 MIT 许可文本见 `UPSTREAM-LICENSE.txt`。本插件为独立改编版本，与上游作者无隶属或背书关系。