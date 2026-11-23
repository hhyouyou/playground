import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHARACTERS,
  createVisualState,
  getCharacter,
  getInitialDynamites,
  getPullMultiplier,
  getSwingMultiplier,
  getWeightClass,
  MISSIONS,
  getMission,
} from '../character-core.js';

test('三类任务具有明确且不同的数值修正与安全回退', () => {
  assert.deepEqual(Object.keys(MISSIONS), ['gold', 'gems', 'demolition']);
  assert.equal(MISSIONS.gold.goalFactor, 1);
  assert.equal(MISSIONS.gems.goalFactor, 1.05);
  assert.equal(MISSIONS.gems.gemFactor, 1.1);
  assert.equal(MISSIONS.gems.extraItem, 'diamond');
  assert.equal(MISSIONS.demolition.goalFactor, 0.95);
  assert.equal(MISSIONS.demolition.rockBonus, 25);
  assert.equal(MISSIONS.demolition.extraItem, 'tnt');
  assert.equal(getMission('unknown'), MISSIONS.gold);
});

test('四名角色均包含完整的展示配置与外观标识', () => {
  assert.deepEqual(Object.keys(CHARACTERS), ['joe', 'rocky', 'lily', 'max']);
  for (const [id, character] of Object.entries(CHARACTERS)) {
    assert.equal(character.id, id);
    assert.ok(character.name.length > 0);
    assert.ok(/^[A-Za-z ]+$/.test(character.title));
    assert.ok(character.description.length > 0);
    assert.match(character.color, /^#[0-9A-Fa-f]{6}$/);
    assert.equal(character.palette.primary, character.color);
    assert.ok(character.palette.secondary);
    assert.ok(character.palette.accent);
    assert.ok(character.appearance.length > 0);
    assert.ok(character.passive.length > 0);
  }
});

test('getCharacter 默认返回 joe，并安全回退未知角色', () => {
  assert.equal(getCharacter(), CHARACTERS.joe);
  assert.equal(getCharacter(undefined), CHARACTERS.joe);
  assert.equal(getCharacter(null), CHARACTERS.joe);
  assert.equal(getCharacter('unknown'), CHARACTERS.joe);
  assert.equal(getCharacter('toString'), CHARACTERS.joe);
  for (const id of Object.keys(CHARACTERS)) {
    assert.equal(getCharacter(id), CHARACTERS[id]);
  }
});

test('重量分级覆盖 330、220、150 三个闭区间阈值', () => {
  const cases = [
    [500, 'light'],
    [330, 'light'],
    [329.999, 'medium'],
    [220, 'medium'],
    [219.999, 'heavy'],
    [150, 'heavy'],
    [149.999, 'extreme'],
    [0, 'extreme'],
  ];
  for (const [pullSpeed, expected] of cases) {
    assert.equal(getWeightClass({ pullSpeed }), expected, `pullSpeed=${pullSpeed}`);
  }
});

test('rocky 仅加速 pullSpeed 小于 220 的重物', () => {
  assert.equal(getPullMultiplier('rocky', { pullSpeed: 219.999 }), 1.08);
  assert.equal(getPullMultiplier('rocky', { pullSpeed: 150 }), 1.08);
  assert.equal(getPullMultiplier('rocky', { pullSpeed: 149.999 }), 1.08);
  assert.equal(getPullMultiplier('rocky', { pullSpeed: 220 }), 1);
  assert.equal(getPullMultiplier('rocky', { pullSpeed: 330 }), 1);
  assert.equal(getPullMultiplier('joe', { pullSpeed: 100 }), 1);
  assert.equal(getPullMultiplier('max', { pullSpeed: 100 }), 1);
});

test('lily 仅加速钻石与金猪，不受重量阈值影响', () => {
  for (const kind of ['diamond', 'pig']) {
    assert.equal(getPullMultiplier('lily', { kind, pullSpeed: 440 }), 1.06);
    assert.equal(getPullMultiplier('lily', { kind, pullSpeed: 100 }), 1.06);
  }
  for (const kind of ['gold', 'rock', 'bag', 'bone', 'tnt']) {
    assert.equal(getPullMultiplier('lily', { kind, pullSpeed: 100 }), 1);
  }
  assert.equal(getPullMultiplier('rocky', { kind: 'diamond', pullSpeed: 440 }), 1);
  assert.equal(getPullMultiplier('unknown', { kind: 'diamond', pullSpeed: 100 }), 1);
});

test('rocky 与 max 的摆钩倍率为 95%，其余角色不减速', () => {
  assert.equal(getSwingMultiplier('rocky'), 0.95);
  assert.equal(getSwingMultiplier('max'), 0.95);
  assert.equal(getSwingMultiplier('joe'), 1);
  assert.equal(getSwingMultiplier('lily'), 1);
  assert.equal(getSwingMultiplier('unknown'), 1);
});

test('max 初始多一根炸药，其余角色均为两根', () => {
  assert.equal(getInitialDynamites('max'), 3);
  assert.equal(getInitialDynamites('joe'), 2);
  assert.equal(getInitialDynamites('rocky'), 2);
  assert.equal(getInitialDynamites('lily'), 2);
  assert.equal(getInitialDynamites('unknown'), 2);
});

test('视觉状态是具有默认动作、表情、张力和时间的纯数据', () => {
  assert.deepEqual(createVisualState(), {
    seed: 0,
    action: 'idle',
    expression: 'neutral',
    tension: 0,
    time: 0,
  });
  assert.deepEqual(createVisualState(42), {
    seed: 42,
    action: 'idle',
    expression: 'neutral',
    tension: 0,
    time: 0,
  });
});

test('每次创建独立的视觉状态，修改实例不会影响后续实例', () => {
  const first = createVisualState(7);
  first.action = 'pulling';
  first.expression = 'strained';
  first.tension = 0.8;
  first.time = 12;
  const second = createVisualState(7);
  assert.deepEqual(second, {
    seed: 7,
    action: 'idle',
    expression: 'neutral',
    tension: 0,
    time: 0,
  });
  assert.notEqual(first, second);
});
