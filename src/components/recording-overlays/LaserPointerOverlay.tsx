import { useEffect, useRef } from "react";

const DOT_RADIUS = 8;
const GLOW_RADIUS = 24;
const TRAIL_LENGTH = 18;
const TRAIL_DECAY = 0.82;

interface TrailPoint {
	x: number;
	y: number;
}

export function LaserPointerOverlay() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const posRef = useRef<{ x: number; y: number } | null>(null);
	const trailRef = useRef<TrailPoint[]>([]);
	const rafRef = useRef<number | null>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		canvas.width = window.screen.width;
		canvas.height = window.screen.height;

		function draw() {
			if (!canvas) return;
			const ctx = canvas.getContext("2d");
			if (!ctx) return;

			ctx.clearRect(0, 0, canvas.width, canvas.height);

			const pos = posRef.current;
			if (!pos) {
				rafRef.current = requestAnimationFrame(draw);
				return;
			}

			const trail = trailRef.current;

			// 트레일 그리기
			for (let i = 0; i < trail.length; i++) {
				const t = trail[i];
				const progress = i / trail.length;
				const alpha = Math.pow(TRAIL_DECAY, trail.length - i) * 0.5;
				const radius = DOT_RADIUS * (0.3 + progress * 0.7);

				ctx.beginPath();
				ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
				ctx.fillStyle = `rgba(255, 30, 30, ${alpha})`;
				ctx.fill();
			}

			// 외부 글로우
			const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, GLOW_RADIUS);
			glow.addColorStop(0, "rgba(255, 60, 60, 0.5)");
			glow.addColorStop(0.4, "rgba(255, 30, 30, 0.2)");
			glow.addColorStop(1, "rgba(255, 0, 0, 0)");
			ctx.beginPath();
			ctx.arc(pos.x, pos.y, GLOW_RADIUS, 0, Math.PI * 2);
			ctx.fillStyle = glow;
			ctx.fill();

			// 중앙 빨간 점
			ctx.beginPath();
			ctx.arc(pos.x, pos.y, DOT_RADIUS, 0, Math.PI * 2);
			ctx.fillStyle = "#ff2020";
			ctx.shadowColor = "#ff0000";
			ctx.shadowBlur = 10;
			ctx.fill();
			ctx.shadowBlur = 0;

			// 흰 중심점
			ctx.beginPath();
			ctx.arc(pos.x, pos.y, 2.5, 0, Math.PI * 2);
			ctx.fillStyle = "rgba(255,255,255,0.9)";
			ctx.fill();

			rafRef.current = requestAnimationFrame(draw);
		}

		rafRef.current = requestAnimationFrame(draw);
		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
	}, []);

	useEffect(() => {
		if (!window.electronAPI?.onLaserPointerPosition) return;
		return window.electronAPI.onLaserPointerPosition((pos) => {
			posRef.current = pos;
			trailRef.current = [...trailRef.current.slice(-(TRAIL_LENGTH - 1)), pos];
		});
	}, []);

	return (
		<canvas
			ref={canvasRef}
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				width: "100vw",
				height: "100vh",
				pointerEvents: "none",
			}}
		/>
	);
}
