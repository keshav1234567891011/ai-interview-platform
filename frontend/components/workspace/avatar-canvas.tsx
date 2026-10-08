"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
export default function AvatarCanvas({ state, onFailure }: { state: "idle" | "asking" | "listening" | "thinking"; onFailure: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const current = useRef(state);
  useEffect(() => { current.current = state; }, [state]);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer | undefined;
    let resize: ResizeObserver | undefined;
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const failed = () => onFailure();
    try {
      const context = element.getContext("webgl2", { alpha: true, antialias: true });
      if (!context) throw new Error("WebGL unavailable");
      renderer = new THREE.WebGLRenderer({ canvas: element, context, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, 1, .1, 100);
      camera.position.set(0, .1, 5);
      scene.add(new THREE.AmbientLight(0xffffff, 2));
      const light = new THREE.DirectionalLight(0xffffff, 3); light.position.set(3, 3, 4); scene.add(light);
      const accent = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
      const shell = new THREE.MeshStandardMaterial({ color: accent, roughness: .65, metalness: .15 });
      const dark = new THREE.MeshStandardMaterial({ color: 0x17181d, roughness: .8 });
      const bright = new THREE.MeshStandardMaterial({ color: 0x79c8d7, emissive: 0x197487, emissiveIntensity: .35 });
      materials.push(shell, dark, bright);
      const body = new THREE.Group(); scene.add(body);
      function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) {
        geometries.push(geometry); const item = new THREE.Mesh(geometry, material); item.position.set(x, y, z); body.add(item); return item;
      }
      mesh(new THREE.SphereGeometry(.55, 24, 16), shell, 0, .5, 0);
      const visor = mesh(new THREE.SphereGeometry(.43, 24, 12), dark, 0, .51, .28); visor.scale.set(1, .45, .55);
      for (const x of [-.18, .18]) mesh(new THREE.SphereGeometry(.055, 12, 8), bright, x, .56, .51);
      const mouth = mesh(new THREE.BoxGeometry(.17, .028, .02), bright, 0, .4, .52);
      const torso = mesh(new THREE.SphereGeometry(.55, 24, 16), shell, 0, -.35, -.05); torso.scale.set(1.3, .8, .7);
      mesh(new THREE.CylinderGeometry(.1, .1, .25, 12), dark, 0, -.03, 0);
      for (const x of [-.65, .65]) { const hand = mesh(new THREE.SphereGeometry(.17, 16, 12), shell, x, -.55, .16); hand.scale.y = 1.4; }
      const resizeCanvas = () => { const width = element.clientWidth, height = element.clientHeight; if (width && height && renderer) { renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.render(scene, camera); } };
      resize = new ResizeObserver(resizeCanvas); resize.observe(element); resizeCanvas();
      let previous = 0;
      renderer.setAnimationLoop((time) => {
        if (!renderer || time - previous < 33) return;
        previous = time; body.position.y = Math.sin(time / 1800) * .025;
        body.rotation.y = Math.sin(time / 3000) * .035;
        mouth.scale.y = current.current === "asking" ? 1 + Math.abs(Math.sin(time / 110)) * 4 : 1;
        body.rotation.z = current.current === "listening" ? -.035 : 0;
        renderer.render(scene, camera);
      });
      element.addEventListener("webglcontextlost", failed);
    } catch { queueMicrotask(failed); }
    return () => { element.removeEventListener("webglcontextlost", failed); resize?.disconnect(); renderer?.setAnimationLoop(null); geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose()); renderer?.dispose(); renderer?.forceContextLoss(); };
  }, [onFailure]);
  return <canvas ref={canvas} className="avatar-canvas" role="img" aria-label="Stylized procedural interviewer avatar" />;
}
