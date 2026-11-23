import { DIFFICULTIES, SHOP_CATALOG } from './game-core.js';
import { CHARACTERS, MISSIONS, getCharacter, getMission, getWeightClass } from './character-core.js';
import {
  DEFAULT_DESIGN_CONFIG,
  DESIGN_STORAGE_KEY,
  SIMULATION,
  analyzeLevel,
  compareCharacters,
  compareMissions,
  comparePlayerCounts,
  createDesignExport,
  getBagProfile,
  getItemName,
  getLevelCurve,
  getRetrievalStats,
  getShopInsights,
  normalizeDesignConfig,
  parseDesignImport,
} from './design-core.js';
import { drawDesignScene, findDesignItem } from './design-scene.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const ITEM_ICONS = Object.freeze({ gold: '🪙', diamond: '💎', rock: '🪨', bag: '💰', bone: '🦴', tnt: '🧨', pig: '🐷' });
const CHARACTER_ICONS = Object.freeze({ joe: '🤠', rocky: '🧔🏻', lily: '👩🏻‍🔧', max: '🧑🏻‍🚒' });
const BUFF_LABELS = Object.freeze({ strength: '🥤 大力', clover: '🍀 幸运', diamond: '💎 鉴定', rock: '📕 收岩' });
const WEIGHT_LABELS = Object.freeze({ light: '轻量', medium: '中等', heavy: '重物', extreme: '超重' });

let restoredSavedConfig = false;
let config = loadInitialConfig();
let analysis = null;
let selectedItemId = null;
let renderQueued = false;
let saveMessage = restoredSavedConfig ? '已载入本机保存的测绘单' : '配置尚未保存';

function money(value, digits = 0) {
  return `$${Number(value).toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function compactMoney(value) {
  if (value >= 1000) return `$${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return money(value);
}

function seconds(value) {
  return `${Number(value).toFixed(value >= 10 ? 1 : 2)} 秒`;
}

function loadInitialConfig() {
  try {
    const saved = localStorage.getItem(DESIGN_STORAGE_KEY);
    restoredSavedConfig = Boolean(saved);
    return saved ? parseDesignImport(saved) : normalizeDesignConfig(DEFAULT_DESIGN_CONFIG);
  } catch {
    restoredSavedConfig = false;
    return normalizeDesignConfig(DEFAULT_DESIGN_CONFIG);
  }
}

function announce(message) {
  $('#designLiveRegion').textContent = message;
}

function markDirty(message = '有未保存的实验修改') {
  saveMessage = message;
  $('#saveStatus').textContent = message;
}

function scheduleRender(message) {
  config = normalizeDesignConfig(config);
  markDirty();
  if (message) announce(message);
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderAll();
  });
}

function buildStaticControls() {
  $('#difficultyControls').innerHTML = Object.values(DIFFICULTIES).map((difficulty) => `
    <button class="mini-landscape ${difficulty.id}" type="button" data-design-difficulty="${difficulty.id}">
      <span class="mini-landscape-scene" aria-hidden="true">${difficulty.icon}</span>
      <b>${difficulty.name}</b><small>${'★'.repeat(difficulty.stars)}${'☆'.repeat(3 - difficulty.stars)}</small><em>目标 ×${difficulty.goalFactor}</em>
    </button>`).join('');
  $('#missionControls').innerHTML = Object.values(MISSIONS).map((mission) => `
    <button class="contract-stamp" type="button" data-design-mission="${mission.id}">
      <span aria-hidden="true">${mission.icon}</span><span><b>${mission.name}</b><small>${mission.subtitle}</small></span><em>目标 ×${mission.goalFactor}</em>
    </button>`).join('');

  $$('[data-player-count]').forEach((button) => button.addEventListener('click', () => {
    config.playerCount = Number(button.dataset.playerCount);
    selectedItemId = null;
    scheduleRender(`已切换${config.playerCount === 2 ? '双人协作' : '单人'}模拟`);
  }));
  $$('[data-design-difficulty]').forEach((button) => button.addEventListener('click', () => {
    config.difficultyId = button.dataset.designDifficulty;
    selectedItemId = null;
    scheduleRender(`已切换${DIFFICULTIES[config.difficultyId].name}难度`);
  }));
  $$('[data-design-mission]').forEach((button) => button.addEventListener('click', () => {
    config.missionId = button.dataset.designMission;
    selectedItemId = null;
    scheduleRender(`已切换${getMission(config.missionId).name}`);
  }));
  $('#levelInput').addEventListener('input', (event) => {
    config.level = Number(event.target.value);
    selectedItemId = null;
    scheduleRender(`测绘第 ${config.level} 关`);
  });
  $('#curveLevelsInput').addEventListener('change', (event) => {
    config.curveLevels = Number(event.target.value);
    scheduleRender();
  });
  $$('[data-tuning]').forEach((input) => input.addEventListener('input', () => {
    config.tuning[input.dataset.tuning] = Number(input.value);
    scheduleRender();
  }));
  $('#goalChart').addEventListener('click', (event) => {
    const target = event.target.closest('[data-chart-level]');
    if (!target) return;
    config.level = Number(target.dataset.chartLevel);
    selectedItemId = null;
    scheduleRender(`图表选择第 ${config.level} 关`);
  });
}

function renderLoadouts() {
  $('#playerLoadouts').innerHTML = Array.from({ length: config.playerCount }, (_, playerIndex) => {
    const character = getCharacter(config.characterIds[playerIndex]);
    return `<section class="loadout-card p${playerIndex + 1}" data-loadout-player="${playerIndex}">
      <div class="loadout-header"><b>P${playerIndex + 1} · ${character.name}</b><span>🧨 初始 ${character.id === 'max' ? 3 : 2}</span></div>
      <div class="character-chips">${Object.values(CHARACTERS).map((entry) => `<button type="button" class="character-chip ${entry.id === character.id ? 'selected' : ''}" style="--character-color:${entry.color}" data-design-character="${entry.id}" data-player-index="${playerIndex}" title="${entry.passive}"><span aria-hidden="true">${CHARACTER_ICONS[entry.id]}</span>${entry.name}</button>`).join('')}</div>
      <p class="loadout-passive">${character.passive}</p>
      <div class="loadout-tools"><span class="hourglass-stepper">⏳ <button type="button" data-hourglass-delta="-1" data-player-index="${playerIndex}" aria-label="减少 P${playerIndex + 1} 沙漏">−</button><b>${config.hourglasses[playerIndex]}</b><button type="button" data-hourglass-delta="1" data-player-index="${playerIndex}" aria-label="增加 P${playerIndex + 1} 沙漏">+</button></span><span class="hourglass-stepper">共享 +${config.hourglasses[playerIndex] * SIMULATION.hourglassSeconds}s</span></div>
      <div class="buff-toggles">${Object.entries(BUFF_LABELS).map(([key, label]) => `<label><input type="checkbox" data-design-buff="${key}" data-player-index="${playerIndex}" ${config.buffs[playerIndex][key] ? 'checked' : ''} />${label}</label>`).join('')}</div>
    </section>`;
  }).join('');

  $$('[data-design-character]').forEach((button) => button.addEventListener('click', () => {
    config.characterIds[Number(button.dataset.playerIndex)] = button.dataset.designCharacter;
    scheduleRender(`P${Number(button.dataset.playerIndex) + 1} 换装为${getCharacter(button.dataset.designCharacter).name}`);
  }));
  $$('[data-hourglass-delta]').forEach((button) => button.addEventListener('click', () => {
    const playerIndex = Number(button.dataset.playerIndex);
    config.hourglasses[playerIndex] = Math.max(0, Math.min(3, config.hourglasses[playerIndex] + Number(button.dataset.hourglassDelta)));
    scheduleRender(`P${playerIndex + 1} 沙漏 ${config.hourglasses[playerIndex]} 个`);
  }));
  $$('[data-design-buff]').forEach((input) => input.addEventListener('change', () => {
    const playerIndex = Number(input.dataset.playerIndex);
    config.buffs[playerIndex][input.dataset.designBuff] = input.checked;
    scheduleRender(`P${playerIndex + 1} ${input.checked ? '装配' : '卸下'}${SHOP_CATALOG.find((offer) => offer.buff === input.dataset.designBuff)?.name || '增益'}`);
  }));
}

function renderControlStates() {
  $('#levelInput').value = config.level;
  $('#levelOutput').textContent = `第 ${config.level} 关`;
  const curveSelect = $('#curveLevelsInput');
  curveSelect.querySelectorAll('option[data-custom]').forEach((option) => option.remove());
  if (![6, 12, 20].includes(config.curveLevels)) {
    const option = document.createElement('option');
    option.value = config.curveLevels;
    option.textContent = `${config.curveLevels} 关（导入）`;
    option.dataset.custom = 'true';
    curveSelect.appendChild(option);
  }
  curveSelect.value = config.curveLevels;
  $$('[data-player-count]').forEach((button) => button.classList.toggle('selected', Number(button.dataset.playerCount) === config.playerCount));
  $$('[data-design-difficulty]').forEach((button) => button.classList.toggle('selected', button.dataset.designDifficulty === config.difficultyId));
  $$('[data-design-mission]').forEach((button) => button.classList.toggle('selected', button.dataset.designMission === config.missionId));
  $$('[data-tuning]').forEach((input) => {
    input.value = config.tuning[input.dataset.tuning];
  });
  $('#goalFactorOutput').textContent = `×${config.tuning.goalFactor.toFixed(2)}`;
  $('#timeFactorOutput').textContent = `×${config.tuning.timeFactor.toFixed(2)}`;
  $('#pullFactorOutput').textContent = `×${config.tuning.pullFactor.toFixed(2)}`;
  $('#aimSecondsOutput').textContent = `${config.tuning.aimSeconds.toFixed(2)} 秒`;
  $('#saveStatus').textContent = saveMessage;
  renderLoadouts();
}

function renderMetrics() {
  const difficulty = DIFFICULTIES[config.difficultyId];
  const mission = getMission(config.missionId);
  $('#ruleSnapshot').textContent = `${difficulty.name} · ${mission.name} · ${analysis.resources.itemCount} 件实物 · 确定性关卡种子`;
  $('#analysisGoal').textContent = money(analysis.goal);
  $('#startingScoreLabel').textContent = `假设起始成绩 ${money(analysis.startingScore)}`;
  $('#goalMetricBar').style.width = `${Math.min(100, (analysis.expectedScore / Math.max(1, analysis.goal)) * 100)}%`;
  $('#analysisTime').textContent = analysis.totalTime.toFixed(analysis.expectedBagTimeBonus ? 1 : 0);
  const timeParts = [`基础 ${analysis.baseTime}s`];
  if (analysis.ownedTimeBonus) timeParts.push(`沙漏 +${analysis.ownedTimeBonus}s`);
  if (analysis.expectedBagTimeBonus) timeParts.push(`福袋期望 +${analysis.expectedBagTimeBonus.toFixed(2)}s`);
  if (analysis.earlySettlement.triggered && analysis.earlySettlement.time > 0) timeParts.push(`预计 ${analysis.earlySettlement.time.toFixed(1)}s ${analysis.earlySettlement.reason === 'goal' ? '达标收工' : '矿区清空'}`);
  $('#timeBreakdown').textContent = timeParts.join(' · ');
  $('#analysisIncome').textContent = money(analysis.expectedEarned, analysis.expectedEarned % 1 ? 2 : 0);
  $('#analysisIncome').style.color = analysis.expectedGoalMet ? '#4e7458' : '#b04f39';
  $('#analysisPerMinute').textContent = `${money(analysis.expectedIncomePerMinute)} / 分钟 · ${analysis.expectedGoalMet ? '预计达标' : `预计差 ${money(analysis.goal - analysis.expectedScore)}`}`;
  $('#analysisMaximum').textContent = money(analysis.resources.maximumValue);
  $('#analysisResources').textContent = `${analysis.resources.itemCount} 件 · 现金期望 ${money(analysis.resources.expectedValue, 2)}`;
}

function renderWarnings() {
  if (!analysis.warnings.length) {
    $('#warningList').innerHTML = `<div class="warning-item all-clear"><span>✓</span><div><b>未发现结构性风险</b><p>理论资源能够覆盖目标差额。仍请用真实操作验证瞄准、遮挡与 TNT 风险。</p></div></div>`;
    return;
  }
  const icons = { danger: '⚠', warning: '!', info: '✦' };
  $('#warningList').innerHTML = analysis.warnings.map((warning) => `<div class="warning-item ${warning.severity}"><span>${icons[warning.severity]}</span><div><b>${warning.title}</b><p>${warning.detail}</p></div></div>`).join('');
}

function renderCurve() {
  const curve = getLevelCurve(config);
  const width = 900;
  const height = 310;
  const margin = { left: 58, right: 52, top: 24, bottom: 40 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  let cumulativeMaximum = 0;
  const points = curve.map((entry) => {
    cumulativeMaximum += entry.maximumValue;
    return { ...entry, cumulativeMaximum };
  });
  const maxValue = Math.max(...points.flatMap((entry) => [entry.goal, entry.cumulativeMaximum])) * 1.08;
  const maxTime = Math.max(75, ...points.map((entry) => entry.time)) * 1.1;
  const x = (index) => margin.left + (index / Math.max(1, points.length - 1)) * plotWidth;
  const y = (value) => margin.top + plotHeight - (value / maxValue) * plotHeight;
  const timeY = (value) => margin.top + plotHeight - (value / maxTime) * plotHeight;
  const pathFor = (key) => points.map((entry, index) => `${index ? 'L' : 'M'} ${x(index).toFixed(1)} ${y(entry[key]).toFixed(1)}`).join(' ');
  const timePath = points.map((entry, index) => `${index ? 'L' : 'M'} ${x(index).toFixed(1)} ${timeY(entry.time).toFixed(1)}`).join(' ');
  const resourceArea = `${pathFor('cumulativeMaximum')} L ${x(points.length - 1)} ${margin.top + plotHeight} L ${x(0)} ${margin.top + plotHeight} Z`;
  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = (maxValue / 4) * index;
    const py = y(value);
    return `<line x1="${margin.left}" y1="${py}" x2="${width - margin.right}" y2="${py}" stroke="#e7dfd0" stroke-width="1"/><text x="${margin.left - 9}" y="${py + 3}" text-anchor="end" fill="#9c9586" font-size="8">${compactMoney(Math.round(value))}</text>`;
  }).join('');
  const selectedIndex = config.level >= 1 && config.level <= points.length ? config.level - 1 : -1;
  const selectionLine = selectedIndex >= 0 ? `<line class="current-level-line" x1="${x(selectedIndex)}" y1="${margin.top}" x2="${x(selectedIndex)}" y2="${margin.top + plotHeight}" stroke="#b69252" stroke-width="1" stroke-dasharray="3 4"/>` : '';
  const labels = points.map((entry, index) => {
    if (points.length > 12 && index % 2 && index !== points.length - 1) return '';
    return `<text x="${x(index)}" y="${height - 17}" text-anchor="middle" fill="${entry.level === config.level ? '#9b6b26' : '#9c9586'}" font-size="8" font-weight="${entry.level === config.level ? '800' : '500'}">${entry.level}</text>`;
  }).join('');
  const dots = (key, color) => points.map((entry, index) => `<circle cx="${x(index)}" cy="${y(entry[key])}" r="${entry.level === config.level ? 4 : 2.3}" fill="${color}" stroke="#fffaf0" stroke-width="1.5"><title>第 ${entry.level} 关 · ${key === 'goal' ? '累计目标' : '累计理论资源'} ${money(entry[key])}</title></circle>`).join('');
  const hitWidth = plotWidth / Math.max(1, points.length - 1);
  const hitAreas = points.map((entry, index) => `<g data-chart-level="${entry.level}" style="cursor:pointer"><rect x="${Math.max(margin.left, x(index) - hitWidth / 2)}" y="${margin.top}" width="${hitWidth}" height="${plotHeight}" fill="transparent"><title>点击查看第 ${entry.level} 关：目标差额 ${money(entry.requiredIncome)}，本关理论资源 ${money(entry.maximumValue)}，${entry.time} 秒</title></rect></g>`).join('');
  $('#goalChart').innerHTML = `
    ${grid}
    <text x="${margin.left}" y="13" fill="#9a9282" font-size="8">累计金额</text><text x="${width - margin.right}" y="13" text-anchor="end" fill="#6f939d" font-size="8">秒</text>
    <path d="${resourceArea}" fill="#6e9273" opacity=".09"/>
    <path d="${pathFor('cumulativeMaximum')}" fill="none" stroke="#5c8267" stroke-width="3" stroke-linejoin="round"/>
    <path d="${pathFor('goal')}" fill="none" stroke="#bd832c" stroke-width="3" stroke-linejoin="round"/>
    <path d="${timePath}" fill="none" stroke="#638b9b" stroke-width="2" stroke-dasharray="6 5" stroke-linejoin="round"/>
    ${dots('cumulativeMaximum', '#5c8267')}${dots('goal', '#bd832c')}
    ${points.map((entry, index) => `<circle cx="${x(index)}" cy="${timeY(entry.time)}" r="2.2" fill="#638b9b"><title>第 ${entry.level} 关 · ${entry.time} 秒</title></circle>`).join('')}
    ${selectionLine}
    ${labels}<text x="${margin.left - 9}" y="${margin.top + plotHeight + 4}" text-anchor="end" fill="#9c9586" font-size="8">0</text>
    ${hitAreas}`;
  $('#goalChart').setAttribute('aria-label', `1 至 ${config.curveLevels} 关累计目标、累计理论资源与倒计时曲线。当前第 ${config.level} 关${selectedIndex < 0 ? '，超出曲线范围' : ''}。`);
  $('#curveTableBody').innerHTML = curve.map((entry) => `<tr style="${entry.level === config.level ? 'background:#f3ead6;font-weight:700' : ''}"><td>第 ${entry.level} 关</td><td>${money(entry.goal)}</td><td>${money(entry.requiredIncome)}</td><td>${entry.time} 秒</td><td>${money(entry.expectedValue, 2)}</td><td>${money(entry.maximumValue)}</td><td>${Math.round(entry.obstacleRatio * 100)}%</td></tr>`).join('');
}

function renderRoute() {
  $('#routeCount').textContent = `${analysis.route.length} / ${analysis.resources.itemCount - analysis.resources.tntCount} 钩`;
  $('#routeTableBody').innerHTML = analysis.route.map((step) => {
    const value = step.kind === 'bag' ? `${money(step.expectedValue, 2)}*` : money(step.expectedValue);
    return `<tr tabindex="0" data-route-item="${step.itemId}" class="${step.itemId === selectedItemId ? 'selected' : ''}">
      <td><span class="route-order p${step.playerIndex + 1}">P${step.playerIndex + 1}·${step.playerRank}</span></td>
      <td><span class="route-item"><span>${ITEM_ICONS[step.kind] || '◆'}</span>${step.name}</span></td>
      <td class="route-value">${value}</td><td>${seconds(step.totalTime)}</td><td class="route-efficiency">${money(step.incomePerMinute)}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="5">当前时间预算内没有完整回收路线。</td></tr>';
  $$('[data-route-item]').forEach((row) => {
    row.addEventListener('click', () => selectItem(row.dataset.routeItem));
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectItem(row.dataset.routeItem);
      }
    });
  });
}

function getSelectedItem() {
  return analysis.resources.items.find((item) => item.id === selectedItemId) || null;
}

function getPreferredItemStats(item, route = null) {
  if (route) return route;
  const choices = Array.from({ length: config.playerCount }, (_, playerIndex) => getRetrievalStats(item, config, playerIndex));
  const reachableChoices = choices.filter((choice) => choice.reachable);
  return [...(reachableChoices.length ? reachableChoices : choices)].sort((a, b) => b.incomePerMinute - a.incomePerMinute)[0];
}

function renderInspector() {
  const item = getSelectedItem();
  if (!item) {
    $('#selectedItemKind').textContent = '未选择';
    $('#itemInspector').innerHTML = '<p>点击上方矿区中的矿物，查看距离、耗时与完整结算顺序。</p>';
    return;
  }
  const route = analysis.route.find((step) => step.itemId === item.id);
  const best = getPreferredItemStats(item, route);
  $('#selectedItemKind').textContent = route ? `P${route.playerIndex + 1} · 第 ${route.playerRank} 钩` : '未进入时间路线';
  const economyRows = item.kind === 'bag'
    ? `<div class="formula-step"><span>普通福袋现金期望</span><em>75% 概率开金币</em><b>${money(getBagProfile(false).expectedCash, 2)}</b></div><div class="formula-step"><span>幸运福袋现金期望</span><em>82% 概率开金币</em><b>${money(getBagProfile(true).expectedCash, 2)}</b></div><div class="formula-step"><span>本配置采用</span><em>${best.economy.bag.lucky ? '四叶草生效' : '无四叶草'}</em><b>${money(best.expectedValue, 2)}</b></div>`
    : best.economy.valueSteps.map((step) => `<div class="formula-step"><span>${step.label}</span><em>${step.formula}</em><b>${money(step.value)}</b></div>`).join('');
  $('#itemInspector').innerHTML = `
    <div class="inspector-item-title"><span aria-hidden="true">${ITEM_ICONS[item.kind]}</span><div><b>${getItemName(item)}</b><small>${WEIGHT_LABELS[getWeightClass(item)]} · 坐标 ${Math.round(item.x)}, ${Math.round(item.y)} · P${best.playerIndex + 1} 原点测算</small></div></div>
    <div class="inspector-metrics"><div><span>中心距离</span><b>${Math.round(best.centerDistance)}</b></div><div><span>完整耗时</span><b>${best.totalTime.toFixed(2)}s</b></div><div><span>收益 / 分钟</span><b>${money(best.incomePerMinute)}</b></div></div>
    <div class="inspector-metrics"><div><span>瞄准 / 出钩</span><b>${best.aimTime.toFixed(2)} / ${best.extensionTime.toFixed(2)}s</b></div><div><span>回收速度</span><b>${best.pullSpeed}/s</b></div><div><span>${item.kind === 'bag' ? '期望 / 上限' : '最终价值'}</span><b>${item.kind === 'bag' ? `${money(best.expectedValue, 2)} / ${money(best.maximumValue)}` : money(best.expectedValue)}</b></div></div>
    <h3 class="formula-title">价值结算顺序</h3><div class="formula-chain">${economyRows}</div>
    <h3 class="formula-title">回收倍率叠乘</h3><div class="formula-chain">${best.pullSteps.map((step) => `<div class="formula-step"><span>${step.label}</span><em>${step.formula}</em><b>${step.value}/s</b></div>`).join('')}</div>`;
}

function renderModeComparison() {
  const modes = comparePlayerCounts(config);
  $('#playerModeComparison').innerHTML = modes.map((mode) => {
    const playerCount = mode.config.playerCount;
    return `<article class="mode-card ${playerCount === 2 ? 'duo' : ''} ${playerCount === config.playerCount ? 'current' : ''}">
      <div class="mode-card-header"><b>${playerCount === 2 ? '⛏️⛏️ 双人协作' : '⛏️ 单人测绘'}</b><span>${playerCount === config.playerCount ? '当前场景' : '同关对照'}</span></div>
      <div class="mode-total">${money(mode.expectedScore, 2)}<small>/ 团队目标 ${money(mode.goal)}</small></div>
      <div class="team-meter"><i style="width:${Math.min(100, (mode.expectedScore / mode.goal) * 100)}%"></i></div>
      <div class="mode-stats"><div>新增收入<b>${money(mode.expectedEarned, 2)}</b></div><div>完成回收<b>${mode.route.length} 钩</b></div><div>预计结果<b>${mode.expectedGoalMet ? '达标' : `差 ${money(mode.goal - mode.expectedScore, 2)}`}</b></div></div>
      <div class="mode-wallet">${mode.players.map((player) => `<span>P${player.playerIndex + 1} · ${getCharacter(player.characterId).name} · ${player.itemCount} 件<b>个人金币 ${money(player.coins, 2)}</b></span>`).join('')}</div>
    </article>`;
  }).join('');
}

function renderMissionComparison() {
  const comparisons = compareMissions(config);
  $('#missionComparison').innerHTML = comparisons.map((entry) => {
    const mission = getMission(entry.missionId);
    return `<article class="mission-compare-card ${entry.missionId === config.missionId ? 'current' : ''}">
      <div class="mission-compare-title"><span>${mission.icon}</span>${mission.name}</div>
      <div class="mission-compare-values"><span>团队目标<b>${money(entry.goal)}</b></span><span>目标差额<b>${money(entry.requiredIncome)}</b></span><span>预计新增<b>${money(entry.expectedEarned, 2)}</b></span><span>理论上限<b>${money(entry.maximumValue)}</b></span></div>
      <div class="mission-compare-foot">${entry.itemCount} 件矿物 · 障碍 ${Math.round(entry.obstacleRatio * 100)}% · TNT ${entry.tntCount}<br>宝石 ×${mission.gemFactor} · 岩石 +${money(mission.rockBonus)} · ${entry.expectedGoalMet ? '预计达标' : '预计不足'}</div>
    </article>`;
  }).join('');
}

function renderCharacterComparison() {
  const item = getSelectedItem() || analysis.resources.items.find((entry) => entry.type === 'goldHuge') || analysis.resources.items[0];
  if (!item) return;
  const comparison = compareCharacters(config, item);
  const maximumIncome = Math.max(...comparison.map((entry) => entry.incomePerMinute), 1);
  const originPlayerIndex = comparison[0]?.originPlayerIndex || 0;
  $('#modifierSubtitle').textContent = `${getItemName(item)} · 固定 P${originPlayerIndex + 1} 可达原点与 P${originPlayerIndex + 1} 增益，仅更换角色。`;
  $('#characterComparison').innerHTML = comparison.map((entry) => `<article class="character-stat-card ${entry.characterId === config.characterIds[originPlayerIndex] ? 'active' : ''}" style="--character-color:${entry.color}">
    <div class="character-stat-name">${entry.name}<span>${CHARACTER_ICONS[entry.characterId]}</span></div><p class="character-stat-passive">${entry.passive}</p>
    <div class="character-stat-numbers"><span>完整耗时 <b>${entry.totalTime.toFixed(2)}s</b></span><span>回收速度 <b>${entry.pullSpeed}/s</b></span><span>每分钟收益 <b>${money(entry.incomePerMinute)}</b></span><span>摆钩速度 <b>${entry.swingSpeed}</b></span></div>
    <div class="character-bar"><i style="width:${Math.max(2, (entry.incomePerMinute / maximumIncome) * 100)}%"></i></div>
  </article>`).join('');
}

function renderShopInsights() {
  const insights = getShopInsights(config, analysis);
  $('#shopInsights').innerHTML = insights.map((insight) => `<article class="shop-insight ${insight.active ? 'active' : ''}">
    <div class="shop-insight-header"><span>${insight.icon}</span><div><b>${insight.name}</b><small>价格 ${money(insight.price)}</small></div>${insight.active ? '<span class="shop-active-badge">P1 已装配</span>' : ''}</div>
    <strong>${insight.headline}</strong><p>${insight.detail}</p>
  </article>`).join('');
}

function drawScene() {
  if (!analysis) return;
  drawDesignScene($('#designCanvas'), analysis, selectedItemId);
}

function renderAll() {
  config = normalizeDesignConfig(config);
  analysis = analyzeLevel(config);
  if (!analysis.resources.items.some((item) => item.id === selectedItemId)) {
    selectedItemId = analysis.route[0]?.itemId || analysis.resources.items.find((item) => item.kind !== 'tnt')?.id || null;
  }
  renderControlStates();
  renderMetrics();
  renderWarnings();
  renderCurve();
  renderRoute();
  renderInspector();
  renderModeComparison();
  renderMissionComparison();
  renderCharacterComparison();
  renderShopInsights();
  drawScene();
}

function selectItem(itemId) {
  if (!analysis.resources.items.some((item) => item.id === itemId)) return;
  selectedItemId = itemId;
  drawScene();
  renderRoute();
  renderInspector();
  renderCharacterComparison();
  const item = getSelectedItem();
  announce(`已选择${getItemName(item)}`);
}

function bindScene() {
  const canvas = $('#designCanvas');
  const tooltip = $('#sceneTooltip');
  canvas.addEventListener('pointermove', (event) => {
    const item = findDesignItem(canvas, analysis, event.clientX, event.clientY);
    if (!item) {
      tooltip.hidden = true;
      canvas.style.cursor = 'crosshair';
      return;
    }
    const route = analysis.route.find((step) => step.itemId === item.id);
    const stats = getPreferredItemStats(item, route);
    tooltip.innerHTML = `<b>${ITEM_ICONS[item.kind]} ${getItemName(item)}</b>${route ? `P${route.playerIndex + 1} 第 ${route.playerRank} 钩 · ` : ''}${item.kind === 'bag' ? `期望 ${money(stats.expectedValue, 2)}` : `价值 ${money(stats.expectedValue)}`}<br>${stats.totalTime.toFixed(2)} 秒 · ${money(stats.incomePerMinute)}/分钟`;
    const wrap = $('.design-canvas-wrap').getBoundingClientRect();
    tooltip.style.left = `${Math.max(6, Math.min(wrap.width - 200, event.clientX - wrap.left + 12))}px`;
    tooltip.style.top = `${Math.max(6, event.clientY - wrap.top - 58)}px`;
    tooltip.hidden = false;
    canvas.style.cursor = 'pointer';
  });
  canvas.addEventListener('pointerleave', () => { tooltip.hidden = true; });
  canvas.addEventListener('pointerdown', (event) => {
    const item = findDesignItem(canvas, analysis, event.clientX, event.clientY);
    if (item) selectItem(item.id);
  });
  canvas.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const items = analysis.resources.items;
    const current = Math.max(0, items.findIndex((item) => item.id === selectedItemId));
    const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1;
    const next = items[(current + direction + items.length) % items.length];
    selectItem(next.id);
  });
  new ResizeObserver(() => drawScene()).observe(canvas);
}

function bindFileActions() {
  $('#saveConfigButton').addEventListener('click', () => {
    try {
      localStorage.setItem(DESIGN_STORAGE_KEY, JSON.stringify(createDesignExport(config)));
      saveMessage = `已保存 · 第 ${config.level} 关 · ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
      $('#saveStatus').textContent = saveMessage;
      announce('测绘单已保存到本机设计台');
    } catch {
      $('#saveStatus').textContent = '浏览器禁止本地存储，请改用 JSON 导出';
    }
  });
  $('#exportConfigButton').addEventListener('click', () => {
    const payload = createDesignExport(config);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gold-rush-level-${config.level}-${config.difficultyId}-${config.missionId}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('#saveStatus').textContent = 'JSON 已导出 · 不包含玩家存档';
    announce('数值模拟配置已导出');
  });
  $('#importConfigButton').addEventListener('click', () => $('#importFileInput').click());
  $('#importFileInput').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      config = parseDesignImport(await file.text());
      selectedItemId = null;
      saveMessage = `已导入 ${file.name} · 尚未保存`;
      renderAll();
      $('#saveStatus').textContent = saveMessage;
      announce('配置导入成功，所有图表已重算');
    } catch (error) {
      $('#saveStatus').textContent = `导入失败：${error.message}`;
      announce(`配置导入失败：${error.message}`);
    } finally {
      event.target.value = '';
    }
  });
  $('#resetConfigButton').addEventListener('click', () => {
    config = normalizeDesignConfig(DEFAULT_DESIGN_CONFIG);
    selectedItemId = null;
    try { localStorage.removeItem(DESIGN_STORAGE_KEY); } catch { /* Storage may be disabled. */ }
    saveMessage = '已恢复默认测绘单';
    renderAll();
    announce('已恢复默认配置');
  });
}

buildStaticControls();
bindScene();
bindFileActions();
renderAll();
