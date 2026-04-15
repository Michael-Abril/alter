'use client';

import {
  CameraRig,
  FloatingGoldShapes,
  GoldGrid,
  GoldParticleField,
  ScrollLighting,
} from './SceneObjects';

export function Scene3D() {
  return (
    <>
      <ScrollLighting />
      <CameraRig />
      <FloatingGoldShapes />
      <GoldGrid />
      <GoldParticleField />
    </>
  );
}
