const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function normalize(vector) {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function smoothstep(edge0, edge1, value) {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function spreadToCosine(degrees) {
  const halfAngle = clamp(degrees, 5, 170) * Math.PI / 360;
  return Math.cos(halfAngle);
}

function barHalfWidth(paneWidth, paneHeight) {
  return Math.min(16, Math.max(4, .04 * Math.min(paneWidth, paneHeight)));
}

function between(offset, cell, bar, softness) {
  const fromBar = Math.abs(offset / cell - Math.round(offset / cell)) * cell;
  return smoothstep(bar - softness, bar + softness, fromBar);
}

function windowGobo(rig, x, y) {
  const win = rig.window;
  const softness = Math.max(.5, win.softness);
  const sx = x - (y - win.y) * win.skew;
  const dx = sx - win.x;
  const dy = y - win.y;
  const across = smoothstep(-softness, softness, win.width / 2 - Math.abs(dx));
  const down = smoothstep(-softness, softness, win.height / 2 - Math.abs(dy));
  const paneWidth = win.width / win.columns;
  const paneHeight = win.height / win.rows;
  const bar = barHalfWidth(paneWidth, paneHeight);
  const open = between(dx + win.width / 2, paneWidth, bar, softness) *
    between(dy + win.height / 2, paneHeight, bar, softness);
  return across * down * (.3 + .7 * open);
}

function irradiance(rig, x, y, normal = [0, 0, 1]) {
  if (rig.source === 'moonlight') {
    return Math.max(0, dot(normal, rig.direction.map(value => -value))) * windowGobo(rig, x, y);
  }
  const toPoint = [x - rig.position[0], y - rig.position[1], -rig.position[2]];
  const distanceSquared = Math.max(1, dot(toPoint, toPoint));
  const ray = normalize(toPoint);
  const cone = smoothstep(rig.cosOuter, rig.cosInner, dot(ray, rig.direction));
  const lambert = Math.max(0, -dot(normal, ray));
  return cone * lambert / distanceSquared;
}

const toneMap = value => 1 - Math.exp(-Math.max(0, value));
const lightAmount = (rig, x, y, normal) => toneMap(irradiance(rig, x, y, normal) * rig.exposure);

function buildRig(settings, theme, sheet) {
  const source = settings.source === 'theme' ? theme.light.source : settings.source;
  const {width, height} = sheet;
  const halfAngle = Math.acos(spreadToCosine(settings.spread));
  const cosOuter = Math.cos(halfAngle);
  const cosInner = Math.cos(halfAngle * (1 - .85 * settings.softness));
  const position = settings.source === 'theme' ? theme.light.position : settings.position;
  const base = {
    source,
    position: [0, 0, 1],
    direction: [0, 0, -1],
    cosOuter,
    cosInner,
    exposure: 1,
    window: {x: width / 2, y: height / 2, width, height, columns: 3, rows: 2, softness: 8, skew: 0}
  };
  const swivel = clamp(settings.aim, -45, 45) * Math.PI / 180;
  let rig;
  let referenceIrradiance;

  if (source === 'carriage') {
    const lamp = [sheet.headX, sheet.railY, 12 + .02 * height];
    const throwLength = .6 * settings.reach * height;
    const aim = [sheet.headX + Math.tan(swivel) * throwLength, sheet.railY - throwLength, 0];
    rig = {...base, position: lamp, direction: normalize([aim[0] - lamp[0], aim[1] - lamp[1], aim[2] - lamp[2]])};
    const referenceLength = .5 * settings.reach * height;
    const reference = [sheet.headX + Math.tan(swivel) * referenceLength, sheet.railY - referenceLength];
    referenceIrradiance = irradiance(rig, reference[0], reference[1]);
  } else if (source === 'desk-lamp') {
    const lamp = [position.x * width, position.y * height, (.3 + .4 * settings.reach) * height];
    const dx = width * .5 - lamp[0];
    const dy = height * .55 - lamp[1];
    const cos = Math.cos(swivel);
    const sin = Math.sin(swivel);
    const aim = [lamp[0] + dx * cos - dy * sin, lamp[1] + dx * sin + dy * cos, 0];
    rig = {...base, position: lamp, direction: normalize([aim[0] - lamp[0], aim[1] - lamp[1], aim[2] - lamp[2]])};
    referenceIrradiance = irradiance(rig, aim[0], aim[1]);
  } else {
    const azimuth = Math.atan2(.5 - position.y, .5 - position.x) + swivel;
    const elevation = 40 * Math.PI / 180;
    const direction = normalize([
      Math.cos(azimuth) * Math.cos(elevation),
      Math.sin(azimuth) * Math.cos(elevation),
      -Math.sin(elevation)
    ]);
    const frame = settings.window;
    const pane = Math.max(60, Math.min(width * .62, height * .7) * settings.reach / 2);
    rig = {
      ...base,
      direction,
      window: {
        x: width * frame.x,
        y: height * frame.y,
        width: pane * frame.columns,
        height: pane * frame.rows,
        columns: frame.columns,
        rows: frame.rows,
        softness: 4 + 40 * settings.softness,
        skew: Math.tan(clamp(frame.slant, -35, 35) * Math.PI / 180)
      }
    };
    referenceIrradiance = Math.max(0, -direction[2]);
  }

  return {...rig, exposure: referenceIrradiance > 0 ? settings.intensity / referenceIrradiance : 0};
}

function toUnit(color) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
  if (!match) return [1, 1, 1];
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)].map(value => value / 255);
}

function linear(value) {
  return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
}

function luminance(rgb) {
  return .2126 * linear(rgb[0]) + .7152 * linear(rgb[1]) + .0722 * linear(rgb[2]);
}

function contrastRatio(ink, paper, factor) {
  const a = luminance(ink.map(channel => channel * factor));
  const b = luminance(paper.map(channel => channel * factor));
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

function ambientFloor(ink, paper, minRatio) {
  const target = Math.min(minRatio, contrastRatio(ink, paper, 1));
  if (contrastRatio(ink, paper, 0) >= target) return 0;
  let low = 0;
  let high = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2;
    if (contrastRatio(ink, paper, mid) >= target) high = mid;
    else low = mid;
  }
  return high;
}

module.exports = {ambientFloor, buildRig, lightAmount, toUnit};
