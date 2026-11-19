import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  life: number;
  maxLife: number;
}

export const CursorSpotlight: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: -100, y: -100, targetX: -100, targetY: -100 });
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = e.clientX;
      mouseRef.current.targetY = e.clientY;

      // Spawn subtle particle dispersion occasionally on movement
      if (Math.random() < 0.45) {
        const colors = ['#00F2FE', '#10B981', '#38BDF8', '#6EE7B7'];
        const chosenColor = colors[Math.floor(Math.random() * colors.length)];
        particlesRef.current.push({
          x: e.clientX,
          y: e.clientY,
          vx: (Math.random() - 0.5) * 1.6,
          vy: (Math.random() - 0.5) * 1.6 - 0.4,
          size: Math.random() * 2.2 + 0.8,
          alpha: 0.75,
          color: chosenColor,
          life: 0,
          maxLife: Math.random() * 45 + 30,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    // Initial center position
    mouseRef.current.x = width / 2;
    mouseRef.current.y = height / 3;
    mouseRef.current.targetX = width / 2;
    mouseRef.current.targetY = height / 3;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Smooth damping physics for spotlight center
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.12;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.12;

      const { x, y } = mouseRef.current;

      // Ambient radial spotlight glow (Aqua & Emerald)
      if (x > -50 && y > -50) {
        // Outer aqua-emerald ambient aura
        const outerGrad = ctx.createRadialGradient(x, y, 0, x, y, 420);
        outerGrad.addColorStop(0, 'rgba(0, 242, 254, 0.08)');
        outerGrad.addColorStop(0.35, 'rgba(16, 185, 129, 0.04)');
        outerGrad.addColorStop(0.7, 'rgba(10, 25, 47, 0.01)');
        outerGrad.addColorStop(1, 'rgba(10, 25, 47, 0)');

        ctx.fillStyle = outerGrad;
        ctx.fillRect(0, 0, width, height);

        // Inner focused spotlight core
        const innerGrad = ctx.createRadialGradient(x, y, 0, x, y, 120);
        innerGrad.addColorStop(0, 'rgba(0, 242, 254, 0.12)');
        innerGrad.addColorStop(0.6, 'rgba(16, 185, 129, 0.05)');
        innerGrad.addColorStop(1, 'rgba(0, 242, 254, 0)');

        ctx.fillStyle = innerGrad;
        ctx.beginPath();
        ctx.arc(x, y, 120, 0, Math.PI * 2);
        ctx.fill();
      }

      // Update and draw dispersing particles
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.alpha = 1 - p.life / p.maxLife;

        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
          continue;
        }

        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha * 0.7);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      animFrame = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animFrame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-30 h-full w-full opacity-90 transition-opacity duration-500"
    />
  );
};
