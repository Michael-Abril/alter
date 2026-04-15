'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';
import { useScrollOffset } from './ScrollContext';

const GOLD = '#D4A744';
const GOLD_LIGHT = '#F5C952';

// ─── Camera rig: gentle parallax as user scrolls ───

export function CameraRig() {
  const scrollRef = useScrollOffset();

  useFrame((state) => {
    const t = scrollRef.current?.offset ?? 0;
    state.camera.position.x = Math.sin(t * Math.PI * 2) * 0.8;
    state.camera.position.y = -t * 1.5;
    state.camera.rotation.z = Math.sin(t * Math.PI) * 0.02;
  });

  return null;
}

// ─── Single floating wireframe shape ───

function GoldShape({
  position,
  geo,
  scale = 1,
  speed = 0.3,
}: {
  position: [number, number, number];
  geo: 'ico' | 'oct' | 'torus' | 'dodec';
  scale?: number;
  speed?: number;
}) {
  const ref = useRef<THREE.Mesh>(null!);

  useFrame((_state, delta) => {
    ref.current.rotation.x += delta * speed * 0.5;
    ref.current.rotation.y += delta * speed;
  });

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={1.2}>
      <mesh ref={ref} position={position} scale={scale}>
        {geo === 'ico' && <icosahedronGeometry args={[1, 1]} />}
        {geo === 'oct' && <octahedronGeometry args={[1, 0]} />}
        {geo === 'torus' && <torusKnotGeometry args={[0.7, 0.22, 64, 12]} />}
        {geo === 'dodec' && <dodecahedronGeometry args={[1, 0]} />}
        <meshStandardMaterial
          color={GOLD}
          emissive={GOLD}
          emissiveIntensity={0.5}
          wireframe
          transparent
          opacity={0.35}
        />
      </mesh>
    </Float>
  );
}

export function FloatingGoldShapes() {
  return (
    <>
      <GoldShape position={[-4.5, 1.5, -3]} geo="ico" scale={1.3} speed={0.2} />
      <GoldShape position={[5, 0.5, -5]} geo="oct" scale={0.9} speed={0.35} />
      <GoldShape position={[-3.5, -2.5, -2]} geo="torus" scale={0.55} speed={0.15} />
      <GoldShape position={[4, -5, -4]} geo="dodec" scale={1.0} speed={0.3} />
      <GoldShape position={[-5.5, -7, -3]} geo="ico" scale={0.7} speed={0.25} />
      <GoldShape position={[3.5, -9, -5]} geo="oct" scale={0.85} speed={0.4} />
      <GoldShape position={[-3, -12, -2]} geo="torus" scale={0.65} speed={0.2} />
      <GoldShape position={[5.5, -14, -4]} geo="dodec" scale={0.8} speed={0.3} />
      <GoldShape position={[-4, -16, -6]} geo="ico" scale={1.1} speed={0.15} />
      <GoldShape position={[3, -19, -3]} geo="oct" scale={0.75} speed={0.35} />
    </>
  );
}

// ─── Gold grid on the ground plane ───

export function GoldGrid() {
  const matRef = useRef<THREE.LineBasicMaterial>(null!);
  const scrollRef = useScrollOffset();

  useFrame(() => {
    if (matRef.current) {
      matRef.current.opacity = THREE.MathUtils.lerp(0.18, 0.04, scrollRef.current?.offset ?? 0);
    }
  });

  const gridGeo = useMemo(() => {
    const size = 60;
    const divisions = 60;
    const step = size / divisions;
    const half = size / 2;
    const verts: number[] = [];

    for (let i = 0; i <= divisions; i++) {
      const pos = -half + i * step;
      verts.push(pos, 0, -half, pos, 0, half);
      verts.push(-half, 0, pos, half, 0, pos);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    return geo;
  }, []);

  return (
    <lineSegments geometry={gridGeo} position={[0, -3, 0]}>
      <lineBasicMaterial
        ref={matRef}
        color={GOLD}
        transparent
        opacity={0.18}
        depthWrite={false}
      />
    </lineSegments>
  );
}

// ─── Particle field: gold dust floating in 3D space ───

export function GoldParticleField() {
  const count = 500;
  const ref = useRef<THREE.Points>(null!);
  const scrollRef = useScrollOffset();

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 30;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 50 - 5;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 20 - 3;
    }
    return arr;
  }, []);

  useFrame((_state, delta) => {
    ref.current.rotation.y += delta * 0.01;
    ref.current.position.y = (scrollRef.current?.offset ?? 0) * 6;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color={GOLD_LIGHT}
        transparent
        opacity={0.7}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// ─── Lighting ───

export function ScrollLighting() {
  const light1 = useRef<THREE.PointLight>(null!);
  const light2 = useRef<THREE.PointLight>(null!);
  const scrollRef = useScrollOffset();

  useFrame(() => {
    const t = scrollRef.current?.offset ?? 0;
    light1.current.position.set(Math.sin(t * Math.PI * 3) * 5, 2 - t * 15, 4);
    light2.current.position.set(Math.cos(t * Math.PI * 2) * 6, -3 - t * 15, 5);
  });

  return (
    <>
      <ambientLight intensity={0.2} color="#FFF8E7" />
      <pointLight ref={light1} color={GOLD} intensity={3} distance={25} decay={2} />
      <pointLight ref={light2} color={GOLD_LIGHT} intensity={2} distance={20} decay={2} />
    </>
  );
}
