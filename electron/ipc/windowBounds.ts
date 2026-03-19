import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { SelectedSource } from "./contracts";
import { getWindowBoundsFromNativeSource } from "./cursorTelemetry";
import type { WindowBounds } from "./cursorTelemetry";
import type { NativeMacWindowSource } from "./nativeHelpers";

const execFileAsync = promisify(execFile);
const DEFAULT_WINDOW_BOUNDS_REFRESH_MS = 250;

export type DisplayBoundsLike = {
	id: number;
	bounds: WindowBounds;
};

export type NativeWindowSourcesGetter = (
	options?: { maxAgeMs?: number },
) => Promise<NativeMacWindowSource[]>;

export function parseWindowId(sourceId?: string) {
	if (!sourceId) {
		return null;
	}

	const match = sourceId.match(/^window:(\d+)/);
	return match ? Number.parseInt(match[1], 10) : null;
}

export function getDisplayBoundsForSource(
	source: SelectedSource,
	displays: DisplayBoundsLike[],
	primaryDisplayBounds: WindowBounds,
) {
	const sourceDisplayId = Number(source?.display_id);
	if (Number.isFinite(sourceDisplayId)) {
		const matchedDisplay = displays.find((display) => display.id === sourceDisplayId);
		if (matchedDisplay) {
			return matchedDisplay.bounds;
		}
	}

	return primaryDisplayBounds;
}

export function parseXwininfoBounds(stdout: string): WindowBounds | null {
	const absX = stdout.match(/Absolute upper-left X:\s+(-?\d+)/);
	const absY = stdout.match(/Absolute upper-left Y:\s+(-?\d+)/);
	const width = stdout.match(/Width:\s+(\d+)/);
	const height = stdout.match(/Height:\s+(\d+)/);

	if (!absX || !absY || !width || !height) {
		return null;
	}

	return {
		x: Number.parseInt(absX[1], 10),
		y: Number.parseInt(absY[1], 10),
		width: Number.parseInt(width[1], 10),
		height: Number.parseInt(height[1], 10),
	};
}

export async function resolveLinuxWindowBounds(
	source: SelectedSource,
	options?: {
		execFileAsync?: typeof execFileAsync;
	},
): Promise<WindowBounds | null> {
	const execFileAsyncImpl = options?.execFileAsync ?? execFileAsync;
	const windowId = parseWindowId(source?.id);

	if (windowId) {
		try {
			const { stdout } = await execFileAsyncImpl("xwininfo", ["-id", String(windowId)], {
				timeout: 1500,
			});
			const bounds = parseXwininfoBounds(String(stdout));
			if (bounds && bounds.width > 0 && bounds.height > 0) {
				return bounds;
			}
		} catch {
			// fall back to title lookup below
		}
	}

	const windowTitle =
		typeof source.windowTitle === "string" ? source.windowTitle.trim() : source.name.trim();
	if (!windowTitle) {
		return null;
	}

	try {
		const { stdout } = await execFileAsyncImpl("xwininfo", ["-name", windowTitle], {
			timeout: 1500,
		});
		const bounds = parseXwininfoBounds(String(stdout));
		return bounds && bounds.width > 0 && bounds.height > 0 ? bounds : null;
	} catch {
		return null;
	}
}

export async function resolveMacWindowBounds(
	source: SelectedSource,
	options: {
		getNativeWindowSources: NativeWindowSourcesGetter;
	},
): Promise<WindowBounds | null> {
	const windowId = parseWindowId(source.id);
	if (!windowId) {
		return null;
	}

	try {
		const nativeSources = await options.getNativeWindowSources({ maxAgeMs: 250 });
		const matchedSource = nativeSources.find((entry) => parseWindowId(entry.id) === windowId);
		return getWindowBoundsFromNativeSource(matchedSource);
	} catch {
		return null;
	}
}

export function createSelectedWindowBoundsTracker(options: {
	platform?: NodeJS.Platform;
	getSelectedSource: () => SelectedSource | null;
	setSelectedWindowBounds: (bounds: WindowBounds | null) => void;
	getNativeWindowSources?: NativeWindowSourcesGetter;
	resolveMacWindowBounds?: typeof resolveMacWindowBounds;
	resolveLinuxWindowBounds?: typeof resolveLinuxWindowBounds;
	setIntervalFn?: typeof setInterval;
	clearIntervalFn?: typeof clearInterval;
	refreshMs?: number;
}) {
	const platform = options.platform ?? process.platform;
	const setIntervalFn = options.setIntervalFn ?? setInterval;
	const clearIntervalFn = options.clearIntervalFn ?? clearInterval;
	const refreshMs = options.refreshMs ?? DEFAULT_WINDOW_BOUNDS_REFRESH_MS;
	const resolveMacWindowBoundsImpl = options.resolveMacWindowBounds ?? resolveMacWindowBounds;
	const resolveLinuxWindowBoundsImpl = options.resolveLinuxWindowBounds ?? resolveLinuxWindowBounds;
	let windowBoundsCaptureInterval: ReturnType<typeof setInterval> | null = null;

	async function refresh() {
		const source = options.getSelectedSource();
		if (!source?.id?.startsWith("window:")) {
			options.setSelectedWindowBounds(null);
			return;
		}

		let bounds: WindowBounds | null = null;
		if (platform === "darwin" && options.getNativeWindowSources) {
			bounds = await resolveMacWindowBoundsImpl(source, {
				getNativeWindowSources: options.getNativeWindowSources,
			});
		} else if (platform === "linux") {
			bounds = await resolveLinuxWindowBoundsImpl(source);
		}

		options.setSelectedWindowBounds(bounds);
	}

	function stop() {
		if (windowBoundsCaptureInterval) {
			clearIntervalFn(windowBoundsCaptureInterval);
			windowBoundsCaptureInterval = null;
		}
		options.setSelectedWindowBounds(null);
	}

	function start() {
		stop();

		if (
			!["darwin", "linux"].includes(platform) ||
			!options.getSelectedSource()?.id?.startsWith("window:")
		) {
			return;
		}

		void refresh();
		windowBoundsCaptureInterval = setIntervalFn(() => {
			void refresh();
		}, refreshMs);
	}

	return {
		refresh,
		start,
		stop,
	};
}
