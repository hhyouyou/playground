import { HOOK, HOOK_POSITIONS, WORLD, createRandom } from './game-core.js';
import { getCharacter } from './character-core.js';
import { getItemName } from './design-core.js';

const PLAYER_COLORS = ['#f4c44e', '#79c7df'];

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function drawGold(ctx, item) {
  const random = createRandom(item.seed || 1);
  const points = 10;
  ctx.beginPath();
  for (let index = 0; index < points; index += 1) {
    const angle = (Math.PI * 2 * index) / points;
    const radius = item.radius * (0.78 + random() * 0.22);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * 0.8;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  const gradient = ctx.createLinearGradient(-item.radius, -item.radius, item.radius, item.radius);
  gradient.addColorStop(0, '#fff0a0');
  gradient.addColorStop(0.35, '#f6c443');
  gradient.addColorStop(1, '#c87920');
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = '#9e5d1d';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-item.radius * 0.45, -item.radius * 0.25);
  ctx.lineTo(-item.radius * 0.05, -item.radius * 0.52);
  ctx.lineTo(item.radius * 0.25, -item.radius * 0.3);
  ctx.strokeStyle = 'rgba(255,255,220,.72)';
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawDiamond(ctx, item) {
  const r = item.radius;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * 0.85, -r * 0.28);
  ctx.lineTo(r * 0.55, r * 0.65);
  ctx.lineTo(0, r);
  ctx.lineTo(-r * 0.55, r * 0.65);
  ctx.lineTo(-r * 0.85, -r * 0.28);
  ctx.closePath();
  const gradient = ctx.createLinearGradient(-r, -r, r, r);
  gradient.addColorStop(0, '#e3ffff');
  gradient.addColorStop(0.45, '#70e0df');
  gradient.addColorStop(1, '#258b9a');
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = '#1c6778';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.8, -r * 0.25);
  ctx.lineTo(r * 0.8, -r * 0.25);
  ctx.moveTo(0, -r);
  ctx.lineTo(-r * 0.2, -r * 0.25);
  ctx.lineTo(0, r);
  ctx.lineTo(r * 0.25, -r * 0.25);
  ctx.strokeStyle = 'rgba(255,255,255,.65)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawRock(ctx, item, bone = false) {
  if (bone) {
    ctx.strokeStyle = '#d5c7a5';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-item.radius * 0.65, item.radius * 0.45);
    ctx.lineTo(item.radius * 0.65, -item.radius * 0.45);
    ctx.stroke();
    ctx.fillStyle = '#e4d8b9';
    for (const [x, y] of [[-0.75, 0.35], [-0.55, 0.65], [0.55, -0.65], [0.75, -0.35]]) {
      ctx.beginPath();
      ctx.arc(item.radius * x, item.radius * y, item.radius * 0.27, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  const random = createRandom(item.seed || 2);
  ctx.beginPath();
  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI * 2 * index) / 8;
    const radius = item.radius * (0.8 + random() * 0.2);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * 0.82;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  const gradient = ctx.createLinearGradient(-item.radius, -item.radius, item.radius, item.radius);
  gradient.addColorStop(0, '#b9b6a6');
  gradient.addColorStop(1, '#666a64');
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = '#4e554f';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-item.radius * 0.35, -item.radius * 0.1);
  ctx.lineTo(0, -item.radius * 0.45);
  ctx.lineTo(item.radius * 0.25, -item.radius * 0.15);
  ctx.strokeStyle = 'rgba(235,230,205,.35)';
  ctx.stroke();
}

function drawBag(ctx, item) {
  const r = item.radius;
  ctx.fillStyle = '#a86b3d';
  ctx.strokeStyle = '#684229';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, -r * 0.65);
  ctx.quadraticCurveTo(-r * 1.05, -r * 0.05, -r * 0.72, r * 0.65);
  ctx.quadraticCurveTo(0, r * 1.12, r * 0.72, r * 0.65);
  ctx.quadraticCurveTo(r * 1.05, -r * 0.05, r * 0.3, -r * 0.65);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#d7ae6c';
  ctx.fillRect(-r * 0.43, -r * 0.7, r * 0.86, r * 0.18);
  ctx.fillStyle = '#ffe8a4';
  ctx.font = `800 ${r}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 0, r * 0.2);
}

function drawTnt(ctx, item) {
  const r = item.radius;
  ctx.fillStyle = '#a94134';
  ctx.strokeStyle = '#612c29';
  ctx.lineWidth = 2;
  roundedRect(ctx, -r * 0.75, -r * 0.8, r * 1.5, r * 1.6, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#d7b273';
  ctx.fillRect(-r * 0.82, -r * 0.65, r * 1.64, r * 0.18);
  ctx.fillRect(-r * 0.82, r * 0.48, r * 1.64, r * 0.18);
  ctx.fillStyle = '#fff0c7';
  ctx.font = `900 ${r * 0.55}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TNT', 0, 0);
  ctx.strokeStyle = '#332b25';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.8);
  ctx.quadraticCurveTo(r * 0.1, -r * 1.25, r * 0.5, -r * 1.2);
  ctx.stroke();
  ctx.fillStyle = '#ffd75c';
  ctx.beginPath();
  ctx.arc(r * 0.52, -r * 1.2, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawPig(ctx, item) {
  const r = item.radius;
  ctx.fillStyle = '#e6a2a0';
  ctx.strokeStyle = '#8d5755';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.68, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(r * 0.72, -r * 0.12, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f2bbb0';
  ctx.beginPath();
  ctx.ellipse(r * 1.02, 0, r * 0.22, r * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#714743';
  ctx.beginPath();
  ctx.arc(r * 0.8, -r * 0.28, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8d5755';
  ctx.lineWidth = 4;
  for (const x of [-0.55, 0.35]) {
    ctx.beginPath();
    ctx.moveTo(r * x, r * 0.5);
    ctx.lineTo(r * x, r * 0.9);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(-r * 0.15, -r * 0.1);
  ctx.scale(0.48, 0.48);
  drawDiamond(ctx, { radius: r });
  ctx.restore();
}

function drawItem(ctx, item, alpha = 1) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.rotation || 0);
  ctx.globalAlpha = alpha;
  if (item.kind === 'gold') drawGold(ctx, item);
  else if (item.kind === 'diamond') drawDiamond(ctx, item);
  else if (item.kind === 'rock') drawRock(ctx, item);
  else if (item.kind === 'bone') drawRock(ctx, item, true);
  else if (item.kind === 'bag') drawBag(ctx, item);
  else if (item.kind === 'tnt') drawTnt(ctx, item);
  else if (item.kind === 'pig') drawPig(ctx, item);
  ctx.restore();
}

function drawMiner(ctx, origin, characterId, playerIndex) {
  const character = getCharacter(characterId);
  const p = character.palette;
  ctx.save();
  ctx.translate(origin.x, 145);
  const scale = characterId === 'rocky' ? 1.08 : 1;
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(32,34,25,.22)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 44, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#313b35';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-13, -36);
  ctx.lineTo(-18, -3);
  ctx.moveTo(13, -36);
  ctx.lineTo(18, -3);
  ctx.stroke();
  ctx.fillStyle = p.primary;
  roundedRect(ctx, -31, -91, 62, 60, characterId === 'rocky' ? 17 : 12);
  ctx.fill();
  ctx.fillStyle = p.secondary;
  ctx.fillRect(-29, -51, 58, 19);
  ctx.strokeStyle = p.skin;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(-27, -79);
  ctx.lineTo(-43, -45);
  ctx.moveTo(27, -79);
  ctx.lineTo(43, -48);
  ctx.stroke();
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.arc(0, -112, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3c332b';
  ctx.beginPath();
  ctx.arc(-8, -113, 2.4, 0, Math.PI * 2);
  ctx.arc(8, -113, 2.4, 0, Math.PI * 2);
  ctx.fill();
  if (characterId === 'joe') {
    ctx.fillStyle = '#eee5d1';
    ctx.beginPath();
    ctx.moveTo(-19, -103);
    ctx.quadraticCurveTo(0, -68, 19, -103);
    ctx.quadraticCurveTo(0, -89, -19, -103);
    ctx.fill();
  }
  if (characterId === 'lily') {
    ctx.fillStyle = '#49352e';
    ctx.beginPath();
    ctx.arc(21, -122, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#65d4da';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-18, -119);
    ctx.lineTo(18, -119);
    ctx.stroke();
  }
  ctx.fillStyle = characterId === 'max' ? '#b9473d' : characterId === 'lily' ? '#72538b' : '#76522f';
  ctx.beginPath();
  ctx.ellipse(0, -135, 39, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  roundedRect(ctx, -24, -154, 48, 22, 7);
  ctx.fill();
  ctx.fillStyle = p.accent;
  ctx.fillRect(-23, -139, 46, 5);
  if (characterId === 'max') {
    ctx.fillStyle = '#c74336';
    ctx.fillRect(24, -82, 8, 36);
    ctx.fillStyle = '#e5c795';
    ctx.fillRect(24, -82, 8, 5);
  }
  ctx.fillStyle = '#23382f';
  roundedRect(ctx, -34, -14, 68, 20, 5);
  ctx.fill();
  ctx.strokeStyle = '#d2aa52';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, -5, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = PLAYER_COLORS[playerIndex];
  ctx.font = '800 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`P${playerIndex + 1} · ${character.name}`, 0, -169);
  ctx.restore();
}

function drawReachability(ctx, origins) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, WORLD.surfaceY, WORLD.width, WORLD.height - WORLD.surfaceY);
  ctx.clip();
  for (const origin of origins) {
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.arc(origin.x, origin.y, 1050, Math.PI / 2 - HOOK.safeAngle, Math.PI / 2 + HOOK.safeAngle);
    ctx.closePath();
    ctx.fillStyle = 'rgba(244,206,107,.035)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(244,214,139,.16)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 10]);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

export function drawDesignScene(canvas, analysis, selectedItemId = null) {
  const ctx = canvas.getContext('2d');
  const displayWidth = canvas.getBoundingClientRect().width || WORLD.width;
  const ratio = Math.max(0.5, Math.min(2, (displayWidth / WORLD.width) * (window.devicePixelRatio || 1)));
  const width = Math.round(WORLD.width * ratio);
  const height = Math.round(WORLD.height * ratio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, WORLD.width, WORLD.height);

  const sky = ctx.createLinearGradient(0, 0, 0, WORLD.surfaceY);
  sky.addColorStop(0, '#f4d99b');
  sky.addColorStop(1, '#d7a663');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD.width, WORLD.surfaceY);
  ctx.fillStyle = '#b67d4f';
  ctx.beginPath();
  ctx.moveTo(0, 112);
  ctx.lineTo(105, 55);
  ctx.lineTo(210, 112);
  ctx.lineTo(350, 42);
  ctx.lineTo(520, 115);
  ctx.lineTo(710, 48);
  ctx.lineTo(870, 112);
  ctx.lineTo(1000, 66);
  ctx.lineTo(1000, 154);
  ctx.lineTo(0, 154);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#815037';
  ctx.fillRect(0, WORLD.surfaceY, WORLD.width, WORLD.height - WORLD.surfaceY);
  const soil = ctx.createLinearGradient(0, WORLD.surfaceY, 0, WORLD.height);
  soil.addColorStop(0, '#825239');
  soil.addColorStop(0.55, '#5e3c31');
  soil.addColorStop(1, '#392c2a');
  ctx.fillStyle = soil;
  ctx.fillRect(0, WORLD.surfaceY, WORLD.width, WORLD.height - WORLD.surfaceY);
  ctx.fillStyle = '#b57d49';
  ctx.fillRect(0, WORLD.surfaceY - 5, WORLD.width, 12);
  ctx.strokeStyle = 'rgba(239,202,133,.075)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= WORLD.width; x += 50) {
    ctx.beginPath(); ctx.moveTo(x, WORLD.surfaceY); ctx.lineTo(x, WORLD.height); ctx.stroke();
  }
  for (let y = 200; y <= WORLD.height; y += 50) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.width, y); ctx.stroke();
  }
  drawReachability(ctx, analysis.config.playerCount === 2 ? HOOK_POSITIONS.double : HOOK_POSITIONS.single);

  const featured = [...analysis.route].sort((a, b) => b.incomePerMinute - a.incomePerMinute).slice(0, 6);
  const featuredIds = new Set(featured.map((step) => step.itemId));
  const routeById = new Map(analysis.route.map((step) => [step.itemId, step]));
  ctx.lineWidth = 2;
  for (const step of featured) {
    ctx.strokeStyle = PLAYER_COLORS[step.playerIndex];
    ctx.globalAlpha = 0.58;
    ctx.setLineDash([7, 7]);
    ctx.beginPath();
    ctx.moveTo(step.origin.x, step.origin.y);
    ctx.lineTo(step.x, step.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  for (const item of analysis.resources.items) {
    const route = routeById.get(item.id);
    drawItem(ctx, item, route || item.kind === 'tnt' ? 1 : 0.42);
    if (route) {
      ctx.fillStyle = PLAYER_COLORS[route.playerIndex];
      ctx.beginPath();
      ctx.arc(item.x + item.radius * 0.65, item.y - item.radius * 0.65, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (featuredIds.has(item.id)) {
      const step = routeById.get(item.id);
      const label = `P${step.playerIndex + 1}·${step.playerRank}`;
      ctx.font = '800 10px sans-serif';
      const width = ctx.measureText(label).width + 12;
      roundedRect(ctx, item.x - width / 2, item.y - item.radius - 24, width, 17, 8);
      ctx.fillStyle = PLAYER_COLORS[step.playerIndex];
      ctx.fill();
      ctx.fillStyle = '#293a32';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, item.x, item.y - item.radius - 15.5);
    }
    if (item.id === selectedItemId) {
      ctx.strokeStyle = '#fff6ce';
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  const origins = analysis.config.playerCount === 2 ? HOOK_POSITIONS.double : HOOK_POSITIONS.single;
  origins.forEach((origin, index) => {
    ctx.strokeStyle = '#2c302b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(origin.x + Math.sin(index === 0 ? -0.35 : 0.35) * 75, origin.y + Math.cos(0.35) * 75);
    ctx.stroke();
    drawMiner(ctx, origin, analysis.config.characterIds[index], index);
  });

  ctx.fillStyle = 'rgba(32,43,36,.82)';
  roundedRect(ctx, 16, 16, 245, 37, 8);
  ctx.fill();
  ctx.fillStyle = '#f5d276';
  ctx.font = '800 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`LEVEL ${String(analysis.level).padStart(2, '0')} · LIVE RULE SNAPSHOT`, 29, 30);
  ctx.fillStyle = '#d6ddce';
  ctx.font = '600 9px sans-serif';
  ctx.fillText('虚线为高效路线 · 点击矿物查看计算', 29, 44);
  canvas.setAttribute('aria-label', `第 ${analysis.level} 关数值矿区，共 ${analysis.resources.itemCount} 件矿物，推荐回收 ${analysis.route.length} 件。点击矿物可查看收益。`);
}

export function findDesignItem(canvas, analysis, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * WORLD.width;
  const y = ((clientY - rect.top) / rect.height) * WORLD.height;
  return [...analysis.resources.items].reverse().find((item) => Math.hypot(item.x - x, item.y - y) <= Math.max(22, item.radius + 8)) || null;
}

export function describeDesignItem(item) {
  return `${getItemName(item)}，坐标 ${Math.round(item.x)}, ${Math.round(item.y)}`;
}
