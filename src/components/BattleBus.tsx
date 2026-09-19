import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../store';
import {
  Group,
  SphereGeometry,
  CylinderGeometry,
  ConeGeometry,
  BoxGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
} from 'three';

// ----------------------------------------------------------------------------
// SINGLETON STATIC GEOMETRIES & MATERIALS FOR BATTLE BUS
// ----------------------------------------------------------------------------
const balloonGeo = new SphereGeometry(7, 16, 12);
const balloonMat = new MeshStandardMaterial({ color: '#0284c7', roughness: 0.3, metalness: 0.1 });
const balloonStripeGeo = new SphereGeometry(7.05, 8, 12);
const balloonStripeMat = new MeshStandardMaterial({ color: '#facc15', roughness: 0.3, wireframe: true });

const burnerRingGeo = new CylinderGeometry(1.6, 1.2, 1, 10);
const burnerRingMat = new MeshStandardMaterial({ color: '#334155', metalness: 0.8, roughness: 0.2 });

const flameOuterGeo = new ConeGeometry(0.9, 2.5, 8);
const flameOuterMat = new MeshBasicMaterial({ color: '#f97316' });
const flameInnerGeo = new ConeGeometry(0.55, 1.8, 8);
const flameInnerMat = new MeshBasicMaterial({ color: '#fef08a' });

const cableGeo = new CylinderGeometry(0.05, 0.05, 7, 4);
const cableMat = new MeshStandardMaterial({ color: '#1e293b', metalness: 0.9 });

const busBodyGeo = new BoxGeometry(4.2, 3.4, 9.8);
const busBodyMat = new MeshStandardMaterial({ color: '#2563eb', roughness: 0.3, metalness: 0.2 });

const busRoofGeo = new BoxGeometry(4.3, 0.3, 9.9);
const busRoofMat = new MeshStandardMaterial({ color: '#f8fafc', roughness: 0.2, metalness: 0.1 });

const busHoodGeo = new BoxGeometry(3.8, 1.8, 2.2);
const busHoodMat = new MeshStandardMaterial({ color: '#1d4ed8', roughness: 0.4 });

const busGrilleGeo = new BoxGeometry(2.8, 1.2, 0.1);
const busGrilleMat = new MeshStandardMaterial({ color: '#0f172a', metalness: 0.8, roughness: 0.3 });

const headlightGeo = new CylinderGeometry(0.35, 0.35, 0.1, 10);
const headlightMat = new MeshBasicMaterial({ color: '#fef08a' });

const windowFrontGeo = new BoxGeometry(3.8, 1.5, 0.1);
const windowSideGeo = new BoxGeometry(0.05, 1.3, 8.4);
const windowRearGeo = new BoxGeometry(3.4, 1.3, 0.05);
const windowMat = new MeshStandardMaterial({ color: '#0284c7', metalness: 0.9, roughness: 0.1, opacity: 0.85, transparent: true });

const wheelGeo = new CylinderGeometry(0.9, 0.9, 0.7, 10);
const wheelMat = new MeshStandardMaterial({ color: '#0f172a', roughness: 0.8 });

const boosterGeo = new CylinderGeometry(0.6, 0.7, 1.2, 10);
const boosterMat = new MeshStandardMaterial({ color: '#334155', metalness: 0.9, roughness: 0.2 });

const boosterFlameGeo = new ConeGeometry(0.45, 1.6, 8);
const boosterFlameMat = new MeshBasicMaterial({ color: '#38bdf8' });

export function BattleBus() {
  const battleBusActive = useGameStore((s) => s.gameState?.battleBus?.active);
  const busRef = useRef<Group>(null);
  const balloonRef = useRef<Group>(null);
  const flameRef = useRef<Group>(null);

  const currentPos = useRef({ x: 0, y: 80, z: 0 });
  const initialized = useRef(false);

  useFrame((_, delta) => {
    const battleBus = useGameStore.getState().gameState?.battleBus;
    if (!battleBus || !battleBus.active || !busRef.current) return;

    if (!initialized.current) {
      currentPos.current = { x: battleBus.currentX, y: battleBus.currentY, z: battleBus.currentZ };
      initialized.current = true;
    }

    const dt = Math.min(delta, 0.1);
    const lerpSpeed = 1 - Math.exp(-15 * dt);
    currentPos.current.x += (battleBus.currentX - currentPos.current.x) * lerpSpeed;
    currentPos.current.y += (battleBus.currentY - currentPos.current.y) * lerpSpeed;
    currentPos.current.z += (battleBus.currentZ - currentPos.current.z) * lerpSpeed;

    const time = performance.now() * 0.003;
    const wobbleY = Math.sin(time) * 0.3;
    const wobbleZ = Math.sin(time * 0.8) * 0.02;
    const wobbleX = Math.cos(time * 0.8) * 0.015;

    busRef.current.position.set(
      currentPos.current.x,
      currentPos.current.y + wobbleY,
      currentPos.current.z
    );

    const dx = battleBus.endX - battleBus.startX;
    const dz = battleBus.endZ - battleBus.startZ;
    const busAngle = Math.atan2(dx, dz);
    busRef.current.rotation.y = busAngle;
    busRef.current.rotation.z = wobbleZ;
    busRef.current.rotation.x = wobbleX;

    if (balloonRef.current) {
      balloonRef.current.rotation.y += dt * 0.4;
    }

    if (flameRef.current) {
      const flicker = 0.85 + Math.random() * 0.3;
      flameRef.current.scale.set(flicker, flicker * (1.0 + Math.random() * 0.4), flicker);
    }
  });

  if (!battleBusActive) return null;

  return (
    <group ref={busRef} position={[currentPos.current.x, currentPos.current.y, currentPos.current.z]}>
      {/* --- HOT AIR BALLOON ASSEMBLY --- */}
      <group position={[0, 9, 0]}>
        {/* Giant Striped Hot Air Balloon */}
        <group ref={balloonRef}>
          <mesh geometry={balloonGeo} material={balloonMat} />
          <mesh geometry={balloonStripeGeo} material={balloonStripeMat} />
        </group>

        {/* Burner / Flame ring */}
        <mesh geometry={burnerRingGeo} material={burnerRingMat} position={[0, -5.5, 0]} />

        {/* Dynamic Thruster Flame */}
        <group ref={flameRef} position={[0, -6.2, 0]}>
          <mesh geometry={flameOuterGeo} material={flameOuterMat} />
          <mesh geometry={flameInnerGeo} material={flameInnerMat} position={[0, 0.3, 0]} />
        </group>

        {/* Support Rigging Cables */}
        <group>
          <mesh geometry={cableGeo} material={cableMat} position={[2.2, -6.5, 3.5]} rotation={[0.2, 0, -0.2]} />
          <mesh geometry={cableGeo} material={cableMat} position={[-2.2, -6.5, 3.5]} rotation={[0.2, 0, 0.2]} />
          <mesh geometry={cableGeo} material={cableMat} position={[2.2, -6.5, -3.5]} rotation={[-0.2, 0, -0.2]} />
          <mesh geometry={cableGeo} material={cableMat} position={[-2.2, -6.5, -3.5]} rotation={[-0.2, 0, 0.2]} />
        </group>
      </group>

      {/* --- THE BATTLE BUS CHASSIS --- */}
      <group position={[0, 0, 0]}>
        {/* Main Blue Bus Body */}
        <mesh geometry={busBodyGeo} material={busBodyMat} position={[0, 0.8, 0]} />

        {/* White Roof */}
        <mesh geometry={busRoofGeo} material={busRoofMat} position={[0, 2.6, 0]} />

        {/* Front Hood */}
        <mesh geometry={busHoodGeo} material={busHoodMat} position={[0, -0.2, 5.7]} />

        {/* Front Grille */}
        <mesh geometry={busGrilleGeo} material={busGrilleMat} position={[0, -0.2, 6.85]} />

        {/* Headlights */}
        <mesh geometry={headlightGeo} material={headlightMat} position={[1.4, -0.1, 6.85]} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={headlightGeo} material={headlightMat} position={[-1.4, -0.1, 6.85]} rotation={[Math.PI / 2, 0, 0]} />

        {/* Windshield & Windows */}
        <mesh geometry={windowFrontGeo} material={windowMat} position={[0, 1.4, 4.95]} rotation={[-0.15, 0, 0]} />
        <mesh geometry={windowSideGeo} material={windowMat} position={[2.12, 1.3, 0]} />
        <mesh geometry={windowSideGeo} material={windowMat} position={[-2.12, 1.3, 0]} />
        <mesh geometry={windowRearGeo} material={windowMat} position={[0, 1.3, -4.92]} />

        {/* Wheels (4 heavy rugged tires) */}
        <mesh geometry={wheelGeo} material={wheelMat} position={[2.2, -1.1, 3.4]} rotation={[0, 0, Math.PI / 2]} />
        <mesh geometry={wheelGeo} material={wheelMat} position={[-2.2, -1.1, 3.4]} rotation={[0, 0, Math.PI / 2]} />
        <mesh geometry={wheelGeo} material={wheelMat} position={[2.2, -1.1, -2.8]} rotation={[0, 0, Math.PI / 2]} />
        <mesh geometry={wheelGeo} material={wheelMat} position={[-2.2, -1.1, -2.8]} rotation={[0, 0, Math.PI / 2]} />

        {/* Rear Jet Boosters */}
        <mesh geometry={boosterGeo} material={boosterMat} position={[1.4, -0.2, -5.2]} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={boosterGeo} material={boosterMat} position={[-1.4, -0.2, -5.2]} rotation={[Math.PI / 2, 0, 0]} />

        {/* Rear Thruster Flame Glow */}
        <mesh geometry={boosterFlameGeo} material={boosterFlameMat} position={[1.4, -0.2, -6.0]} rotation={[-Math.PI / 2, 0, 0]} />
        <mesh geometry={boosterFlameGeo} material={boosterFlameMat} position={[-1.4, -0.2, -6.0]} rotation={[-Math.PI / 2, 0, 0]} />
      </group>
    </group>
  );
}
