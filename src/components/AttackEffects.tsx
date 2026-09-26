import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Quaternion, CylinderGeometry, RingGeometry, MeshBasicMaterial, InstancedMesh, Object3D, Group } from 'three';
import { onAttackEvent, useGameStore } from '../store';
import { AttackEvent, CharacterClass } from '../types';

interface BulletInstance {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  distTraveled: number;
  maxDist: number;
  color: string;
  charClass: CharacterClass;
  quat: Quaternion;
}

interface SlashArcInstance {
  id: string;
  x: number;
  y: number;
  z: number;
  ry: number;
  createdAt: number;
  duration: number;
}

// Singletons for Slash Arcs
const slashWaveGeo = new RingGeometry(3, 14, 16, 1, -Math.PI / 3, (2 * Math.PI) / 3);
const slashWaveMat = new MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.8, depthWrite: false, side: 2 });
const slashCoreGeo = new RingGeometry(11.5, 14, 16, 1, -Math.PI / 3.2, (2 * Math.PI) / 3.2);
const slashCoreMat = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false, side: 2 });

// Singletons for Bullets
const bulletGeo = new CylinderGeometry(0.12, 0.12, 1.8, 6);
const bulletMatYellow = new MeshBasicMaterial({ color: '#fbbf24' });

const MAX_BULLETS = 60;
const MAX_SLASH_POOLS = 8;
const tempObj = new Object3D();

export function AttackEffects() {
  const bulletsRef = useRef<BulletInstance[]>([]);
  const slashArcsRef = useRef<SlashArcInstance[]>([]);
  const instancedMeshRef = useRef<InstancedMesh>(null);
  const slashMeshRefs = useRef<(Group | null)[]>([]);

  useEffect(() => {
    const unsubAttack = onAttackEvent((evt: AttackEvent) => {
      const myId = useGameStore.getState().myId;
      const myPlayer = myId ? useGameStore.getState().gameState?.players[myId] : null;

      // Distance gating: if attack is > 85m away from player, skip visual effect to save GPU
      if (myPlayer) {
        const distSq = (evt.x - myPlayer.x) ** 2 + (evt.z - myPlayer.z) ** 2;
        if (distSq > 85 * 85) return;
      }

      if (evt.isSword) {
        if (slashArcsRef.current.length < MAX_SLASH_POOLS) {
          slashArcsRef.current.push({
            id: evt.id,
            x: evt.x,
            y: evt.y,
            z: evt.z,
            ry: evt.ry,
            createdAt: performance.now() / 1000,
            duration: 0.28,
          });
        }
      } else {
        const speed = 150;
        let dirX = -Math.sin(evt.ry);
        let dirY = 0;
        let dirZ = -Math.cos(evt.ry);

        if (evt.dirX !== undefined && evt.dirY !== undefined && evt.dirZ !== undefined) {
          dirX = evt.dirX;
          dirY = evt.dirY;
          dirZ = evt.dirZ;
        } else if (evt.targetPos) {
          const dx = evt.targetPos.x - evt.x;
          const dy = evt.targetPos.y - evt.y;
          const dz = evt.targetPos.z - evt.z;
          const len = Math.hypot(dx, dy, dz) || 1;
          dirX = dx / len;
          dirY = dy / len;
          dirZ = dz / len;
        }

        const rotQuat = new Quaternion();
        const lookDir = new Vector3(dirX, dirY, dirZ).normalize();
        rotQuat.setFromUnitVectors(new Vector3(0, 1, 0), lookDir);

        if (bulletsRef.current.length < MAX_BULLETS) {
          bulletsRef.current.push({
            id: evt.id,
            x: evt.x + dirX * 1.5,
            y: evt.y + dirY * 1.5,
            z: evt.z + dirZ * 1.5,
            vx: dirX * speed,
            vy: dirY * speed,
            vz: dirZ * speed,
            distTraveled: 0,
            maxDist: evt.range || 40,
            color: evt.characterClass === 'scout' ? '#38bdf8' : evt.characterClass === 'tank' ? '#34d399' : '#fbbf24',
            charClass: evt.characterClass,
            quat: rotQuat,
          });
        }
      }
    });

    return () => {
      unsubAttack();
    };
  }, []);

  // 100% Pure GPU/Three.js frame loop - ZERO React re-renders or setState calls
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const now = performance.now() / 1000;

    // 1. Update Bullets in InstancedMesh
    const activeBullets: BulletInstance[] = [];
    const count = bulletsRef.current.length;

    for (let i = 0; i < count; i++) {
      const b = bulletsRef.current[i];
      const stepDist = Math.hypot(b.vx * dt, b.vz * dt);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      b.distTraveled += stepDist;

      if (b.distTraveled < b.maxDist) {
        activeBullets.push(b);
      }
    }
    bulletsRef.current = activeBullets;

    if (instancedMeshRef.current) {
      const mesh = instancedMeshRef.current;
      const renderCount = Math.min(activeBullets.length, MAX_BULLETS);
      mesh.count = renderCount;

      for (let i = 0; i < renderCount; i++) {
        const b = activeBullets[i];
        tempObj.position.set(b.x, b.y, b.z);
        tempObj.quaternion.copy(b.quat);
        tempObj.scale.set(1, 1, 1);
        tempObj.updateMatrix();
        mesh.setMatrixAt(i, tempObj.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    // 2. Update Pre-allocated Slash Arcs (Direct mutation, no React state)
    const activeArcs: SlashArcInstance[] = [];
    for (let i = 0; i < slashArcsRef.current.length; i++) {
      const s = slashArcsRef.current[i];
      const age = now - s.createdAt;
      if (age < s.duration) {
        activeArcs.push(s);
      }
    }
    slashArcsRef.current = activeArcs;

    for (let i = 0; i < MAX_SLASH_POOLS; i++) {
      const meshGroup = slashMeshRefs.current[i];
      if (!meshGroup) continue;

      if (i < activeArcs.length) {
        const s = activeArcs[i];
        const progress = Math.min(1, Math.max(0, (now - s.createdAt) / s.duration));
        const scale = 0.5 + progress * 0.65;
        const forwardDist = 1.0 + progress * 2.5;
        const fx = -Math.sin(s.ry) * forwardDist;
        const fz = -Math.cos(s.ry) * forwardDist;

        meshGroup.visible = true;
        meshGroup.position.set(s.x + fx, s.y + 0.2, s.z + fz);
        meshGroup.rotation.set(0, s.ry, 0);
        meshGroup.scale.set(scale, 1, scale);
      } else {
        meshGroup.visible = false;
      }
    }
  });

  return (
    <group>
      {/* High performance instanced bullets (1 Draw Call for all bullets) */}
      <instancedMesh
        ref={instancedMeshRef}
        args={[bulletGeo, bulletMatYellow, MAX_BULLETS]}
        frustumCulled={false}
      />

      {/* Pre-allocated Sword Slash Arcs Pool (Directly managed, 0 React re-renders) */}
      {Array.from({ length: MAX_SLASH_POOLS }).map((_, idx) => (
        <group
          key={idx}
          ref={(el) => {
            slashMeshRefs.current[idx] = el;
          }}
          visible={false}
        >
          <mesh geometry={slashWaveGeo} material={slashWaveMat} rotation={[-Math.PI / 2, 0, Math.PI / 2]} />
          <mesh geometry={slashCoreGeo} material={slashCoreMat} rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0, 0.05, 0]} />
        </group>
      ))}
    </group>
  );
}
