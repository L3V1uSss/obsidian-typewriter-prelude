const { Plugin, PluginSettingTab, Setting, MarkdownView, Notice } = require('obsidian');
const { createMachine } = require('../machine-bundle.js');
const { ambientFloor, buildRig, toUnit } = require('./light-model.js');
const { GlowLayer } = require('./glow-layer.js');
const { PaperLight } = require('./paper-light.js');

const DEFAULT_SETTINGS = {
  enabled: true,
  cursorPosition: 72,
  paper: 'onionskin',
  filterStyle: 'clean',
  filterStrength: 299,
  room: 'paper-and-ink',
  sound: true,
  volume: 30,
  voice: 'whisper',
  telegraphWpm: 26,
  telegraphInterrupt: false,
  lighting: false,
  lightSource: 'carriage',
  readingLightSource: 'desk-lamp',
  lightIntensity: 80,
  dust: true,
  focusLine: false,
  reducedMotion: false
};

const MORSE = {
  A: ".-",     B: "-...",   C: "-.-.",   D: "-..",
  E: ".",      F: "..-.",   G: "--.",    H: "....",
  I: "..",     J: ".---",   K: "-.-",    L: ".-..",
  M: "--",     N: "-.",     O: "---",    P: ".--.",
  Q: "--.-",   R: ".-.",    S: "...",    T: "-",
  U: "..-",    V: "...-",   W: ".--",    X: "-..-",
  Y: "-.--",   Z: "--..",

  0: "-----", 1: ".----",  2: "..---",   3: "...--",
  4: "....-", 5: ".....",  6: "-....",   7: "--...",
  8: "---..", 9: "----.",

  ".": ".-.-.-", ",": "--..--", "?": "..--..",
  "'": ".----.", "!": "-.-.--", "/": "-..-.",
  "(": "-.--.",  ")": "-.--.-", "&": ".-...",
  ":": "---...", ";": "-.-.-.", "=": "-...-",
  "+": ".-.-.",  "-": "-....-", "_": "..--.-",
  '"': ".-..-.", "$": "...-..-", "@": ".--.-."
};

const FULLWIDTH_TO_ASCII = {
  '。': '.', '，': ',', '？': '?', '！': '!', '：': ':', '；': ';',
  '（': '(', '）': ')', '“': '"', '”': '"', '‘': "'", '’': "'",
  '—': '-', '－': '-', '＿': '_', '＋': '+', '＝': '=', '／': '/',
  '、': '/', '＆': '&', '＠': '@', '￥': '$', '＄': '$'
};

const SHIFTED_DIGIT_TO_SYMBOL = {
  '1': '!', '2': '@', '4': '$', '7': '&', '9': '(', '0': ')'
};

function resolveTelegraphChar(event) {
  if (event.key && event.key.length === 1) {
    return FULLWIDTH_TO_ASCII[event.key] || event.key;
  }
  const code = event.code || '';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) {
    const digit = code.slice(5);
    return (event.shiftKey && SHIFTED_DIGIT_TO_SYMBOL[digit]) || digit;
  }
  if (/^Numpad[0-9]$/.test(code)) return code.slice(6);
  const punctuation = {
    Minus: event.shiftKey ? '_' : '-',
    Equal: event.shiftKey ? '+' : '=',
    Semicolon: event.shiftKey ? ':' : ';',
    Quote: event.shiftKey ? '"' : "'",
    Comma: ',',
    Period: '.',
    Slash: event.shiftKey ? '?' : '/',
    NumpadAdd: '+',
    NumpadSubtract: '-',
    NumpadDivide: '/',
    NumpadDecimal: '.'
  };
  return punctuation[code] || '';
}

const PAPERS = {
  onionskin: { name: '葱皮纸', color: '#f2f1ea', ink: '#29231d', accent: '#9b7540', dark: false, surface: { crinkle: .08, felt: 0, laid: 0, linen: 0, mottle: .04, age: 0 } },
  cotton: { name: '棉纸', color: '#eee6d5', ink: '#2a2019', accent: '#a77b3e', dark: false, surface: { crinkle: .3, felt: 1, laid: 0, linen: 0, mottle: .08, age: 0 } },
  laid: { name: '条纹纸', color: '#f1e9d6', ink: '#2b231c', accent: '#96703b', dark: false, surface: { crinkle: .22, felt: 0, laid: 1, linen: 0, mottle: .18, age: 0 } },
  linen: { name: '亚麻纸', color: '#ebe5d8', ink: '#2a211b', accent: '#927044', dark: false, surface: { crinkle: .2, felt: 0, laid: 0, linen: 1, mottle: .08, age: 0 } },
  parchment: { name: '羊皮纸', color: '#efdfbd', ink: '#30251a', accent: '#946a35', dark: false, surface: { crinkle: .25, felt: 0, laid: 0, linen: 0, mottle: 1, age: .75 } },
  night: { name: '夜间纸', color: '#1d1a20', ink: '#e6e1ea', accent: '#c5b9e8', dark: true, surface: { crinkle: .3, felt: 0, laid: 0, linen: 0, mottle: .1, age: 0 } }
};

const ROOMS = {
  'paper-and-ink': { name: 'Paper & Ink', room: '#241a14', trim: '#c9a35c', lamp: '#ffd29a', source: 'carriage', position: { x: .5, y: 1 }, shade: .42, metal: '#b8904c' },
  'midnight-study': { name: 'Midnight Study', room: '#140f0b', trim: '#c9a45c', lamp: '#ffb35c', source: 'desk-lamp', position: { x: .84, y: .04 }, shade: .5, metal: '#c9a45c' },
  'moonlit-poetry': { name: 'Moonlit Poetry', room: '#0e0e1a', trim: '#b7bdd6', lamp: '#c9d4ff', source: 'moonlight', position: { x: .14, y: -.1 }, shade: .48, metal: '#aeb4c8' }
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function setPaperFilterStyle(element, style) {
  element.dataset.filterStyle = style === 'hokkaido-blue-hour' ? 'hokkaido-blue-hour' : 'clean';
}

function machineLayout(width, height, readingMode = false) {
  const machineHeight = readingMode ? 0 : clamp(height * .3, 160, 300);
  const margins = width < 720 ? 40 : 2 * clamp(width * .04, 18, 64);
  const narrowest = Math.round(Math.max(160, Math.min(width - margins, 1240)));
  const margin = Math.round((width - narrowest) / 2);
  const reach = Math.min(margin * .45, 90);
  const platen = { left: margin - reach, right: margin + narrowest + reach };
  const sheetWidth = narrowest + 2 * reach;
  const sheetX = platen.left;
  const machineTop = height - machineHeight;
  const platenRadius = machineHeight * .12;
  const platenY = readingMode ? height : machineTop + machineHeight * .24;
  const bailY = readingMode ? height : machineTop + machineHeight * .08;
  return {
    width,
    height,
    machine: !readingMode,
    machineHeight,
    machineTop,
    sheet: { x: sheetX, y: -12, width: sheetWidth, height: Math.ceil(platenY + 12) },
    margin,
    platen,
    platenY,
    platenRadius,
    bailY,
    headRailY: platenY + platenRadius * 1.35,
    lampY: bailY + 12,
    text: { x: sheetX, y: 0, width: sheetWidth, height: readingMode ? height : Math.max(80, Math.round(bailY - 16)) }
  };
}
const random = (seed) => { let x = seed >>> 0; return () => { x += 0x6D2B79F5; let t = x; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const SOUND_DURATIONS = {key:.18,space:.22,backspace:.16,return:.62,bell:1.6,tab:.3,history:.18,nudge:.08,select:.12,commit:.26,switch:.24};
const SOUND_LOUDNESS = {key:1,space:1,backspace:.9,return:.8,bell:.8,tab:.8,history:.75,nudge:.6,select:.6,commit:1,switch:.9};
const SOUND_VOICES = {
  standard:{body:140,bodyGain:.9,click:2600,clickGain:.75,ring:3300,ringGain:.16,level:1},
  portable:{body:190,bodyGain:.5,click:3600,clickGain:.9,ring:4300,ringGain:.22,level:.9},
  electric:{body:105,bodyGain:.75,click:1700,clickGain:.4,ring:2500,ringGain:.06,level:.85},
  whisper:{body:160,bodyGain:.3,click:3000,clickGain:.3,ring:3700,ringGain:.04,level:.6},
  telegraph:{body:140,bodyGain:.7,click:2350,clickGain:.5,ring:2800,ringGain:.05,level:.95}
};

function renderOfflineSound(kind, voice, seed) {
  const AudioContextConstructor=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  if(!AudioContextConstructor) return Promise.reject(new Error('OfflineAudioContext is unavailable.'));
  const sampleRate=44100;
  const context=new AudioContextConstructor(1,Math.ceil(SOUND_DURATIONS[kind]*sampleRate),sampleRate);
  const rand=random(seed);
  const output=context.createGain();
  output.gain.value=voice.level;
  output.connect(context.destination);
  const noise=(seconds)=>{
    const buffer=context.createBuffer(1,Math.max(1,Math.ceil(seconds*sampleRate)),sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=rand()*2-1;
    return buffer;
  };
  const envelope=(gain,at,peak,decay,attack=.0006)=>{
    gain.gain.setValueAtTime(0,at);
    gain.gain.linearRampToValueAtTime(peak,at+attack);
    gain.gain.exponentialRampToValueAtTime(.0001,at+attack+decay);
  };
  const burst=(frequency,decay,peak,type='bandpass',at=0,q=.7)=>{
    const source=context.createBufferSource();source.buffer=noise(decay+.02);
    const filter=context.createBiquadFilter();filter.type=type;filter.frequency.value=frequency;filter.Q.value=q;
    const gain=context.createGain();envelope(gain,at,peak,decay);
    source.connect(filter).connect(gain).connect(output);source.start(at);
  };
  const thump=(frequency,peak,decay,at=0)=>{
    const oscillator=context.createOscillator();oscillator.type='sine';
    oscillator.frequency.setValueAtTime(frequency*1.6,at);oscillator.frequency.exponentialRampToValueAtTime(frequency,at+.02);
    const gain=context.createGain();envelope(gain,at,peak,decay);
    oscillator.connect(gain).connect(output);oscillator.start(at);oscillator.stop(at+decay+.05);
  };
  const strike=(weight,voiceOverride=voice,at=0)=>{
    const hitVoice=voiceOverride,jitter=()=>.92+rand()*.16;
    burst(hitVoice.click*jitter(),.012,hitVoice.clickGain,'highpass',at);
    thump(hitVoice.body*jitter()*(2-weight),hitVoice.bodyGain*weight,.05,at);
    burst(hitVoice.ring*jitter(),.1,hitVoice.ringGain,'bandpass',at+.002,16);
    burst(hitVoice.click*.7*jitter(),.01,hitVoice.clickGain*.28,'bandpass',at+.024+rand()*.008,2);
  };
  if(kind==='key') strike(1);
  else if(kind==='space') strike(1.25,{...voice,clickGain:voice.clickGain*.5,ringGain:0});
  else if(kind==='backspace') strike(.7,{...voice,bodyGain:voice.bodyGain*.5});
  else if(kind==='commit'){
    strike(1.3,voice,0);
    strike(.8,{...voice,bodyGain:voice.bodyGain*.4,ringGain:voice.ringGain*.5},.075);
  }else if(kind==='return'){
    for(let i=0;i<5;i++)burst(2200+rand()*400,.008,.45-i*.06,'bandpass',i*.026,3);
    const slide=context.createBufferSource();slide.buffer=noise(.4);
    const filter=context.createBiquadFilter();filter.type='bandpass';filter.Q.value=1.4;
    filter.frequency.setValueAtTime(1900,.12);filter.frequency.exponentialRampToValueAtTime(520,.44);
    const gain=context.createGain();gain.gain.setValueAtTime(0,.12);gain.gain.linearRampToValueAtTime(.32,.18);gain.gain.exponentialRampToValueAtTime(.0001,.46);
    slide.connect(filter).connect(gain).connect(output);slide.start(.12);
    thump(voice.body*.7,voice.bodyGain*1.1,.08,.46);burst(1500,.02,.5,'highpass',.46);
  }else if(kind==='bell'){
    for(const [frequency,peak,decay] of [[2093,.5,1.3],[5230,.12,.6],[3150,.09,.9]]){
      const oscillator=context.createOscillator();oscillator.type='sine';oscillator.frequency.value=frequency;
      const gain=context.createGain();envelope(gain,0,peak,decay,.002);
      oscillator.connect(gain).connect(output);oscillator.start(0);oscillator.stop(decay+.1);
    }
  }else if(kind==='tab'){
    thump(voice.body*.9,voice.bodyGain*.6,.04);
    for(let i=0;i<6;i++)burst(2900+rand()*300,.006,.2,'bandpass',.03+i*.013,4);
    thump(voice.body*.75,voice.bodyGain*.8,.06,.12);burst(1800,.012,.3,'highpass',.12);
  }else if(kind==='history'){
    for(let i=0;i<2;i++)burst(2500+rand()*500,.009,.36,'bandpass',i*.032,4);
    burst(520,.12,.14,'lowpass',0,.7);thump(voice.body*1.4,voice.bodyGain*.22,.03,.004);
  }else if(kind==='nudge'){
    burst(3400*(.95+rand()*.1),.006,.3,'bandpass',0,5);
    burst(voice.click,.004,voice.clickGain*.12,'highpass',.002);
  }else if(kind==='select'){
    burst(1150+rand()*150,.022,.3,'bandpass',0,3);burst(4200,.003,.08,'highpass');
  }else if(kind==='switch'){
    for(const at of [0,.028,.047])burst(4800+rand()*800,.012,.12,'bandpass',at,8);
    burst(2200,.008,.6,'highpass',.07);thump(190,.42,.03,.074);burst(1600,.01,.18,'bandpass',.16,2);
  }
  return context.startRendering();
}

class TypewriterNocturnePlugin extends Plugin {
  async onload() {
    const savedSettings = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, savedSettings);
    if (savedSettings && Number(savedSettings.cursorPosition) === 44) {
      this.settings.cursorPosition = DEFAULT_SETTINGS.cursorPosition;
    }
    this.stages = new Map();
    this.stageCache = new Map();
    this.lampButtons = new Map();
    this.frames = new Set();
    this.alignmentScheduled = false;
    this.pendingCaretRecenter = false;
    this.currentLeaf = null;
    this.audio = new TypewriterAudio(() => this.settings);

    this.addRibbonIcon('type', '切换 Typewriter Prelude', () => this.toggleMode());
    this.addCommand({ id: 'toggle-typewriter-nocturne', name: '切换打字机写作模式', callback: () => this.toggleMode() });
    this.addCommand({ id: 'toggle-nocturne-lamp', name: '切换滑轨动态灯光', callback: () => this.toggleLamp() });
    this.addCommand({ id: 'toggle-nocturne-sound', name: '切换机械打字音效', callback: () => this.toggleSound() });
    this.addCommand({ id: 'toggle-nocturne-focus', name: '切换当前行聚焦', callback: () => this.toggleFocus() });
    this.addCommand({ id: 'nocturne-recenter-cursor', name: '将光标移回打字机位置', callback: () => this.scheduleCursorSync(true) });
    this.settingTab = new TypewriterSettingTab(this.app, this);
    this.addSettingTab(this.settingTab);

    this.status = this.addStatusBarItem();
    this.status.addClass('tn-status-clickable');
    this.status.setAttr('aria-label', '切换打字机写作模式');
    this.status.addEventListener('click', () => this.toggleMode());

    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.refreshViews()));
    this.registerEvent(this.app.workspace.on('file-open', () => this.refreshViews()));
    this.registerEvent(this.app.workspace.on('layout-change', () => this.refreshViews()));
    this.registerEvent(this.app.workspace.on('editor-change', () => this.scheduleCursorSync(true)));

    this.registerDomEvent(document, 'keydown', (e) => this.onKeyDown(e), true);
    this.registerDomEvent(document, 'keyup', (e) => { if (this.isInsideActiveEditor(e)) this.scheduleCursorSync(true); }, true);
    this.registerDomEvent(document, 'pointerup', (e) => { if (this.isInsideActiveEditor(e)) { const cm=this.getCM(this.getActiveView()); const stage=this.activeStage(); if(cm && cm.state.selection.ranges.some(r=>!r.empty)) this.audio.play('select', false, stage ? stage.pan() : 0); this.scheduleCursorSync(true); } }, true);
    this.registerDomEvent(document, 'compositionstart', (e) => {
      if (this.isInsideActiveEditor(e)) this.isComposingText = true;
    }, true);
    this.registerDomEvent(document, 'compositionend', (e) => {
      if (this.isInsideActiveEditor(e)) {
        this.isComposingText = false;
        this.activeStage()?.strike(0.45);
        this.scheduleCursorSync(true);
      }
    }, true);
    this.registerDomEvent(window, 'resize', () => this.refreshViews());
    this.refreshViews();
    this.updateStatus();
  }

  onunload() {
    for (const id of this.frames) cancelAnimationFrame(id);
    this.frames.clear();
    for (const pair of this.stageCache.values()) {
      if (pair.edit) pair.edit.destroy();
      if (pair.reading) pair.reading.destroy();
    }
    this.stageCache.clear();
    this.stages.clear();
    document.querySelectorAll('.tn-view-active').forEach(el => el.classList.remove('tn-view-active'));
    for (const btn of this.lampButtons.values()) btn.remove();
    this.lampButtons.clear();
    this.audio.destroy();
    document.querySelectorAll('.tn-nocturne-active').forEach(el => el.classList.remove('tn-nocturne-active', 'tn-focus-line'));
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.refreshViews();
    this.updateStatus();
    if (this.settingTab && this.settingTab.lightingToggle && this.settingTab.containerEl && this.settingTab.containerEl.isConnected) {
      this.settingTab.lightingToggle.setValue(this.settings.lighting);
    }
  }

  applyPaperFilter() {
    for (const stage of this.stages.values()) {
      setPaperFilterStyle(stage.source, this.settings.filterStyle);
      stage.renderLight();
    }
  }

  updateStatus() {
    if (!this.status) return;
    this.status.setText(this.settings.enabled ? '✦ 打字机：开启' : '打字机：关闭');
    this.status.toggleClass('is-active', this.settings.enabled);
  }

  async toggleMode() {
    this.settings.enabled = !this.settings.enabled;
    if (!this.settings.enabled) this.audio.stopTelegraph();
    await this.saveSettings();
    new Notice(this.settings.enabled ? 'Typewriter Prelude 已开启' : 'Typewriter Prelude 已关闭');
    if (this.settings.enabled) this.scheduleCursorSync(true);
  }

  async toggleLamp() {
    this.settings.lighting = !this.settings.lighting;
    try { this.audio.play('switch', false, this.activeStage()?.pan() || 0); } catch (_) {}
    await this.saveSettings();
  }

  async toggleSound() {
    this.settings.sound = !this.settings.sound;
    if (this.settings.sound) this.audio.unlock();
    else this.audio.stopTelegraph();
    await this.saveSettings();
    new Notice(this.settings.sound ? '机械打字音效已开启' : '机械打字音效已关闭');
  }

  async toggleFocus() {
    this.settings.focusLine = !this.settings.focusLine;
    await this.saveSettings();
  }

  getMarkdownLeaves() { return this.app.workspace.getLeavesOfType('markdown'); }
  getActiveView() { return this.app.workspace.getActiveViewOfType(MarkdownView); }
  getCM(view) { try { return view && view.editor ? view.editor.cm : null; } catch (_) { return null; } }

  isInsideActiveEditor(event) {
    const cm = this.getCM(this.getActiveView());
    return !!(cm && cm.dom && event && event.target && (cm.dom === event.target || cm.dom.contains(event.target)));
  }

  activeStage() {
    const leaf = this.app.workspace.activeLeaf;
    return leaf ? this.stages.get(leaf) || null : null;
  }

  syncLampButton(leaf) {
    if (!leaf || !leaf.view || typeof leaf.view.addAction !== 'function') return;
    let btn = this.lampButtons.get(leaf);
    if (!btn || !btn.isConnected) {
      btn = leaf.view.addAction('lightbulb', '切换灯光', () => this.toggleLamp());
      btn.addClass('tn-lamp-action');
      this.lampButtons.set(leaf, btn);
    }
    const isOn = this.settings.enabled && this.settings.lighting;
    btn.toggleClass('is-active', isOn);
    btn.setAttr('aria-label', isOn ? '关闭灯光' : '开启灯光');
    btn.style.display = this.settings.enabled ? '' : 'none';
  }

  refreshViews() {
    const leaves = this.getMarkdownLeaves();
    const alive = new Set(leaves);
    for (const [leaf, pair] of this.stageCache) {
      if (!alive.has(leaf) || !leaf.view || !leaf.view.containerEl.isConnected) {
        if (pair.edit) pair.edit.destroy();
        if (pair.reading) pair.reading.destroy();
        this.stageCache.delete(leaf);
        this.stages.delete(leaf);
      }
    }
    for (const [leaf, btn] of this.lampButtons) {
      if (!alive.has(leaf) || !leaf.view || !leaf.view.containerEl.isConnected) {
        btn.remove(); this.lampButtons.delete(leaf);
      }
    }
    const room = ROOMS[this.settings.room] || ROOMS['paper-and-ink'];
    const paper = PAPERS[this.settings.paper] || PAPERS.parchment;
    for (const leaf of leaves) {
      if (!leaf.view || !leaf.view.containerEl) continue;
      this.syncLampButton(leaf);
      const host = leaf.view.containerEl;
      host.classList.toggle('tn-view-active', this.settings.enabled);
      if (this.settings.enabled) {
        host.style.setProperty('--tn-room', room.room);
        host.style.setProperty('--tn-paper', paper.color);
        host.style.setProperty('--tn-ink', paper.ink);
      }
      const isReading = typeof leaf.view.getMode === 'function' && leaf.view.getMode() === 'preview';
      const modeKey = isReading ? 'reading' : 'edit';
      const otherKey = isReading ? 'edit' : 'reading';
      let pair = this.stageCache.get(leaf);
      if (!pair) { pair = { edit: null, reading: null }; this.stageCache.set(leaf, pair); }
      if (pair[otherKey]) pair[otherKey].setActive(false);
      const source = isReading
        ? host.querySelector('.markdown-reading-view')
        : host.querySelector('.markdown-source-view');
      const editor = isReading
        ? source && source.querySelector('.markdown-preview-view')
        : source && source.querySelector('.cm-editor');
      if (!source || !editor) continue;
      let stage = pair[modeKey];
      if (!stage || stage.destroyed || stage.source !== source || stage.editor !== editor) {
        if (stage) stage.destroy();
        stage = new NocturneStage(this, leaf, source, editor, isReading);
        pair[modeKey] = stage;
      }
      stage.setActive(true);
      this.stages.set(leaf, stage);
      stage.update(this.settings);
    }
    this.updateStatus();
    if (this.settings.enabled) this.scheduleCursorSync(true);
  }

  onKeyDown(event) {
    if (!this.settings.enabled || !this.isInsideActiveEditor(event)) return;
    const stage = this.activeStage();
    if (!stage) return;
    const modified = event.ctrlKey || event.metaKey || event.altKey;
    const isSpace = event.key === ' ' || event.code === 'Space';
    const isBackspace = event.key === 'Backspace' || event.code === 'Backspace';
    const isDelete = event.key === 'Delete' || event.code === 'Delete';
    const isImeTextKey = (event.key && event.key.length === 1 && event.key !== ' ') ||
      /^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|NumpadAdd|NumpadSubtract|NumpadDivide|NumpadDecimal|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Backquote|Comma|Period|Slash|IntlRo|IntlYen)$/.test(event.code || '');
    const isComposing = event.isComposing || this.isComposingText ||
      (event.key === 'Process' && /^(Key[A-Z]|Digit[0-9])$/.test(event.code || ''));
    const char = resolveTelegraphChar(event);
    if (isComposing) {
      if (modified) return;
      if (isSpace) {
        this.audio.play('space', event.repeat, stage.pan());
        stage.strike(0.75);
      } else if (isBackspace || isDelete) {
        this.audio.play('backspace', event.repeat, stage.pan());
        stage.strike(0.55);
      } else if (event.key === 'Enter' || event.code === 'Enter' || event.code === 'NumpadEnter') {
        this.audio.play('commit', event.repeat, stage.pan());
        stage.strike(0.8);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
        this.audio.play('nudge', event.repeat, stage.pan());
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.code === 'ArrowUp' || event.code === 'ArrowDown') {
        this.audio.play('history', event.repeat, stage.pan());
      } else if (event.key === 'Tab' || event.code === 'Tab') {
        this.audio.play('tab', event.repeat, stage.pan());
        stage.strike(0.5);
      } else if (isImeTextKey) {
        this.audio.play('key', event.repeat, stage.pan(), char);
        stage.strike(0.8);
      }
      return;
    }
    if (event.key === 'Enter' || event.code === 'Enter' || event.code === 'NumpadEnter') {
      this.audio.play('return', event.repeat, stage.pan());
      stage.carriageReturn();
    } else if (isBackspace || isDelete) {
      this.audio.play('backspace', event.repeat, stage.pan());
      stage.strike(0.55);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
      this.audio.play('nudge', event.repeat, stage.pan());
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.code === 'ArrowUp' || event.code === 'ArrowDown') {
      this.audio.play('history', event.repeat, stage.pan());
    } else if (event.key === 'Tab' || event.code === 'Tab') {
      this.audio.play('tab', event.repeat, stage.pan());
      stage.strike(0.5);
    } else if (isSpace) {
      if (!modified) { this.audio.play('space', event.repeat, stage.pan()); stage.strike(0.75); }
    } else if (isImeTextKey && !modified) {
      this.audio.play('key', event.repeat, stage.pan(), char);
      stage.strike(1);
      const cm=this.getCM(this.getActiveView());
      try { const pos=cm.state.selection.main.head, rect=cm.coordsAtPos(pos), box=cm.dom.getBoundingClientRect(); const line=cm.state.doc.lineAt(pos).number; if(rect && (rect.left-box.left)/Math.max(1,box.width)>.93 && this.lastMarginBellLine!==line){this.audio.play('bell',false,stage.pan());this.lastMarginBellLine=line;} } catch(_) {}
    }
    this.scheduleCursorSync(true);
  }

  scheduleCursorSync(recenter) {
    if (!this.settings.enabled) return;
    this.pendingCaretRecenter = this.pendingCaretRecenter || recenter;
    if (this.alignmentScheduled) return;
    this.alignmentScheduled = true;
    const add = (fn) => {
      const id = requestAnimationFrame(() => { this.frames.delete(id); fn(); });
      this.frames.add(id);
    };
    add(() => add(() => {
      const shouldRecenter = this.pendingCaretRecenter;
      this.pendingCaretRecenter = false;
      this.alignmentScheduled = false;
      this.syncCaret(shouldRecenter);
    }));
  }

  syncCaret(recenter) {
    if (!this.settings.enabled) return;
    const view = this.getActiveView();
    const cm = this.getCM(view);
    const leaf = this.app.workspace.activeLeaf;
    if (!cm || !cm.scrollDOM || !cm.state || !cm.state.selection || !leaf) return;
    const source = view.containerEl.querySelector('.markdown-source-view');
    if (!source) return;
    const stage = this.stages.get(leaf);
    if (!stage) return;
    try {
      const pos = cm.state.selection.main.head;
      const initialCaret = cm.coordsAtPos(pos);
      if (!initialCaret) return;
      const viewport = cm.scrollDOM.getBoundingClientRect();
      const editorRect = cm.dom.getBoundingClientRect();
      const y = (initialCaret.top + initialCaret.bottom) / 2;
      const requestedTarget = viewport.top + cm.scrollDOM.clientHeight * (this.settings.cursorPosition / 100);
      const paperTarget = stage.machineLayout
        ? editorRect.top + stage.machineLayout.text.height - (initialCaret.bottom - initialCaret.top) / 2 - 2
        : requestedTarget;
      const target = Math.min(requestedTarget, paperTarget);
      const delta = y - target;
      if (recenter && Math.abs(delta) > 1.25) {
        const max = Math.max(0, cm.scrollDOM.scrollHeight - cm.scrollDOM.clientHeight);
        cm.scrollDOM.scrollTop = clamp(cm.scrollDOM.scrollTop + delta, 0, max);
      }
      const caret = cm.coordsAtPos(pos) || initialCaret;
      const x = (caret.left + caret.right) * 0.5 - editorRect.left;
      const caretBottom = caret.bottom - editorRect.top;
      stage.setCursor(x, caretBottom, Math.max(1, caret.bottom - caret.top));
    } catch (_) { /* Obsidian/CodeMirror may be between editor transactions. */ }
  }
}

class NocturneStage {
  constructor(plugin, leaf, source, editor, isReading = false) {
    this.plugin = plugin;
    this.leaf = leaf;
    this.source = source;
    this.editor = editor;
    this.isReading = isReading;
    this.active = true;
    this.destroyed = false;
    this.paperCanvas = document.createElement('canvas');
    this.paperCanvas.className = 'tn-paper-layer';
    this.lightCanvas = document.createElement('canvas');
    this.lightCanvas.className = 'tn-light-layer';
    this.railCanvas = document.createElement('canvas');
    this.railCanvas.className = 'tn-rail-layer';
    this.machineCanvas = document.createElement('canvas');
    this.machineCanvas.className = 'tn-machine-layer';
    this.machineCanvas.style.visibility = 'hidden';
    this.cursor = { x: editor.clientWidth * .5, y: editor.clientHeight * .44, lineHeight: 20 };
    this.railPulse = 0;
    this.machineReady = false;
    this.machineAttempted = false;
    this.machineSpool = 0;
    this.machineSway = 0;
    this.platenTurn = 0;
    this.source.append(this.paperCanvas, this.lightCanvas, this.railCanvas, this.machineCanvas);
    this.paperLight = PaperLight.create(this.paperCanvas, () => {
      if (!this.destroyed) this.renderLight();
    });
    this.glowLayer = new GlowLayer(this.lightCanvas);
    this.source.classList.add('tn-nocturne-active');
    this.source.classList.toggle('tn-reading-mode', this.isReading);
    const cm = this.isReading ? null : plugin.getCM(leaf.view);
    this.scrollDOM = cm && cm.scrollDOM;
    this.scrollHandler = () => plugin.scheduleCursorSync(false);
    if (this.scrollDOM) this.scrollDOM.addEventListener('scroll', this.scrollHandler, { passive: true });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.editor);
    this.resize();
    this.update(plugin.settings);
  }

  setActive(active) {
    this.active = active;
    if (!active) {
      if (this.dustFrame) { cancelAnimationFrame(this.dustFrame); this.dustFrame = 0; }
      if (this.cursorFrame) { cancelAnimationFrame(this.cursorFrame); this.cursorFrame = 0; }
      if (this.railFrame) { cancelAnimationFrame(this.railFrame); this.railFrame = 0; }
    }
  }

  update(settings) {
    if (this.destroyed) return;
    this.source.classList.toggle('tn-focus-line', settings.focusLine);
    this.source.classList.toggle('tn-mode-off', !settings.enabled);
    if(settings.reducedMotion&&this.cursorFrame){
      cancelAnimationFrame(this.cursorFrame);this.cursorFrame=0;
      this.cursor=this.cursorTarget||this.cursor;
    }
    const room = ROOMS[settings.room] || ROOMS['paper-and-ink'];
    const paper = PAPERS[settings.paper] || PAPERS.onionskin;
    this.source.style.setProperty('--tn-paper', paper.color);
    this.source.style.setProperty('--tn-ink', paper.ink);
    this.source.style.setProperty('--tn-accent', paper.accent);
    this.source.style.setProperty('--tn-room', room.room);
    this.source.style.setProperty('--tn-metal', room.metal);
    this.source.style.setProperty('--tn-light-color', room.lamp);
    this.source.classList.toggle('tn-paper-dark', paper.dark);
    this.source.dataset.paper = settings.paper;
    this.source.dataset.room = settings.room;
    setPaperFilterStyle(this.source, settings.filterStyle);
    this.resize();
    this.syncDustAnimation();
  }

  resize() {
    if (this.destroyed || !this.active) return;
    const rect = this.editor.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;
    const sourceRect = this.source.getBoundingClientRect();
    const offsetX = rect.left - sourceRect.left;
    const offsetY = rect.top - sourceRect.top;
    const dpr = window.devicePixelRatio || 1;
    const ratio = Math.min(2, dpr);
    const w = Math.max(1, Math.floor(rect.width * ratio));
    const h = Math.max(1, Math.floor(rect.height * ratio));
    this.renderRatio = ratio;
    for (const canvas of [this.paperCanvas, this.lightCanvas, this.railCanvas]) {
      if (canvas !== this.paperCanvas || !this.paperLight) {
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
      }
      canvas.style.left = `${offsetX}px`;
      canvas.style.top = `${offsetY}px`;
      canvas.style.right = 'auto';
      canvas.style.bottom = 'auto';
      canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`;
    }
    this.machineCanvas.style.left = `${offsetX}px`;
    this.machineCanvas.style.top = `${offsetY}px`;
    this.machineCanvas.style.right = 'auto';
    this.machineCanvas.style.bottom = 'auto';
    this.machineCanvas.style.width = `${rect.width}px`;
    this.machineCanvas.style.height = `${rect.height}px`;
    this.machineLayout = machineLayout(rect.width, rect.height, this.isReading);
    this.source.style.setProperty('--tn-machine-height', `${this.machineLayout.machineHeight}px`);
    const paperLeft = clamp(this.machineLayout.sheet.x, 0, rect.width);
    const paperRight = clamp(this.machineLayout.sheet.x + this.machineLayout.sheet.width, paperLeft, rect.width);
    const textBottom = clamp(this.machineLayout.text.height, 0, rect.height);
    const paperBottom = clamp(this.machineLayout.sheet.y + this.machineLayout.sheet.height, textBottom, rect.height);
    this.source.style.setProperty('--tn-editor-paper-left', `${paperLeft}px`);
    this.source.style.setProperty('--tn-editor-paper-right', `${paperRight}px`);
    this.source.style.setProperty('--tn-paper-text-height', `${textBottom}px`);
    this.source.style.setProperty('--tn-paper-tail-height', `${paperBottom - textBottom}px`);
    this.glowLayer.resize(rect.width, rect.height, ratio);
    this.configureMachine();
    this.renderPaperSurface();
    this.renderLight();
    this.renderRail();
  }

  configureMachine() {
    if (this.isReading || !this.plugin.settings.enabled || !this.machineLayout) return;
    this.ensureMachineRenderer();
    if (!this.machineRenderer) return;
    const settings = this.plugin.settings;
    const room = ROOMS[settings.room] || ROOMS['paper-and-ink'];
    const paper = PAPERS[settings.paper] || PAPERS.onionskin;
    const cm = this.plugin.getCM(this.leaf.view);
    const rect = this.editor.getBoundingClientRect();
    let cellWidth = 9;
    let gridLeft = this.machineLayout.margin;
    if (cm) {
      if (Number.isFinite(cm.defaultCharacterWidth) && cm.defaultCharacterWidth > 0) {
        cellWidth = cm.defaultCharacterWidth;
      }
      try {
        const firstCell = cm.coordsAtPos(0);
        if (firstCell) gridLeft = firstCell.left - rect.left;
      } catch (_) { /* CodeMirror may be between editor transactions. */ }
    }
    const gridRight = this.machineLayout.sheet.x + this.machineLayout.sheet.width - 12;
    gridLeft = clamp(gridLeft, this.machineLayout.sheet.x + 8, gridRight - cellWidth);
    const columns = Math.max(1, Math.floor((gridRight - gridLeft) / cellWidth));
    this.machineGrid = { left: gridLeft, right: gridLeft + columns * cellWidth };
    const source = settings.lightSource === 'theme' ? room.source : settings.lightSource;
    let serif = 'serif';
    try {
      serif = getComputedStyle(this.editor).fontFamily || serif;
    } catch (_) { /* The browser may not have computed editor styles yet. */ }
    const spec = {
      layout: this.machineLayout,
      pixelRatio: this.renderRatio || 1,
      quality: 'high',
      grid: { left: gridLeft, cols: columns, cellWidth },
      theme: {
        room: room.room,
        light: room.lamp,
        source,
        trim: room.trim,
        environment: .55,
        exposure: 1
      },
      paper: { color: paper.color, appearance: paper.dark ? 'dark' : 'light' },
      serif
    };
    const machineKey = JSON.stringify(spec);
    if (this.machineReady && this.machineSpecKey === machineKey) return;
    this.machineSpecKey = machineKey;
    this.machineCanvas.style.visibility = 'hidden';
    this.machineReady = false;
    try {
      this.machineRenderer.build(spec);
    } catch (error) {
      console.error('Typewriter Prelude: 3D machine build failed; using the 2D rail.', error);
      this.machineRenderer.dispose();
      this.machineRenderer = null;
    }
  }

  ensureMachineRenderer() {
    if (this.isReading || this.machineAttempted || !this.plugin.settings.enabled) return;
    this.machineAttempted = true;
    try {
      this.machineRenderer = createMachine(this.machineCanvas, () => {
        if (this.destroyed) return;
        this.machineReady = true;
        this.renderRail();
      });
    } catch (error) {
      console.error('Typewriter Prelude: 3D machine initialization failed; using the 2D rail.', error);
      this.machineRenderer = null;
    }
  }

  renderPaperSurface() {
    if (this.destroyed || !this.paperLight || !this.machineLayout) return;
    const width = this.machineLayout.width;
    const height = this.machineLayout.height;
    const sheet = this.machineLayout.sheet;
    const left = clamp(sheet.x, 0, width);
    const top = clamp(sheet.y, 0, height);
    const right = clamp(sheet.x + sheet.width, left, width);
    const bottom = clamp(sheet.y + sheet.height, top, height);
    const rect = { x: left, y: top, width: right - left, height: bottom - top };
    const paper = PAPERS[this.plugin.settings.paper] || PAPERS.onionskin;
    const spec = {
      width,
      height,
      pixelRatio: this.renderRatio || 1,
      paper,
      texture: .5,
      rect
    };
    const key = JSON.stringify([width, height, spec.pixelRatio, paper.surface, rect]);
    if (key === this.paperSurfaceKey) return;
    this.paperSurfaceKey = key;
    try {
      this.paperLight.build(spec);
    } catch (error) {
      console.error('Typewriter Prelude: paper surface could not be built; using the plain paper colour.', error);
    }
  }

  renderLight() {
    if (this.destroyed || !this.machineLayout) return;
    const settings = this.plugin.settings;
    const paper = PAPERS[settings.paper] || PAPERS.parchment;
    const room = ROOMS[settings.room] || ROOMS['paper-and-ink'];
    const layout = this.machineLayout;
    const width = layout.width;
    const height = layout.height;
    const sheet = layout.sheet;
    const left = clamp(sheet.x, 0, width);
    const top = clamp(sheet.y, 0, height);
    const right = clamp(sheet.x + sheet.width, left, width);
    const bottom = clamp(sheet.y + sheet.height, top, height);
    const rect = { x: left, y: top, width: right - left, height: bottom - top };
    if (rect.width <= 0 || rect.height <= 0) {
      this.glowLayer.render({ lamp: false, rect });
      return;
    }

    const strength = clamp(Number(settings.filterStrength) || 0, 0, 500);
    const filterAmount = settings.filterStyle === 'hokkaido-blue-hour' ? strength / 500 : 0;
    const blueTint = toUnit('#a9c1ed');
    const lampColor = toUnit(room.lamp).map((value, index) => value * (1 - filterAmount) + blueTint[index] * filterAmount);
    const requestedSource = this.isReading ? (settings.readingLightSource || 'theme') : settings.lightSource;
    let source = requestedSource === 'theme' ? room.source : requestedSource;
    if (this.isReading && source === 'carriage') source = 'desk-lamp';
    const roomFallbackSource = this.isReading && room.source === 'carriage' ? 'desk-lamp' : room.source;
    const roomFallbackPosition = this.isReading && room.source === 'carriage' ? ROOMS['midnight-study'].position : room.position;
    const position = requestedSource === 'theme'
      ? roomFallbackPosition
      : source === 'desk-lamp'
        ? ROOMS['midnight-study'].position
        : source === 'moonlight'
          ? ROOMS['moonlit-poetry'].position
          : ROOMS['paper-and-ink'].position;
    const intensity = settings.lighting ? clamp(settings.lightIntensity, 0, 100) / 100 : 0;
    const rig = buildRig({
      source: this.isReading ? source : requestedSource,
      position,
      intensity,
      spread: 74,
      softness: .65,
      aim: 0,
      reach: 1,
      window: { x: .5, y: .38, columns: 3, rows: 2, slant: 0 }
    }, {
      light: { source: roomFallbackSource, position: roomFallbackPosition }
    }, {
      width: rect.width,
      height: rect.height,
      headX: clamp(this.cursorX() - rect.x, 0, rect.width),
      railY: clamp(layout.bailY - sheet.y + 12 - rect.y, 0, rect.height)
    });
    const roomColor = toUnit(room.room);
    const tintStrength = source === 'moonlight' ? .75 : .4;
    const ambientTint = roomColor.map(value => 1 + (.6 + value * 1.5 - 1) * tintStrength);
    if (filterAmount > 0) {
      const blueShadow = [.62, .73, .96];
      for (let i = 0; i < 3; i++) ambientTint[i] = ambientTint[i] * (1 - filterAmount) + blueShadow[i] * filterAmount;
    }
    const floor = Math.max(
      ambientFloor(toUnit(paper.ink), toUnit(paper.color), 4.5),
      paper.dark ? .62 : .55
    );
    const shade = room.shade * strength / 300;
    const shadeIntensity = clamp(settings.lightIntensity, 0, 100) / 100;
    const ambient = clamp(1 - shade * (.55 + .45 * shadeIntensity), floor, 1);
    const frame = {
      rig,
      lamp: settings.enabled,
      tint: settings.lighting ? lampColor : [0, 0, 0],
      ambient,
      ambientTint,
      relief: 1,
      grain: .08,
      time: 0,
      soft: false
    };
    this.paperLight?.render(frame);

    const rgb = lampColor.map(value => Math.round(value * 255));
    const pool = paper.dark
      ? lampColor.map((value, index) => Math.min(255, Math.round(value * toUnit(paper.color)[index] * 600)))
      : rgb;
    this.glowLayer.render({
      rig,
      lamp: settings.enabled && settings.lighting,
      rgb: rgb.join(', '),
      poolRgb: pool.join(', '),
      appearance: paper.dark ? 'dark' : 'light',
      intensity,
      particles: settings.dust && !settings.reducedMotion ? .45 : 0,
      cursorGlow: 0,
      cursor: null,
      time: performance.now() / 1000,
      rect
    });
  }

  renderMachine() {
    if (!this.machineRenderer || !this.machineReady || !this.machineLayout) return false;
    const settings = this.plugin.settings;
    const room = ROOMS[settings.room] || ROOMS['paper-and-ink'];
    const source = settings.lightSource === 'theme' ? room.source : settings.lightSource;
    const grid = this.machineGrid || { left: this.machineLayout.platen.left, right: this.machineLayout.platen.right };
    const headX = clamp(this.cursorX(), grid.left, grid.right);
    return this.machineRenderer.render({
      headX,
      sway: this.machineSway,
      strike: this.railPulse || 0,
      vibrator: Math.min(1, this.railPulse || 0),
      spool: this.machineSpool,
      platenTurn: this.platenTurn,
      lamp: settings.enabled && settings.lighting && source === 'carriage',
      lighting: settings.enabled && settings.lighting,
      intensity: settings.lighting ? settings.lightIntensity / 100 : 0
    });
  }

  renderRail() {
    const ctx=this.railCanvas.getContext('2d');if(!ctx)return;
    const width=this.machineLayout?this.machineLayout.width:this.editor.clientWidth;
    const height=this.machineLayout?this.machineLayout.height:this.editor.clientHeight;
    const ratio=this.renderRatio||1;
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,this.railCanvas.width,this.railCanvas.height);
    if(this.isReading||!this.plugin.settings.enabled||width<80||height<40){this.machineCanvas.style.visibility='hidden';return;}
    if(this.machineRenderer&&this.machineReady){
      const rendered=this.renderMachine();
      this.machineCanvas.style.visibility=rendered?'visible':'hidden';
      if(rendered)return;
    }else{
      this.machineCanvas.style.visibility='hidden';
    }
    ctx.setTransform(ratio,0,0,ratio,0,0);
    const railWidth=Math.max(48,width-24);
    const left=(width-railWidth)/2;
    const right=left+railWidth;
    const y=clamp(this.machineLayout?this.machineLayout.headRailY:height-48,20,height-36);
    const carriageX=clamp(this.cursorX(),left+34,right-34);
    const pulse=this.railPulse||0;
    const metal=ctx.createLinearGradient(0,y-5,0,y+5);
    metal.addColorStop(0,'#f6f7f5');metal.addColorStop(.18,'#778087');metal.addColorStop(.42,'#e5e8e5');metal.addColorStop(.68,'#90979a');metal.addColorStop(1,'#292d30');
    const lowerMetal=ctx.createLinearGradient(0,y+12,0,y+26);
    lowerMetal.addColorStop(0,'#111417');lowerMetal.addColorStop(.24,'#798087');lowerMetal.addColorStop(.5,'#272b2e');lowerMetal.addColorStop(.78,'#9ba0a0');lowerMetal.addColorStop(1,'#111315');
    const railSettings=this.plugin.settings;
    const room=ROOMS[railSettings.room]||ROOMS['paper-and-ink'];
    ctx.save();
    ctx.lineCap='round';ctx.lineJoin='round';
    ctx.shadowColor='rgba(4,6,8,.68)';ctx.shadowBlur=12;ctx.shadowOffsetY=6;
    ctx.strokeStyle='#090b0d';ctx.lineWidth=18;ctx.beginPath();ctx.moveTo(left,y+10);ctx.lineTo(right,y+10);ctx.stroke();
    ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    ctx.strokeStyle='#1b1f22';ctx.lineWidth=13;ctx.beginPath();ctx.moveTo(left,y+12);ctx.lineTo(right,y+12);ctx.stroke();
    ctx.strokeStyle=lowerMetal;ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(left+2,y+22);ctx.lineTo(right-2,y+22);ctx.stroke();
    ctx.strokeStyle='rgba(228,232,231,.7)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left+4,y+19);ctx.lineTo(right-4,y+19);ctx.stroke();

    const ribbonY=y+18;
    ctx.strokeStyle='#100f10';ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(left+8,ribbonY+7);ctx.quadraticCurveTo((left+carriageX)/2,ribbonY+10,carriageX,ribbonY);ctx.quadraticCurveTo((carriageX+right)/2,ribbonY+10,right-8,ribbonY+7);ctx.stroke();
    ctx.strokeStyle='#8a2924';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(left+8,ribbonY+6);ctx.quadraticCurveTo((left+carriageX)/2,ribbonY+8,carriageX,ribbonY-1);ctx.quadraticCurveTo((carriageX+right)/2,ribbonY+8,right-8,ribbonY+6);ctx.stroke();

    ctx.shadowColor='rgba(0,0,0,.62)';ctx.shadowBlur=7;ctx.shadowOffsetY=2;
    ctx.strokeStyle='#080a0c';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();
    ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    ctx.strokeStyle=metal;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.82)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left+4,y-1.6);ctx.lineTo(right-4,y-1.6);ctx.stroke();
    ctx.strokeStyle='rgba(24,28,31,.85)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left+4,y+2.2);ctx.lineTo(right-4,y+2.2);ctx.stroke();

    const cm=this.plugin.getCM(this.leaf.view);
    const toothPitch=clamp(cm&&cm.defaultCharacterWidth?cm.defaultCharacterWidth:width/100,5,14);
    ctx.strokeStyle='rgba(205,211,211,.88)';ctx.lineWidth=1;
    for(let tx=left+4;tx<right-3;tx+=toothPitch){
      ctx.beginPath();ctx.moveTo(tx,y+16);ctx.lineTo(tx,y+21);ctx.stroke();
    }
    ctx.fillStyle='#101315';ctx.strokeStyle='#777f82';ctx.lineWidth=1;
    for(const endX of [left+2,right-12]){
      ctx.beginPath();ctx.roundRect(endX,y-7,10,31,2);ctx.fill();ctx.stroke();
      ctx.fillStyle='#d9ddda';ctx.beginPath();ctx.arc(endX+5,y-3,1.3,0,Math.PI*2);ctx.fill();ctx.fillStyle='#101315';
    }

    ctx.strokeStyle=`rgba(255,218,158,${.38+pulse*.48})`;ctx.lineWidth=1.4;
    const bulbY=clamp(this.machineLayout?this.machineLayout.lampY:y-72,12,y-18);
    ctx.beginPath();ctx.moveTo(carriageX,y-13);ctx.lineTo(carriageX,bulbY+8);ctx.stroke();
    const block=ctx.createLinearGradient(carriageX-28,y-15,carriageX+28,y+25);
    block.addColorStop(0,'#181b1e');block.addColorStop(.16,'#d7dcda');block.addColorStop(.32,'#676e71');block.addColorStop(.5,'#f0f1ed');block.addColorStop(.72,'#70777a');block.addColorStop(.9,'#bbc1bf');block.addColorStop(1,'#202427');
    ctx.shadowColor=railSettings.lighting?`${room.lamp}${Math.floor(80+pulse*110).toString(16)}`:'transparent';
    ctx.shadowBlur=8+pulse*12;ctx.fillStyle=block;ctx.strokeStyle='#181b1d';ctx.lineWidth=1;
    ctx.beginPath();ctx.roundRect(carriageX-27,y-13,54,18,3);ctx.fill();ctx.stroke();
    ctx.shadowBlur=0;
    ctx.fillStyle='#252a2d';ctx.beginPath();ctx.roundRect(carriageX-18,y+2,36,19,2);ctx.fill();ctx.strokeStyle='#b8bfbd';ctx.stroke();
    for(const side of [-1,1]){
      ctx.fillStyle='#d4d9d6';ctx.beginPath();ctx.ellipse(carriageX+side*19,y-3,5,3.8,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle='#31373a';ctx.beginPath();ctx.arc(carriageX+side*19,y-3,1.2,0,Math.PI*2);ctx.fill();
    }
    ctx.fillStyle='#8a2924';ctx.fillRect(carriageX-11,y+8,22,3);
    if(railSettings.lighting){
      const bulb=ctx.createRadialGradient(carriageX,bulbY,0,carriageX,bulbY,11+pulse*5);
      bulb.addColorStop(0,'rgba(255,246,211,.95)');bulb.addColorStop(.22,`${room.lamp}d9`);bulb.addColorStop(1,`${room.lamp}00`);
      ctx.fillStyle=bulb;ctx.fillRect(carriageX-16,bulbY-16,32,32);
      ctx.fillStyle='#fff4d0';ctx.beginPath();ctx.arc(carriageX,bulbY,2.4,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }

  syncDustAnimation() {
    if (this.dustFrame) cancelAnimationFrame(this.dustFrame);
    this.dustFrame = 0;
    if (!this.active) return;
    const tick = (now) => {
      if (this.destroyed || !this.active) return;
      const s=this.plugin.settings;
      if (!(s.enabled && s.lighting && s.dust && !s.reducedMotion)) return;
      if (!this.lastDust || now-this.lastDust>40) { this.lastDust=now; this.renderLight(); }
      this.dustFrame=requestAnimationFrame(tick);
    };
    const s=this.plugin.settings;
    if (s.enabled && s.lighting && s.dust && !s.reducedMotion) this.dustFrame=requestAnimationFrame(tick);
  }

  setCursor(x,y,lineHeight) {
    const width=this.machineLayout?this.machineLayout.width:this.editor.clientWidth;
    const height=this.machineLayout?this.machineLayout.height:this.editor.clientHeight;
    this.cursorTarget={x:clamp(x,0,width),y:clamp(y,0,height),lineHeight};
    if(this.plugin.settings.reducedMotion){
      this.cursor=this.cursorTarget;
      this.machineSway=0;
      this.renderLight();this.renderRail();
      return;
    }
    if(this.cursorFrame)return;
    const tick=()=>{
      const target=this.cursorTarget;
      this.machineSway=clamp((target.x-this.cursor.x)/80,-.12,.12);
      this.cursor.x+=(target.x-this.cursor.x)*.38;
      this.cursor.y+=(target.y-this.cursor.y)*.38;
      this.cursor.lineHeight=target.lineHeight;
      this.renderLight();this.renderRail();
      if(Math.abs(target.x-this.cursor.x)>.35||Math.abs(target.y-this.cursor.y)>.35){
        this.cursorFrame=requestAnimationFrame(tick);
      }else{
        this.cursor={...target};
        this.machineSway=0;
        this.cursorFrame=0;
        this.renderLight();this.renderRail();
      }
    };
    this.cursorFrame=requestAnimationFrame(tick);
  }
  cursorX() { return (this.cursorTarget||this.cursor).x; }
  pan() { return clamp(this.cursor.x/Math.max(1,this.editor.clientWidth)*1.4-.7,-.7,.7); }
  strike(force) {
    this.railPulse=Math.max(this.railPulse||0,force);
    this.machineSpool+=.045*force;
    this.renderRail();
    if(this.plugin.settings.reducedMotion||this.railFrame)return;
    const tick=()=>{
      this.railPulse*=.78;this.renderRail();
      if(this.railPulse>.015)this.railFrame=requestAnimationFrame(tick);
      else{this.railPulse=0;this.railFrame=0;this.renderRail();}
    };
    this.railFrame=requestAnimationFrame(tick);
  }
  carriageReturn() {
    if (this.machineLayout) {
      const circumference = 2 * Math.PI * this.machineLayout.platenRadius;
      this.platenTurn += clamp(this.cursor.lineHeight / Math.max(1, circumference), .02, .16);
    }
    this.strike(.8);
  }
  destroy() {
    if(this.destroyed)return;this.destroyed=true;
    if(this.resizeObserver)this.resizeObserver.disconnect();
    if(this.cursorFrame)cancelAnimationFrame(this.cursorFrame);
    if(this.scrollDOM)this.scrollDOM.removeEventListener('scroll',this.scrollHandler);
    if(this.railFrame)cancelAnimationFrame(this.railFrame);
    if(this.dustFrame)cancelAnimationFrame(this.dustFrame);
    if(this.machineRenderer)this.machineRenderer.dispose();
    if(this.paperLight)this.paperLight.dispose();
    for(const el of [this.paperCanvas,this.lightCanvas,this.railCanvas,this.machineCanvas])el.remove();
    this.source.classList.remove('tn-nocturne-active','tn-reading-mode','tn-focus-line','tn-mode-off','tn-paper-dark');
    delete this.source.dataset.paper; delete this.source.dataset.room; delete this.source.dataset.filterStyle;
    for(const v of ['--tn-paper','--tn-ink','--tn-accent','--tn-room','--tn-metal','--tn-light-color','--tn-filter-wash-alpha','--tn-filter-center-alpha','--tn-filter-vignette-alpha','--tn-filter-edge-alpha','--tn-filter-top-alpha','--tn-filter-bottom-alpha','--tn-machine-height','--tn-editor-paper-left','--tn-editor-paper-right','--tn-paper-text-height','--tn-paper-tail-height'])this.source.style.removeProperty(v);
  }
}

class TypewriterAudio {
  constructor(getSettings){this.getSettings=getSettings;this.ctx=null;this.master=null;this.rand=random(Date.now());this.buffers=new Map();this.preparing=new Map();this.offlineWarningShown=false;this.telegraphNextAt=0;this.telegraphBus=null;this.telegraphNodes=new Set();this.telegraphQueue=[];this.telegraphTimer=null;}
  unlock(){
    if(!this.getSettings().sound)return;
    try{
      if(!this.ctx){
        const C=window.AudioContext||window.webkitAudioContext;
        if(!C){console.warn('Typewriter sounds unavailable: AudioContext is not supported.');return;}
        this.ctx=new C({latencyHint:'interactive'});
        this.master=this.ctx.createGain();this.master.gain.value=this.getSettings().volume/100;this.master.connect(this.ctx.destination);
        const con=this.ctx.createConvolver();con.buffer=this.makeRoom();const wet=this.ctx.createGain();wet.gain.value=.16;
        this.master.connect(con).connect(wet).connect(this.ctx.destination);
      }
      if(this.ctx.state==='suspended')void this.ctx.resume();
      void this.prepare(this.getSettings().voice);
    }catch(error){console.warn('Typewriter sounds could not be initialized:',error.message);}
  }
  prepare(voiceName){
    if(this.preparing.has(voiceName))return this.preparing.get(voiceName);
    if(voiceName==='telegraph')return Promise.resolve();
    const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;
    if(!Offline){
      if(!this.offlineWarningShown){console.warn('Offline sound variations unavailable; using live synthesis.');this.offlineWarningShown=true;}
      return Promise.resolve();
    }
    const work=Promise.all(Object.keys(SOUND_DURATIONS).map(async(kind)=>{
      const variants=[];
      for(let i=0;i<4;i++)variants.push(await renderOfflineSound(kind,SOUND_VOICES[voiceName]||SOUND_VOICES.standard,i*7919+kind.length));
      this.buffers.set(`${voiceName}:${kind}`,variants);
    })).then(()=>undefined).catch(error=>{
      console.warn('Pre-rendered typewriter sounds unavailable; using live synthesis:',error.message);
    });
    this.preparing.set(voiceName,work);
    return work;
  }
  makeRoom(){const len=Math.floor(.34*this.ctx.sampleRate),b=this.ctx.createBuffer(2,len,this.ctx.sampleRate);for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<len;i++)d[i]=(this.rand()*2-1)*Math.pow(1-i/len,3.8);}return b;}
  noiseBuffer(seconds){const b=this.ctx.createBuffer(1,Math.ceil(seconds*this.ctx.sampleRate),this.ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=this.rand()*2-1;return b;}
  envelope(gain,at,peak,decay,attack=.0006){gain.gain.setValueAtTime(.0001,at);gain.gain.linearRampToValueAtTime(Math.max(.0001,peak),at+attack);gain.gain.exponentialRampToValueAtTime(.0001,at+attack+decay);}
  filteredNoise(freq,duration,gainValue,type='bandpass',when=0,q=.8,dest=this.master,track=null){const c=this.ctx,src=c.createBufferSource();src.buffer=this.noiseBuffer(duration+.02);const f=c.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q;const g=c.createGain();this.envelope(g,when,gainValue,duration);src.connect(f).connect(g).connect(this.output(dest));if(track){track.add(src);src.onended=()=>track.delete(src);}src.start(when);src.stop(when+duration+.025);}
  thump(freq,peak,decay,when=0){const c=this.ctx,o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(freq*1.75,when);o.frequency.exponentialRampToValueAtTime(freq,when+.025);this.envelope(g,when,peak,decay);o.connect(g).connect(this.output());o.start(when);o.stop(when+decay+.05);}
  tone(freq,peak,decay,when=0,type='triangle'){const c=this.ctx,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=freq;this.envelope(g,when,peak,decay,.0015);o.connect(g).connect(this.output());o.start(when);o.stop(when+decay+.05);}
  output(dest=this.master){const p=this.ctx.createStereoPanner();p.pan.value=this.pan||0;p.connect(dest);return p;}
  ensureTelegraphBus(){
    if(!this.telegraphBus){
      this.telegraphBus=this.ctx.createGain();
      this.telegraphBus.gain.value=1;
      this.telegraphBus.connect(this.master);
    }
    return this.telegraphBus;
  }
  stopTelegraph(){
    this.telegraphQueue.length=0;
    if(this.telegraphTimer){
      clearTimeout(this.telegraphTimer);
      this.telegraphTimer=null;
    }
    if(!this.ctx)return;
    const now=this.ctx.currentTime;
    if(this.telegraphBus){
      const oldBus=this.telegraphBus;
      try{
        oldBus.gain.cancelScheduledValues(now);
        oldBus.gain.setValueAtTime(Math.max(.0001,oldBus.gain.value),now);
        oldBus.gain.linearRampToValueAtTime(.0001,now+.01);
      }catch(_){}
      this.telegraphBus=null;
    }
    for(const node of this.telegraphNodes){
      try{node.stop(now+.012);}catch(_){}
    }
    this.telegraphNodes.clear();
    this.telegraphNextAt=0;
  }
  // 电报信号音
  telegraphPulse(at, duration, pan, velocity = 1) {
    const c = this.ctx;
    const bus = this.ensureTelegraphBus();

    const osc = c.createOscillator();
    const filter = c.createBiquadFilter();
    const gain = c.createGain();

    // 老式电报机的音调，加入轻微频率偏差
    const base = 650 + (this.rand() - 0.5) * 28;

    osc.type = "sine";
    osc.frequency.setValueAtTime(base, at);
    osc.frequency.linearRampToValueAtTime(
      base + (this.rand() - 0.5) * 8,
      at + duration
    );

    filter.type = "lowpass";
    filter.frequency.value = 1800;
    filter.Q.value = 0.55;

    const level = 0.52 * velocity;

    // 音量包络：快速启动、稳定发声、迅速停止
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(level, at + 0.005);
    gain.gain.setValueAtTime(
      level * 0.88,
      Math.max(at + 0.006, at + duration - 0.008)
    );
    gain.gain.linearRampToValueAtTime(
      0.0001,
      at + duration + 0.008
    );

    const panner = c.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));

    osc.connect(filter)
      .connect(gain)
      .connect(panner)
      .connect(bus);

    this.telegraphNodes.add(osc);
    osc.onended = () => this.telegraphNodes.delete(osc);

    osc.start(at);
    osc.stop(at + duration + 0.02);

    // 电键闭合和释放时的金属接点声
    this.filteredNoise(
      2350, 0.009, 0.13 * velocity,
      "bandpass", at, 2.2, bus, this.telegraphNodes
    );

    this.filteredNoise(
      1850, 0.007, 0.075 * velocity,
      "highpass", at + duration, 0.8, bus, this.telegraphNodes
    );
  }
  scheduleTelegraphChar(item) {
    const s = this.getSettings();
    const { char, repeat, pan } = item;
    const pattern = MORSE[String(char || "").toUpperCase()];
    const wpm = clamp(Number(s.telegraphWpm) || 26, 12, 40);
    const unit = 1.2 / wpm;
    const now = this.ctx.currentTime;
    const start = Math.max(now + 0.01, this.telegraphNextAt || 0);

    this.pan = clamp(pan, -1, 1);

    if (!pattern) {
      this.telegraphPulse(start, 0.045, this.pan, repeat ? 0.55 : 0.82);
      this.telegraphNextAt = start + 0.09;
      return this.telegraphNextAt;
    }

    let at = start;
    const velocity = repeat ? 0.62 : 1;

    for (let i = 0; i < pattern.length; i++) {
      const duration = unit * (pattern[i] === "-" ? 3 : 1);
      this.telegraphPulse(at, duration, this.pan, velocity);
      at += duration;
      if (i < pattern.length - 1) {
        at += unit;
      }
    }

    // 字符之间间隔三个时间单位
    this.telegraphNextAt = at + 3 * unit;
    return this.telegraphNextAt;
  }
  pumpTelegraphQueue() {
    if (this.telegraphTimer || !this.telegraphQueue.length) return;
    const s = this.getSettings();
    if (!this.ctx || !s.enabled || !s.sound || s.volume <= 0 || s.voice !== "telegraph") {
      this.stopTelegraph();
      return;
    }

    const item = this.telegraphQueue.shift();
    const endAt = this.scheduleTelegraphChar(item);

    // 在当前字符结束前 40ms 唤醒，无缝衔接队列中的下一个字符，且始终只为 1 个字符创建音频节点
    const delayMs = Math.max(10, (endAt - this.ctx.currentTime - 0.04) * 1000);
    this.telegraphTimer = setTimeout(() => {
      this.telegraphTimer = null;
      this.pumpTelegraphQueue();
    }, delayMs);
  }
  // 将输入字符转换成莫尔斯电码（支持打断模式与轻量顺序队列）
  telegraphCharacter(char, repeat = false, pan = 0) {
    const s = this.getSettings();

    if (s.telegraphInterrupt) {
      this.stopTelegraph();
      this.scheduleTelegraphChar({ char, repeat, pan });
      return;
    }

    this.telegraphQueue.push({ char, repeat, pan });
    this.pumpTelegraphQueue();
  }
  telegraphSpecial(kind, repeat = false, pan = 0) {
    const s = this.getSettings();
    if (s.telegraphInterrupt && kind !== "bell" && kind !== "cord" && kind !== "switch") {
      this.stopTelegraph();
    }

    const now = this.ctx.currentTime;
    const scale = repeat ? 0.62 : 1;

    this.pan = pan;

    if (kind === "space") {

      // 空格：低沉的电键声
      this.filteredNoise(
        900, 0.055, 0.16 * scale,
        "lowpass", now, 0.7
      );

      this.thump(175, 0.22 * scale, 0.055, now);

    } else if (kind === "return") {

      // 回车：电报机械机构动作
      for (let i = 0; i < 4; i++) {
        this.filteredNoise(
          1850 + i * 130,
          0.013,
          0.22 * scale,
          "bandpass",
          now + i * 0.035,
          3
        );
      }

      this.filteredNoise(
        720, 0.24, 0.23 * scale,
        "lowpass", now + 0.12, 0.7
      );

      this.thump(115, 0.72 * scale, 0.11, now + 0.38);

      this.telegraphPulse(
        now + 0.47, 0.06, pan, 0.45 * scale
      );

      this.telegraphNextAt = Math.max(this.telegraphNextAt || 0, now + 0.58);

    } else if (
      kind === "backspace" ||
      kind === "nudge" ||
      kind === "history" ||
      kind === "tab"
    ) {

      const frequency = {
        tab: 1450,
        history: 980,
        backspace: 1250,
        nudge: 2100
      }[kind];

      this.filteredNoise(
        frequency,
        0.018,
        0.2 * scale,
        "bandpass",
        now,
        2.6
      );

      this.thump(
        kind === "tab" ? 150 : 210,
        0.24 * scale,
        0.035,
        now + 0.008
      );

    } else if (kind === "bell") {

      // 电报提示铃
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.value = 880;

      this.envelope(gain, now, 0.2 * scale, 0.48, 0.003);

      osc.connect(gain).connect(this.output());

      osc.start(now);
      osc.stop(now + 0.52);

    } else if (kind === "cord" || kind === "switch") {

      // 拉绳开关声
      [0, 0.025, 0.048].forEach(t => {
        this.filteredNoise(
          3400, 0.012, 0.15 * scale,
          "bandpass", now + t, 5
        );
      });

      this.thump(165, 0.42 * scale, 0.045, now + 0.07);

      this.filteredNoise(
        850, 0.08, 0.12 * scale,
        "lowpass", now + 0.1, 0.8
      );

    } else if (kind === "select" || kind === "commit") {

      this.filteredNoise(
        2200, 0.012, 0.16 * scale,
        "bandpass", now, 2
      );

      this.telegraphPulse(
        now + 0.025, 0.075, pan, 0.72 * scale
      );
    }
  }
  play(kind,repeat=false,pan=0,char=''){
    const s=this.getSettings();if(!s.enabled||!s.sound||s.volume<=0)return;
    this.unlock();if(!this.ctx||!this.master)return;
    this.pan=clamp(pan,-1,1);const now=this.ctx.currentTime;this.master.gain.setTargetAtTime(s.volume/100,now,.035);
    if (s.voice === "telegraph") {
      if (kind === "key") {
        this.telegraphCharacter(char, repeat, this.pan);
      } else {
        this.telegraphSpecial(kind, repeat, this.pan);
      }
      return;
    }
    void this.prepare(s.voice);
    const variants=this.buffers.get(`${s.voice}:${kind}`);
    if(variants&&variants.length){
      const source=this.ctx.createBufferSource();
      source.buffer=variants[Math.floor(this.rand()*variants.length)];
      source.playbackRate.value=1+(this.rand()-.5)*.09;
      const level=this.ctx.createGain();
      level.gain.value=SOUND_LOUDNESS[kind]*(1+(this.rand()-.5)*.35)*(repeat?.55:1);
      const panner=this.ctx.createStereoPanner();panner.pan.value=this.pan;
      source.connect(level).connect(panner).connect(this.master);source.start();
      return;
    }
    const v=s.voice==='portable'?{body:185,bodyGain:.48,click:3400,clickGain:.72,ring:4200,ringGain:.13}:s.voice==='electric'?{body:112,bodyGain:.66,click:1850,clickGain:.38,ring:2550,ringGain:.045}:s.voice==='whisper'?{body:155,bodyGain:.28,click:2850,clickGain:.26,ring:3600,ringGain:.03}:{body:138,bodyGain:.72,click:2450,clickGain:.56,ring:3150,ringGain:.095};
    const weight=repeat ? .52+.1*this.rand() : .9+.1*this.rand(),variation=.88+this.rand()*.24;
    if(kind==='key'||kind==='space'||kind==='backspace'||kind==='commit'){
      const mul=kind==='space'?1.12:kind==='backspace'?.72:kind==='commit'?1.22:1;
      const click=v.click*variation,body=v.body*(.92+this.rand()*.18);
      this.filteredNoise(click,.006+this.rand()*.004,v.clickGain*(kind==='space'?.42:1)*weight,'highpass',now,1.2);
      this.thump(body*(2-mul),v.bodyGain*mul*weight,.042+this.rand()*.024,now);
      if(kind!=='space'){
        this.filteredNoise(v.ring*(.91+this.rand()*.18),.045+this.rand()*.045,v.ringGain*weight,'bandpass',now+.003,11+this.rand()*7);
        this.tone(v.ring*(.96+this.rand()*.08),v.ringGain*.17*weight,.045+this.rand()*.035,now+.004,'triangle');
      }
      this.filteredNoise(click*.68,.008,v.clickGain*.2*weight,'bandpass',now+.018+this.rand()*.008,2.4);
      if(kind==='commit'){this.thump(body*.68,.2*weight,.045,now+.045);this.filteredNoise(click*.82,.006,.2*weight,'highpass',now+.051);}
    }else if(kind==='return'){
      for(let i=0;i<5;i++){
        const t=i*.024+this.rand()*.004;
        this.filteredNoise(1850+i*95,.007,.28-i*.035,'bandpass',now+t,2.5+this.rand()*1.5);
      }
      this.filteredNoise(920,.24,.17,'bandpass',now+.105,1.2);
      this.filteredNoise(1550,.09,.12,'lowpass',now+.16,.7);
      this.thump(v.body*.72,v.bodyGain*.72,.085,now+.39);
      this.filteredNoise(1800,.018,.28,'highpass',now+.395,1.4);
    }else if(kind==='nudge'){
      this.filteredNoise(3050+this.rand()*700,.005,.2,'bandpass',now,4+this.rand()*2);
      this.filteredNoise(v.click*.86,.0035,v.clickGain*.12,'highpass',now+.004);
      this.tone(v.ring,.035,.022,now+.006,'triangle');
    }else if(kind==='history'){
      this.filteredNoise(2450+this.rand()*300,.008,.23,'bandpass',now,3.5);
      this.thump(v.body*1.35,v.bodyGain*.2,.032,now+.006);
      this.filteredNoise(2800+this.rand()*400,.009,.2,'bandpass',now+.028,3);
    }else if(kind==='tab'){
      this.thump(v.body*.92,v.bodyGain*.48,.045,now);
      for(let i=0;i<5;i++)this.filteredNoise(2650+i*95,.005,.14,'bandpass',now+.025+i*.014,3.4);
      this.thump(v.body*.78,v.bodyGain*.62,.055,now+.11);
      this.tone(v.ring*.72,.035,.045,now+.115,'triangle');
    }else if(kind==='switch'){
      this.filteredNoise(3400+this.rand()*500,.007,.1,'bandpass',now,5);
      this.thump(205,.22,.035,now+.012);
      this.filteredNoise(1450,.018,.08,'bandpass',now+.045,1.8);
    }else if(kind==='bell'){
      [[1960,.3,.92],[2790,.105,.48],[3970,.055,.26]].forEach(([freq,gain,decay],i)=>{
        this.tone(freq*(.995+this.rand()*.01),gain,decay,now+i*.0015,'sine');
      });
    }
  }
  destroy(){this.stopTelegraph();if(this.ctx){this.ctx.close().catch(error=>console.warn('Typewriter audio could not be closed:',error.message));this.ctx=null;this.master=null;}this.buffers.clear();this.preparing.clear();}
}

class TypewriterSettingTab extends PluginSettingTab {
  constructor(app,plugin){super(app,plugin);this.plugin=plugin;}
  display(){const c=this.containerEl;c.empty();c.createEl('h2',{text:'Typewriter Prelude · 机械滑轨写作环境'});
    const p=this.plugin,s=p.settings,save=()=>p.saveSettings();
    new Setting(c).setName('启用打字机环境').setDesc('开启纸张背景、光标下方的机械滑轨和动态灯光。').addToggle(t=>t.setValue(s.enabled).onChange(async v=>{s.enabled=v;if(!v)p.audio.stopTelegraph();await save();}));
    new Setting(c).setName('纸张材质').setDesc('羊皮纸为默认暖色纸面；其他材质保留各自的颗粒、纤维、条纹与织纹。').addDropdown(d=>{for(const [k,v] of Object.entries(PAPERS))d.addOption(k,v.name);d.setValue(s.paper).onChange(async v=>{s.paper=v;await save();});});
    new Setting(c).setName('纸面滤镜').setDesc('纯净保留中性暖纸色；北海道蓝调时分为纸面加入冷蓝暮色。滤镜只作用于纸面，不压暗打字机模型。').addDropdown(d=>d.addOption('clean','纯净滤镜').addOption('hokkaido-blue-hour','北海道蓝调时分').setValue(s.filterStyle).onChange(async v=>{s.filterStyle=v;p.applyPaperFilter();await p.saveData(s);}));
    new Setting(c).setName('滤镜强度').setDesc('调整所选纸面滤镜的明暗与色调幅度，可边拖动边预览。').addSlider(sl=>sl.setLimits(0,500,1).setValue(s.filterStrength).setDynamicTooltip().onChange(async v=>{s.filterStrength=v;p.applyPaperFilter();await p.saveData(s);}));
    new Setting(c).setName('环境主题').setDesc('决定纸面光色和金属滑轨色调。').addDropdown(d=>{for(const [k,v]of Object.entries(ROOMS))d.addOption(k,v.name);d.setValue(s.room).onChange(async v=>{s.room=v;await save();});});
    new Setting(c).setName('光标固定高度').setDesc('调节光标高度；默认贴近纸面打字线，且不会进入机器遮挡区。').addSlider(sl=>sl.setLimits(18,78,1).setValue(s.cursorPosition).setDynamicTooltip().onChange(async v=>{s.cursorPosition=v;await save();}));
    new Setting(c).setName('台灯与纸面光照').setDesc('开启随光标移动的暖色聚光束、纸面渐晕及滑轨局部高光。').addToggle(t=>{this.lightingToggle=t;t.setValue(s.lighting).onChange(async v=>{if(s.lighting===v)return;s.lighting=v;await save();});});
    new Setting(c).setName('灯光风格').setDesc('切换聚光范围和色调；光斑始终跟随当前光标。').addDropdown(d=>d.addOption('theme','跟随环境主题').addOption('carriage','聚焦').addOption('desk-lamp','台灯').addOption('moonlight','窗格日影').setValue(s.lightSource).onChange(async v=>{s.lightSource=v;await save();}));
    new Setting(c).setName('阅读模式灯光风格').setDesc('阅读模式无打字机字架，仅提供以下三种灯光效果。').addDropdown(d=>d.addOption('theme','跟随环境主题').addOption('desk-lamp','台灯').addOption('moonlight','窗格日影').setValue(s.readingLightSource).onChange(async v=>{s.readingLightSource=v;await save();}));
    new Setting(c).setName('灯光亮度').addSlider(sl=>sl.setLimits(10,100,1).setValue(s.lightIntensity).setDynamicTooltip().onChange(async v=>{s.lightIntensity=v;await save();}));
    new Setting(c).setName('浮尘粒子').setDesc('在光束中显示轻微漂浮的尘埃。').addToggle(t=>t.setValue(s.dust).onChange(async v=>{s.dust=v;await save();}));
    new Setting(c).setName('机械打字音效').setDesc('离线合成键杆敲击、滚筒回车、擒纵机构、边铃和灯光开关声。').addToggle(t=>t.setValue(s.sound).onChange(async v=>{s.sound=v;if(v)p.audio.unlock();else p.audio.stopTelegraph();await save();}));
    new Setting(c).setName('音量').addSlider(sl=>sl.setLimits(0,100,1).setValue(s.volume).setDynamicTooltip().onChange(async v=>{s.volume=v;await save();}));
    new Setting(c).setName('打字机音色').addDropdown(d=>d.addOption('standard','标准机械').addOption('whisper','柔和机械').addOption('telegraph','电报机').addOption('portable','便携式打字机').addOption('electric','电动打字机').setValue(s.voice).onChange(async v=>{s.voice=v;if(v!=='telegraph')p.audio.stopTelegraph();await save();}));
    new Setting(c).setName('电报码速（WPM）').setDesc('仅在“打字机音色”选择“电报机”时生效（12–40 WPM）。').addSlider(sl=>sl.setLimits(12,40,1).setValue(s.telegraphWpm).setDynamicTooltip().onChange(async v=>{s.telegraphWpm=v;await save();}));
    new Setting(c).setName('连续输入打断电报音').setDesc('开启后，按下新按键会立即中止尚未播完的莫尔斯电码并播报当前按键；关闭则按顺序严格排队播放。').addToggle(t=>t.setValue(s.telegraphInterrupt).onChange(async v=>{s.telegraphInterrupt=v;if(v)p.audio.stopTelegraph();await save();}));
    new Setting(c).setName('当前行聚焦').setDesc('降低非当前行的视觉权重。').addToggle(t=>t.setValue(s.focusLine).onChange(async v=>{s.focusLine=v;await save();}));
    new Setting(c).setName('减少动画').setDesc('关闭滑块脉冲和浮尘动画，保留静态滑轨与声音。').addToggle(t=>t.setValue(s.reducedMotion).onChange(async v=>{s.reducedMotion=v;await save();}));
    c.createEl('h3',{text:'交互命令'});const ul=c.createEl('ul');['切换打字机写作模式','切换滑轨动态灯光','切换机械打字音效','切换当前行聚焦','将光标移回打字机位置'].forEach(x=>ul.createEl('li',{text:x}));c.createEl('p',{text:'可以在 Obsidian → 设置 → 快捷键中为上述命令分配快捷键。',cls:'tn-settings-footnote'});
  }
}

module.exports = TypewriterNocturnePlugin;
