import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Vector3, Quaternion, CylinderGeometry, SphereGeometry, RingGeometry, BoxGeometry, MeshBasicMaterial, InstancedMesh, Object3D, Matrix4 } from 'three';
import { onAttackEvent, onDamageDealt, useGameStore } from '../store';
import { AttackEvent, DamagePopupEvent, CharacterClass } from '../types';

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
  emissive: string;
  size: number;
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

interface DamagePopupInstance {
  id: string;
  x: number;
  y: number;
  z: number;
  amount: number;
  isSword: boolean;
  createdAt: number;
}

// Singletons for Slash Arcs
const slashWaveGeo = new RingGeometry(3, 14, 16, 1, -Math.PI / 3, (2 * Math.PI) / 3);
const slashWaveMat = new MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.8, depthWrite: false, side: 2 });
const slashCoreGeo = new RingGeometry(11.5, 14, 16, 1, -Math.PI / 3.2, (2 * Math.PI) / 3.2);
const slashCoreMat = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false, side: 2 });

// Singletons for Bullets
const bulletGeo = new CylinderGeometry(0.12, 0.12, 1.8, 6);
const bulletMatYellow = new MeshBasicMaterial({ color: '#fbbf24' });
const bulletMatCyan = new MeshBasicMaterial({ color: '#38bdf8' });
const bulletMatGreen = new MeshBasicMaterial({ color: '#34d399' });

const MAX_BULLETS = 60;
const tempObj = new Object3D();

export function AttackEffects() {
  const bulletsRef = useRef<BulletInstance[]>([]);
  const slashArcsRef = useRef<SlashArcInstance[]>([]);
  const instancedMeshRef = useRef<InstancedMesh>(null);
  const [activePopups, setActivePopups] = useState<DamagePopupInstance[]>([]);
  const [slashArcsState, setSlashArcsState] = useState<SlashArcInstance[]>([]);

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
        const newArc: SlashArcInstance = {
          id: evt.id,
          x: evt.x,
          y: evt.y,
          z: evt.z,
          ry: evt.ry,
          createdAt: performance.now() / 1000,
          duration: 0.28,
        };
        slashArcsRef.current.push(newArc);
        setSlashArcsState([...slashArcsRef.current.slice(-10)]);
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
            y: evt.y + 0.2,
            z: evt.z + dirZ * 1.5,
            vx: dirX * speed,
            vy: dirY * speed,
            vz: dirZ * speed,
            distTraveled: 0,
            maxDist: evt.range || 40,
            color: evt.characterClass === 'scout' ? '#38bdf8' : evt.characterClass === 'tank' ? '#34d399' : '#fbbf24',
            emissive: '#ffffff',
            size: 0.15,
            charClass: evt.characterClass,
            quat: rotQuat,
          });
        }
      }
    });

    const unsubDamage = onDamageDealt((evt: DamagePopupEvent) => {
      const myId = useGameStore.getState().myId;
      const myPlayer = myId ? useGameStore.getState().gameState?.players[myId] : null;

      if (myPlayer) {
        const distSq = (evt.x - myPlayer.x) ** 2 + (evt.z - myPlayer.z) ** 2;
        if (distSq > 75 * 75) return;
      }

      const now = performance.now() / 1000;
      setActivePopups((prev) => [
        ...prev.slice(-8), // Keep max 8 active popups
        {
          id: evt.id,
          x: evt.x + (Math.random() - 0.5) * 0.4,
          y: evt.y + 0.4,
          z: evt.z + (Math.random() - 0.5) * 0.4,
          amount: evt.amount,
          isSword: evt.isSword,
          createdAt: now,
        },
      ]);
    });

    return () => {
      unsubAttack();
      unsubDamage();
    };
  }, []);

  // High-performance Frame Loop updating InstancedMesh directly (0 React renders)
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const now = performance.now() / 1000;

    // 1. Update Bullets
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

    // Update InstancedMesh matrices
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

    // 2. Clean up expired slash arcs
    if (slashArcsRef.current.length > 0) {
      const remaining = slashArcsRef.current.filter((s) => now - s.createdAt < s.duration);
      if (remaining.length !== slashArcsRef.current.length) {
        slashArcsRef.current = remaining;
        setSlashArcsState(remaining);
      }
    }

    // 3. Clean up expired popups
    setActivePopups((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.filter((p) => now - p.createdAt < 0.85);
      return next.length === prev.length ? prev : next;
    });
  });

  const nowTime = performance.now() / 1000;

  return (
    <group>
      {/* High performance instanced bullets (1 Draw Call for all bullets) */}
      <instancedMesh
        ref={instancedMeshRef}
        args={[bulletGeo, bulletMatYellow, MAX_BULLETS]}
        frustumCulled={false}
      />

      {/* Sword Slash Arcs */}
      {slashArcsState.map((s) => {
        const progress = Math.min(1, Math.max(0, (nowTime - s.createdAt) / s.duration));
        const scale = 0.5 + progress * 0.65;
        const forwardDist = 1.0 + progress * 2.5;
        const fx = -Math.sin(s.ry) * forwardDist;
        const fz = -Math.cos(s.ry) * forwardDist;

        return (
          <group key={s.id} position={[s.x + fx, s.y + 0.2, s.z + fz]} rotation={[0, s.ry, 0]} scale={[scale, 1, scale]}>
            <mesh geometry={slashWaveGeo} material={slashWaveMat} rotation={[-Math.PI / 2, 0, Math.PI / 2]} />
            <mesh geometry={slashCoreGeo} material={slashCoreMat} rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0, 0.05, 0]} />
          </group>
        );
      })}

      {/* Floating 3D Damage Numbers */}
      {activePopups.map((popup) => {
        const age = nowTime - popup.createdAt;
        const yOffset = age * 2.8;
        const opacity = Math.max(0, 1 - age / 0.85);

        return (
          <Html
            key={popup.id}
            position={[popup.x, popup.y + yOffset, popup.z]}
            center
            distanceFactor={18}
            style={{
              opacity,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            <div
              className={`font-black text-xl px-2 py-0.5 rounded-lg border flex items-center gap-1 shadow-md whitespace-nowrap ${
                popup.isSword
                  ? 'bg-red-600/90 text-white border-red-300'
                  : 'bg-amber-500/90 text-black border-yellow-200'
              }`}
            >
              <span>{popup.isSword ? '⚔️' : '💥'}</span>
              <span>-{popup.amount}</span>
            </div>
          </Html>
        );
      })}
    </group>
  );
}
