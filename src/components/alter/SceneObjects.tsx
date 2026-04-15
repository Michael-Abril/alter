'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useScroll, Float } from '@react-three/drei';
import * as THREE from 'three';

const GOLD = new THREE.Color('#D4A744');
const GOLD_LIGHT = new THREE.Color('#F5C952');
const GOLD_DARK = new THREE.Color('#96752F');

// ─── Camera rig that moves through space as user scrolls ───

export function CameraRig() {
  const scroll = useScroll();

  useFrame((state) => {
    const t = scroll.offset;
    state.camera.position.z = 8 - t * 14;
    state.camera.position.y = t * -2;
    state.camera.position.x = Math.sin(t * Math.PI * 2) * 0.6;
    state.camera.lookAt(0, state.camera.position.y, state.camera.position.z - 10);
  });

  return null;
}

// ─── Floating gold geometric shapes at various depths ───

interface ShapeProps {
  position: [number, number, number];
  geometry: 'icosahedron' | 'octahedron' | 'torusKnot' | 'dodecahedron';
  scale?: number;
  rotationSpeed?: number;
  scrollRange?: [number, number];
  floatIntensity?: number;
}

function GoldShape({ position, geometry, scale = 1, rotationSpeed = 0.3, scrollRange = [0, 1], floatIntensity = 1 }: ShapeProps) {
  const ref = useRef<THREE.Mesh>(null!);
  const scroll = useScroll();
  const materialRef = useRef<THREE.MeshStandardMaterial>(null!);

  useFrame((state, delta) => {
    const t = scroll.offset;
    const inRange = t >= scrollRange[0] && t <= scrollRange[1];
    const rangeProgress = inRange
      ? (t - scrollRange[0]) / (scrollRange[1] - scrollRange[0])
      : t < scrollRange[0] ? 0 : 1;

    ref.current.rotation.x += delta * rotationSpeed * 0.5;
    ref.current.rotation.y += delta * rotationSpeed;

    const targetOpacity = inRange ? Math.sin(rangeProgress * Math.PI) * 0.7 + 0.15 : 0.05;
    materialRef.current.opacity = THREE.MathUtils.lerp(
      materialRef.current.opacity,
      targetOpacity,
      delta * 3
    );
  });

  const geo = useMemo(() => {
    switch (geometry) {
      case 'icosahedron': return <icosahedronGeometry args={[1, 1]} />;
      case 'octahedron': return <octahedronGeometry args={[1, 0]} />;
      case 'torusKnot': return <torusKnotGeometry args={[0.8, 0.25, 64, 16]} />;
      case 'dodecahedron': return <dodecahedronGeometry args={[1, 0]} />;
    }
  }, [geometry]);

  return (
    <Float speed={2} rotationIntensity={0.4} floatIntensity={floatIntensity}>
      <mesh ref={ref} position={position} scale={scale}>
        {geo}
        <meshStandardMaterial
          ref={materialRef}
          color={GOLD}
          emissive={GOLD}
          emissiveIntensity={0.6}
          wireframe
          transparent
          opacity={0.3}
        />
      </mesh>
    </Float>
  );
}

export function FloatingGoldShapes() {
  const shapes: ShapeProps[] = [
    { position: [-4, 1, -2], geometry: 'icosahedron', scale: 1.2, rotationSpeed: 0.25, scrollRange: [0, 0.25], floatIntensity: 1.5 },
    { position: [4.5, 0, -4], geometry: 'octahedron', scale: 0.8, rotationSpeed: 0.4, scrollRange: [0, 0.2], floatIntensity: 1 },
    { position: [-3, -3, -3], geometry: 'torusKnot', scale: 0.5, rotationSpeed: 0.2, scrollRange: [0.1, 0.35], floatIntensity: 0.8 },
    { position: [3.5, -6, -2], geometry: 'dodecahedron', scale: 0.9, rotationSpeed: 0.35, scrollRange: [0.2, 0.45], floatIntensity: 1.2 },
    { position: [-5, -8, -5], geometry: 'icosahedron', scale: 0.7, rotationSpeed: 0.3, scrollRange: [0.3, 0.55], floatIntensity: 1 },
    { position: [5, -11, -3], geometry: 'torusKnot', scale: 0.6, rotationSpeed: 0.15, scrollRange: [0.4, 0.65], floatIntensity: 1.3 },
    { position: [-4, -14, -4], geometry: 'octahedron', scale: 1.0, rotationSpeed: 0.3, scrollRange: [0.5, 0.75], floatIntensity: 0.9 },
    { position: [3, -17, -2], geometry: 'dodecahedron', scale: 0.7, rotationSpeed: 0.4, scrollRange: [0.6, 0.85], floatIntensity: 1.1 },
    { position: [-3, -20, -6], geometry: 'icosahedron', scale: 1.1, rotationSpeed: 0.2, scrollRange: [0.7, 0.95], floatIntensity: 1.4 },
    { position: [4, -23, -3], geometry: 'torusKnot', scale: 0.5, rotationSpeed: 0.35, scrollRange: [0.8, 1.0], floatIntensity: 1 },
  ];

  return (
    <>
      {shapes.map((s, i) => (
        <GoldShape key={i} {...s} />
      ))}
    </>
  );
}

// ─── Grid plane receding into the distance ───

export function GoldGrid() {
  const ref = useRef<THREE.GridHelper>(null!);
  const scroll = useScroll();

  useFrame(() => {
    const t = scroll.offset;
    if (ref.current.material instanceof THREE.Material) {
      ref.current.material.opacity = THREE.MathUtils.lerp(0.2, 0.04, t);
    }
  });

  return (
    <gridHelper
      ref={ref}
      args={[80, 80, GOLD, GOLD_DARK]}
      position={[0, -3, 0]}
      rotation={[0, 0, 0]}
      material-transparent
      material-opacity={0.25}
    />
  );
}

// ─── Gold particle field ───

export function GoldParticleField() {
  const count = 600;
  const ref = useRef<THREE.Points>(null!);
  const scroll = useScroll();

  const [positions, sizes] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20 - 5;
      sz[i] = Math.random() * 2 + 0.5;
    }
    return [pos, sz];
  }, []);

  useFrame((state, delta) => {
    const t = scroll.offset;
    ref.current.rotation.y += delta * 0.015;
    ref.current.position.y = t * 8;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        color={GOLD_LIGHT}
        transparent
        opacity={0.8}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// ─── Ambient gold lighting that shifts with scroll ───

export function ScrollLighting() {
  const pointRef = useRef<THREE.PointLight>(null!);
  const pointRef2 = useRef<THREE.PointLight>(null!);
  const scroll = useScroll();

  useFrame(() => {
    const t = scroll.offset;
    pointRef.current.position.set(
      Math.sin(t * Math.PI * 3) * 4,
      2 - t * 20,
      3
    );
    pointRef2.current.position.set(
      Math.cos(t * Math.PI * 2) * 5,
      -2 - t * 20,
      4
    );
  });

  return (
    <>
      <ambientLight intensity={0.15} color="#FFF8E7" />
      <pointLight ref={pointRef} color={GOLD} intensity={2} distance={20} decay={2} />
      <pointLight ref={pointRef2} color={GOLD_LIGHT} intensity={1.5} distance={15} decay={2} />
    </>
  );
}
