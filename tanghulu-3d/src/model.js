import * as THREE from 'three';

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function seededRandom(seed = 20261117) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function foodTexture(base, seed, density = 3400) {
  const random = seededRandom(seed);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const context = canvas.getContext('2d');
  context.fillStyle = base;
  context.fillRect(0, 0, 512, 512);
  for (let i = 0; i < density; i += 1) {
    const light = random() > 0.46;
    context.fillStyle = light
      ? `rgba(255,238,205,${random() * 0.1})`
      : `rgba(62,8,10,${random() * 0.07})`;
    const radius = random() * 2.1 + 0.3;
    context.beginPath();
    context.arc(random() * 512, random() * 512, radius, 0, Math.PI * 2);
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 1.5);
  return texture;
}

function woodTexture() {
  const random = seededRandom(72);
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  context.fillStyle = '#d9b77f';
  context.fillRect(0, 0, 128, 512);
  for (let i = 0; i < 70; i += 1) {
    const x = random() * 128;
    context.strokeStyle = `rgba(103,62,25,${random() * 0.13})`;
    context.lineWidth = random() * 1.2 + 0.25;
    context.beginPath();
    context.moveTo(x, 0);
    context.bezierCurveTo(x + random() * 5, 170, x - random() * 5, 340, x + random() * 3, 512);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function addMesh(parent, geometry, material, position = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

// The berry is authored in its final orientation: broad shoulder down, tip up.
function strawberryGeometry() {
  const controls = [
    [0.15, -0.63], [0.32, -0.56], [0.45, -0.39], [0.515, -0.15],
    [0.505, 0.07], [0.43, 0.27], [0.30, 0.45], [0.15, 0.59], [0.012, 0.70],
  ].map(([radius, y]) => new THREE.Vector2(radius, y));
  const profile = new THREE.SplineCurve(controls).getPoints(48);
  const geometry = new THREE.LatheGeometry(profile, 64);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const angle = Math.atan2(z, x);
    const organic = 1 + 0.014 * Math.sin(angle * 5 + y * 7) + 0.009 * Math.cos(angle * 9 - y * 5);
    positions.setXYZ(i, x * organic, y, z * organic);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function createStrawberry(materials, random) {
  const group = new THREE.Group();
  const geometry = strawberryGeometry();
  addMesh(group, geometry, materials.strawberry);

  // Each seed sits in a darker, flattened socket instead of floating on the skin.
  const rows = [
    { y: -0.49, r: 0.35, count: 8, ny: -0.32 },
    { y: -0.31, r: 0.47, count: 11, ny: -0.12 },
    { y: -0.11, r: 0.515, count: 13, ny: 0.08 },
    { y: 0.10, r: 0.49, count: 13, ny: 0.22 },
    { y: 0.29, r: 0.41, count: 11, ny: 0.42 },
    { y: 0.46, r: 0.28, count: 9, ny: 0.62 },
    { y: 0.59, r: 0.135, count: 6, ny: 0.80 },
  ];
  const count = rows.reduce((sum, row) => sum + row.count, 0);
  const sockets = new THREE.InstancedMesh(new THREE.SphereGeometry(0.052, 8, 6), materials.seedSocket, count);
  const seeds = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 8, 6), materials.seed, count);
  const dummy = new THREE.Object3D();
  let index = 0;
  rows.forEach((row, rowIndex) => {
    for (let i = 0; i < row.count; i += 1) {
      const angle = (i / row.count) * Math.PI * 2 + (rowIndex % 2) * 0.25 + (random() - 0.5) * 0.07;
      const normal = new THREE.Vector3(Math.cos(angle), row.ny, Math.sin(angle)).normalize();
      const surface = new THREE.Vector3(Math.cos(angle) * row.r, row.y, Math.sin(angle) * row.r);
      dummy.position.copy(surface).addScaledVector(normal, 0.002);
      dummy.quaternion.setFromUnitVectors(Z_AXIS, normal);
      dummy.scale.set(0.83, 1.18, 0.20);
      dummy.updateMatrix();
      sockets.setMatrixAt(index, dummy.matrix);

      dummy.position.copy(surface).addScaledVector(normal, 0.011);
      dummy.scale.set(0.52, 1.05, 0.20);
      dummy.updateMatrix();
      seeds.setMatrixAt(index, dummy.matrix);
      index += 1;
    }
  });
  sockets.receiveShadow = true;
  seeds.castShadow = true;
  group.add(sockets, seeds);

  const crystals = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.016), materials.sugarCrystal, 28);
  for (let i = 0; i < 28; i += 1) {
    const y = -0.38 + random() * 0.94;
    const angle = random() * Math.PI * 2;
    const r = 0.50 * Math.sqrt(Math.max(0.08, 1 - Math.pow((y + 0.08) / 0.83, 2)));
    const normal = new THREE.Vector3(Math.cos(angle), 0.22, Math.sin(angle)).normalize();
    dummy.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r).addScaledVector(normal, 0.025);
    dummy.quaternion.setFromUnitVectors(Y_AXIS, normal);
    dummy.scale.setScalar(0.55 + random() * 0.85);
    dummy.updateMatrix();
    crystals.setMatrixAt(i, dummy.matrix);
  }
  group.add(crystals);
  group.rotation.y = random() * Math.PI * 2;
  return { group, geometry };
}

function milkSkinGeometry(random) {
  const around = 64;
  const vertical = 16;
  const positions = [];
  const uvs = [];
  const indices = [];
  const edgePoints = { top: [], bottom: [] };

  for (let yIndex = 0; yIndex <= vertical; yIndex += 1) {
    const v = yIndex / vertical;
    for (let angleIndex = 0; angleIndex <= around; angleIndex += 1) {
      const u = angleIndex / around;
      const theta = 0.68 + u * (Math.PI * 2 - 1.36);
      const wave = Math.sin(theta * 4 + v * 5) * 0.015 + Math.cos(theta * 7 - v * 3) * 0.008;
      const fold = (Math.exp(-u * 24) + Math.exp(-(1 - u) * 24)) * 0.035 * Math.sin(v * Math.PI);
      const radius = 0.585 - v * 0.035 + wave + fold;
      const y = -0.54 + v * 0.99 + Math.sin(theta * 3 + 0.7) * 0.018;
      const point = new THREE.Vector3(Math.sin(theta) * radius, y, Math.cos(theta) * radius);
      positions.push(point.x, point.y, point.z);
      uvs.push(u * 2, v);
      if (yIndex === 0) edgePoints.bottom.push(point.clone());
      if (yIndex === vertical) edgePoints.top.push(point.clone());
    }
  }
  for (let yIndex = 0; yIndex < vertical; yIndex += 1) {
    for (let angleIndex = 0; angleIndex < around; angleIndex += 1) {
      const a = yIndex * (around + 1) + angleIndex;
      const b = a + 1;
      const c = a + around + 1;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return { geometry, edgePoints };
}

function createMilkSkin(materials, random) {
  const group = new THREE.Group();
  const { geometry, edgePoints } = milkSkinGeometry(random);
  addMesh(group, geometry, materials.milkSkin);

  // Two fine rolled edges reveal that this is a thin sheet, not a solid cylinder.
  ['top', 'bottom'].forEach((edge) => {
    const curve = new THREE.CatmullRomCurve3(edgePoints[edge]);
    addMesh(group, new THREE.TubeGeometry(curve, 80, 0.014, 6, false), materials.milkEdge);
  });

  const outerGlaze = addMesh(group, geometry.clone(), materials.glaze);
  outerGlaze.scale.setScalar(1.014);
  outerGlaze.renderOrder = 3;
  outerGlaze.castShadow = false;
  return group;
}

export function createTanghulu() {
  const random = seededRandom();
  const group = new THREE.Group();
  group.name = 'Milk skin tanghulu — strawberry tips up';
  group.userData.strawberryOrientation = 'tips-up';
  const assemblies = [];
  const skins = [];
  const fruitGlazes = [];
  const anchors = {};

  const strawberryMap = foodTexture('#c91822', 26, 6500);
  const milkMap = foodTexture('#f1dfae', 44, 2200);
  const materials = {
    strawberry: new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: strawberryMap, bumpMap: strawberryMap, bumpScale: 0.012, roughness: 0.31, clearcoat: 0.58, clearcoatRoughness: 0.2 }),
    seedSocket: new THREE.MeshStandardMaterial({ color: '#a52729', roughness: 0.58 }),
    seed: new THREE.MeshStandardMaterial({ color: '#edbd76', roughness: 0.48 }),
    milkSkin: new THREE.MeshPhysicalMaterial({ color: '#fff3cd', map: milkMap, bumpMap: milkMap, bumpScale: 0.009, roughness: 0.48, clearcoat: 0.22, side: THREE.DoubleSide }),
    milkEdge: new THREE.MeshStandardMaterial({ color: '#e7cf94', roughness: 0.58 }),
    wood: new THREE.MeshStandardMaterial({ color: '#e4c48f', map: woodTexture(), roughness: 0.66 }),
    glaze: new THREE.MeshPhysicalMaterial({ color: '#fff7df', roughness: 0.055, transmission: 0.98, thickness: 0.045, ior: 1.46, clearcoat: 1, clearcoatRoughness: 0.04, attenuationColor: '#fff0c9', attenuationDistance: 1.8, depthWrite: false, side: THREE.FrontSide }),
    sugarCrystal: new THREE.MeshPhysicalMaterial({ color: '#fff9e9', roughness: 0.08, transmission: 0.35, transparent: true, opacity: 0.82, clearcoat: 1 }),
  };

  const stick = addMesh(group, new THREE.CylinderGeometry(0.056, 0.068, 5.72, 20), materials.wood, [0, 2.87, 0]);
  stick.name = 'Vertical bamboo skewer';
  const stickTip = addMesh(group, new THREE.ConeGeometry(0.056, 0.24, 20), materials.wood, [0, 5.84, 0]);

  const centers = [1.35, 2.90, 4.45];
  centers.forEach((center, index) => {
    const assembly = new THREE.Group();
    assembly.position.y = center;
    assembly.userData.baseY = center;
    assembly.userData.explode = (index - 1) * 0.38;
    assembly.scale.setScalar(0.97 + random() * 0.055);
    group.add(assembly);
    assemblies.push(assembly);

    const strawberry = createStrawberry(materials, random);
    assembly.add(strawberry.group);

    const glaze = addMesh(assembly, strawberry.geometry.clone(), materials.glaze);
    glaze.rotation.copy(strawberry.group.rotation);
    glaze.scale.setScalar(1.026);
    glaze.renderOrder = 2;
    glaze.castShadow = false;
    glaze.userData.baseX = 0;
    fruitGlazes.push(glaze);

    const milkSkin = createMilkSkin(materials, random);
    milkSkin.userData.baseX = 0;
    assembly.add(milkSkin);
    skins.push(milkSkin);

    if (index === 2) {
      const strawberryAnchor = new THREE.Object3D();
      strawberryAnchor.position.set(0, 0.69, 0);
      strawberry.group.add(strawberryAnchor);
      anchors.strawberry = strawberryAnchor;

      const sugarAnchor = new THREE.Object3D();
      sugarAnchor.position.set(-0.34, 0.16, 0.40);
      glaze.add(sugarAnchor);
      anchors.sugar = sugarAnchor;
    }
    if (index === 1) {
      const milkAnchor = new THREE.Object3D();
      milkAnchor.position.set(0.56, 0.02, 0.18);
      milkSkin.add(milkAnchor);
      anchors.milk = milkAnchor;
    }
  });

  anchors.bamboo = new THREE.Object3D();
  anchors.bamboo.position.set(0, 5.55, 0);
  group.add(anchors.bamboo);

  let explosion = 0;
  function update(delta, exploded) {
    explosion = THREE.MathUtils.damp(explosion, exploded ? 1 : 0, 5.5, delta);
    assemblies.forEach((assembly) => {
      assembly.position.y = assembly.userData.baseY + assembly.userData.explode * explosion;
    });
    skins.forEach((skin) => { skin.position.x = explosion * 0.95; });
    fruitGlazes.forEach((glaze) => { glaze.position.x = -explosion * 0.85; });
  }

  return { group, anchors, materials, update };
}

export function createStage() {
  const group = new THREE.Group();
  const ceramic = new THREE.MeshPhysicalMaterial({ color: '#eee5d8', roughness: 0.26, clearcoat: 0.32, clearcoatRoughness: 0.3 });
  const plate = addMesh(group, new THREE.CylinderGeometry(1.72, 1.80, 0.15, 96), ceramic, [0, 0, 0]);
  plate.receiveShadow = true;
  const rim = addMesh(group, new THREE.TorusGeometry(1.65, 0.015, 8, 96), new THREE.MeshStandardMaterial({ color: '#cbb797', roughness: 0.38, metalness: 0.18 }), [0, 0.083, 0]);
  rim.rotation.x = Math.PI / 2;
  const holder = addMesh(group, new THREE.CylinderGeometry(0.20, 0.29, 0.16, 40), ceramic, [0, 0.13, 0]);
  holder.receiveShadow = true;
  return group;
}
