import { useCallback, useEffect, useRef } from "react";

export type DrawTool = "pen" | "line" | "rect" | "arrow" | "laser" | "spotlight";

const FADE_DURATION_MS = 3000; // pen/line/rect/arrow strokes fade after this

interface PenPath {
	type: "pen";
	points: { x: number; y: number }[];
	color: string;
	width: number;
	createdAt: number;
}

interface LinePath {
	type: "line";
	start: { x: number; y: number };
	end: { x: number; y: number };
	color: string;
	width: number;
	createdAt: number;
}

interface RectPath {
	type: "rect";
	start: { x: number; y: number };
	end: { x: number; y: number };
	color: string;
	width: number;
	createdAt: number;
}

interface ArrowPath {
	type: "arrow";
	start: { x: number; y: number };
	end: { x: number; y: number };
	color: string;
	width: number;
	createdAt: number;
}

type DrawnShape = PenPath | LinePath | RectPath | ArrowPath;

interface DrawingCanvasProps {
	tool: DrawTool;
	color: string;
	strokeWidth: number;
	spotlightPos: { x: number; y: number } | null;
	clearSignal: number;
	fadeEnabled: boolean;
}

function drawArrow(
	ctx: CanvasRenderingContext2D,
	start: { x: number; y: number },
	end: { x: number; y: number },
	width: number,
) {
	const headLen = Math.max(16, width * 4);
	const angle = Math.atan2(end.y - start.y, end.x - start.x);

	ctx.beginPath();
	ctx.moveTo(start.x, start.y);
	ctx.lineTo(end.x, end.y);
	ctx.stroke();

	// Arrowhead
	ctx.beginPath();
	ctx.moveTo(end.x, end.y);
	ctx.lineTo(
		end.x - headLen * Math.cos(angle - Math.PI / 6),
		end.y - headLen * Math.sin(angle - Math.PI / 6),
	);
	ctx.moveTo(end.x, end.y);
	ctx.lineTo(
		end.x - headLen * Math.cos(angle + Math.PI / 6),
		end.y - headLen * Math.sin(angle + Math.PI / 6),
	);
	ctx.stroke();
}

export function DrawingCanvas({
	tool,
	color,
	strokeWidth,
	spotlightPos,
	clearSignal,
	fadeEnabled,
}: DrawingCanvasProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const shapesRef = useRef<DrawnShape[]>([]);
	const currentPenRef = useRef<{ x: number; y: number }[] | null>(null);
	const currentLineRef = useRef<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null);
	const currentRectRef = useRef<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null);
	const currentArrowRef = useRef<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null);
	const isDrawingRef = useRef(false);
	const rafRef = useRef<number | null>(null);
	const toolRef = useRef(tool);
	const colorRef = useRef(color);
	const strokeWidthRef = useRef(strokeWidth);
	const spotlightRef = useRef(spotlightPos);
	const fadeEnabledRef = useRef(fadeEnabled);

	useEffect(() => { toolRef.current = tool; }, [tool]);
	useEffect(() => { colorRef.current = color; }, [color]);
	useEffect(() => { strokeWidthRef.current = strokeWidth; }, [strokeWidth]);
	useEffect(() => { spotlightRef.current = spotlightPos; }, [spotlightPos]);
	useEffect(() => { fadeEnabledRef.current = fadeEnabled; }, [fadeEnabled]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	}, []);

	useEffect(() => {
		if (clearSignal === 0) return;
		shapesRef.current = [];
		currentPenRef.current = null;
		currentLineRef.current = null;
		currentRectRef.current = null;
		currentArrowRef.current = null;
		isDrawingRef.current = false;
	}, [clearSignal]);

	const renderShape = useCallback(
		(ctx: CanvasRenderingContext2D, shape: DrawnShape, alpha: number) => {
			ctx.globalAlpha = alpha;
			ctx.strokeStyle = shape.color;
			ctx.lineWidth = shape.width;
			ctx.lineCap = "round";
			ctx.lineJoin = "round";

			if (shape.type === "pen") {
				const pts = shape.points;
				if (pts.length < 2) return;
				ctx.beginPath();
				ctx.moveTo(pts[0].x, pts[0].y);
				for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
				ctx.stroke();
			} else if (shape.type === "line") {
				ctx.beginPath();
				ctx.moveTo(shape.start.x, shape.start.y);
				ctx.lineTo(shape.end.x, shape.end.y);
				ctx.stroke();
			} else if (shape.type === "rect") {
				const x = Math.min(shape.start.x, shape.end.x);
				const y = Math.min(shape.start.y, shape.end.y);
				const w = Math.abs(shape.end.x - shape.start.x);
				const h = Math.abs(shape.end.y - shape.start.y);
				ctx.strokeRect(x, y, w, h);
			} else if (shape.type === "arrow") {
				drawArrow(ctx, shape.start, shape.end, shape.width);
			}

			ctx.globalAlpha = 1;
		},
		[],
	);

	const render = useCallback(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		ctx.clearRect(0, 0, canvas.width, canvas.height);

		const now = Date.now();

		// Committed shapes (with optional fade)
		if (fadeEnabledRef.current) {
			// Remove fully faded shapes
			shapesRef.current = shapesRef.current.filter(
				(s) => now - s.createdAt < FADE_DURATION_MS,
			);
		}

		for (const shape of shapesRef.current) {
			let alpha = 1;
			if (fadeEnabledRef.current) {
				const age = now - shape.createdAt;
				alpha = Math.max(0, 1 - age / FADE_DURATION_MS);
			}
			renderShape(ctx, shape, alpha);
		}

		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		ctx.globalAlpha = 1;

		// In-progress stroke
		const c = colorRef.current;
		const w = strokeWidthRef.current;

		const penPts = currentPenRef.current;
		if (penPts && penPts.length > 1) {
			ctx.strokeStyle = c;
			ctx.lineWidth = w;
			ctx.beginPath();
			ctx.moveTo(penPts[0].x, penPts[0].y);
			for (let i = 1; i < penPts.length; i++) ctx.lineTo(penPts[i].x, penPts[i].y);
			ctx.stroke();
		}

		const line = currentLineRef.current;
		if (line) {
			ctx.strokeStyle = c;
			ctx.lineWidth = w;
			ctx.beginPath();
			ctx.moveTo(line.start.x, line.start.y);
			ctx.lineTo(line.end.x, line.end.y);
			ctx.stroke();
		}

		const rect = currentRectRef.current;
		if (rect) {
			ctx.strokeStyle = c;
			ctx.lineWidth = w;
			const x = Math.min(rect.start.x, rect.end.x);
			const y = Math.min(rect.start.y, rect.end.y);
			const rw = Math.abs(rect.end.x - rect.start.x);
			const rh = Math.abs(rect.end.y - rect.start.y);
			ctx.strokeRect(x, y, rw, rh);
		}

		const arrow = currentArrowRef.current;
		if (arrow) {
			ctx.strokeStyle = c;
			ctx.lineWidth = w;
			drawArrow(ctx, arrow.start, arrow.end, w);
		}

		// Laser pointer
		const spot = spotlightRef.current;
		if (toolRef.current === "laser" && spot) {
			const radius = 12;
			ctx.save();
			// Outer glow
			const glow = ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, radius * 2.5);
			glow.addColorStop(0, "rgba(255,30,30,0.5)");
			glow.addColorStop(1, "rgba(255,30,30,0)");
			ctx.fillStyle = glow;
			ctx.beginPath();
			ctx.arc(spot.x, spot.y, radius * 2.5, 0, Math.PI * 2);
			ctx.fill();
			// Core dot
			ctx.fillStyle = "#ff1e1e";
			ctx.beginPath();
			ctx.arc(spot.x, spot.y, radius, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
		}

		// Spotlight
		if (toolRef.current === "spotlight" && spot) {
			const radius = 80;
			ctx.save();
			ctx.fillStyle = "rgba(0,0,0,0.55)";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.globalCompositeOperation = "destination-out";
			const grad = ctx.createRadialGradient(spot.x, spot.y, radius * 0.5, spot.x, spot.y, radius);
			grad.addColorStop(0, "rgba(0,0,0,1)");
			grad.addColorStop(1, "rgba(0,0,0,0)");
			ctx.fillStyle = grad;
			ctx.beginPath();
			ctx.arc(spot.x, spot.y, radius, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
		}

		rafRef.current = requestAnimationFrame(render);
	}, [renderShape]);

	useEffect(() => {
		rafRef.current = requestAnimationFrame(render);
		return () => {
			if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
		};
	}, [render]);

	const getPos = (e: React.MouseEvent) => ({ x: e.clientX, y: e.clientY });

	const commitDrawing = useCallback(
		(endPos: { x: number; y: number }) => {
			if (!isDrawingRef.current) return;
			isDrawingRef.current = false;
			const now = Date.now();

			if (toolRef.current === "pen" && currentPenRef.current && currentPenRef.current.length > 0) {
				shapesRef.current.push({
					type: "pen",
					points: currentPenRef.current,
					color: colorRef.current,
					width: strokeWidthRef.current,
					createdAt: now,
				});
				currentPenRef.current = null;
			} else if (toolRef.current === "line" && currentLineRef.current) {
				shapesRef.current.push({
					type: "line",
					start: currentLineRef.current.start,
					end: endPos,
					color: colorRef.current,
					width: strokeWidthRef.current,
					createdAt: now,
				});
				currentLineRef.current = null;
			} else if (toolRef.current === "rect" && currentRectRef.current) {
				shapesRef.current.push({
					type: "rect",
					start: currentRectRef.current.start,
					end: endPos,
					color: colorRef.current,
					width: strokeWidthRef.current,
					createdAt: now,
				});
				currentRectRef.current = null;
			} else if (toolRef.current === "arrow" && currentArrowRef.current) {
				shapesRef.current.push({
					type: "arrow",
					start: currentArrowRef.current.start,
					end: endPos,
					color: colorRef.current,
					width: strokeWidthRef.current,
					createdAt: now,
				});
				currentArrowRef.current = null;
			}
		},
		[],
	);

	useEffect(() => {
		const onUp = (e: MouseEvent) => commitDrawing({ x: e.clientX, y: e.clientY });
		window.addEventListener("mouseup", onUp);
		return () => window.removeEventListener("mouseup", onUp);
	}, [commitDrawing]);

	const handleMouseDown = (e: React.MouseEvent) => {
		if (e.button !== 0) return;
		const t = toolRef.current;
		if (t === "laser" || t === "spotlight") return;
		isDrawingRef.current = true;
		const pos = getPos(e);
		if (t === "pen") currentPenRef.current = [pos];
		else if (t === "line") currentLineRef.current = { start: pos, end: pos };
		else if (t === "rect") currentRectRef.current = { start: pos, end: pos };
		else if (t === "arrow") currentArrowRef.current = { start: pos, end: pos };
	};

	const handleMouseMove = (e: React.MouseEvent) => {
		if (!isDrawingRef.current) return;
		const pos = getPos(e);
		const t = toolRef.current;
		if (t === "pen" && currentPenRef.current) currentPenRef.current.push(pos);
		else if (t === "line" && currentLineRef.current) currentLineRef.current = { ...currentLineRef.current, end: pos };
		else if (t === "rect" && currentRectRef.current) currentRectRef.current = { ...currentRectRef.current, end: pos };
		else if (t === "arrow" && currentArrowRef.current) currentArrowRef.current = { ...currentArrowRef.current, end: pos };
	};

	const cursor =
		tool === "spotlight" || tool === "laser" ? "none" : "crosshair";

	return (
		<canvas
			ref={canvasRef}
			style={{
				position: "fixed",
				inset: 0,
				width: "100vw",
				height: "100vh",
				cursor,
				touchAction: "none",
			}}
			onMouseDown={handleMouseDown}
			onMouseMove={handleMouseMove}
		/>
	);
}
