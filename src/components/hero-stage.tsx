import { useEffect, useRef } from "react";
import * as THREE from "three";

function chartTexture(seed: number, up: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const g = canvas.getContext("2d");
  if (!g) return new THREE.CanvasTexture(canvas);
  g.fillStyle = "#120f1c";
  g.fillRect(0, 0, 640, 360);
  g.strokeStyle = "rgba(166,152,181,0.15)";
  for (let y = 40; y < 340; y += 40) {
    g.beginPath();
    g.moveTo(24, y);
    g.lineTo(616, y);
    g.stroke();
  }
  for (let i = 0; i < 22; i += 1) {
    const x = 36 + i * 26;
    const body = 28 + Math.abs(Math.sin(seed + i * 0.7)) * 70;
    const y = 180 + Math.sin(i * 0.45 + seed) * 70;
    const green = Math.sin(i + seed) > 0 ? up : !up;
    g.fillStyle = green ? "#12b981" : "#ef4444";
    g.fillRect(x, y - body / 2, 14, body);
    g.fillRect(x + 6, y - body / 2 - 16, 2, body + 32);
  }
  g.fillStyle = "#f59e0b";
  g.font = "600 22px sans-serif";
  g.fillText("BTC / USDT", 28, 36);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function HeroStage() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = host.current;
    if (!parent) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(parent.clientWidth, parent.clientHeight);
    parent.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, parent.clientWidth / Math.max(parent.clientHeight, 1), 0.1, 50);
    camera.position.set(0, 0.35, 6.2);

    scene.add(new THREE.AmbientLight(0x6b46c1, 0.55));
    const gold = new THREE.PointLight(0xf59e0b, 18, 18);
    gold.position.set(2.4, 1.6, 3);
    scene.add(gold);
    const violet = new THREE.PointLight(0x6b46c1, 16, 16);
    violet.position.set(-2.6, -0.4, 2);
    scene.add(violet);

    const group = new THREE.Group();
    scene.add(group);
    const planes: THREE.Mesh[] = [];
    const textures: THREE.Texture[] = [];
    [0, 1, 2].forEach((i) => {
      const texture = chartTexture(i * 1.7, i !== 1);
      textures.push(texture);
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(2.5, 1.4),
        new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.45,
          metalness: 0.25,
          emissive: new THREE.Color("#1a1030"),
        }),
      );
      mesh.position.set((i - 1) * 1.7, i === 1 ? 0.15 : -0.25, -i * 0.55);
      mesh.rotation.y = (i - 1) * 0.28;
      mesh.rotation.x = -0.12;
      group.add(mesh);
      planes.push(mesh);
    });

    const dots = new THREE.BufferGeometry();
    const positions = new Float32Array(180 * 3);
    for (let i = 0; i < 180; i += 1) {
      positions[i * 3] = (Math.sin(i * 12.3) * 0.5 + (i % 10) - 5) * 0.7;
      positions[i * 3 + 1] = Math.cos(i * 4.1) * 2.2;
      positions[i * 3 + 2] = Math.sin(i) * 3 - 1;
    }
    dots.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      dots,
      new THREE.PointsMaterial({ color: 0xf59e0b, size: 0.035, transparent: true, opacity: 0.75 }),
    );
    scene.add(points);

    let frame = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const clock = new THREE.Clock();
    const tick = () => {
      const t = clock.getElapsedTime();
      if (!reduce) {
        camera.position.x = Math.sin(t * 0.16) * 0.55;
        camera.position.y = 0.28 + Math.sin(t * 0.11) * 0.12;
        camera.lookAt(0, 0, 0);
        group.rotation.y = Math.sin(t * 0.08) * 0.18;
        points.rotation.y = t * 0.04;
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => {
      if (!parent) return;
      camera.aspect = parent.clientWidth / Math.max(parent.clientHeight, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(parent.clientWidth, parent.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      planes.forEach((mesh) => {
        mesh.geometry.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material.dispose();
      });
      textures.forEach((texture) => texture.dispose());
      dots.dispose();
      (points.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} className="absolute inset-0" aria-hidden="true" />;
}
