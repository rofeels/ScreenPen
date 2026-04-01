import { useCallback, useEffect, useRef, useState } from "react";
import { DrawingCanvas } from "./DrawingCanvas";
import type { DrawTool } from "./DrawingCanvas";
import { OverlayToolbar } from "./OverlayToolbar";

export function DrawingOverlayApp() {
	const [tool, setTool] = useState<DrawTool>("pen");
	const [color, setColor] = useState("#ef4444");
	const [strokeWidth, setStrokeWidth] = useState(4);
	const [clearSignal, setClearSignal] = useState(0);
	const [spotlightPos, setSpotlightPos] = useState<{ x: number; y: number } | null>(null);
	const [fadeEnabled, setFadeEnabled] = useState(false);
	const toolRef = useRef(tool);

	useEffect(() => {
		toolRef.current = tool;
		if (tool !== "spotlight" && tool !== "laser") {
			setSpotlightPos(null);
		}
	}, [tool]);

	// Cursor position from main process (for spotlight & laser)
	useEffect(() => {
		if (!window.electronAPI?.onCursorScreenPosition) return;
		const unsub = window.electronAPI.onCursorScreenPosition((pos) => {
			const t = toolRef.current;
			if (t === "spotlight" || t === "laser") {
				setSpotlightPos(pos);
			}
		});
		return unsub;
	}, []);

	const handleClose = useCallback(() => {
		window.electronAPI?.destroyDrawingOverlay?.();
	}, []);

	const handleClear = useCallback(() => {
		setClearSignal((s) => s + 1);
	}, []);

	const handleFadeToggle = useCallback(() => {
		setFadeEnabled((v) => !v);
	}, []);

	// Keyboard shortcuts
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.target instanceof HTMLInputElement) return;

			switch (e.key) {
				case "1": setTool("pen"); break;
				case "2": setTool("line"); break;
				case "3": setTool("rect"); break;
				case "4": setTool("arrow"); break;
				case "5": setTool("laser"); break;
				case "6": setTool("spotlight"); break;
				case "[": setStrokeWidth((w) => Math.max(2, w - 2)); break;
				case "]": setStrokeWidth((w) => Math.min(20, w + 2)); break;
				case "f":
				case "F":
					handleFadeToggle();
					break;
				case "c":
				case "C":
				case "Delete":
				case "Backspace":
					handleClear();
					break;
				case "Escape":
					handleClose();
					break;
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [handleClear, handleClose, handleFadeToggle]);

	return (
		<div
			// eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
			tabIndex={0}
			style={{
				position: "fixed",
				inset: 0,
				width: "100vw",
				height: "100vh",
				overflow: "hidden",
				background: "transparent",
				outline: "none",
			}}
		>
			<DrawingCanvas
				tool={tool}
				color={color}
				strokeWidth={strokeWidth}
				spotlightPos={tool === "spotlight" || tool === "laser" ? spotlightPos : null}
				clearSignal={clearSignal}
				fadeEnabled={fadeEnabled}
			/>
			<OverlayToolbar
				tool={tool}
				color={color}
				strokeWidth={strokeWidth}
				fadeEnabled={fadeEnabled}
				onToolChange={setTool}
				onColorChange={setColor}
				onStrokeWidthChange={setStrokeWidth}
				onFadeToggle={handleFadeToggle}
				onClear={handleClear}
				onClose={handleClose}
			/>
		</div>
	);
}
