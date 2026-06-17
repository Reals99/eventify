import { useEffect, useRef } from 'react';

/**
 * Animated concentric pulse rings behind the main record button.
 * Pure CSS animation, no canvas needed.
 */
export default function PulseRings({ color = '#7F77DD', size = 160 }) {
  return (
    <div style={{
      position: 'absolute',
      width: size,
      height: size,
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
    }}>
      {[1, 2, 3].map(i => (
        <div
          key={i}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `2px solid ${color}`,
            opacity: 0,
            animation: `pulse-ring 2.4s ease-out ${i * 0.8}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0;   }
        }
      `}</style>
    </div>
  );
}
