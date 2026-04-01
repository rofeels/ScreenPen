import { useEffect, useRef } from "react";

interface ClickRipple {
	id: number;
	x: number;
	y: number;
	type: string;
	startedAt: number;
}

const RIPPLE_DURATION = 600;

export function ClickEffectOverlay() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const ripplesRef = useRef<ClickRipple[]>([]);
	const rafRef = useRef<number | null>(null);
	const idRef = useRef(0);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	}, []);

	useEffect(() => {
		if (!window.electronAPI?.onClickEvent) return;
		return window.electronAPI.onClickEvent((data) => {
			ripplesRef.current.push({
				id: idRef.current++,
				x: data.x,
				y: data.y,
				type: data.type,
				startedAt: Date.now(),
			});
		});
	}, []);

	useEffect(() => {
		const render = () => {
			const canvas = canvasRef.current;
			if (!canvas) return;
			const ctx = canvas.getContext("2d");
			if (!ctx) return;

			ctx.clearRect(0, 0, canvas.width, canvas.height);

			const now = Date.now();
			ripplesRef.current = ripplesRef.current.filter(
				(r) => now - r.startedAt < RIPPLE_DURATION,
			);

			for (const ripple of ripplesRef.current) {
				const progress = (now - ripple.startedAt) / RIPPLE_DURATION;
				const eased = 1 - (1 - progress) * (1 - progress);
				const maxRadius = ripple.type === "double-click" ? 48 : 32;
				const radius = eased * maxRadius;
				const alpha = (1 - progress) * 0.75;

				const color =
					ripple.type === "right-click"
						? `rgba(251,191,36,${alpha})`
						: ripple.type === "double-click"
							? `rgba(167,139,250,${alpha})`
							: `rgba(96,165,250,${alpha})`;

				// Outer ripple ring
				ctx.beginPath();
				ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
				ctx.strokeStyle = color;
				ctx.lineWidth = 2.5;
				ctx.stroke();

				// Inner dot (only at start)
				if (progress < 0.3) {
					const dotAlpha = (1 - progress / 0.3) * 0.9;
					ctx.beginPath();
					ctx.arc(ripple.x, ripple.y, 6, 0, Math.PI * 2);
					ctx.fillStyle =
						ripple.type === "right-click"
							? `rgba(251,191,36,${dotAlpha})`
							: ripple.type === "double-click"
								? `rgba(167,139,250,${dotAlpha})`
								: `rgba(96,165,250,${dotAlpha})`;
					ctx.fill();
				}
			}

			rafRef.current = requestAnimationFrame(render);
		};

		rafRef.current = requestAnimationFrame(render);
		return () => {
			if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
		};
	}, []);

	return (
		<canvas
			ref={canvasRef}
			style={{
				position: "fixed",
				inset: 0,
				width: "100vw",
				height: "100vh",
				pointerEvents: "none",
			}}
		/>
	);
}
