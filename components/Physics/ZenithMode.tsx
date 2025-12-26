
import React, { useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';

interface ZenithModeProps {
  onClose: () => void;
}

export const ZenithMode: React.FC<ZenithModeProps> = ({ onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Load Matter.js dynamically
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/matter-js@0.19.0/build/matter.min.js";
    document.body.appendChild(script);

    script.onload = () => {
      // @ts-ignore
      const { Engine, Render, Runner, Bodies, Composite, Mouse, MouseConstraint } = window.Matter;

      const engine = Engine.create();
      engine.world.gravity.y = 0; // Zero gravity

      const render = Render.create({
        element: containerRef.current,
        engine: engine,
        options: {
          width: window.innerWidth,
          height: window.innerHeight,
          background: 'transparent',
          wireframes: false
        }
      });

      // Create some "UI elements" as physics bodies
      const boxes = [];
      for (let i = 0; i < 15; i++) {
        const body = Bodies.rectangle(
          Math.random() * window.innerWidth,
          Math.random() * window.innerHeight,
          100 + Math.random() * 200,
          40 + Math.random() * 40,
          {
            render: {
              fillStyle: 'transparent',
              strokeStyle: '#00ff41',
              lineWidth: 1,
              sprite: {
                // This would be cool to use snapshots of actual UI components
              }
            },
            chamfer: { radius: 10 }
          }
        );
        boxes.push(body);
      }

      const walls = [
        Bodies.rectangle(window.innerWidth / 2, -10, window.innerWidth, 20, { isStatic: true }),
        Bodies.rectangle(window.innerWidth / 2, window.innerHeight + 10, window.innerWidth, 20, { isStatic: true }),
        Bodies.rectangle(-10, window.innerHeight / 2, 20, window.innerHeight, { isStatic: true }),
        Bodies.rectangle(window.innerWidth + 10, window.innerHeight / 2, 20, window.innerHeight, { isStatic: true })
      ];

      Composite.add(engine.world, [...boxes, ...walls]);

      const mouse = Mouse.create(render.canvas);
      const mouseConstraint = MouseConstraint.create(engine, {
        mouse: mouse,
        constraint: {
          stiffness: 0.2,
          render: { visible: false }
        }
      });
      Composite.add(engine.world, mouseConstraint);

      Render.run(render);
      const runner = Runner.create();
      Runner.run(runner, engine);

      // Random drifting forces
      const driftInterval = setInterval(() => {
        boxes.forEach(box => {
          // @ts-ignore
          window.Matter.Body.applyForce(box, box.position, {
            x: (Math.random() - 0.5) * 0.05,
            y: (Math.random() - 0.5) * 0.05
          });
        });
      }, 2000);

      return () => {
        Render.stop(render);
        Runner.stop(runner);
        Engine.clear(engine);
        clearInterval(driftInterval);
      };
    };

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md cursor-crosshair">
      <div className="absolute top-8 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <h2 className="text-4xl font-black text-[#00ff41] glitch-text">ZENITH_ZERO_G_MODE</h2>
        <p className="text-xs opacity-50">PHYSICS_OVERRIDE_ACTIVE // CLICK_AND_DRAG_TO_MANIPULATE</p>
      </div>
      <button 
        onClick={onClose}
        className="absolute top-8 right-8 text-[#00ff41] border border-[#00ff41] px-4 py-1 hover:bg-[#00ff41] hover:text-black"
      >
        RESTORE GRAVITY
      </button>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};
