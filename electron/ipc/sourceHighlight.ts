import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { BrowserWindowConstructorOptions } from "electron";
import type { SelectedSource } from "./contracts";
import type { WindowBounds } from "./cursorTelemetry";
import type { NativeWindowSourcesGetter } from "./windowBounds";
import { parseWindowId, resolveLinuxWindowBounds, resolveMacWindowBounds } from "./windowBounds";

const execFileAsync = promisify(execFile);
const DEFAULT_HIGHLIGHT_PADDING_PX = 6;
const DEFAULT_HIGHLIGHT_DURATION_MS = 1700;

type ExecFileAsyncLike = typeof execFileAsync;

type HighlightWindowLike = {
	close: () => void;
	isDestroyed: () => boolean;
	loadURL: (url: string) => Promise<unknown>;
	setIgnoreMouseEvents: (ignore: boolean) => void;
};

export function getSourceHighlightAppName(source: SelectedSource) {
	const appName = source.appName || source.name?.split(" — ")[0]?.trim();
	return appName ? appName : null;
}

export function parseAppleScriptBounds(stdout: string): WindowBounds | null {
	const parts = stdout
		.trim()
		.split(",")
		.map((value) => Number(value));

	if (parts.length !== 4 || !parts.every((value) => Number.isFinite(value))) {
		return null;
	}

	return {
		x: parts[0],
		y: parts[1],
		width: parts[2],
		height: parts[3],
	};
}

export function buildSourceHighlightWindowOptions(
	bounds: WindowBounds,
	padding = DEFAULT_HIGHLIGHT_PADDING_PX,
): BrowserWindowConstructorOptions {
	return {
		x: bounds.x - padding,
		y: bounds.y - padding,
		width: bounds.width + padding * 2,
		height: bounds.height + padding * 2,
		frame: false,
		transparent: true,
		alwaysOnTop: true,
		skipTaskbar: true,
		hasShadow: false,
		resizable: false,
		focusable: false,
		webPreferences: { nodeIntegration: false, contextIsolation: true },
	};
}

export function buildSourceHighlightHtml() {
	return `<!DOCTYPE html>
<html><head><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:transparent;overflow:hidden;width:100vw;height:100vh}

.border-wrap{
  position:fixed;inset:0;border-radius:10px;padding:3px;
  background:conic-gradient(from var(--angle,0deg),
    transparent 0%,
    transparent 60%,
    rgba(99,96,245,.15) 70%,
    rgba(99,96,245,.9) 80%,
    rgba(123,120,255,1) 85%,
    rgba(99,96,245,.9) 90%,
    rgba(99,96,245,.15) 95%,
    transparent 100%
  );
  -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);
  -webkit-mask-composite:xor;
  mask-composite:exclude;
  animation:spin 1.2s linear forwards, fadeAll 1.6s ease-out forwards;
}

.glow-wrap{
  position:fixed;inset:-4px;border-radius:14px;padding:6px;
  background:conic-gradient(from var(--angle,0deg),
    transparent 0%,
    transparent 65%,
    rgba(99,96,245,.3) 78%,
    rgba(123,120,255,.5) 85%,
    rgba(99,96,245,.3) 92%,
    transparent 100%
  );
  -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);
  -webkit-mask-composite:xor;
  mask-composite:exclude;
  filter:blur(8px);
  animation:spin 1.2s linear forwards, fadeAll 1.6s ease-out forwards;
}

@property --angle{
  syntax:'<angle>';
  initial-value:0deg;
  inherits:false;
}

@keyframes spin{
  0%{--angle:0deg}
  100%{--angle:360deg}
}

@keyframes fadeAll{
  0%,60%{opacity:1}
  100%{opacity:0}
}
</style></head><body>
<div class="glow-wrap"></div>
<div class="border-wrap"></div>
</body></html>`;
}

async function waitForDelay(ms: number) {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

async function activateMacWindowForHighlight(
	source: SelectedSource,
	options: {
		execFileAsync?: ExecFileAsyncLike;
		wait?: (ms: number) => Promise<void>;
	},
): Promise<WindowBounds | null> {
	const execFileAsyncImpl = options.execFileAsync ?? execFileAsync;
	const wait = options.wait ?? waitForDelay;
	const appName = getSourceHighlightAppName(source);
	if (!appName) {
		return null;
	}

	try {
		const { stdout } = await execFileAsyncImpl(
			"osascript",
			[
				"-e",
				`tell application "${appName}"\n` +
					`  activate\n` +
					`end tell\n` +
					`delay 0.3\n` +
					`tell application "System Events"\n` +
					`  tell process "${appName}"\n` +
					`    set frontWindow to front window\n` +
					`    set {x1, y1} to position of frontWindow\n` +
					`    set {w1, h1} to size of frontWindow\n` +
					`    return (x1 as text) & "," & (y1 as text) & "," & (w1 as text) & "," & (h1 as text)\n` +
					`  end tell\n` +
					`end tell`,
			],
			{ timeout: 4000 },
		);
		return parseAppleScriptBounds(String(stdout));
	} catch {
		try {
			await execFileAsyncImpl("osascript", ["-e", `tell application "${appName}" to activate`], {
				timeout: 2000,
			});
			await wait(350);
		} catch {
			/* ignore */
		}
		return null;
	}
}

async function activateLinuxWindowForHighlight(
	windowId: number,
	options: {
		execFileAsync?: ExecFileAsyncLike;
		wait?: (ms: number) => Promise<void>;
	},
) {
	const execFileAsyncImpl = options.execFileAsync ?? execFileAsync;
	const wait = options.wait ?? waitForDelay;

	try {
		await execFileAsyncImpl("wmctrl", ["-i", "-a", `0x${windowId.toString(16)}`], {
			timeout: 1500,
		});
	} catch {
		try {
			await execFileAsyncImpl("xdotool", ["windowactivate", String(windowId)], {
				timeout: 1500,
			});
		} catch {
			/* not available */
		}
	}

	await wait(250);
}

export async function resolveSourceHighlightBounds(
	source: SelectedSource,
	options: {
		platform?: NodeJS.Platform;
		getDisplayBounds: (source: SelectedSource) => WindowBounds;
		getNativeWindowSources?: NativeWindowSourcesGetter;
		execFileAsync?: ExecFileAsyncLike;
		wait?: (ms: number) => Promise<void>;
		resolveLinuxWindowBounds?: typeof resolveLinuxWindowBounds;
		resolveMacWindowBounds?: typeof resolveMacWindowBounds;
	},
): Promise<WindowBounds> {
	const platform = options.platform ?? process.platform;
	const resolveLinuxWindowBoundsImpl = options.resolveLinuxWindowBounds ?? resolveLinuxWindowBounds;
	const resolveMacWindowBoundsImpl = options.resolveMacWindowBounds ?? resolveMacWindowBounds;
	const isWindow = source.id?.startsWith("window:");
	const windowId = isWindow ? parseWindowId(source.id) : null;
	let bounds: WindowBounds | null = null;

	if (isWindow && platform === "darwin") {
		bounds = await activateMacWindowForHighlight(source, {
			execFileAsync: options.execFileAsync,
			wait: options.wait,
		});
	} else if (windowId && platform === "linux") {
		await activateLinuxWindowForHighlight(windowId, {
			execFileAsync: options.execFileAsync,
			wait: options.wait,
		});
	}

	if (!bounds) {
		if (source.id?.startsWith("screen:")) {
			bounds = options.getDisplayBounds(source);
		} else if (isWindow) {
			if (platform === "darwin" && options.getNativeWindowSources) {
				bounds = await resolveMacWindowBoundsImpl(source, {
					getNativeWindowSources: options.getNativeWindowSources,
				});
			} else if (platform === "linux") {
				bounds = await resolveLinuxWindowBoundsImpl(source);
			}
		}
	}

	if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
		return options.getDisplayBounds(source);
	}

	return bounds;
}

export async function showSourceHighlight(
	source: SelectedSource,
	options: {
		platform?: NodeJS.Platform;
		getDisplayBounds: (source: SelectedSource) => WindowBounds;
		getNativeWindowSources?: NativeWindowSourcesGetter;
		execFileAsync?: ExecFileAsyncLike;
		wait?: (ms: number) => Promise<void>;
		createHighlightWindow?: (
			windowOptions: BrowserWindowConstructorOptions,
		) => HighlightWindowLike | Promise<HighlightWindowLike>;
		highlightPadding?: number;
		durationMs?: number;
	},
) {
	const highlightPadding = options.highlightPadding ?? DEFAULT_HIGHLIGHT_PADDING_PX;
	const durationMs = options.durationMs ?? DEFAULT_HIGHLIGHT_DURATION_MS;
	const bounds = await resolveSourceHighlightBounds(source, options);
	const createHighlightWindow =
		options.createHighlightWindow ??
		(async (windowOptions: BrowserWindowConstructorOptions) => {
			const { BrowserWindow } = await import("electron");
			return new BrowserWindow(windowOptions);
		});
	const highlightWindow = await createHighlightWindow(
		buildSourceHighlightWindowOptions(bounds, highlightPadding),
	);

	highlightWindow.setIgnoreMouseEvents(true);
	await highlightWindow.loadURL(
		`data:text/html;charset=utf-8,${encodeURIComponent(buildSourceHighlightHtml())}`,
	);

	setTimeout(() => {
		if (!highlightWindow.isDestroyed()) {
			highlightWindow.close();
		}
	}, durationMs);
}
