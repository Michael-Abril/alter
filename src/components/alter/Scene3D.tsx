'use client';

import { type ReactNode } from 'react';
import { ScrollControls, Scroll } from '@react-three/drei';
import {
  CameraRig,
  FloatingGoldShapes,
  GoldGrid,
  GoldParticleField,
  ScrollLighting,
} from './SceneObjects';

interface Scene3DProps {
  children: ReactNode;
}

export function Scene3D({ children }: Scene3DProps) {
  return (
    <ScrollControls pages={11} damping={0.2}>
      {/* 3D scene layer -- behind HTML */}
      <ScrollLighting />
      <CameraRig />
      <FloatingGoldShapes />
      <GoldGrid />
      <GoldParticleField />

      {/* HTML layer -- scrolls in sync, overlaid on canvas */}
      <Scroll html>
        <div style={{ width: '100vw' }} className="bg-alter-bg text-alter-text antialiased">
          {children}
        </div>
      </Scroll>
    </ScrollControls>
  );
}
