import { useEffect, useRef } from 'react';

/**
 * Animated audio waveform bars that pulse with the audioLevel (0-100).
 */
export default function AudioVisualiser({ audioLevel = 0, primaryColor = '#7F77DD', isRecording = false }) {
  const BAR_COUNT = 24;

  // Each bar gets a random phase offset so they don't all pulse in sync
  const phases = useRef(Array.from({ length: BAR_COUNT }, () => Math.random() * Math.PI * 2));

  // Use a canvas for smooth animation
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const levelRef = useRef(audioLevel);
  levelRef.current = audioLevel;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let t = 0;

    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const level = levelRef.current / 100;
      const barW = Math.floor((width - (BAR_COUNT - 1) * 3) / BAR_COUNT);
      const maxH = height * 0.85;
      const minH = height * 0.08;

      for (let i = 0; i < BAR_COUNT; i++) {
        const phase = phases.current[i];
        const wave = (Math.sin(t * 2 + phase) + 1) / 2; // 0-1
        const barH = isRecording
          ? minH + (maxH - minH) * level * (0.4 + wave * 0.6)
          : minH + (maxH - minH) * 0.05 * (0.5 + wave * 0.5);

        const x = i * (barW + 3);
        const y = (height - barH) / 2;

        // Gradient per bar
        const grad = ctx.createLinearGradient(x, y + barH, x, y);
        grad.addColorStop(0, primaryColor + 'AA');
        grad.addColorStop(1, primaryColor);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, 3);
        ctx.fill();
      }

      t += 0.04;
      frameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(frameRef.current);
  }, [isRecording, primaryColor]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={100}
      style={{ width: '100%', height: 100, display: 'block' }}
    />
  );
}
