# Typewriter Nocturne for Obsidian

这是面向 Obsidian 桌面端的打字机写作环境，设计方向参考 [Chaosnap/Typewriter-Nocturne](https://github.com/Chaosnap/Typewriter-Nocturne)。它不是把原 Electron 终端嵌进 Obsidian，而是保留 Obsidian 的 Markdown / CodeMirror 编辑器，在其周围重建纸张、机械字车、灯光和声音效果。

## 0.5.0 已实现

- **六种程序化纸张**：葱皮纸、棉纸、条纹纸、亚麻纸、羊皮纸、夜间纸。纸张底色与纤维、绒面、帘纹、亚麻织纹和旧化斑驳由 WebGL 2 着色器生成，不依赖图片文件。
- **三种环境主题**：Paper & Ink、Midnight Study、Moonlit Poetry。环境主题决定动态光束的色调与范围。
- **完整 3D 机械机构**：不再用 2D 线条代替模型；移植上游 Three.js 打字机模型及程序纹理，重现滚筒与纸张卷边、机架、导杆、逐字距齿条、红黑色带、可移动字车灯头和底座。正面铭牌采用 `PRELUDE` 银箔烫印与本机 Old English 哥特字体；不内嵌或远程下载字体。字车只随光标横向移动。
- **上游物理纸面灯效**：移植上游的灯光 rig、双 pass 纸面着色器和 GlowLayer。聚光按距离衰减、Lambert 法线与软边锥角计算；纸面层以 multiply 逐像素着色，直接覆盖编辑器渲染结果而不模糊或重绘文字。screen 光晕独立限制在纸面范围内。
- **光标与打字线对齐**：默认将当前光标滚动到纸面打字线附近，并限制在纸面文字区内；底部刻度尺和机身字样居中于编辑区。
- **纸面滤镜调节**：提供纯净滤镜与北海道蓝调时分两种色调，并可用 0–500 强度滑条实时调整。滤镜映射到纸面环境光与色温，不绘制固定三角阴影，也不改变打字机模型亮度。
- **复古墨水光标**：细窄的墨线带有轻微晕染和墨滴细节；正文字体跟随 Obsidian 当前主题。
- **机械反馈**：按键时滑块会有轻微高光脉冲，并支持减少动画。
- **合成打字音效**：先用 OfflineAudioContext 预合成多组声音变体，再以低延迟 Web Audio 播放；音色叠加字杆点击、滚筒低频敲击、金属共鸣、回车棘轮与滑动声，并加入轻微房间混响和随字车变化的声像。离线合成不可用时回退到实时合成；不加载远程音频或录音素材。
- **中文输入音效**：监听输入法组合期间的按键并即时播放打字声，不必等空格选词；空格选词不会误触发字杆声。
- **纸面氛围**：以着色器生成纸纤维表面起伏与受限的边缘明暗，另有低强度浮尘和灯泡晕光；移除左侧流苏挂饰。
- **写作模式**：光标高度可调，并提供当前行聚焦、音量、音色和减少动画设置。
- **离线运行**：不加载 CDN、远程脚本、在线图片、字体或声音文件。

## 安装

1. 解压 ZIP。
2. 将 `typewriter-nocturne` 文件夹放进你的库目录：`.obsidian/plugins/`。
3. 打开 Obsidian「设置 → 第三方插件」，启用 Typewriter Nocturne。
4. 进入「设置 → Typewriter Nocturne」，开启打字机环境。

插件目录中应直接包含 `manifest.json`、构建后的 `main.js` 和 `styles.css`。Obsidian 固定从 `main.js` 加载插件。

插件源码在 `src/`；若需重新生成，在插件目录运行 `npm install` 后执行 `npm run build:plugin`。

## 命令

- 切换打字机写作模式
- 切换滑轨动态灯光
- 切换机械打字音效
- 切换当前行聚焦
- 将光标移回打字机位置

可以在 Obsidian「设置 → 快捷键」里为这些命令分配快捷键。

## 重要说明

- **仅支持 Obsidian 桌面端**。完整机械模型使用本地 WebGL；若设备禁用或不支持 WebGL，会明确记录警告并回退到 Canvas 2D 滑轨。纸面光照需要 WebGL 2；若不可用，会记录警告并保留纸张纯色背景，不会退回到模糊文字的整页光池。
- 光标坐标使用 Obsidian 桌面端的 `MarkdownView.editor.cm` 内部接口；若 Obsidian 改动此接口，滑轨和灯光的跟随位置可能需要适配。
- 机械模型是实时渲染的 Three.js 几何体，不是静态截图；它会适配编辑区尺寸，不能保证与单张参考图逐像素完全一致。当前环境没有可用的 Obsidian 客户端，因此仍需在真实库内检查 WebGL 渲染、文字遮挡和性能。

## 上游致谢与许可

纸面光照、纸张着色器、灯光 rig 与 GlowLayer 以 MIT 许可的 [Typewriter Nocturne](https://github.com/Chaosnap/Typewriter-Nocturne) 源码为基础移植并适配 Obsidian；其他插件功能按 Obsidian/CodeMirror 环境实现。上游 MIT 许可文本见 `UPSTREAM-LICENSE.txt`。本插件与上游作者没有隶属或背书关系。
