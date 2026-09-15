import React, { useRef, useMemo } from 'react';
import { useGameStore } from '../store';
import { useFrame } from '@react-three/fiber';
import {
  Vector3,
  Group,
  CapsuleGeometry,
  BoxGeometry,
  CylinderGeometry,
  SphereGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
} from 'three';

// Normalize angle difference to [-PI, PI] to prevent 360-degree flip spins
function lerpAngle(current: number, target: number, t: number): number {
  let diff = (target - current) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * t;
}

// ----------------------------------------------------------------------------
// SINGLETON SHARED GEOMETRIES & STATIC PRE-CACHED MATERIALS
// Sharing geometries AND materials across 100 players guarantees ZERO GPU memory
// reallocation, ZERO garbage collection pauses, and ZERO WebGL crashes.
// ----------------------------------------------------------------------------
const sharedBodyGeo = new CapsuleGeometry(0.5, 1, 4, 8);
const sharedVisorGeo = new BoxGeometry(0.6, 0.2, 0.2);
const sharedVisorMat = new MeshStandardMaterial({ color: '#111827', roughness: 0.2 });

// Pre-cached static materials for player bodies
const bodyMats: Record<string, MeshStandardMaterial> = {
  '#ef4444': new MeshStandardMaterial({ color: '#ef4444', roughness: 0.4, metalness: 0.2 }),
  '#3b82f6': new MeshStandardMaterial({ color: '#3b82f6', roughness: 0.4, metalness: 0.2 }),
  '#eab308': new MeshStandardMaterial({ color: '#eab308', roughness: 0.4, metalness: 0.2 }),
  '#f59e0b': new MeshStandardMaterial({ color: '#f59e0b', roughness: 0.4, metalness: 0.2 }),
  '#10b981': new MeshStandardMaterial({ color: '#10b981', roughness: 0.4, metalness: 0.2 }),
  '#38bdf8': new MeshStandardMaterial({ color: '#38bdf8', roughness: 0.4, metalness: 0.2 }),
};
const defaultBodyMat = bodyMats['#ef4444'];

// Glider Geometries & Materials
const sharedGliderWingGeo = new BoxGeometry(3.2, 0.08, 1.4);
const gliderWingMats: Record<string, MeshStandardMaterial> = {
  '#ef4444': new MeshStandardMaterial({ color: '#ef4444', roughness: 0.3, metalness: 0.4 }),
  '#3b82f6': new MeshStandardMaterial({ color: '#3b82f6', roughness: 0.3, metalness: 0.4 }),
  '#eab308': new MeshStandardMaterial({ color: '#eab308', roughness: 0.3, metalness: 0.4 }),
  '#f59e0b': new MeshStandardMaterial({ color: '#f59e0b', roughness: 0.3, metalness: 0.4 }),
  '#10b981': new MeshStandardMaterial({ color: '#10b981', roughness: 0.3, metalness: 0.4 }),
  '#38bdf8': new MeshStandardMaterial({ color: '#38bdf8', roughness: 0.3, metalness: 0.4 }),
};
const defaultGliderWingMat = gliderWingMats['#ef4444'];

const sharedGliderTipGeo = new BoxGeometry(0.6, 0.06, 1.3);
const sharedGliderTipMat = new MeshStandardMaterial({ color: '#0f172a' });
const sharedGliderStrutGeo = new CylinderGeometry(0.04, 0.04, 1.2, 6);
const sharedGliderStrutMat = new MeshStandardMaterial({ color: '#334155', metalness: 0.8 });

// Weapon Geometries & Materials
const sharedGunBodyGeo = new BoxGeometry(0.14, 0.22, 0.55);
const sharedGunBodyMat = new MeshStandardMaterial({ color: '#1e293b', metalness: 0.5, roughness: 0.4 });
const sharedGunBarrelGeo = new CylinderGeometry(0.05, 0.05, 0.45, 6);
const sharedGunBarrelMat = new MeshStandardMaterial({ color: '#475569', metalness: 0.8, roughness: 0.2 });
const sharedGunAccentGeo = new BoxGeometry(0.08, 0.04, 0.35);

const weaponAccentMats: Record<string, MeshBasicMaterial> = {
  '#ef4444': new MeshBasicMaterial({ color: '#ef4444' }),
  '#3b82f6': new MeshBasicMaterial({ color: '#3b82f6' }),
  '#eab308': new MeshBasicMaterial({ color: '#eab308' }),
  '#f59e0b': new MeshBasicMaterial({ color: '#f59e0b' }),
  '#10b981': new MeshBasicMaterial({ color: '#10b981' }),
  '#38bdf8': new MeshBasicMaterial({ color: '#38bdf8' }),
};
const defaultWeaponAccentMat = weaponAccentMats['#ef4444'];

const sharedSwordHiltGeo = new CylinderGeometry(0.04, 0.04, 0.35, 6);
const sharedSwordHiltMat = new MeshStandardMaterial({ color: '#0f172a', roughness: 0.6 });
const sharedSwordGuardGeo = new CylinderGeometry(0.14, 0.14, 0.03, 8);
const sharedSwordGuardMat = new MeshStandardMaterial({ color: '#f59e0b', metalness: 0.8, roughness: 0.3 });
const sharedSwordBladeGeo = new BoxGeometry(0.05, 1.7, 0.02);
const sharedSwordBladeMat = new MeshStandardMaterial({ color: '#f1f5f9', metalness: 0.9, roughness: 0.1 });
const sharedSwordEdgeGeo = new BoxGeometry(0.015, 1.72, 0.025);
const sharedSwordEdgeMat = new MeshBasicMaterial({ color: '#ef4444' });

// FX Geometries & Materials
const sharedRollGeo = new CylinderGeometry(0.9, 0.9, 2.2, 8);
const sharedRollMat = new MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.35, wireframe: true });
const sharedShieldGeo = new SphereGeometry(1.5, 8, 8);
const sharedShieldMat = new MeshStandardMaterial({ color: '#fbbf24', transparent: true, opacity: 0.3, emissive: '#fbbf24', emissiveIntensity: 0.5 });
const sharedInvulnGeo = new CylinderGeometry(1, 1, 2.5, 8);
const sharedInvulnMat = new MeshStandardMaterial({ color: '#ef4444', transparent: true, opacity: 0.4, emissive: '#ef4444', emissiveIntensity: 1 });
const sharedHealGeo = new CylinderGeometry(0.8, 0.8, 2, 8);
const sharedHealMat = new MeshStandardMaterial({ color: '#22c55e', transparent: true, opacity: 0.3, emissive: '#22c55e', emissiveIntensity: 0.8 });

// Team Markers Geometries & Materials
const sharedTeamMarkerGeo = new SphereGeometry(0.18, 6, 6);
const sharedAllyMat = new MeshBasicMaterial({ color: '#38bdf8' }); // Bright cyan for ally
const sharedEnemyMat = new MeshBasicMaterial({ color: '#ef4444' }); // Vivid red for enemy

const RemotePlayer = React.memo(function RemotePlayer({ id }: { id: string }) {
  const staticMeta = useGameStore((s) => {
    const p = s.gameState?.players[id];
    if (!p) return null;
    return `${p.color}_${p.characterClass}_${p.team || ''}`;
  });

  const isTeamMode = useGameStore((s) => s.gameState?.mode === 'team');
  const myId = useGameStore((s) => s.myId);
  const myTeam = useGameStore((s) => (myId ? s.gameState?.players[myId]?.team : undefined));
  const remotePlayerTeam = useGameStore((s) => s.gameState?.players[id]?.team);
  const isAlly = isTeamMode && !!myTeam && !!remotePlayerTeam && remotePlayerTeam === myTeam;
  const isEnemy = isTeamMode && !!myTeam && !!remotePlayerTeam && remotePlayerTeam !== myTeam;

  const color = staticMeta ? staticMeta.split('_')[0] : 'blue';
  const characterClass = (staticMeta ? staticMeta.split('_')[1] : 'melee') as any;

  const ref = useRef<Group>(null);
  const innerRef = useRef<Group>(null);
  const gliderRef = useRef<Group>(null);
  const weaponRef = useRef<Group>(null);
  const rollRef = useRef<any>(null);
  const shieldRef = useRef<any>(null);
  const invulnRef = useRef<any>(null);
  const healRef = useRef<any>(null);

  const targetPos = useRef(new Vector3());
  const initialized = useRef(false);

  useFrame((state, delta) => {
    const gameState = useGameStore.getState().gameState;
    const p = gameState?.players[id];
    if (!p || p.isDead || p.inBus) {
      if (ref.current?.visible) {
        ref.current.visible = false;
      }
      return;
    }

    targetPos.current.set(p.x, p.y, p.z);

    if (ref.current) {
      const camDistSq = state.camera.position.distanceToSquared(targetPos.current);
      if (camDistSq > 95 * 95) {
        if (ref.current.visible) {
          ref.current.visible = false;
        }
        initialized.current = false;
        return;
      }
      if (!ref.current.visible) {
        ref.current.visible = true;
      }

      if (!initialized.current) {
        ref.current.position.copy(targetPos.current);
        ref.current.rotation.y = p.ry;
        initialized.current = true;
      } else {
        const dt = Math.min(delta, 0.1);
        const lerpFactor = 1 - Math.exp(-18 * dt);
        ref.current.position.lerp(targetPos.current, lerpFactor);
        ref.current.rotation.y = lerpAngle(ref.current.rotation.y, p.ry, lerpFactor);
      }

      if (innerRef.current) {
        if (p.isRolling) {
          innerRef.current.rotation.x += delta * 18;
        } else if (p.isSkydiving) {
          innerRef.current.rotation.x = 1.1;
        } else if (p.isGliding) {
          innerRef.current.rotation.x = 0.2;
        } else {
          innerRef.current.rotation.x = 0;
        }
      }

      if (gliderRef.current) gliderRef.current.visible = !!p.isGliding;
      if (weaponRef.current) weaponRef.current.visible = !p.isGliding && !p.isSkydiving;
      if (rollRef.current) rollRef.current.visible = !!p.isRolling;
      if (shieldRef.current) shieldRef.current.visible = !!p.hasShield;
      if (invulnRef.current) invulnRef.current.visible = !!p.isInvulnerable;
      if (healRef.current) healRef.current.visible = !!p.isHealing;
    }
  });

  const bodyMat = bodyMats[color] || defaultBodyMat;
  const gliderWingMat = gliderWingMats[color] || defaultGliderWingMat;
  const weaponAccentMat = weaponAccentMats[color] || defaultWeaponAccentMat;

  return (
    <group ref={ref}>
      <group ref={innerRef}>
        {/* Body */}
        <mesh geometry={sharedBodyGeo} material={bodyMat} position={[0, 0, 0]} />
        
        {/* Eyes / Visor */}
        <mesh geometry={sharedVisorGeo} material={sharedVisorMat} position={[0, 0.5, -0.4]} />

        {/* 3D Glider */}
        <group ref={gliderRef} position={[0, 1.6, -0.2]} visible={false}>
          <mesh geometry={sharedGliderWingGeo} material={gliderWingMat} />
          <mesh geometry={sharedGliderTipGeo} material={sharedGliderTipMat} position={[1.7, 0.2, 0]} rotation={[0, 0, -0.3]} />
          <mesh geometry={sharedGliderTipGeo} material={sharedGliderTipMat} position={[-1.7, 0.2, 0]} rotation={[0, 0, 0.3]} />
          <mesh geometry={sharedGliderStrutGeo} material={sharedGliderStrutMat} position={[0, -0.6, 0]} />
        </group>

        {/* 3D Weapon */}
        <group ref={weaponRef} position={[0.45, 0.1, -0.3]}>
          {characterClass === 'sword' ? (
            <group rotation={[-0.4, 0.2, -0.2]}>
              <mesh geometry={sharedSwordHiltGeo} material={sharedSwordHiltMat} position={[0, -0.3, 0]} />
              <mesh geometry={sharedSwordGuardGeo} material={sharedSwordGuardMat} position={[0, -0.1, 0]} />
              <mesh geometry={sharedSwordBladeGeo} material={sharedSwordBladeMat} position={[0, 0.8, 0]} />
              <mesh geometry={sharedSwordEdgeGeo} material={sharedSwordEdgeMat} position={[0.03, 0.8, 0]} />
            </group>
          ) : (
            <group position={[0, 0, 0]}>
              <mesh geometry={sharedGunBodyGeo} material={sharedGunBodyMat} position={[0, 0, 0]} />
              <mesh geometry={sharedGunBarrelGeo} material={sharedGunBarrelMat} position={[0, 0.04, -0.45]} rotation={[Math.PI / 2, 0, 0]} />
              <mesh geometry={sharedGunAccentGeo} material={weaponAccentMat} position={[0, 0.12, -0.05]} />
            </group>
          )}
        </group>
      </group>

      {/* Dodge Roll Slipstream */}
      <mesh ref={rollRef} geometry={sharedRollGeo} material={sharedRollMat} position={[0, 0, 0]} visible={false} />

      {/* Tank Shield */}
      <mesh ref={shieldRef} geometry={sharedShieldGeo} material={sharedShieldMat} position={[0, 0, 0]} visible={false} />

      {/* Sword Dash Invulnerability */}
      <mesh ref={invulnRef} geometry={sharedInvulnGeo} material={sharedInvulnMat} position={[0, 0, 0]} visible={false} />
      
      {/* Healing */}
      <mesh ref={healRef} geometry={sharedHealGeo} material={sharedHealMat} position={[0, 0, 0]} visible={false} />

      {/* Team Battle Overhead Marker */}
      {isTeamMode && (isAlly || isEnemy) && (
        <group position={[0, 1.4, 0]}>
          <mesh
            geometry={sharedTeamMarkerGeo}
            material={isAlly ? sharedAllyMat : sharedEnemyMat}
          />
        </group>
      )}
    </group>
  );
});

export const Players = React.memo(function Players() {
  const activeKeys = useGameStore((s) => {
    const p = s.gameState?.players;
    return p ? Object.keys(p).join(',') : '';
  });
  const playerIds = useMemo(() => (activeKeys ? activeKeys.split(',') : []), [activeKeys]);

  const myId = useGameStore((s) => s.myId);

  return (
    <>
      {playerIds.map((id) => {
        if (id === myId) return null;
        return <RemotePlayer key={id} id={id} />;
      })}
    </>
  );
});
