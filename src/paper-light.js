// Adapted from Typewriter Nocturne's MIT-licensed paper-light.ts.
const VERTEX = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const NOISE = `
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
`;

const SURFACE = `#version 300 es
precision highp float;
uniform vec2 uSize; uniform vec2 uPaperSize; uniform vec2 uPaperOrigin; uniform float uScale; uniform float uSeed; uniform float uFold; uniform float uFelt;
uniform float uAge; uniform float uMottle; uniform float uCrinkle; uniform float uLaid; uniform float uLinen;
layout(location = 0) out vec4 outAlbedo;
layout(location = 1) out vec4 outNormal;
${NOISE}
const mat2 TURN = mat2(0.8, -0.6, 0.6, 0.8);
float relief(vec2 p) {
  vec2 w = vec2(fbm(p * 0.012 + uSeed), fbm(p * 0.012 + uSeed + 9.2));
  float veins = 1.0 - abs(fbm(p * 0.02 + w * 3.0) * 2.0 - 1.0);
  float r = 0.35 * pow(veins, 6.0) + 0.35 * noise(p * vec2(0.6, 0.18)) + 0.3 * noise(p * 1.9);
  if (uFelt > 0.0) {
    vec2 q = TURN * p;
    float tooth = 0.62 * noise(q * 0.45) + 0.38 * noise(TURN * q * 0.95 + 5.3);
    float felt = 0.7 * tooth + 0.2 * noise(q * 0.11 + 2.1) + 0.1 * noise(q * vec2(0.5, 0.12));
    r = mix(r, felt, uFelt);
  }
  float laidLines = 0.5 + 0.5 * sin(p.y * 6.2831 / 4.2);
  float chain = exp(-pow((mod(p.x, 96.0) - 48.0) / 3.2, 2.0));
  r = mix(r, r * 0.6 + laidLines * 0.18 + chain * 0.35, uLaid);
  float weave = 0.5 + 0.5 * sin(p.x * 6.2831 / 3.4) * sin(p.y * 6.2831 / 3.4);
  float slub = noise(p * vec2(0.07, 1.3));
  return mix(r, r * 0.3 + weave * 0.5 + slub * 0.35, uLinen);
}
vec3 albedo(vec2 p) {
  vec2 uv = p / uPaperSize;
  float mottle = fbm(p * 0.006 + uSeed) * 0.65 + fbm(p * 0.022 + uSeed * 2.0) * 0.35;
  vec3 tint = mix(vec3(1.0, 0.985, 0.95), vec3(0.86, 0.74, 0.55), smoothstep(0.35, 0.8, mottle) * 0.85);
  vec3 base = mix(vec3(1.0), tint, uMottle);
  vec3 tone = vec3(1.0);
  float edge = min(min(uv.x, 1.0 - uv.x) * uPaperSize.x, uv.y * uPaperSize.y);
  float ragged = edge + (fbm(p * 0.05 + 3.0) - 0.5) * 26.0;
  tone *= mix(vec3(1.0), vec3(0.62, 0.45, 0.28), (1.0 - smoothstep(0.0, 46.0, ragged)) * 0.85);
  vec2 cell = floor(p / 70.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 c = cell + vec2(float(i), float(j));
      if (hash12(c + uSeed) > 0.16) continue;
      vec2 centre = (c + vec2(hash12(c + 1.7), hash12(c + 4.1))) * 70.0;
      float radius = mix(1.5, 6.5, hash12(c + 8.3));
      float spot = 1.0 - smoothstep(radius * 0.4, radius * 2.4, length(p - centre));
      tone *= mix(vec3(1.0), vec3(0.8, 0.62, 0.45), spot * 0.7);
    }
  }
  float tide = 1.0 - smoothstep(0.0, 0.015, abs(fbm(p * 0.004 + uSeed + 31.0) - 0.58));
  tone *= mix(vec3(1.0), vec3(0.82, 0.7, 0.52), tide * 0.35);
  float fold = (p.y - uFold) / 2.5;
  tone *= 1.0 - 0.08 * exp(-fold * fold) + 0.03 * exp(-(fold - 2.2) * (fold - 2.2));
  float chainTone = exp(-pow((mod(p.x, 96.0) - 48.0) / 3.2, 2.0));
  base *= 1.0 - uLaid * (0.03 * chainTone + 0.005 * (0.5 + 0.5 * sin(p.y * 6.2831 / 4.2)));
  base *= 1.0 - uLinen * 0.02 * (0.5 + 0.5 * sin(p.x * 6.2831 / 3.4) * sin(p.y * 6.2831 / 3.4));
  if (uFelt > 0.0) {
    vec2 q = TURN * p;
    float threads = smoothstep(0.86, 0.97, noise(q * vec2(0.06, 1.1) + uSeed));
    threads += smoothstep(0.86, 0.97, noise(TURN * q * vec2(1.1, 0.06) + 3.0));
    base *= 1.0 - uFelt * 0.035 * min(1.0, threads);
  }
  return base * mix(vec3(1.0), tone, uAge);
}
void main() {
  vec2 screen = vec2(gl_FragCoord.x, uSize.y * uScale - gl_FragCoord.y) / uScale;
  vec2 p = screen - uPaperOrigin;
  float e = 0.9;
  float h0 = relief(p);
  float slope = 1.2 + 3.0 * uCrinkle;
  vec3 n = normalize(vec3(-(relief(p + vec2(e, 0.0)) - h0) * slope, -(relief(p + vec2(0.0, e)) - h0) * slope, 1.0));
  outAlbedo = vec4(albedo(p), 1.0);
  outNormal = vec4(n.xy * 0.5 + 0.5, 0.0, 1.0);
}`;

const LIGHT = `#version 300 es
precision highp float;
uniform sampler2D uAlbedo; uniform sampler2D uNormal;
uniform vec2 uSize; uniform vec2 uPaperSize; uniform vec4 uPaperRect; uniform float uScale; uniform int uSource;
uniform vec3 uLightPos; uniform vec3 uLightDir; uniform vec2 uCone; uniform float uExposure;
uniform vec4 uWindow; uniform vec4 uPanes; uniform vec3 uTint; uniform float uLamp;
uniform float uAmbient; uniform vec3 uAmbientTint; uniform float uRelief; uniform float uCrinkle;
uniform float uGrain; uniform float uTime; uniform float uSoft;
out vec4 outColor;
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float between(float offset, float cell, float bar, float soft) {
  float t = offset / cell;
  return smoothstep(bar - soft, bar + soft, abs(t - round(t)) * cell);
}
float gobo(vec2 p) {
  float soft = max(0.5, uPanes.z);
  p.x -= (p.y - uWindow.y) * uPanes.w;
  vec2 d = p - uWindow.xy;
  vec2 inside = smoothstep(-soft, soft, uWindow.zw * 0.5 - abs(d));
  vec2 pane = uWindow.zw / uPanes.xy;
  float bar = clamp(0.04 * min(pane.x, pane.y), 4.0, 16.0);
  float open = between(d.x + uWindow.z * 0.5, pane.x, bar, soft) * between(d.y + uWindow.w * 0.5, pane.y, bar, soft);
  return inside.x * inside.y * (0.3 + 0.7 * open);
}
const float BULB = 30.0;
float irradiance(vec3 P, vec3 n) {
  if (uSource == 2) return max(0.0, dot(n, -uLightDir)) * gobo(P.xy);
  vec3 d = P - uLightPos; float d2 = max(1.0, dot(d, d)); vec3 r = d * inversesqrt(d2);
  float near = uSoft * (1.0 - smoothstep(0.0, 260.0, sqrt(d2)));
  float cone = smoothstep(uCone.x - 0.3 * near, uCone.y, dot(r, uLightDir));
  return cone * max(0.0, -dot(n, r)) / (d2 + uSoft * BULB * BULB);
}
void main() {
  vec2 screen = vec2(gl_FragCoord.x, uSize.y * uScale - gl_FragCoord.y) / uScale;
  vec2 p = screen - uPaperRect.xy;
  ivec2 texel = ivec2(gl_FragCoord.xy);
  vec3 albedo = texelFetch(uAlbedo, texel, 0).rgb;
  vec2 nxy = texelFetch(uNormal, texel, 0).xy * 2.0 - 1.0;
  float lit = (1.0 - exp(-irradiance(vec3(p, 0.0), vec3(0.0, 0.0, 1.0)) * uExposure)) * uLamp;
  vec2 uv = p / uPaperSize;
  float vignette = smoothstep(0.15, 1.1, length((uv - vec2(0.5, 0.55)) * vec2(1.0, 1.15)));
  float ambient = mix(1.0, uAmbient * (1.0 - 0.3 * vignette), uLamp);
  vec3 irr = uAmbientTint * ambient + (1.0 - ambient) * lit * uTint;
  float relief = uRelief * (1.0 - 0.4 * lit);
  float bound = (0.16 * uCrinkle + 0.04) * relief;
  irr *= clamp(1.0 + (-nxy.x * 0.35 - nxy.y * 0.55) * (0.6 + 2.2 * uCrinkle) * relief, 1.0 - bound, 1.0 + bound);
  irr *= mix(0.9, 1.0, smoothstep(0.0, 28.0, min(uv.x, 1.0 - uv.x) * uPaperSize.x));
  float g = hash12(gl_FragCoord.xy + fract(uTime * 7.31) * 113.0) - 0.5;
  float inside = step(uPaperRect.x, screen.x) * step(uPaperRect.y, screen.y) *
    step(screen.x, uPaperRect.x + uPaperRect.z) * step(screen.y, uPaperRect.y + uPaperRect.w);
  outColor = vec4(clamp(albedo * irr + g * (uGrain * 0.045 + 1.5 / 255.0), 0.0, 1.0), inside);
}`;

const SURFACE_UNIFORMS = ['uSize', 'uPaperSize', 'uPaperOrigin', 'uScale', 'uSeed', 'uFold', 'uFelt', 'uAge', 'uMottle', 'uCrinkle', 'uLaid', 'uLinen'];
const LIGHT_UNIFORMS = ['uAlbedo', 'uNormal', 'uSize', 'uPaperSize', 'uPaperRect', 'uScale', 'uSource', 'uLightPos', 'uLightDir', 'uCone', 'uExposure', 'uWindow', 'uPanes', 'uTint', 'uLamp', 'uAmbient', 'uAmbientTint', 'uRelief', 'uCrinkle', 'uGrain', 'uTime', 'uSoft'];
const SOURCE_INDEX = {carriage: 0, 'desk-lamp': 1, moonlight: 2};

function compileProgram(gl, fragmentSource) {
  const program = gl.createProgram();
  if (!program) throw new Error('Could not create a WebGL program.');
  const shaders = [];
  try {
    for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, fragmentSource]]) {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('Could not create a WebGL shader.');
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
      shaders.push(shader);
    }
    gl.bindAttribLocation(program, 0, 'aPos');
    gl.linkProgram(program);
    return {program, shaders};
  } catch (error) {
    shaders.forEach(shader => gl.deleteShader(shader));
    gl.deleteProgram(program);
    throw error;
  }
}

function uniforms(gl, program, names) {
  return Object.fromEntries(names.map(name => [name, gl.getUniformLocation(program, name)]));
}

class PaperLight {
  static create(canvas, onReady) {
    const gl = canvas.getContext('webgl2', {alpha: true, premultipliedAlpha: false, antialias: false});
    if (!gl) {
      console.warn('Typewriter Nocturne paper lighting requires WebGL 2; using the plain paper colour.');
      return null;
    }
    try {
      return new PaperLight(canvas, gl, onReady);
    } catch (error) {
      console.warn('Paper lighting disabled:', error.message);
      return null;
    }
  }

  constructor(canvas, gl, onReady) {
    this.canvas = canvas;
    this.gl = gl;
    this.onReady = onReady;
    this.state = 'compiling';
    this.pending = null;
    this.textures = [];
    this.framebuffer = null;
    this.spec = null;
    this.pollTimer = 0;
    this.parallel = gl.getExtension('KHR_parallel_shader_compile');
    this.handleContextLost = event => {
      event.preventDefault();
      this.state = 'lost';
      console.warn('Typewriter Nocturne paper lighting paused: the WebGL context was lost.');
    };
    this.handleContextRestored = () => {
      try {
        this.initialize();
      } catch (error) {
        this.state = 'failed';
        console.warn('Paper lighting could not recover its WebGL context:', error.message);
      }
    };
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
    try {
      this.initialize();
    } catch (error) {
      canvas.removeEventListener('webglcontextlost', this.handleContextLost);
      canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
      throw error;
    }
  }

  initialize() {
    const gl = this.gl;
    window.clearTimeout(this.pollTimer);
    this.pending = this.spec || this.pending;
    this.spec = null;
    this.state = 'compiling';
    const surface = compileProgram(gl, SURFACE);
    const light = compileProgram(gl, LIGHT);
    this.surfaceProgram = surface.program;
    this.lightProgram = light.program;
    this.shaders = surface.shaders.concat(light.shaders);
    this.vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    if (!this.vao || !buffer) throw new Error('Could not allocate WebGL paper geometry.');
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.buffer = buffer;
    this.poll();
  }

  poll() {
    const gl = this.gl;
    if (this.parallel) {
      const complete = [this.surfaceProgram, this.lightProgram].every(program =>
        gl.getProgramParameter(program, this.parallel.COMPLETION_STATUS_KHR) === true);
      if (!complete) {
        this.pollTimer = window.setTimeout(() => this.poll(), 32);
        return;
      }
    }
    for (const program of [this.surfaceProgram, this.lightProgram]) {
      const shaders = gl.getAttachedShaders(program) || [];
      const shaderError = shaders.map(shader => gl.getShaderInfoLog(shader)).filter(Boolean).join('\n');
      if (!gl.getProgramParameter(program, gl.LINK_STATUS) || shaders.some(shader => !gl.getShaderParameter(shader, gl.COMPILE_STATUS))) {
        this.state = 'failed';
        console.warn('Paper lighting disabled:', gl.getProgramInfoLog(program) || shaderError || 'WebGL program linking failed.');
        return;
      }
    }
    this.surfaceUniforms = uniforms(gl, this.surfaceProgram, SURFACE_UNIFORMS);
    this.lightUniforms = uniforms(gl, this.lightProgram, LIGHT_UNIFORMS);
    this.state = 'ready';
    if (this.pending) {
      try {
        this.build(this.pending);
      } catch (error) {
        console.error('Typewriter Nocturne: paper surface could not be built; using the plain paper colour.', error);
      }
    }
    this.onReady();
  }

  build(spec) {
    if (this.state !== 'ready') {
      this.pending = spec;
      return;
    }
    const gl = this.gl;
    this.pending = null;
    this.spec = spec;
    const width = Math.max(1, Math.round(spec.width * spec.pixelRatio));
    const height = Math.max(1, Math.round(spec.height * spec.pixelRatio));
    this.canvas.width = width;
    this.canvas.height = height;
    this.releaseTargets();
    try {
      const framebuffer = gl.createFramebuffer();
      if (!framebuffer) throw new Error('Could not create the paper surface framebuffer.');
      this.framebuffer = framebuffer;
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      for (let i = 0; i < 2; i++) {
        const texture = gl.createTexture();
        if (!texture) throw new Error('Could not create a paper surface texture.');
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, texture, 0);
        this.textures.push(texture);
      }
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error('The WebGL paper surface framebuffer is incomplete.');
      }
      const u = this.surfaceUniforms;
      const rect = spec.rect;
      const surface = spec.paper.surface;
      gl.bindVertexArray(this.vao);
      gl.useProgram(this.surfaceProgram);
      gl.viewport(0, 0, width, height);
      gl.uniform2f(u.uSize, spec.width, spec.height);
      gl.uniform2f(u.uPaperSize, rect.width, rect.height);
      gl.uniform2f(u.uPaperOrigin, rect.x, rect.y);
      gl.uniform1f(u.uScale, spec.pixelRatio);
      gl.uniform1f(u.uSeed, 3.7);
      gl.uniform1f(u.uFold, rect.height * 0.38);
      gl.uniform1f(u.uFelt, surface.felt);
      gl.uniform1f(u.uAge, surface.age);
      gl.uniform1f(u.uMottle, surface.mottle);
      gl.uniform1f(u.uCrinkle, surface.crinkle * spec.texture);
      gl.uniform1f(u.uLaid, surface.laid * Math.min(1, spec.texture));
      gl.uniform1f(u.uLinen, surface.linen * Math.min(1, spec.texture));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    } catch (error) {
      this.state = 'failed';
      this.spec = null;
      this.releaseTargets();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.canvas.width = 1;
      this.canvas.height = 1;
      throw error;
    }
  }

  render(frame) {
    const gl = this.gl;
    const spec = this.spec;
    if (!spec || !this.lightUniforms || this.state !== 'ready' || gl.isContextLost()) return;
    const u = this.lightUniforms;
    const rig = frame.rig;
    gl.bindVertexArray(this.vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.drawBuffers([gl.BACK]);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.lightProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[0]);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[1]);
    gl.uniform1i(u.uAlbedo, 0);
    gl.uniform1i(u.uNormal, 1);
    gl.uniform2f(u.uSize, spec.width, spec.height);
    gl.uniform2f(u.uPaperSize, spec.rect.width, spec.rect.height);
    gl.uniform4f(u.uPaperRect, spec.rect.x, spec.rect.y, spec.rect.width, spec.rect.height);
    gl.uniform1f(u.uScale, spec.pixelRatio);
    gl.uniform1i(u.uSource, SOURCE_INDEX[rig.source]);
    gl.uniform3fv(u.uLightPos, rig.position);
    gl.uniform3fv(u.uLightDir, rig.direction);
    gl.uniform2f(u.uCone, rig.cosOuter, rig.cosInner);
    gl.uniform1f(u.uExposure, rig.exposure);
    gl.uniform4f(u.uWindow, rig.window.x, rig.window.y, rig.window.width, rig.window.height);
    gl.uniform4f(u.uPanes, rig.window.columns, rig.window.rows, rig.window.softness, rig.window.skew);
    const peak = Math.max(frame.tint[0], frame.tint[1], frame.tint[2], 1e-6);
    gl.uniform3f(u.uTint, frame.tint[0] / peak, frame.tint[1] / peak, frame.tint[2] / peak);
    gl.uniform1f(u.uLamp, frame.lamp ? 1 : 0);
    gl.uniform1f(u.uAmbient, frame.ambient);
    gl.uniform3fv(u.uAmbientTint, frame.ambientTint);
    gl.uniform1f(u.uRelief, frame.relief);
    gl.uniform1f(u.uSoft, frame.soft ? 1 : 0);
    gl.uniform1f(u.uCrinkle, spec.paper.surface.crinkle * spec.texture);
    gl.uniform1f(u.uGrain, frame.grain);
    gl.uniform1f(u.uTime, frame.time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  releaseTargets() {
    const gl = this.gl;
    this.textures.forEach(texture => gl.deleteTexture(texture));
    this.textures = [];
    if (this.framebuffer) gl.deleteFramebuffer(this.framebuffer);
    this.framebuffer = null;
  }

  dispose() {
    window.clearTimeout(this.pollTimer);
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    if (!this.gl.isContextLost()) {
      this.releaseTargets();
      this.shaders.forEach(shader => this.gl.deleteShader(shader));
      this.gl.deleteProgram(this.surfaceProgram);
      this.gl.deleteProgram(this.lightProgram);
      this.gl.deleteBuffer(this.buffer);
      this.gl.deleteVertexArray(this.vao);
    }
  }

}

module.exports = {PaperLight};
