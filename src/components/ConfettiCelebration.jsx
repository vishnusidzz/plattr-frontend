import React, { useEffect } from "react";

export default function ConfettiCelebration({
  duration = 3000, // run for 3 seconds
  particleCount = 100,
  colors = ["#FF6B6B", "#FFD166", "#6BCB77", "#4D96FF", "#C77DFF"],
  zIndex = 60,
}) {
  useEffect(() => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.style.position = "fixed";
    canvas.style.top = 0;
    canvas.style.left = 0;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = zIndex;
    document.body.appendChild(canvas);

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.3,
      size: Math.random() * 6 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      vy: Math.random() * 4 + 2,
      vx: Math.random() * 2 - 1,
      rotation: Math.random() * 360,
      spin: (Math.random() - 0.5) * 10,
    }));

    let running = true;
    const start = performance.now();

    function draw() {
      const now = performance.now();
      const elapsed = now - start;
      if (elapsed > duration) {
        running = false;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.spin;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });

      if (running) {
        requestAnimationFrame(draw);
      } else {
        cleanup();
      }
    }

    function cleanup() {
      window.removeEventListener("resize", resize);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }

    draw();

    return cleanup;
  }, [duration, particleCount, colors, zIndex]);

  return null; // no JSX overlay needed
}