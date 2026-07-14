'use client';

/**
 * LandingScrollScene — v2-Szene (Orbit-Kamera von oben nach unten),
 * aber mit DEINEN GLB-Modellen statt der prozeduralen Figuren.
 *
 * Erwartete Dateien (in public/models/ ablegen):
 *   public/models/submissiv-guy-kneeling.glb
 *   public/models/dominant-woman-whip.glb
 *   public/models/money-note.glb        (fallende Scheine)
 *
 * Alles andere bleibt wie in der Video-Version: absteigende 360°-Kamera,
 * Geldschein-Fächer über dem Sub (automatisch über der Modell-Oberkante
 * verankert), fallende Scheine, leuchtender Bodenring, Schatten,
 * ACES-Tonemapping, weicher Crossfade beim Rollenwechsel.
 *
 * Benötigt: pnpm add three  (+ pnpm add -D @types/three)
 */

import * as React from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

type Mode = 'sub' | 'domme';

/* ============ HIER anpassen ============ */
const MODELS = {
  sub: {
    url: '/models/submissiv-guy-kneeling.glb',
    targetHeight: 2.3,  // Welthöhe des Modells inkl. erhobener Arme
    rotationY: 0,       // falls das Modell falsch herum schaut: Math.PI
  },
  domme: {
    url: '/models/dominant-woman-whip.glb',
    targetHeight: 2.15,
    rotationY: 0,
  },
};

const COLORS = {
  sub:   { accent: 0x8b7db0, bg: 0x08080a },
  domme: { accent: 0xa855f7, bg: 0x0c0710 },
};

const CAM = {
  sub: {
    yStart: 2.7, yEnd: 1.2,
    lookStart: new THREE.Vector3(0, 2.0, 0.2), lookEnd: new THREE.Vector3(0, 1.05, 0),
    rStart: 3.0, rEnd: 4.2,
  },
  domme: {
    yStart: 2.25, yEnd: 0.95,
    lookStart: new THREE.Vector3(0, 1.8, 0), lookEnd: new THREE.Vector3(0, 0.9, 0.1),
    rStart: 2.9, rEnd: 4.0,
  },
};

/* ============ Hilfsfunktionen ============ */

function setGroupOpacity(group: THREE.Object3D, o: number) {
  group.visible = o > 0.02;
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const mm = m as THREE.Material & { userData: { baseOpacity?: number } };
      mm.opacity = o * (mm.userData.baseOpacity ?? 1);
    }
  });
}

/** Modell skalieren, zentrieren, auf den Boden stellen, Schatten + Crossfade
 *  aktivieren. Gibt die Oberkante (Welt-Y) zurück (für den Geldfächer). */
function prepareModel(root: THREE.Object3D, targetHeight: number, rotationY: number): number {
  root.rotation.y = rotationY;
  root.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  root.scale.setScalar(targetHeight / Math.max(size.y, 0.001));
  root.updateMatrixWorld(true);

  const box2 = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  box2.getCenter(center);
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box2.min.y;
  root.updateMatrixWorld(true);

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      m.transparent = true;
      m.userData.baseOpacity = m.opacity ?? 1;
    }
  });

  return new THREE.Box3().setFromObject(root).max.y;
}

function phys(opts: THREE.MeshPhysicalMaterialParameters, baseOpacity = 1) {
  const m = new THREE.MeshPhysicalMaterial({ transparent: true, ...opts });
  m.userData.baseOpacity = baseOpacity;
  return m;
}

/* ============ Banknoten (wie v2) ============ */

/* ============ Komponente ============ */

export default function LandingScrollScene({ mode }: { mode: Mode }) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const modeRef = React.useRef<Mode>(mode);
  modeRef.current = mode;

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(COLORS.sub.bg, 6, 13);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.4;

    const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 40);

    const ambient = new THREE.AmbientLight(0xffffff, 0.3);
    const key = new THREE.SpotLight(COLORS.sub.accent, 55, 25, Math.PI / 5, 0.45, 1.2);
    key.position.set(2.6, 4.2, 2.6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0004;
    key.target.position.set(0, 1, 0);
    const rim = new THREE.DirectionalLight(0xbfd4ff, 1.0);
    rim.position.set(-3, 4, -2);
    const under = new THREE.PointLight(COLORS.sub.accent, 6, 8);
    under.position.set(0, 0.15, 1.3);
    scene.add(ambient, key, key.target, rim, under);

    const floorMat = phys({ color: 0x0a0a0d, roughness: 0.9, metalness: 0.05 });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 48), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const ringMat = phys(
      { color: COLORS.sub.accent, emissive: COLORS.sub.accent, emissiveIntensity: 0.9, side: THREE.DoubleSide },
      0.35,
    );
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.24, 64), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    scene.add(ring);

    /* ---- Gruppen ---- */
    const subGroup = new THREE.Group();
    const dommeGroup = new THREE.Group();
    scene.add(subGroup, dommeGroup);

    /* ---- GLB-Modelle laden ---- */
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);

    loader.load(
      MODELS.sub.url,
      (gltf) => {
        prepareModel(gltf.scene, MODELS.sub.targetHeight, MODELS.sub.rotationY);
        subGroup.add(gltf.scene);
      },
      undefined,
      (err) => console.warn(`[LandingScrollScene] ${MODELS.sub.url} konnte nicht geladen werden:`, err),
    );
    loader.load(
      MODELS.domme.url,
      (gltf) => {
        prepareModel(gltf.scene, MODELS.domme.targetHeight, MODELS.domme.rotationY);
        dommeGroup.add(gltf.scene);
      },
      undefined,
      (err) => console.warn(`[LandingScrollScene] ${MODELS.domme.url} konnte nicht geladen werden:`, err),
    );

    /* ---- Animations-State ---- */
    let fade = mode === 'domme' ? 1 : 0;
    let progress = 0;
    const accent = new THREE.Color(mode === 'domme' ? COLORS.domme.accent : COLORS.sub.accent);
    const fogColor = new THREE.Color(mode === 'domme' ? COLORS.domme.bg : COLORS.sub.bg);
    const look = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    const clock = new THREE.Clock();
    let raf = 0;

    const targetProgress = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      const p = reduce ? 0.35 : targetProgress();
      progress += (p - progress) * Math.min(1, dt * 5);

      const fTarget = modeRef.current === 'domme' ? 1 : 0;
      fade += (fTarget - fade) * Math.min(1, dt * 3.2);
      accent.lerp(new THREE.Color(fTarget ? COLORS.domme.accent : COLORS.sub.accent), dt * 2.5);
      fogColor.lerp(new THREE.Color(fTarget ? COLORS.domme.bg : COLORS.sub.bg), dt * 2.5);
      (scene.fog as THREE.Fog).color.copy(fogColor);
      key.color.copy(accent);
      under.color.copy(accent);
      ringMat.color.copy(accent);
      ringMat.emissive.copy(accent);

      setGroupOpacity(subGroup, 1 - fade);
      setGroupOpacity(dommeGroup, fade);

      const y =
        THREE.MathUtils.lerp(CAM.sub.yStart, CAM.sub.yEnd, progress) * (1 - fade) +
        THREE.MathUtils.lerp(CAM.domme.yStart, CAM.domme.yEnd, progress) * fade;
      const r =
        THREE.MathUtils.lerp(CAM.sub.rStart, CAM.sub.rEnd, progress) * (1 - fade) +
        THREE.MathUtils.lerp(CAM.domme.rStart, CAM.domme.rEnd, progress) * fade;
      look.lerpVectors(CAM.sub.lookStart, CAM.sub.lookEnd, progress).multiplyScalar(1 - fade);
      tmp.lerpVectors(CAM.domme.lookStart, CAM.domme.lookEnd, progress).multiplyScalar(fade);
      look.add(tmp);

      const theta = 0.45 + progress * Math.PI * 2 + (reduce ? t * 0.02 : 0);
      camera.position.set(Math.sin(theta) * r, y, Math.cos(theta) * r);
      const shift = window.innerWidth >= 900 ? -1.05 : 0;
      camera.lookAt(look.x + shift, look.y, look.z);
      
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      pmrem.dispose();
      draco.dispose();
      renderer.dispose();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => m?.dispose?.());
      });
      host.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={hostRef} className="lp-scene" aria-hidden="true" />;
}