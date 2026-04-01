import { X } from "lucide-react";

interface Props {
	opacity: number;
	onOpacityChange: (v: number) => void;
}

export function PresenterControls({ opacity, onOpacityChange }: Props) {
	function handleClose() {
		window.electronAPI.closeMediaPresenter();
	}

	return (
		<div
			className="flex items-center gap-3 border-t border-white/10 bg-zinc-900/80 px-3 py-2"
			style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
		>
			<span className="text-xs text-white/50">투명도</span>
			<input
				type="range"
				min={0.1}
				max={1}
				step={0.05}
				value={opacity}
				onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
				className="h-1 w-24 cursor-pointer accent-blue-500"
			/>
			<span className="w-8 text-xs text-white/50">{Math.round(opacity * 100)}%</span>
			<div className="ml-auto">
				<button
					onClick={handleClose}
					className="flex h-6 w-6 items-center justify-center rounded text-white/50 hover:bg-white/10 hover:text-white"
				>
					<X size={14} />
				</button>
			</div>
		</div>
	);
}
