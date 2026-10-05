import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const houseColors = [0x8aacb2, 0xd58f9f, 0xb4a0c8, 0xa8b9ab, 0xd8b186, 0x859dca];

/** A small, real 3D city. Gameplay and input remain outside the renderer. */
export class WorldRenderer {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.setAttribute('aria-label', 'Greek Row: a 3D punk neighborhood');
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x17182b);
    this.scene.fog = new THREE.Fog(0x17182b, 72, 145);
    this.camera = new THREE.OrthographicCamera(-25, 25, 15, -15, 0.1, 180);
    this.materials = new Map();
    this.geometries = new Map();
    this.textures = new Set();
    this.labelResources = new Map();
    this.houseMeshes = new Map();
    this.hazardMeshes = new Map();
    this.pickupMeshes = new Map();
    this.bottleMeshes = new Map();
    this.particles = [];
    this.decorations = [];
    this.focus = null;
    this.portrait = false;
    this.projectVector = new THREE.Vector3();
    this.scene.add(new THREE.HemisphereLight(0xc7c0ff, 0x334652, 2.45));
    this.sun = new THREE.DirectionalLight(0xffccb4, 3.1);
    this.sun.position.set(-12, 28, 18);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -32, right: 32, top: 27, bottom: -27, near: 1, far: 85 });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.08;
    this.scene.add(this.sun, this.sun.target);
    const rim = new THREE.DirectionalLight(0x8f80ff, 2.2);
    rim.position.set(5, 15, -24);
    this.scene.add(rim);
    this.buildStreet();
    this.player = this.makePlayer();
    this.scene.add(this.player);
    this.target = this.makeTarget();
    this.scene.add(this.target);
    this.resize();
  }

  material(color, options = {}) {
    const key = `${color}:${JSON.stringify(options)}`;
    if (!this.materials.has(key)) this.materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.05, ...options }));
    return this.materials.get(key);
  }

  geometry(kind, args) {
    const key = `${kind}:${args.join(',')}`;
    if (!this.geometries.has(key)) {
      let g;
      if (kind === 'box') g = new RoundedBoxGeometry(...args, 2, Math.min(...args) * 0.075);
      if (kind === 'cylinder') g = new THREE.CylinderGeometry(...args);
      if (kind === 'sphere') g = new THREE.SphereGeometry(...args);
      if (kind === 'cone') g = new THREE.ConeGeometry(...args);
      if (kind === 'torus') g = new THREE.TorusGeometry(...args);
      this.geometries.set(key, g);
    }
    return this.geometries.get(key);
  }

  mesh(parent, geometry, material, x = 0, y = 0, z = 0, shadows = true) {
    const mesh = new THREE.Mesh(geometry, typeof material === 'number' ? this.material(material) : material);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    parent.add(mesh);
    return mesh;
  }

  box(parent, w, h, d, color, x = 0, y = 0, z = 0, shadows = true) {
    return this.mesh(parent, this.geometry('box', [w, h, d]), color, x, y, z, shadows);
  }

  sphere(parent, r, color, x = 0, y = 0, z = 0, shadows = true) {
    return this.mesh(parent, this.geometry('sphere', [r, 12, 8]), color, x, y, z, shadows);
  }

  cylinder(parent, rt, rb, height, color, x = 0, y = 0, z = 0, segments = 12) {
    return this.mesh(parent, this.geometry('cylinder', [rt, rb, height, segments]), color, x, y, z);
  }

  label(text, width, height, { color = '#f5eddb', background = '#262537', size = 60, border = '#b7ef69', subtitle = '' } = {}) {
    const cacheKey = JSON.stringify([text, width, height, color, background, size, border, subtitle]);
    const cached = this.labelResources.get(cacheKey);
    if (cached) return new THREE.Mesh(cached.geometry, cached.material);
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = Math.round(768 * height / width);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = background;
    ctx.beginPath();
    ctx.roundRect(3, 3, canvas.width - 6, canvas.height - 6, 18);
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.font = `900 ${size}px Arial, sans-serif`;
    ctx.fillText(text, canvas.width / 2, canvas.height * (subtitle ? 0.39 : 0.52), canvas.width - 48);
    if (subtitle) {
      ctx.font = '600 24px Arial, sans-serif';
      ctx.fillStyle = '#d9d3e2';
      ctx.fillText(subtitle, canvas.width / 2, canvas.height * 0.76, canvas.width - 48);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    this.textures.add(texture);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
    this.materials.set(`label:${this.textures.size}`, material);
    const geo = new THREE.PlaneGeometry(width, height);
    this.geometries.set(`label:${this.textures.size}`, geo);
    this.labelResources.set(cacheKey, { geometry: geo, material });
    return new THREE.Mesh(geo, material);
  }

  // Bake repeated static details together by material, keeping mobile draw calls low.
  batchStatic(group, excluded = []) {
    group.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert();
    const batches = new Map();
    const skip = new Set();
    for (const root of excluded) root.traverse(object => skip.add(object));
    group.traverse(object => {
      if (!object.isMesh || object.isInstancedMesh || skip.has(object) || Array.isArray(object.material)) return;
      const key = `${object.material.uuid}:${object.castShadow}:${object.receiveShadow}`;
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key).push(object);
    });
    for (const meshes of batches.values()) {
      if (meshes.length < 2) continue;
      const geometries = meshes.map(mesh => {
        const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
        return geometry;
      });
      const geometry = mergeGeometries(geometries, false);
      for (const source of geometries) source.dispose();
      if (!geometry) continue;
      this.geometries.set(`batch:${geometry.uuid}`, geometry);
      const mesh = new THREE.Mesh(geometry, meshes[0].material);
      mesh.castShadow = meshes[0].castShadow;
      mesh.receiveShadow = meshes[0].receiveShadow;
      for (const original of meshes) original.removeFromParent();
      group.add(mesh);
    }
  }

  buildStreet() {
    const city = new THREE.Group();
    this.scene.add(city);
    this.box(city, 380, 0.5, 100, 0x222c3c, 145, -0.42, -5);
    this.box(city, 380, 0.14, 11.4, 0x36374b, 145, -0.1, 0);
    this.box(city, 380, 0.24, 2.1, 0x818398, 145, -0.01, -6.7);
    this.box(city, 380, 0.24, 1.8, 0x77788c, 145, -0.01, 6.7);
    this.box(city, 380, 0.05, 0.13, 0xddcbac, 145, 0.005, -4.7, false);
    this.box(city, 380, 0.05, 0.13, 0xddcbac, 145, 0.005, 4.7, false);
    this.box(city, 380, 0.16, 16, 0x426e66, 145, -0.04, -15.8);
    const lineGeometry = this.geometry('box', [2.4, 0.025, 0.11]);
    const lines = new THREE.InstancedMesh(lineGeometry, this.material(0xa5a79b), 138);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < 138; i++) {
      matrix.makeTranslation(-40 + Math.floor(i / 2) * 5.5, 0.002, i % 2 ? 0.22 : -0.22);
      lines.setMatrixAt(i, matrix);
    }
    city.add(lines);
    for (let x = -15; x < 294; x += 20) {
      const chunk = new THREE.Group();
      chunk.position.x = x;
      this.scene.add(chunk);
      this.decorations.push(chunk);
      this.makeLamp(chunk, 3, -6.5);
      this.makeLamp(chunk, 13, 6.7);
      this.makeTree(chunk, 0, -18.5, x % 40 === 5 ? 0xa05e86 : 0x487f78);
      this.makeTree(chunk, 14, -18.7, 0x526c8a);
      this.makeTree(chunk, 18, 9.5, 0x577e80, 0.72);
      this.box(chunk, 0.09, 0.012, 1.9, 0x656a7e, 0, 0.125, -6.7, false);
      this.box(chunk, 0.09, 0.012, 1.9, 0x656a7e, 10, 0.125, -6.7, false);
      const drain = this.box(chunk, 0.8, 0.025, 0.52, 0x1c2738, 6, 0.015, 5.2, false);
      for (let n = 0; n < 4; n++) this.box(chunk, 0.035, 0.03, 0.48, 0x85888e, 5.7 + n * 0.19, 0.03, 5.2, false);
      drain.receiveShadow = false;
      this.box(chunk, 1.3, 0.22, 0.44, 0xa57867, 9, 0.67, -6.8);
      this.box(chunk, 1.3, 0.56, 0.16, 0x916658, 9, 0.95, -7.04);
      for (const dx of [-0.45, 0.45]) this.box(chunk, 0.09, 0.5, 0.35, 0x293448, 9 + dx, 0.36, -6.8);
      this.cylinder(chunk, 0.29, 0.32, 0.8, 0x39565c, 11, 0.52, -6.9);
      this.cylinder(chunk, 0.34, 0.34, 0.08, 0x87a49b, 11, 0.94, -6.9);
      // Individually modeled blocks create a skyline, but stay behind the street.
      for (let j = 0; j < 2; j++) {
        const height = 7 + ((Math.abs(x) + j * 7) % 13);
        const block = this.box(chunk, 7, height, 6, j ? 0x373b5c : 0x45445f, j * 9 - 2, height / 2 - 0.1, -29 - j * 4);
        block.castShadow = false;
        for (let k = 0; k < 5; k++) {
          this.box(chunk, 0.6, 0.9, 0.03, this.material(0xe8b78e, { emissive: 0xad7774, emissiveIntensity: 0.4 }), j * 9 - 4 + (k % 3) * 1.5, 3 + Math.floor(k / 3) * 3.4, -25.97 - j * 4, false);
        }
      }
      this.batchStatic(chunk);
    }
    for (const x of [2, 82, 162, 242]) {
      for (let z = -4; z <= 4; z += 1.35) this.box(city, 2.1, 0.012, 0.69, 0xb0adb7, x, 0.011, z, false);
    }
    this.makeShop(-7, 12.8, 'NO FUTURE', 'RECORDS & TAPES', 0xa8799e, 0x8bf1b2);
    this.makeShop(37, 13, 'KICKFLIP', 'SKATE / REPAIR / REPEAT', 0x747ead, 0xffaab8);
    this.makeShop(77, 13, 'LOUDER', 'COFFEE • COMMUNITY • CHAOS', 0x668e8d, 0xf2d184);
    this.makeShop(117, 13, 'NO FUTURE', 'ALL AGES. ALWAYS.', 0xa8799e, 0x8bf1b2);
    this.makeShop(157, 13, 'KICKFLIP', 'SUPPORT YOUR LOCAL SCENE', 0x747ead, 0xffaab8);
    this.makeShop(197, 13, 'LOUDER', 'COFFEE • COMMUNITY • CHAOS', 0x668e8d, 0xf2d184);
    this.makeShop(237, 13, 'NO FUTURE', 'RECORDS & TAPES', 0xa8799e, 0x8bf1b2);
    this.batchStatic(city);
  }

  makeLamp(parent, x, z) {
    const dark = this.material(0x283548, { metalness: 0.45 });
    this.cylinder(parent, 0.085, 0.13, 3.7, dark, x, 1.96, z, 8);
    this.cylinder(parent, 0.24, 0.34, 0.24, dark, x, 0.25, z, 10);
    this.box(parent, 0.9, 0.11, 0.12, dark, x, 3.79, z);
    this.box(parent, 0.51, 0.08, 0.38, this.material(0xffe6bb, { emissive: 0xffc375, emissiveIntensity: 2 }), x + 0.32, 3.68, z, false);
    const glow = this.mesh(parent, this.geometry('cylinder', [1.8, 1.8, 0.006, 28]), this.material(0xffd59c, { transparent: true, opacity: 0.065, depthWrite: false }), x + 0.3, 0.13, z, false);
    glow.scale.z = 0.68;
  }

  makeTree(parent, x, z, color, scale = 1) {
    const group = new THREE.Group();
    group.position.set(x, 0.1, z);
    group.scale.setScalar(scale);
    parent.add(group);
    this.cylinder(group, 0.13, 0.23, 2.3, 0x715e62, 0, 1.1, 0, 8);
    const leaves = this.sphere(group, 1.55, color, 0, 3.15, 0);
    leaves.scale.set(1, 1.12, 0.95);
    this.sphere(group, 1.08, color, -0.76, 2.77, 0.28);
    this.sphere(group, 1.03, color, 0.82, 2.9, -0.21);
    this.cylinder(group, 1.32, 1.4, 0.19, 0x717d83, 0, 0.07, 0, 16);
  }

  makeShop(x, z, name, subtitle, color, accent) {
    const shop = new THREE.Group();
    shop.position.set(x, 0, z);
    this.scene.add(shop);
    this.decorations.push(shop);
    this.box(shop, 9, 3.8, 4.5, color, 0, 1.9, 0);
    this.box(shop, 9.35, 0.23, 4.85, 0x394054, 0, 3.89, 0);
    this.box(shop, 8.5, 0.09, 4, 0x56616c, 0, 4.08, 0);
    // Storefront faces the street, on the negative-z side.
    for (const dx of [-2.8, 2.8]) {
      this.box(shop, 2.4, 1.8, 0.13, 0x263b50, dx, 1.66, -2.31);
      this.box(shop, 2.1, 1.48, 0.03, this.material(accent, { emissive: accent, emissiveIntensity: 0.18 }), dx, 1.65, -2.4, false);
      this.box(shop, 0.08, 1.6, 0.1, 0x354357, dx, 1.65, -2.44);
      for (let n = 0; n < 3; n++) this.box(shop, 0.4, 0.54, 0.07, [0xe8889a, 0xefd084, 0x889ed2][n], dx - 0.65 + n * 0.63, 1.24, -2.48);
    }
    this.box(shop, 1.35, 2.48, 0.15, 0x26364a, 0, 1.24, -2.33);
    this.box(shop, 0.91, 1.67, 0.02, this.material(0xb3decd, { emissive: 0x5c9b96, emissiveIntensity: 0.3 }), 0, 1.53, -2.42, false);
    this.box(shop, 0.12, 0.31, 0.08, 0xe1cba6, 0.4, 1.13, -2.5);
    const sign = this.label(name, 6.5, 0.84, { size: 64, border: `#${accent.toString(16)}` });
    sign.position.set(0, 3.17, -2.35);
    sign.rotation.y = Math.PI;
    shop.add(sign);
    const small = this.label(subtitle, 6, 0.4, { size: 28, border: '#40485b' });
    small.position.set(0, 2.57, -2.37);
    small.rotation.y = Math.PI;
    shop.add(small);
    const awning = this.box(shop, 9.15, 0.16, 1.6, accent, 0, 2.45, -2.95);
    awning.rotation.x = -0.14;
    this.box(shop, 9.15, 0.28, 0.13, color, 0, 2.24, -3.73);
    this.box(shop, 2.3, 0.9, 1.4, 0x7f8993, 2.5, 4.6, 0.1);
    this.cylinder(shop, 0.46, 0.46, 0.04, 0x39434f, 2.5, 5.07, 0.1, 16);
    this.batchStatic(shop);
  }

  roof(parent, width, height, depth, color, y) {
    const key = `roof:${width}:${height}:${depth}`;
    if (!this.geometries.has(key)) {
      const shape = new THREE.Shape();
      shape.moveTo(-width / 2, 0);
      shape.lineTo(0, height);
      shape.lineTo(width / 2, 0);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 1, steps: 1 });
      geo.translate(0, 0, -depth / 2);
      this.geometries.set(key, geo);
    }
    return this.mesh(parent, this.geometries.get(key), color, 0, y, 0);
  }

  makeHouse(data, index) {
    const group = new THREE.Group();
    group.position.set(data.x, 0, data.z ?? -10.5);
    this.scene.add(group);
    const pastel = houseColors[index % houseColors.length];
    const paint = this.material(pastel).clone();
    this.materials.set(`house-paint:${data.id}`, paint);
    const roofMaterial = this.material([0x545b79, 0x74556e, 0x465b68][index % 3]).clone();
    this.materials.set(`house-roof:${data.id}`, roofMaterial);
    const windowMaterial = this.material(0xffd8a4, { emissive: 0xffbe77, emissiveIntensity: 0.72 }).clone();
    this.materials.set(`house-window:${data.id}`, windowMaterial);
    const width = 7.2 + (index % 3) * 0.45;
    const height = 4.6 + (index % 2) * 0.45;
    const groundZ = -10.5 - (data.z ?? -10.5);
    this.box(group, 13.8, 0.1, 7.6, index % 2 ? 0x517b6d : 0x557c72, 0, 0.04, 0.3);
    this.box(group, 1.5, 0.13, 5.8, 0xb8b1ad, 0, 0.14, 2.3);
    this.box(group, width + 0.24, 0.56, 4.75, 0x8f919e, 0, 0.3, -0.3);
    this.box(group, width, height, 4.45, paint, 0, height / 2 + 0.56, -0.3);
    this.box(group, width + 0.25, 0.17, 4.65, 0xe4dbcb, 0, 2.87, -0.3);
    this.box(group, width + 0.34, 0.22, 4.8, 0xe4dbcb, 0, height + 0.56, -0.3);
    const roof = this.roof(group, width + 0.85, 1.65, 5.15, roofMaterial, height + 0.64);
    roof.position.z = -0.3;
    this.box(group, 0.7, 1.55, 0.74, 0xb98081, width / 2 - 1.2, height + 1.75, -0.8);
    this.box(group, 0.91, 0.17, 0.94, 0xddb6a1, width / 2 - 1.2, height + 2.6, -0.8);
    for (const dx of [-width / 2 + 0.21, width / 2 - 0.21]) this.box(group, 0.23, height, 0.16, 0xe5ddcc, dx, height / 2 + 0.56, 1.99);
    for (const dx of [-2.45, 0, 2.45]) {
      for (const y of [1.65, 3.99]) {
        if (dx === 0 && y < 2) continue;
        this.box(group, 1.31, 1.43, 0.18, 0xe1d5c4, dx, y, 1.98);
        this.box(group, 1.08, 1.21, 0.04, windowMaterial, dx, y, 2.09, false);
        this.box(group, 0.07, 1.25, 0.09, 0xf2e3c9, dx, y, 2.14);
        this.box(group, 1.1, 0.07, 0.09, 0xf2e3c9, dx, y, 2.14);
        for (const side of [-1, 1]) this.box(group, 0.27, 1.44, 0.12, roofMaterial, dx + side * 0.83, y, 2.05);
      }
    }
    // A porch with real columns, steps, and a pediment.
    this.box(group, 3.6, 0.27, 1.8, 0xd0c9bd, 0, 0.4, 2.75);
    this.box(group, 2.8, 0.2, 0.48, 0xb5b2b0, 0, 0.17, 3.67);
    this.box(group, 1.25, 2.14, 0.2, 0x4e4d67, 0, 1.48, 2.06);
    this.box(group, 0.85, 1.34, 0.04, this.material(0x988aad, { emissive: 0x80779a, emissiveIntensity: 0.12 }), 0, 1.64, 2.18, false);
    this.sphere(group, 0.07, 0xefc780, 0.41, 1.29, 2.25, false);
    for (const dx of [-1.53, 1.53]) {
      this.cylinder(group, 0.16, 0.21, 2.5, 0xece1ca, dx, 1.77, 3.15, 12);
      this.box(group, 0.52, 0.16, 0.52, 0xe7dfcf, dx, 0.59, 3.15);
      this.box(group, 0.52, 0.16, 0.52, 0xe7dfcf, dx, 2.97, 3.15);
    }
    this.box(group, 3.8, 0.22, 1.78, 0xd9cfc2, 0, 3.08, 2.81);
    const porchRoof = this.roof(group, 4.05, 0.75, 1.88, roofMaterial, 3.2);
    porchRoof.position.z = 2.81;
    const greek = this.label(data.letters || ['Σ Φ', 'Β Ρ Ο', 'Δ Κ', 'Π Σ'][index % 4], 2.35, 0.69, { color: '#fff2d8', background: '#32354d', border: '#c6b695', size: 92 });
    greek.position.set(0, height + 1.22, 2.37);
    group.add(greek);
    for (const dx of [-4.7, 4.7]) {
      this.box(group, 2, 0.58, 1, 0x447565, dx, 0.4, 2.7);
      for (let j = 0; j < 3; j++) this.sphere(group, 0.1, index % 2 ? 0xf4b5c3 : 0xeab186, dx - 0.6 + j * 0.6, 0.72, 3.02, false);
    }
    for (const side of [-1, 1]) {
      this.box(group, 4.7, 0.13, 0.13, 0xc7c0b5, side * 4.65, 0.55, 4);
      for (let n = 0; n < 5; n++) this.box(group, 0.13, 0.91, 0.13, 0xd5cbb9, side * (2.7 + n * 0.96), 0.55, 4);
    }
    const yardSign = this.label(data.name || 'FRAT HOUSE', 3, 0.85, { size: 49, border: '#f2a395', subtitle: `${index + 1} / 12 • GREEK ROW` });
    yardSign.position.set(4.4, 1.47, 3.76);
    group.add(yardSign);
    this.box(group, 0.12, 1.4, 0.12, 0xd7c6aa, 4.4, 0.7, 3.74);
    const flames = this.makeFlames(group, width);
    flames.visible = false;
    const health = new THREE.Group();
    health.position.set(0, height + 3.3, 0.5);
    const healthBack = this.box(health, 3.8, 0.24, 0.1, 0x272a3e, 0, 0, 0, false);
    const healthFill = this.box(health, 3.55, 0.12, 0.13, this.material(0xbbed76, { emissive: 0xaadd66, emissiveIntensity: 0.5 }), 0, 0, 0.07, false);
    healthBack.castShadow = false;
    group.add(health);
    this.batchStatic(group, [flames, health, roof]);
    return { group, paint, originalColor: new THREE.Color(pastel), roofMaterial, windowMaterial, roof, flames, health, healthFill, burned: false, groundZ };
  }

  makeFlames(parent, width) {
    const flames = new THREE.Group();
    parent.add(flames);
    const outer = this.material(0xff693e, { emissive: 0xff4d16, emissiveIntensity: 1.8, transparent: true, opacity: 0.88, depthWrite: false });
    const inner = this.material(0xffd68d, { emissive: 0xffaa42, emissiveIntensity: 2.3, transparent: true, opacity: 0.95, depthWrite: false });
    for (let i = 0; i < 9; i++) {
      const flame = new THREE.Group();
      flame.position.set((i % 5 - 2) * width / 5, i < 5 ? 0.35 : 4.8, i < 5 ? 2.8 : 0.8);
      const a = this.mesh(flame, this.geometry('cone', [0.64, 2.7, 7]), outer, 0, 1.3, 0, false);
      const b = this.mesh(flame, this.geometry('cone', [0.35, 1.8, 7]), inner, 0, 0.82, 0.08, false);
      a.rotation.z = (i % 3 - 1) * 0.17;
      b.rotation.z = -0.13;
      flame.userData.phase = i * 2.16;
      flames.add(flame);
    }
    const smokeMaterial = this.material(0x4b4557, { transparent: true, opacity: 0.5, depthWrite: false });
    for (let i = 0; i < 4; i++) {
      const smoke = this.sphere(flames, 1.1, smokeMaterial, (i % 2 - 0.5) * 2.3, 6 + i, 0, false);
      smoke.userData.smoke = i;
    }
    return flames;
  }

  makePlayer() {
    const group = new THREE.Group();
    group.scale.setScalar(1.17);
    const body = new THREE.Group();
    group.add(body);
    const jacket = this.material(0x272837).clone();
    const trim = this.material(0xf06eae).clone();
    const hair = this.material(0x242434).clone();
    const skirtMaterial = this.material(0x9d5199).clone();
    const skin = this.material(0xe6b2a3);
    this.materials.set('player-jacket', jacket);
    this.materials.set('player-trim', trim);
    this.materials.set('player-hair', hair);
    this.materials.set('player-skirt', skirtMaterial);
    this.box(body, 0.57, 0.65, 0.62, jacket, 0, 1.31, 0);
    this.box(body, 0.025, 0.51, 0.06, 0xdde4db, 0.299, 1.29, 0);
    this.box(body, 0.035, 0.17, 0.16, trim, 0.307, 1.41, -0.17);
    this.cylinder(body, 0.16, 0.17, 0.18, skin, 0, 1.71, 0, 10);
    this.cylinder(body, 0.32, 0.47, 0.37, skirtMaterial, 0, 0.89, 0, 12);
    for (let i = 0; i < 8; i++) {
      const angle = i * TAU / 8;
      this.box(body, 0.045, 0.27, 0.045, 0xd29abc, Math.cos(angle) * 0.4, 0.87, Math.sin(angle) * 0.4, false);
    }
    this.cylinder(body, 0.31, 0.32, 0.11, 0x1e2836, 0, 1.06, 0);
    this.box(body, 0.05, 0.12, 0.17, 0xddc582, 0.33, 1.06, 0);
    const head = new THREE.Group();
    head.position.set(0.035, 1.96, 0);
    body.add(head);
    this.sphere(head, 0.32, skin).scale.set(0.93, 1.04, 0.88);
    const haircap = this.sphere(head, 0.33, hair, -0.09, 0.06, 0);
    haircap.scale.set(0.84, 1.02, 1.01);
    for (const side of [-1, 1]) {
      this.sphere(head, 0.037, 0x2e2c39, 0.291, 0.036, side * 0.105, false);
      this.sphere(head, 0.015, 0xffffff, 0.32, 0.048, side * 0.108, false);
      this.sphere(head, 0.052, skin, -0.015, -0.02, side * 0.29);
    }
    this.sphere(head, 0.058, skin, 0.322, -0.04, 0).scale.set(1, 0.7, 0.74);
    this.box(head, 0.027, 0.024, 0.11, 0xa04e66, 0.299, -0.133, 0, false);
    const earring = this.mesh(head, this.geometry('torus', [0.064, 0.019, 6, 12]), 0xe6dbaf, 0, -0.093, 0.31, false);
    earring.rotation.y = Math.PI / 2;
    const mohawk = new THREE.Group();
    head.add(mohawk);
    for (let i = 0; i < 5; i++) {
      const spike = this.mesh(mohawk, this.geometry('cone', [0.14, 0.41 + (2 - Math.abs(2 - i)) * 0.08, 5]), trim, -0.24 + i * 0.1, 0.37 - Math.abs(2 - i) * 0.025, 0);
      spike.rotation.z = (2 - i) * 0.2;
    }
    const ponytail = new THREE.Group();
    head.add(ponytail);
    this.sphere(ponytail, 0.19, hair, -0.35, 0.09, 0).scale.set(1.6, 1, 1);
    const tail = this.sphere(ponytail, 0.2, hair, -0.52, -0.18, 0);
    tail.scale.set(0.8, 1.8, 0.9);
    this.sphere(ponytail, 0.1, trim, -0.31, 0.07, 0);
    const pearls = new THREE.Group();
    body.add(pearls);
    for (let i = 0; i < 7; i++) this.sphere(pearls, 0.035, 0xfff2de, 0.31, 1.61 - Math.sin(i / 6 * Math.PI) * 0.14, -0.23 + i * 0.077, false);
    const legs = [];
    const arms = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(0, 0.83, side * 0.22);
      this.cylinder(leg, 0.12, 0.11, 0.46, 0x343344, 0, -0.2, 0, 10);
      const shin = new THREE.Group();
      shin.position.set(0, -0.43, 0);
      leg.add(shin);
      this.cylinder(shin, 0.11, 0.115, 0.28, skin, 0, -0.12, 0, 10);
      this.box(shin, 0.38, 0.24, 0.27, 0x202533, 0.075, -0.26, 0);
      this.box(shin, 0.43, 0.08, 0.3, 0x363f48, 0.09, -0.38, 0);
      this.box(shin, 0.12, 0.055, 0.285, trim, 0.06, -0.2, 0);
      body.add(leg);
      legs.push({ leg, shin });
      const arm = new THREE.Group();
      arm.position.set(0, 1.52, side * 0.4);
      this.cylinder(arm, 0.13, 0.12, 0.37, jacket, 0, -0.15, 0, 10);
      this.sphere(arm, 0.13, skin, 0.04, -0.42, 0);
      this.box(arm, 0.22, 0.09, 0.24, 0x292c3c, 0.025, -0.29, 0);
      body.add(arm);
      arms.push(arm);
    }
    const studs = new THREE.Group();
    body.add(studs);
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) this.mesh(studs, this.geometry('cone', [0.07, 0.17, 5]), 0xe5e8d8, -0.14 + i * 0.13, 1.75, side * 0.36);
    const halo = this.mesh(group, this.geometry('torus', [0.66, 0.045, 8, 40]), this.material(0xb4fa91, { emissive: 0xa6ee83, emissiveIntensity: 0.6 }), 0, 0.035, 0, false);
    halo.rotation.x = -Math.PI / 2;
    group.userData = { body, head, legs, arms, jacket, hair, trim, skirtMaterial, mohawk, ponytail, pearls, studs, halo };
    return group;
  }

  makeTarget() {
    const group = new THREE.Group();
    const material = this.material(0xc3f88e, { emissive: 0xb8f875, emissiveIntensity: 0.9, transparent: true, opacity: 0.8, depthWrite: false });
    const ring = this.mesh(group, this.geometry('torus', [1.2, 0.055, 8, 48]), material, 0, 0.15, 0, false);
    ring.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      const marker = this.box(group, 0.32, 0.04, 0.12, material, Math.cos(a) * 1.54, 0.16, Math.sin(a) * 1.54, false);
      marker.rotation.y = -a;
    }
    const arrow = this.mesh(group, this.geometry('cone', [0.24, 0.45, 3]), material, 0, 2.1, 0, false);
    arrow.rotation.z = Math.PI;
    group.userData = { ring, arrow };
    return group;
  }

  makeHazard(data) {
    const group = new THREE.Group();
    if (data.type === 'bro') {
      const shirt = [0xeee0b8, 0x92b1cb, 0xca8bb0][Math.abs(Number(data.id) || String(data.id).length) % 3];
      this.box(group, 0.78, 0.87, 0.6, shirt, 0, 1.23, 0);
      this.sphere(group, 0.32, 0xd3a591, 0, 1.99, 0);
      this.sphere(group, 0.33, 0x684c51, -0.05, 2.11, 0).scale.y = 0.51;
      this.box(group, 0.15, 0.19, 0.68, 0x313846, 0.28, 2.01, 0);
      for (const side of [-1, 1]) {
        this.box(group, 0.23, 0.62, 0.28, 0x647897, 0, 0.55, side * 0.23);
        this.box(group, 0.42, 0.18, 0.32, 0xe6dfd2, 0.09, 0.17, side * 0.23);
        this.cylinder(group, 0.14, 0.12, 0.71, 0xd3a591, 0, 1.15, side * 0.49, 8);
      }
      this.cylinder(group, 0.15, 0.12, 0.27, 0xe56871, 0.11, 0.84, 0.55, 10);
    } else if (data.type === 'keg') {
      const silver = this.material(0xabb6c1, { metalness: 0.62, roughness: 0.4 });
      this.cylinder(group, 0.57, 0.57, 1.1, silver, 0, 0.59, 0, 16);
      for (const y of [0.16, 0.37, 0.81, 1.02]) this.cylinder(group, 0.62, 0.62, 0.08, 0x718293, 0, y, 0, 16);
      this.box(group, 0.12, 0.39, 0.12, 0x263747, 0, 1.3, 0);
      this.box(group, 0.39, 0.1, 0.12, 0x2e3c4e, 0.13, 1.5, 0);
    } else {
      const pink = this.material(0xf997d5, { emissive: 0xf364c4, emissiveIntensity: 0.35, transparent: true, opacity: 0.8, metalness: 0.12 });
      this.box(group, 0.83, 1.15, 0.63, pink, 0, 0.78, 0);
      this.box(group, 0.59, 0.37, 0.44, 0xf4d99f, 0, 1.53, 0);
      const label = this.label('PINK', 0.67, 0.32, { color: '#6c305c', background: '#fce5ec', border: '#edb2cd', size: 160 });
      label.position.set(0, 0.78, 0.33);
      group.add(label);
      this.sphere(group, 0.28, this.material(0xef8bd3, { transparent: true, opacity: 0.19, depthWrite: false }), -0.6, 1.95, 0, false);
    }
    this.batchStatic(group);
    this.scene.add(group);
    return group;
  }

  makePickup(data) {
    const group = new THREE.Group();
    const color = data.type === 'vinyl' ? 0xe8baff : data.type === 'coffee' ? 0xffcb84 : 0xa4f9b6;
    if (data.type === 'vinyl') {
      const disc = this.cylinder(group, 0.52, 0.52, 0.08, 0x202938, 0, 0, 0, 32);
      disc.rotation.x = Math.PI / 2;
      const inner = this.cylinder(group, 0.22, 0.22, 0.09, 0xea94c9, 0, 0, 0.02, 24);
      inner.rotation.x = Math.PI / 2;
      for (const r of [0.34, 0.44]) this.mesh(group, this.geometry('torus', [r, 0.014, 5, 32]), 0x526074, 0, 0, 0.047, false);
    } else if (data.type === 'coffee') {
      this.cylinder(group, 0.32, 0.23, 0.65, 0xf0ded0, 0, 0, 0, 16);
      this.cylinder(group, 0.29, 0.26, 0.28, 0xb28167, 0, -0.01, 0, 16);
      this.cylinder(group, 0.36, 0.36, 0.11, 0x403642, 0, 0.37, 0, 16);
      this.sphere(group, 0.085, this.material(0xdce9e6, { transparent: true, opacity: 0.45, depthWrite: false }), 0, 0.6, 0, false);
    } else {
      const shape = new THREE.Shape();
      shape.moveTo(0.07, 0.68); shape.lineTo(-0.36, -0.04); shape.lineTo(-0.04, -0.04); shape.lineTo(-0.14, -0.61); shape.lineTo(0.42, 0.18); shape.lineTo(0.12, 0.18); shape.closePath();
      const key = 'pickup-bolt';
      if (!this.geometries.has(key)) this.geometries.set(key, new THREE.ExtrudeGeometry(shape, { depth: 0.15, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 }));
      this.mesh(group, this.geometries.get(key), this.material(color, { emissive: color, emissiveIntensity: 0.5 }), 0, 0, -0.075);
    }
    const hoop = this.mesh(group, this.geometry('torus', [0.76, 0.025, 6, 32]), this.material(color, { emissive: color, emissiveIntensity: 0.6, transparent: true, opacity: 0.72 }), 0, 0, 0, false);
    group.userData.hoop = hoop;
    this.scene.add(group);
    return group;
  }

  makeBottle() {
    const group = new THREE.Group();
    this.cylinder(group, 0.14, 0.14, 0.49, this.material(0x6ca999, { metalness: 0.1 }), 0, 0, 0, 10);
    this.cylinder(group, 0.06, 0.11, 0.23, 0x9ac18e, 0, 0.36, 0, 10);
    this.box(group, 0.28, 0.17, 0.15, 0xe7d4a7, 0, 0, 0.07, false);
    this.mesh(group, this.geometry('cone', [0.16, 0.57, 7]), this.material(0xffb65e, { emissive: 0xff944b, emissiveIntensity: 2 }), 0, 0.67, 0, false);
    this.scene.add(group);
    return group;
  }

  burst(x, z, color = 0xff603c, count = 18) {
    const material = this.material(color, { emissive: color, emissiveIntensity: 0.5 });
    for (let i = 0; i < Math.min(count, 48); i++) {
      if (this.particles.length >= 160) {
        const old = this.particles.shift();
        this.scene.remove(old.mesh);
      }
      const mesh = this.mesh(this.scene, this.geometry('box', [0.13, 0.13, 0.13]), material, x, 0.4, z, false);
      const a = Math.random() * TAU;
      const speed = 1.5 + Math.random() * 3.5;
      this.particles.push({ mesh, vx: Math.cos(a) * speed, vy: 2.5 + Math.random() * 4.5, vz: Math.sin(a) * speed, life: 0.65 + Math.random() * 0.65, total: 1.3 });
    }
  }

  resize() {
    this.width = Math.max(1, this.container.clientWidth || window.innerWidth);
    this.height = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.renderer.setSize(this.width, this.height, false);
    this.updateProjection();
  }

  updateProjection() {
    const aspect = this.width / this.height;
    const viewHeight = this.portrait ? Math.max(31, 21 / aspect) : Math.max(23.5, 37 / aspect);
    this.camera.left = -viewHeight * aspect / 2;
    this.camera.right = viewHeight * aspect / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.updateProjectionMatrix();
  }

  syncEntities(items, map, create, update) {
    const seen = new Set();
    for (const data of items || []) {
      seen.add(data.id);
      let mesh = map.get(data.id);
      if (!mesh) { mesh = create.call(this, data); map.set(data.id, mesh); }
      update(mesh, data);
    }
    for (const [id, mesh] of map) if (!seen.has(id)) {
      mesh.traverse(object => {const geometry=object.geometry;if(geometry&&this.geometries.has(`batch:${geometry.uuid}`)){geometry.dispose();this.geometries.delete(`batch:${geometry.uuid}`);}});
      this.scene.remove(mesh); map.delete(id);
    }
  }

  render(state, dt = 1 / 60) {
    this.idleTime = (this.idleTime || 0) + dt;
    const time = state.phase === 'title' ? this.idleTime : (state.time || 0);
    const player = state.player || { x: 0, z: 0, pipeline: 0, level: 0 };
    const title = state.phase === 'title';
    if (this.portrait !== Boolean(state.portrait)) {
      this.portrait = Boolean(state.portrait);
      this.updateProjection();
    }
    const desiredFocus = title ? (this.portrait ? 10 : (player.x || 5) - 5) : (state.distance ?? player.x ?? 0) + (this.portrait ? 2 : 6.5);
    this.focus = this.focus == null || Math.abs(this.focus - desiredFocus) > 55 ? desiredFocus : THREE.MathUtils.lerp(this.focus, desiredFocus, 1 - Math.exp(-Math.max(dt, 0.016) * 5));
    if (this.portrait) {
      this.camera.position.set(this.focus - 29, 34, -1.2);
      this.camera.lookAt(this.focus + 4, 0, -4);
    } else {
      this.camera.position.set(this.focus - 11, 24, 30);
      this.camera.lookAt(this.focus + 1, 0, -3.4);
    }
    this.camera.updateMatrixWorld();
    this.sun.position.set(this.focus - 18, 30, 19);
    this.sun.target.position.set(this.focus, 0, -2);
    for (const group of this.decorations) group.visible = Math.abs(group.position.x - this.focus) < 61;
    const liveIds = new Set();
    for (let i = 0; i < (state.houses || []).length; i++) {
      const house = state.houses[i];
      liveIds.add(house.id);
      let rendered = this.houseMeshes.get(house.id);
      if (!rendered) { rendered = this.makeHouse(house, i); this.houseMeshes.set(house.id, rendered); }
      rendered.group.visible = Math.abs(house.x - this.focus) < 58;
      if (!rendered.group.visible) continue;
      const burned = Boolean(house.burned);
      if (burned !== rendered.burned) {
        rendered.burned = burned;
        rendered.paint.color.copy(burned ? new THREE.Color(0x61505c) : rendered.originalColor);
        rendered.roofMaterial.color.set(burned ? 0x3c3448 : [0x545b79, 0x74556e, 0x465b68][i % 3]);
        rendered.windowMaterial.emissive.set(burned ? 0xff672f : 0xffbe77);
        rendered.windowMaterial.emissiveIntensity = burned ? 1.8 : 0.72;
        rendered.roof.rotation.z = burned ? 0.025 : 0;
      }
      rendered.flames.visible = burned;
      if (burned) for (let j = 0; j < rendered.flames.children.length; j++) {
        const flame = rendered.flames.children[j];
        if (flame.userData.smoke != null) {
          const phase = (time * 0.27 + flame.userData.smoke * 0.24) % 1;
          flame.position.y = 6 + phase * 7;
          flame.position.x = Math.sin(time * 0.7 + j) * 0.6 + phase * 1.7;
          flame.scale.setScalar(0.75 + phase * 1.6);
        } else {
          flame.scale.y = 0.76 + Math.sin(time * 8.5 + flame.userData.phase) * 0.22;
          flame.rotation.z = Math.sin(time * 6 + flame.userData.phase) * 0.1;
        }
      }
      const hp = clamp((house.hp ?? 1) / (house.maxHp || 1), 0, 1);
      rendered.health.visible = !burned && house.id === state.targetId && state.phase === 'playing';
      rendered.health.quaternion.copy(this.camera.quaternion);
      rendered.healthFill.scale.x = hp;
      rendered.healthFill.position.x = -(1 - hp) * 1.775;
    }
    for (const [id, rendered] of this.houseMeshes) if (!liveIds.has(id)) { this.scene.remove(rendered.group); this.houseMeshes.delete(id); }
    const p = this.player.userData;
    const pipeline = clamp((player.pipeline || 0) / 100, 0, 1);
    const level = player.level || 0;
    this.player.position.set(player.x || 0, 0.12, player.z || 0);
    this.player.visible = !(player.invulnerable > 0 && Math.sin(time * 26) < -0.5);
    const running = state.phase === 'playing';
    const stride = time * (player.dashing > 0 ? 24 : 13);
    p.body.position.y = running ? Math.abs(Math.sin(stride)) * 0.09 : Math.sin(time * 2.4) * 0.025;
    p.body.rotation.z = player.dashing > 0 ? -0.28 : -0.045;
    for (let i = 0; i < 2; i++) {
      const swing = running ? Math.sin(stride + i * Math.PI) : 0;
      p.legs[i].leg.rotation.z = swing * 0.62;
      p.legs[i].shin.rotation.z = Math.max(0, -swing) * 0.73;
      p.arms[i].rotation.z = -swing * 0.68 - 0.18;
    }
    p.head.rotation.y = Math.sin(time * 1.3) * 0.06;
    p.jacket.color.set(0x272837).lerp(new THREE.Color(0xf1a7c6), pipeline);
    p.hair.color.set(level > 1 ? 0x6754a2 : 0x242434).lerp(new THREE.Color(0xeac67e), pipeline);
    p.trim.color.set([0xf06eae, 0xb2ef86, 0xa99aff][Math.min(level, 2)]);
    p.skirtMaterial.color.set(0x90538f).lerp(new THREE.Color(0xe8aec9), pipeline);
    p.mohawk.scale.set(1 + level * 0.13, Math.max(0.05, 1 - pipeline) * (1 + level * 0.2), 1 + level * 0.1);
    p.ponytail.visible = pipeline > 0.36;
    p.ponytail.scale.setScalar(pipeline);
    p.pearls.visible = pipeline > 0.5;
    p.studs.visible = pipeline < 0.68;
    p.studs.scale.y = 1 + level * 0.3;
    p.halo.material.color.set(player.dashing > 0 ? 0xffffff : 0xb4fa91);
    p.halo.scale.setScalar(1 + (player.dashing > 0 ? 0.2 : 0));
    if (state.phase === 'transform') { p.body.rotation.y = time * 8; p.body.position.y = 0.2 + Math.sin(time * 6) * 0.12; }
    else p.body.rotation.y = 0;
    this.syncEntities(state.hazards, this.hazardMeshes, this.makeHazard, (mesh, item) => {
      mesh.position.set(item.x, 0.08, item.z);
      mesh.visible = Math.abs(item.x - this.focus) < 48;
      if (item.type === 'pink') mesh.position.y += 0.14 + Math.sin(time * 2 + item.x) * 0.1;
      if (item.type === 'bro') mesh.rotation.z = Math.sin(time * 5 + item.x) * 0.045;
    });
    this.syncEntities(state.pickups, this.pickupMeshes, this.makePickup, (mesh, item) => {
      mesh.position.set(item.x, 1.04 + Math.sin(time * 3.2 + item.x) * 0.18, item.z);
      mesh.rotation.y = time * 1.6;
      mesh.visible = Math.abs(item.x - this.focus) < 48;
      mesh.userData.hoop.rotation.z = -time * 0.5;
    });
    this.syncEntities(state.projectiles, this.bottleMeshes, this.makeBottle, (mesh, item) => {
      const progress = clamp(item.progress || 0, 0, 1);
      mesh.position.set(THREE.MathUtils.lerp(item.fromX, item.toX, progress), 1.5 * (1 - progress) + Math.sin(progress * Math.PI) * 5.7 + 0.1, THREE.MathUtils.lerp(item.fromZ, item.toZ, progress));
      mesh.rotation.z = progress * TAU * 1.4;
      mesh.rotation.x = progress * 2;
    });
    const target = (state.houses || []).find(h => h.id === state.targetId && !h.burned);
    this.target.visible = Boolean(target) && state.phase === 'playing';
    if (target) {
      this.target.position.set(target.x, 0.02, -6.6);
      this.target.userData.ring.scale.setScalar(1 + Math.sin(time * 4) * 0.07);
      this.target.userData.arrow.position.y = 2 + Math.sin(time * 4) * 0.22;
      this.target.userData.arrow.rotation.y = time * 1.3;
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.life -= dt;
      if (particle.life <= 0) { this.scene.remove(particle.mesh); this.particles.splice(i, 1); continue; }
      particle.vy -= dt * 9;
      particle.mesh.position.x += particle.vx * dt;
      particle.mesh.position.y += particle.vy * dt;
      particle.mesh.position.z += particle.vz * dt;
      particle.mesh.rotation.x += dt * 6;
      particle.mesh.rotation.z += dt * 5;
      particle.mesh.scale.setScalar(Math.min(1, particle.life * 2));
    }
    this.renderer.render(this.scene, this.camera);
  }

  project(x, z, y = 0) {
    this.projectVector.set(x, y, z).project(this.camera);
    return { x: (this.projectVector.x + 1) * this.width / 2, y: (1 - this.projectVector.y) * this.height / 2 };
  }

  dispose() {
    for (const geometry of this.geometries.values()) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    for (const texture of this.textures) texture.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
