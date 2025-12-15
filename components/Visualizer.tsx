import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isActive: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        const size = Math.min(parent.clientWidth, parent.clientHeight);
        // Increase resolution for sharpness
        canvas.width = size * 2; 
        canvas.height = size * 2;
        canvas.style.width = `${size}px`;
        canvas.style.height = `${size}px`;
        ctx.scale(2, 2);
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let time = 0;

    const draw = () => {
      if (!ctx || !canvas) return;
      
      const width = canvas.width / 2;
      const height = canvas.height / 2;
      const centerX = width / 2;
      const centerY = height / 2;
      
      ctx.clearRect(0, 0, width, height);
      
      const baseRadius = Math.min(centerX, centerY) * 0.55;
      
      // -- The Orb --
      
      // 1. Base Dark Sphere
      const sphereGradient = ctx.createRadialGradient(centerX - baseRadius * 0.3, centerY - baseRadius * 0.3, 0, centerX, centerY, baseRadius);
      sphereGradient.addColorStop(0, '#333');
      sphereGradient.addColorStop(0.5, '#111');
      sphereGradient.addColorStop(1, '#000');
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
      ctx.fillStyle = sphereGradient;
      ctx.fill();

      // 2. Inner Colorful Glows (Animated)
      // We mask the drawing to the sphere
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
      ctx.clip();

      const moveX = Math.sin(time * 0.5) * baseRadius * 0.3;
      const moveY = Math.cos(time * 0.3) * baseRadius * 0.3;

      // Pink Glow
      const pinkG = ctx.createRadialGradient(centerX + moveX, centerY - moveY, 0, centerX + moveX, centerY - moveY, baseRadius * 0.8);
      pinkG.addColorStop(0, 'rgba(236, 72, 153, 0.4)'); // Pink
      pinkG.addColorStop(1, 'transparent');
      ctx.fillStyle = pinkG;
      ctx.fillRect(0, 0, width, height);

      // Blue Glow
      const blueG = ctx.createRadialGradient(centerX - moveX, centerY + moveY, 0, centerX - moveX, centerY + moveY, baseRadius * 0.8);
      blueG.addColorStop(0, 'rgba(59, 130, 246, 0.4)'); // Blue
      blueG.addColorStop(1, 'transparent');
      ctx.fillStyle = blueG;
      ctx.fillRect(0, 0, width, height);
      
      // Green Glow
      const greenG = ctx.createRadialGradient(centerX, centerY + baseRadius * 0.5, 0, centerX, centerY + baseRadius * 0.5, baseRadius * 0.6);
      greenG.addColorStop(0, 'rgba(16, 185, 129, 0.3)'); // Green
      greenG.addColorStop(1, 'transparent');
      ctx.fillStyle = greenG;
      ctx.fillRect(0, 0, width, height);

      ctx.restore();

      // 3. Eyes (Vertical Pills) - The "Face"
      const eyeWidth = baseRadius * 0.12;
      const eyeHeight = baseRadius * 0.35;
      const eyeSpacing = baseRadius * 0.3;

      ctx.fillStyle = 'white';
      
      // Left Eye
      ctx.beginPath();
      ctx.roundRect(centerX - eyeSpacing - eyeWidth/2, centerY - eyeHeight/2, eyeWidth, eyeHeight, 10);
      ctx.fill();
      
      // Right Eye
      ctx.beginPath();
      ctx.roundRect(centerX + eyeSpacing - eyeWidth/2, centerY - eyeHeight/2, eyeWidth, eyeHeight, 10);
      ctx.fill();

      // 4. Glossy Reflection (Top)
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.ellipse(centerX, centerY - baseRadius * 0.5, baseRadius * 0.6, baseRadius * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 5. Floor Shadow / Reflection
      const shadowG = ctx.createRadialGradient(centerX, centerY + baseRadius * 1.4, 0, centerX, centerY + baseRadius * 1.4, baseRadius);
      shadowG.addColorStop(0, 'rgba(124, 58, 237, 0.3)');
      shadowG.addColorStop(1, 'transparent');
      ctx.fillStyle = shadowG;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY + baseRadius * 1.4, baseRadius, baseRadius * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Animation State
      if (isActive) {
        time += 0.05;
        // Bounce effect
        ctx.save();
        ctx.translate(0, Math.sin(time * 2) * 5); 
        ctx.restore();
      } else {
        time += 0.02; // Slow breathing
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [isActive]);

  return (
      <div className="w-full h-full flex items-center justify-center">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
  );
};

export default Visualizer;