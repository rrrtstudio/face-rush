import * as THREE from "three";
import { COLOR_DEFINITIONS } from "./cube.js";

const FLASH_DURATION_MS = 1000;
const BURST_DURATION_MS = 900;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.flashes = [];
    this.bursts = [];
    this.audioContext = null;
  }

  unlockAudio() {
    if (this.audioContext) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    this.audioContext = new AudioContextClass();
  }

  playClearSound() {
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    gain.connect(this.audioContext.destination);

    for (const [index, frequency] of [523.25, 783.99].entries()) {
      const oscillator = this.audioContext.createOscillator();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.035);
      oscillator.connect(gain);
      oscillator.start(now + index * 0.035);
      oscillator.stop(now + 0.24);
    }
  }

  flashStickers(stickers) {
    const materials = stickers.map((sticker) => sticker.mesh.material);

    this.flashes.push({
      age: 0,
      duration: FLASH_DURATION_MS,
      materials,
      originals: materials.map((material) => ({
        emissive: material.emissive.clone(),
        intensity: material.emissiveIntensity,
      })),
    });
  }

  createBurst(origin, colorName) {
    const count = 96;
    const color = COLOR_DEFINITIONS[colorName]?.hex ?? 0xffffff;
    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i += 1) {
      const direction = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.2,
        Math.random() - 0.5
      ).normalize();
      const speed = 1.2 + Math.random() * 2.8;
      const offset = direction.clone().multiplyScalar(0.12 + Math.random() * 0.2);

      positions[i * 3] = origin.x + offset.x;
      positions[i * 3 + 1] = origin.y + offset.y;
      positions[i * 3 + 2] = origin.z + offset.z;
      velocities.push(direction.multiplyScalar(speed));
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color,
      size: 0.055,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    this.scene.add(points);

    this.bursts.push({
      age: 0,
      duration: BURST_DURATION_MS,
      geometry,
      material,
      points,
      velocities,
    });
  }

  update(deltaMs) {
    this.updateFlashes(deltaMs);
    this.updateBursts(deltaMs);
  }

  updateFlashes(deltaMs) {
    for (let i = this.flashes.length - 1; i >= 0; i -= 1) {
      const flash = this.flashes[i];
      flash.age += deltaMs;
      const progress = Math.min(1, flash.age / flash.duration);
      const intensity = Math.sin(progress * Math.PI) * 1.25;

      for (const material of flash.materials) {
        material.emissive.set(0xffffff);
        material.emissiveIntensity = intensity;
      }

      if (progress >= 1) {
        flash.materials.forEach((material, index) => {
          material.emissive.copy(flash.originals[index].emissive);
          material.emissiveIntensity = flash.originals[index].intensity;
        });
        this.flashes.splice(i, 1);
      }
    }
  }

  updateBursts(deltaMs) {
    for (let i = this.bursts.length - 1; i >= 0; i -= 1) {
      const burst = this.bursts[i];
      burst.age += deltaMs;
      const progress = Math.min(1, burst.age / burst.duration);
      const positions = burst.geometry.attributes.position.array;

      for (let particle = 0; particle < burst.velocities.length; particle += 1) {
        const velocity = burst.velocities[particle];
        positions[particle * 3] += velocity.x * (deltaMs / 1000);
        positions[particle * 3 + 1] += velocity.y * (deltaMs / 1000);
        positions[particle * 3 + 2] += velocity.z * (deltaMs / 1000);
        velocity.y -= 1.6 * (deltaMs / 1000);
      }

      burst.geometry.attributes.position.needsUpdate = true;
      burst.material.opacity = 1 - progress;

      if (progress >= 1) {
        this.scene.remove(burst.points);
        burst.geometry.dispose();
        burst.material.dispose();
        this.bursts.splice(i, 1);
      }
    }
  }
}
