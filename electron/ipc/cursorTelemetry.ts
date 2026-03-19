import type { CursorTelemetryPoint } from "./contracts";
import type { NativeMacWindowSource } from "./nativeHelpers";

export type CursorVisualType = NonNullable<CursorTelemetryPoint["cursorType"]>;
export type CursorInteractionType = NonNullable<CursorTelemetryPoint["interactionType"]>;

export type HookMouseEventLike = {
	button?: unknown;
	mouseButton?: unknown;
	x?: unknown;
	y?: unknown;
	screenX?: unknown;
	screenY?: unknown;
	data?: {
		button?: unknown;
		mouseButton?: unknown;
		x?: unknown;
		y?: unknown;
		screenX?: unknown;
		screenY?: unknown;
	};
};

export type WindowBounds = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export function normalizeHookMouseButton(rawButton: unknown): 1 | 2 | 3 {
	if (typeof rawButton !== "number" || !Number.isFinite(rawButton)) {
		return 1;
	}

	if (rawButton === 2 || rawButton === 39) {
		return 2;
	}

	if (rawButton === 3 || rawButton === 38) {
		return 3;
	}

	return 1;
}

export function getHookMouseButton(event: HookMouseEventLike): 1 | 2 | 3 {
	return normalizeHookMouseButton(
		event?.button ?? event?.mouseButton ?? event?.data?.button ?? event?.data?.mouseButton,
	);
}

export function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

export function normalizeCursorPointForBounds(
	cursor: { x: number; y: number },
	bounds: WindowBounds,
) {
	const width = Math.max(1, bounds.width);
	const height = Math.max(1, bounds.height);

	return {
		cx: clamp((cursor.x - bounds.x) / width, 0, 1),
		cy: clamp((cursor.y - bounds.y) / height, 0, 1),
	};
}

export function getHookCursorScreenPoint(
	event: HookMouseEventLike,
): { x: number; y: number } | null {
	const rawX = event?.x ?? event?.data?.x ?? event?.screenX ?? event?.data?.screenX;
	const rawY = event?.y ?? event?.data?.y ?? event?.screenY ?? event?.data?.screenY;

	if (
		typeof rawX !== "number" ||
		!Number.isFinite(rawX) ||
		typeof rawY !== "number" ||
		!Number.isFinite(rawY)
	) {
		return null;
	}

	return { x: rawX, y: rawY };
}

export function getWindowBoundsFromNativeSource(
	source?: NativeMacWindowSource | null,
): WindowBounds | null {
	if (!source) {
		return null;
	}

	const { x, y, width, height } = source;
	if (
		typeof x !== "number" ||
		!Number.isFinite(x) ||
		typeof y !== "number" ||
		!Number.isFinite(y) ||
		typeof width !== "number" ||
		!Number.isFinite(width) ||
		typeof height !== "number" ||
		!Number.isFinite(height)
	) {
		return null;
	}

	if (width <= 0 || height <= 0) {
		return null;
	}

	return { x, y, width, height };
}

export function mergePendingCursorSamples(
	pendingSamples: CursorTelemetryPoint[],
	activeSamples: CursorTelemetryPoint[],
) {
	if (activeSamples.length === 0) {
		return pendingSamples;
	}

	if (pendingSamples.length === 0) {
		return [...activeSamples];
	}

	const lastPendingTimeMs = pendingSamples[pendingSamples.length - 1]?.timeMs ?? -1;
	return [
		...pendingSamples,
		...activeSamples.filter((sample) => sample.timeMs > lastPendingTimeMs),
	];
}
