import { ArrowRight, Minus, Pen, Square, Timer, Trash2, X, ZoomIn } from "lucide-react";
import type { DrawTool } from "./DrawingCanvas";

const COLORS = [
	{ value: "#ef4444", label: "빨강" },
	{ value: "#22c55e", label: "초록" },
	{ value: "#3b82f6", label: "파랑" },
	{ value: "#eab308", label: "노랑" },
	{ value: "#ffffff", label: "흰색" },
];

interface OverlayToolbarProps {
	tool: DrawTool;
	color: string;
	strokeWidth: number;
	fadeEnabled: boolean;
	onToolChange: (tool: DrawTool) => void;
	onColorChange: (color: string) => void;
	onStrokeWidthChange: (width: number) => void;
	onFadeToggle: () => void;
	onClear: () => void;
	onClose: () => void;
}

export function OverlayToolbar({
	tool,
	color,
	strokeWidth,
	fadeEnabled,
	onToolChange,
	onColorChange,
	onStrokeWidthChange,
	onFadeToggle,
	onClear,
	onClose,
}: OverlayToolbarProps) {
	return (
		<div
			style={{
				position: "fixed",
				bottom: 140,
				left: "50%",
				transform: "translateX(-50%)",
				display: "flex",
				alignItems: "center",
				gap: 8,
				padding: "8px 12px",
				borderRadius: 14,
				background: "rgba(15,15,15,0.88)",
				backdropFilter: "blur(12px)",
				border: "1px solid rgba(255,255,255,0.12)",
				boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
				zIndex: 9999,
				userSelect: "none",
			}}
			onMouseDown={(e) => e.stopPropagation()}
		>
			{/* Tool buttons */}
			<ToolBtn active={tool === "pen"} onClick={() => onToolChange("pen")} title="펜 (1)">
				<Pen size={16} />
			</ToolBtn>
			<ToolBtn active={tool === "line"} onClick={() => onToolChange("line")} title="직선 (2)">
				<Minus size={16} />
			</ToolBtn>
			<ToolBtn active={tool === "rect"} onClick={() => onToolChange("rect")} title="사각형 (3)">
				<Square size={16} />
			</ToolBtn>
			<ToolBtn active={tool === "arrow"} onClick={() => onToolChange("arrow")} title="화살표 (4)">
				<ArrowRight size={16} />
			</ToolBtn>
			<ToolBtn active={tool === "laser"} onClick={() => onToolChange("laser")} title="레이저 포인터 (5)" laser>
				<span style={{ fontSize: 14, lineHeight: 1 }}>●</span>
			</ToolBtn>
			<ToolBtn active={tool === "spotlight"} onClick={() => onToolChange("spotlight")} title="스포트라이트 (6)">
				<ZoomIn size={16} />
			</ToolBtn>

			<Divider />

			{/* Color swatches */}
			{COLORS.map((c) => (
				<button
					key={c.value}
					title={c.label}
					onClick={() => onColorChange(c.value)}
					style={{
						width: 20,
						height: 20,
						borderRadius: "50%",
						background: c.value,
						border: color === c.value ? "2px solid #fff" : "2px solid rgba(255,255,255,0.25)",
						cursor: "pointer",
						flexShrink: 0,
						outline: "none",
					}}
				/>
			))}

			<Divider />

			{/* Stroke width */}
			<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
				<span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, whiteSpace: "nowrap" }}>
					굵기 ([ ])
				</span>
				<input
					type="range"
					min={2}
					max={20}
					value={strokeWidth}
					onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
					style={{ width: 72, accentColor: "#3b82f6" }}
				/>
				<span style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, width: 16, textAlign: "right" }}>
					{strokeWidth}
				</span>
			</div>

			<Divider />

			{/* Fade toggle */}
			<ToolBtn active={fadeEnabled} onClick={onFadeToggle} title={`자동 페이드 ${fadeEnabled ? "켜짐" : "꺼짐"} (F)`}>
				<Timer size={16} />
			</ToolBtn>

			{/* Clear */}
			<ToolBtn active={false} onClick={onClear} title="전체 지우기 (C / Delete)">
				<Trash2 size={16} />
			</ToolBtn>

			{/* Close */}
			<ToolBtn active={false} onClick={onClose} title="닫기 (Esc)" danger>
				<X size={16} />
			</ToolBtn>
		</div>
	);
}

function Divider() {
	return (
		<div
			style={{
				width: 1,
				height: 20,
				background: "rgba(255,255,255,0.15)",
				flexShrink: 0,
			}}
		/>
	);
}

function ToolBtn({
	active,
	onClick,
	title,
	danger,
	laser,
	children,
}: {
	active: boolean;
	onClick: () => void;
	title: string;
	danger?: boolean;
	laser?: boolean;
	children: React.ReactNode;
}) {
	return (
		<button
			title={title}
			onClick={onClick}
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				width: 32,
				height: 32,
				borderRadius: 8,
				border: "none",
				cursor: "pointer",
				background: active
					? laser
						? "rgba(239,68,68,0.25)"
						: "rgba(59,130,246,0.35)"
					: "transparent",
				color: danger
					? "rgba(239,68,68,0.85)"
					: laser
						? active
							? "#f87171"
							: "rgba(239,68,68,0.7)"
						: active
							? "#93c5fd"
							: "rgba(255,255,255,0.75)",
				outline: "none",
				transition: "background 0.12s, color 0.12s",
				flexShrink: 0,
			}}
		>
			{children}
		</button>
	);
}
