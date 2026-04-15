'use client';

import { type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene3D } from './Scene3D';

interface SceneCanvasProps {
  children: ReactNode;
}

export default function SceneCanvas({ children }: SceneCanvasProps) {
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 8], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: '#09090B' }}
      >
        <color attach="background" args={['#09090B']} />
        <Scene3D>{children}</Scene3D>
      </Canvas>
    </div>
  );
}
