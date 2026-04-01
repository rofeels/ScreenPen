import { useEffect, useRef, useState } from "react";

// uiohook-napi keycodes (subset of common keys)
const KEYCODE_MAP: Record<number, string> = {
	1: "Esc",
	2: "1", 3: "2", 4: "3", 5: "4", 6: "5", 7: "6", 8: "7", 9: "8", 10: "9", 11: "0",
	12: "-", 13: "=", 14: "⌫",
	15: "Tab",
	16: "Q", 17: "W", 18: "E", 19: "R", 20: "T", 21: "Y", 22: "U", 23: "I", 24: "O", 25: "P",
	26: "[", 27: "]", 28: "↵",
	29: "Ctrl",
	30: "A", 31: "S", 32: "D", 33: "F", 34: "G", 35: "H", 36: "J", 37: "K", 38: "L",
	39: ";", 40: "'", 41: "`",
	42: "Shift",
	43: "\\",
	44: "Z", 45: "X", 46: "C", 47: "V", 48: "B", 49: "N", 50: "M",
	51: ",", 52: ".", 53: "/",
	54: "Shift",
	56: "Alt",
	57: "Space",
	58: "CapsLock",
	59: "F1", 60: "F2", 61: "F3", 62: "F4", 63: "F5", 64: "F6",
	65: "F7", 66: "F8", 67: "F9", 68: "F10",
	87: "F11", 88: "F12",
	3675: "⌘", // Meta left
	3676: "⌘", // Meta right
	3640: "Alt",
	3613: "↵",
	3638: "Del",
	57416: "↑", 57419: "←", 57421: "→", 57424: "↓",
	3639: "Home", 3647: "End", 3649: "PgUp", 3657: "PgDn",
};

const MODIFIER_CODES = new Set([29, 42, 54, 56, 3675, 3676, 3640]);

interface KeystrokeEvent {
	keycode: number;
	altKey: boolean;
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
}

interface KeyDisplay {
	id: number;
	label: string;
	timestamp: number;
}

const DISPLAY_DURATION = 2200;
const MERGE_WINDOW = 800; // merge new key into existing display if within this ms

function buildLabel(event: KeystrokeEvent): string | null {
	const key = KEYCODE_MAP[event.keycode];
	if (!key) return null;

	// Skip standalone modifier keys
	if (MODIFIER_CODES.has(event.keycode)) return null;

	const parts: string[] = [];
	if (event.metaKey) parts.push("⌘");
	if (event.ctrlKey) parts.push("Ctrl");
	if (event.altKey) parts.push("Alt");
	if (event.shiftKey && !["Shift"].includes(key)) parts.push("⇧");
	parts.push(key);

	return parts.join(" + ");
}

export function KeystrokeOverlay() {
	const [displays, setDisplays] = useState<KeyDisplay[]>([]);
	const idRef = useRef(0);

	useEffect(() => {
		if (!window.electronAPI?.onKeystrokeEvent) return;
		return window.electronAPI.onKeystrokeEvent((data) => {
			const label = buildLabel(data);
			if (!label) return;

			setDisplays((prev) => {
				const now = Date.now();
				const last = prev[prev.length - 1];
				// Merge into last entry if within window
				if (last && now - last.timestamp < MERGE_WINDOW && last.label === label) {
					return prev; // same key held down — ignore
				}
				// Append
				return [...prev.slice(-4), { id: idRef.current++, label, timestamp: now }];
			});
		});
	}, []);

	// Remove expired entries
	useEffect(() => {
		const interval = setInterval(() => {
			const now = Date.now();
			setDisplays((prev) => prev.filter((d) => now - d.timestamp < DISPLAY_DURATION));
		}, 200);
		return () => clearInterval(interval);
	}, []);

	if (displays.length === 0) return null;

	return (
		<div
			style={{
				position: "fixed",
				top: 24,
				left: "50%",
				transform: "translateX(-50%)",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: 6,
				pointerEvents: "none",
				zIndex: 9999,
			}}
		>
			{displays.map((d) => {
				const age = Date.now() - d.timestamp;
				const fadeStart = DISPLAY_DURATION - 400;
				const opacity = age > fadeStart ? 1 - (age - fadeStart) / 400 : 1;

				return (
					<div
						key={d.id}
						style={{
							padding: "6px 18px",
							borderRadius: 10,
							background: "rgba(0,0,0,0.72)",
							border: "1px solid rgba(255,255,255,0.18)",
							backdropFilter: "blur(8px)",
							color: "#fff",
							fontSize: 20,
							fontWeight: 600,
							fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif",
							letterSpacing: "0.02em",
							whiteSpace: "nowrap",
							opacity,
							transition: "opacity 0.1s linear",
							boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
						}}
					>
						{d.label}
					</div>
				);
			})}
		</div>
	);
}
