import * as THREE from 'three';

export class ParticleManager {
  constructor(scene) {
    this.scene = scene;
    this.effects = [];
  }

  createExplosion(position, color) {
    const particleCount = 100;
    const particlesGeometry = new THREE.BufferGeometry();
    const posArray = new Float32Array(particleCount * 3);
    const velocities = [];

    for (let i = 0; i < particleCount; i++) {
        posArray[i * 3 + 0] = 0;
        posArray[i * 3 + 1] = 0;
        posArray[i * 3 + 2] = 0;

        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            Math.random() * 2,
            (Math.random() - 0.5) * 2
        );
        velocities.push(velocity);
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.08,
      color: color === 'white' ? 0xFFFFF0 : 0x555555,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particleSystem = new THREE.Points(particlesGeometry, particleMaterial);
    particleSystem.position.copy(position);
    this.scene.add(particleSystem);

    this.effects.push({
      system: particleSystem,
      velocities: velocities,
      startTime: Date.now(),
      duration: 1000,
    });
  }
  
  createGameOverEffect(type) {
    let particleCount, colors, initialVelocity, gravity, size;
    switch (type) {
      case 'win':
        particleCount = 400;
        colors = [new THREE.Color(0xf1c40f), new THREE.Color(0xe67e22), new THREE.Color(0xffffff)];
        initialVelocity = () => new THREE.Vector3(
            (Math.random() - 0.5) * 15,
            Math.random() * 10 + 5,
            (Math.random() - 0.5) * 15
        );
        gravity = new THREE.Vector3(0, -9.8, 0);
        size = 0.15;
        break;
      case 'lose':
        particleCount = 100;
        colors = [new THREE.Color(0x34495e)];
        initialVelocity = () => new THREE.Vector3(
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5
        );
        gravity = new THREE.Vector3(0, -0.5, 0);
        size = 0.05;
        break;
      case 'draw':
        particleCount = 150;
        colors = [new THREE.Color(0xbdc3c7), new THREE.Color(0xecf0f1)];
        initialVelocity = () => new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            Math.random() * 2 - 1,
            (Math.random() - 0.5) * 2
        );
        gravity = new THREE.Vector3(0, 0, 0); // Floaty
        size = 0.08;
        break;
      default: return;
    }
    const particlesGeometry = new THREE.BufferGeometry();
    const posArray = new Float32Array(particleCount * 3);
    const colorArray = new Float32Array(particleCount * 3);
    const velocities = [];
    for (let i = 0; i < particleCount; i++) {
        posArray[i * 3 + 0] = (Math.random() - 0.5) * 8; // Spread across the board
        posArray[i * 3 + 1] = type === 'win' ? 12 : 3; // Start from top for win, mid for others
        posArray[i * 3 + 2] = (Math.random() - 0.5) * 8;
        
        const color = colors[Math.floor(Math.random() * colors.length)];
        colorArray[i * 3 + 0] = color.r;
        colorArray[i * 3 + 1] = color.g;
        colorArray[i * 3 + 2] = color.b;
        velocities.push(initialVelocity());
    }
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
    const particleMaterial = new THREE.PointsMaterial({
      size,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particleSystem = new THREE.Points(particlesGeometry, particleMaterial);
    this.scene.add(particleSystem);
    this.effects.push({
      system: particleSystem,
      velocities: velocities,
      startTime: Date.now(),
      duration: 5000, // Linger for 5 seconds
      gravity: gravity
    });
  }
  update() {
    const now = Date.now();
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      const elapsed = now - effect.startTime;
      const progress = elapsed / effect.duration;

      if (progress >= 1) {
        this.scene.remove(effect.system);
        effect.system.geometry.dispose();
        effect.system.material.dispose();
        this.effects.splice(i, 1);
        continue;
      }

      const positions = effect.system.geometry.attributes.position;
      for (let j = 0; j < positions.count; j++) {
        const velocity = effect.velocities[j];
        const deltaTime = 0.016; // Approximate delta time
        if (effect.gravity) {
            velocity.add(effect.gravity.clone().multiplyScalar(deltaTime));
        } else {
             velocity.y -= 0.05 * progress; // Default gravity
        }
        
        positions.setX(j, positions.getX(j) + velocity.x * deltaTime);
        positions.setY(j, positions.getY(j) + velocity.y * deltaTime);
        positions.setZ(j, positions.getZ(j) + velocity.z * deltaTime);
      }
      positions.needsUpdate = true;
      effect.system.material.opacity = Math.cos(progress * Math.PI / 2); // Fade out smoothly
    }
  }
}