'use client';

import { type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene3D } from './Scene3D';
import { ScrollProvider } from './ScrollContext';

interface SceneCanvasProps {
  children: ReactNode;
}

export default function SceneCanvas({ children }: SceneCanvasProps) {
  return (
    <ScrollProvider>
      {/* Fixed 3D canvas as background */}
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 8], fov: 50, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: false }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      >
        <color attach="background" args={['#09090B']} />
        <Scene3D />
      </Canvas>

      {/* Normal scrollable HTML content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </ScrollProvider>
  );
}
