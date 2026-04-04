import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain } from "electron";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nodeRequire = createRequire(import.meta.url);

const APP_ROOT = path.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const RENDERER_DIST = path.join(APP_ROOT, "dist");
const WINDOW_ICON_PATH = path.join(
	process.env.VITE_PUBLIC || RENDERER_DIST,
	"app-icons",
	"screencraft-512.png",
);

let hudOverlayWindow: BrowserWindow | null = null;
let hudOverlayHiddenFromCapture = true;
let hudOverlayCaptureProtectionLoaded = false;
let countdownWindow: BrowserWindow | null = null;
let drawingOverlayWindow: BrowserWindow | null = null;
let clickEffectWindow: BrowserWindow | null = null;
let keystrokeWindow: BrowserWindow | null = null;
let mediaPresenterWindow: BrowserWindow | null = null;
let laserPointerWindow: BrowserWindow | null = null;

const HUD_OVERLAY_SETTINGS_FILE = path.join(app.getPath("userData"), "hud-overlay-settings.json");
const HUD_BOTTOM_CLEARANCE_CM = 3.5;
const DIP_PER_INCH = 96;
const CM_PER_INCH = 2.54;
const HUD_EDGE_MARGIN_DIP = 16;
const HUD_SHADOW_BLEED_DIP = 20;
const HUD_WINDOW_WIDTH = 560;
const HUD_COMPACT_HEIGHT = 96;
const HUD_EXPANDED_HEIGHT = 520 + HUD_SHADOW_BLEED_DIP;

function useForcedVisibleWindows(): boolean {
	return process.env["SCREENPEN_FORCE_VISIBLE_WINDOWS"] === "1";
}

function isHudOverlayCaptureProtectionSupported(): boolean {
	return process.platform !== "linux";
}

function loadHudOverlayCaptureProtectionSetting(): boolean {
	if (hudOverlayCaptureProtectionLoaded) {
		return hudOverlayHiddenFromCapture;
	}

	hudOverlayCaptureProtectionLoaded = true;

	try {
		if (!fs.existsSync(HUD_OVERLAY_SETTINGS_FILE)) {
			return hudOverlayHiddenFromCapture;
		}

		const raw = fs.readFileSync(HUD_OVERLAY_SETTINGS_FILE, "utf-8");
		const parsed = JSON.parse(raw) as { hiddenFromCapture?: unknown };
		if (typeof parsed.hiddenFromCapture === "boolean") {
			hudOverlayHiddenFromCapture = parsed.hiddenFromCapture;
		}
	} catch {
		// Ignore settings read failures and fall back to defaults.
	}

	return hudOverlayHiddenFromCapture;
}

function persistHudOverlayCaptureProtectionSetting(enabled: boolean): void {
	try {
		fs.writeFileSync(
			HUD_OVERLAY_SETTINGS_FILE,
			JSON.stringify({ hiddenFromCapture: enabled }, null, 2),
			"utf-8",
		);
	} catch {
		// Ignore settings write failures and keep runtime state working.
	}
}

function getScreen() {
	return nodeRequire("electron").screen as typeof import("electron").screen;
}

function getHudTargetDisplay() {
	const screen = getScreen();
	const cursorPoint = screen.getCursorScreenPoint();
	return screen.getDisplayNearestPoint(cursorPoint);
}

function getHudOverlayBounds(expanded: boolean) {
	const { workArea } = getHudTargetDisplay();
	const windowWidth = HUD_WINDOW_WIDTH;
	const windowHeight = expanded ? HUD_EXPANDED_HEIGHT : HUD_COMPACT_HEIGHT;
	const bottomClearanceDip = Math.round((HUD_BOTTOM_CLEARANCE_CM / CM_PER_INCH) * DIP_PER_INCH);
	const workAreaBottom = workArea.y + workArea.height;
	const preferredBottom = workAreaBottom - bottomClearanceDip;
	const maximumSafeBottom = workAreaBottom - HUD_EDGE_MARGIN_DIP;
	const windowBottom = Math.min(preferredBottom, maximumSafeBottom);

	const x = Math.floor(workArea.x + (workArea.width - windowWidth) / 2);
	const y = Math.max(workArea.y + HUD_EDGE_MARGIN_DIP, Math.floor(windowBottom - windowHeight));

	return {
		x,
		y,
		width: windowWidth,
		height: windowHeight,
	};
}

function applyHudOverlayBounds(expanded: boolean) {
	if (!hudOverlayWindow || hudOverlayWindow.isDestroyed()) {
		return;
	}

	hudOverlayWindow.setBounds(getHudOverlayBounds(expanded), false);
	if (!hudOverlayWindow.isVisible()) {
		return;
	}
	hudOverlayWindow.moveTop();
}

ipcMain.on("hud-overlay-hide", () => {
	if (hudOverlayWindow && !hudOverlayWindow.isDestroyed()) {
		hudOverlayWindow.minimize();
	}
});

ipcMain.on("set-hud-overlay-expanded", (_event, expanded: boolean) => {
	applyHudOverlayBounds(Boolean(expanded));
});

ipcMain.handle("get-hud-overlay-capture-protection", () => {
	const enabled = loadHudOverlayCaptureProtectionSetting();

	return {
		success: true,
		enabled,
	};
});

ipcMain.handle("set-hud-overlay-capture-protection", (_event, enabled: boolean) => {
	loadHudOverlayCaptureProtectionSetting();
	hudOverlayHiddenFromCapture = Boolean(enabled);
	persistHudOverlayCaptureProtectionSetting(hudOverlayHiddenFromCapture);

	if (
		isHudOverlayCaptureProtectionSupported() &&
		hudOverlayWindow &&
		!hudOverlayWindow.isDestroyed()
	) {
		hudOverlayWindow.setContentProtection(hudOverlayHiddenFromCapture);
	}

	return {
		success: true,
		enabled: hudOverlayHiddenFromCapture,
	};
});

export function createHudOverlayWindow(): BrowserWindow {
	loadHudOverlayCaptureProtectionSetting();
	const initialBounds = getHudOverlayBounds(false);
	const forceVisibleWindows = useForcedVisibleWindows();

	const win = new BrowserWindow({
		width: initialBounds.width,
		height: initialBounds.height,
		minWidth: HUD_WINDOW_WIDTH,
		maxWidth: HUD_WINDOW_WIDTH,
		minHeight: HUD_COMPACT_HEIGHT,
		maxHeight: HUD_EXPANDED_HEIGHT,
		x: initialBounds.x,
		y: initialBounds.y,
		frame: forceVisibleWindows,
		transparent: !forceVisibleWindows,
		resizable: false,
		alwaysOnTop: !forceVisibleWindows,
		skipTaskbar: !forceVisibleWindows,
		hasShadow: forceVisibleWindows,
		show: false,
		title: "ScreenPen HUD",
		backgroundColor: forceVisibleWindows ? "#09090b" : "#00000000",
		webPreferences: {
			preload: path.join(__dirname, "preload.mjs"),
			nodeIntegration: false,
			contextIsolation: true,
			backgroundThrottling: false,
		},
	});

	if (isHudOverlayCaptureProtectionSupported()) {
		win.setContentProtection(hudOverlayHiddenFromCapture);
	}
	win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

	win.webContents.on("did-finish-load", () => {
		win?.webContents.send("main-process-message", new Date().toLocaleString());
		setTimeout(() => {
			if (!win.isDestroyed()) {
				win.show();
			}
		}, 100);
	});

	hudOverlayWindow = win;

	win.on("closed", () => {
		if (hudOverlayWindow === win) {
			hudOverlayWindow = null;
		}
	});

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL + "?windowType=hud-overlay");
	} else {
		win.loadFile(path.join(RENDERER_DIST, "index.html"), {
			query: { windowType: "hud-overlay" },
		});
	}

	return win;
}

export function createEditorWindow(): BrowserWindow {
	const isMac = process.platform === "darwin";

	const win = new BrowserWindow({
		width: 1200,
		height: 800,
		minWidth: 800,
		minHeight: 600,
		...(process.platform !== "darwin" && {
			icon: WINDOW_ICON_PATH,
		}),
		...(isMac && {
			titleBarStyle: "hiddenInset",
			trafficLightPosition: { x: 12, y: 12 },
		}),
		transparent: false,
		resizable: true,
		alwaysOnTop: false,
		skipTaskbar: false,
		title: "ScreenPen",
		show: false,
		backgroundColor: "#000000",
		webPreferences: {
			preload: path.join(__dirname, "preload.mjs"),
			nodeIntegration: false,
			contextIsolation: true,
			webSecurity: false,
			backgroundThrottling: false,
		},
	});

	win.once("ready-to-show", () => {
		win.show();
		win.maximize();
	});

	win.webContents.on("did-finish-load", () => {
		win?.webContents.send("main-process-message", new Date().toLocaleString());
	});

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL + "?windowType=editor");
	} else {
		win.loadFile(path.join(RENDERER_DIST, "index.html"), {
			query: { windowType: "editor" },
		});
	}

	return win;
}

export function createSettingsWindow(): BrowserWindow {
	const isMac = process.platform === "darwin";

	const win = new BrowserWindow({
		width: 1040,
		height: 760,
		minWidth: 860,
		minHeight: 620,
		center: true,
		maximizable: false,
		fullscreenable: false,
		...(process.platform !== "darwin" && {
			icon: WINDOW_ICON_PATH,
		}),
		...(isMac && {
			titleBarStyle: "hiddenInset",
			trafficLightPosition: { x: 12, y: 12 },
		}),
		transparent: false,
		resizable: true,
		alwaysOnTop: false,
		skipTaskbar: false,
		title: "ScreenPen Settings",
		show: false,
		backgroundColor: "#09090b",
		webPreferences: {
			preload: path.join(__dirname, "preload.mjs"),
			nodeIntegration: false,
			contextIsolation: true,
			webSecurity: false,
			backgroundThrottling: false,
		},
	});

	win.once("ready-to-show", () => {
		win.show();
		win.focus();
	});

	win.webContents.on("did-finish-load", () => {
		win?.webContents.send("main-process-message", new Date().toLocaleString());
	});

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL + "?windowType=settings");
	} else {
		win.loadFile(path.join(RENDERER_DIST, "index.html"), {
			query: { windowType: "settings" },
		});
	}

	return win;
}

export function createSourceSelectorWindow(): BrowserWindow {
	const { width, height } = getScreen().getPrimaryDisplay().workAreaSize;
	const forceVisibleWindows = useForcedVisibleWindows();

	const win = new BrowserWindow({
		width: 620,
		height: 420,
		minHeight: 350,
		maxHeight: 500,
		x: Math.round((width - 620) / 2),
		y: Math.round((height - 420) / 2),
		frame: forceVisibleWindows,
		resizable: false,
		alwaysOnTop: !forceVisibleWindows,
		transparent: !forceVisibleWindows,
		show: false,
		...(process.platform !== "darwin" && {
			icon: WINDOW_ICON_PATH,
		}),
		title: "ScreenPen Source Selector",
		backgroundColor: forceVisibleWindows ? "#09090b" : "#00000000",
		webPreferences: {
			preload: path.join(__dirname, "preload.mjs"),
			nodeIntegration: false,
			contextIsolation: true,
		},
	});

	win.webContents.on("did-finish-load", () => {
		setTimeout(() => {
			if (!win.isDestroyed()) {
				win.show();
			}
		}, 100);
	});

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL + "?windowType=source-selector");
	} else {
		win.loadFile(path.join(RENDERER_DIST, "index.html"), {
			query: { windowType: "source-selector" },
		});
	}

	return win;
}

export function createCountdownWindow(): BrowserWindow {
	const primaryDisplay = getScreen().getPrimaryDisplay();
	const { width, height } = primaryDisplay.workAreaSize;

	const windowSize = 200;
	const x = Math.floor((width - windowSize) / 2);
	const y = Math.floor((height - windowSize) / 2);

	const win = new BrowserWindow({
		width: windowSize,
		height: windowSize,
		x: x,
		y: y,
		frame: false,
		transparent: true,
		resizable: false,
		alwaysOnTop: true,
		skipTaskbar: true,
		hasShadow: false,
		focusable: true,
		show: false,
		webPreferences: {
			preload: path.join(__dirname, "preload.mjs"),
			nodeIntegration: false,
			contextIsolation: true,
		},
	});

	countdownWindow = win;

	win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

	win.webContents.on("did-finish-load", () => {
		if (!win.isDestroyed()) {
			win.show();
		}
	});

	win.on("closed", () => {
		if (countdownWindow === win) {
			countdownWindow = null;
		}
	});

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL + "?windowType=countdown");
	} else {
		win.loadFile(path.join(RENDERER_DIST, "index.html"), {
			query: { windowType: "countdown" },
		});
	}

	return win;
}

export function getCountdownWindow(): BrowserWindow | null {
	return countdownWindow;
}

export function closeCountdownWindow(): void {
	if (countdownWindow && !countdownWindow.isDestroyed()) {
		countdownWindow.close();
		countdownWindow = null;
	}
}

export function createDrawingOverlayWindow(): BrowserWindow {
	const primaryDisplay = getScreen().getPrimaryDisplay();
	const { width, height } = primaryDisplay.size;

	const win = new BrowserWindow({
		width,
		height,
		x: 0,
		y: 0,
		frame: false,
		transparent: true,
		resizable: false,
		alwaysOnTop: true,
		skipTaskbar: true,
		hasShadow: false,
		focusable: true,
		show: false,
		webPreferences: {
			preload: path.join(__dirname, "preload.mjs"),
			nodeIntegration: false,
			contextIsolation: true,
			backgroundThrottling: false,
		},
	});

	// Must NOT have content protection so the overlay is captured in the recording
	win.setContentProtection(false);
	win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

	win.webContents.on("did-finish-load", () => {
		if (!win.isDestroyed()) {
			win.show();
			win.focus();
		}
	});

	win.on("closed", () => {
		if (drawingOverlayWindow === win) {
			drawingOverlayWindow = null;
		}
	});

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL + "?windowType=drawing-overlay");
	} else {
		win.loadFile(path.join(RENDERER_DIST, "index.html"), {
			query: { windowType: "drawing-overlay" },
		});
	}

	drawingOverlayWindow = win;
	return win;
}

export function getDrawingOverlayWindow(): BrowserWindow | null {
	return drawingOverlayWindow;
}

export function toggleDrawingOverlay(): void {
	if (!drawingOverlayWindow || drawingOverlayWindow.isDestroyed()) {
		createDrawingOverlayWindow();
		return;
	}
	if (drawingOverlayWindow.isVisible()) {
		drawingOverlayWindow.hide();
	} else {
		drawingOverlayWindow.show();
		drawingOverlayWindow.focus();
	}
}

export function destroyDrawingOverlay(): void {
	if (drawingOverlayWindow && !drawingOverlayWindow.isDestroyed()) {
		drawingOverlayWindow.close();
		drawingOverlayWindow = null;
	}
}

export function createClickEffectWindow(): BrowserWindow {
	const primaryDisplay = getScreen().getPrimaryDisplay();
	const { width, height } = primaryDisplay.size;

	const win = new BrowserWindow({
		width,
		height,
		x: 0,
		y: 0,
		frame: false,
		transparent: true,
		resizable: false,
		alwaysOnTop: true,
		skipTaskbar: true,
		hasShadow: false,
		focusable: false,
		show: false,
		webPreferences: {
			preload: path.join(__dirname, "preload.mjs"),
			nodeIntegration: false,
			contextIsolation: true,
			backgroundThrottling: false,
		},
	});

	win.setContentProtection(false);
	win.setIgnoreMouseEvents(true);
	win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

	win.on("closed", () => {
		if (clickEffectWindow === win) clickEffectWindow = null;
	});

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL + "?windowType=click-effect");
	} else {
		win.loadFile(path.join(RENDERER_DIST, "index.html"), {
			query: { windowType: "click-effect" },
		});
	}

	clickEffectWindow = win;
	return win;
}

export function getClickEffectWindow(): BrowserWindow | null {
	return clickEffectWindow;
}

export function showClickEffectWindow(): void {
	if (clickEffectWindow && !clickEffectWindow.isDestroyed()) {
		clickEffectWindow.showInactive();
	}
}

export function hideClickEffectWindow(): void {
	if (clickEffectWindow && !clickEffectWindow.isDestroyed()) {
		clickEffectWindow.hide();
	}
}

export function destroyClickEffectWindow(): void {
	if (clickEffectWindow && !clickEffectWindow.isDestroyed()) {
		clickEffectWindow.close();
		clickEffectWindow = null;
	}
}

export function createKeystrokeWindow(): BrowserWindow {
	const primaryDisplay = getScreen().getPrimaryDisplay();
	const { width } = primaryDisplay.size;

	const winWidth = 520;
	const winHeight = 280;

	const win = new BrowserWindow({
		width: winWidth,
		height: winHeight,
		x: Math.floor((width - winWidth) / 2),
		y: 80,
		frame: false,
		transparent: true,
		resizable: false,
		alwaysOnTop: true,
		skipTaskbar: true,
		hasShadow: false,
		focusable: false,
		show: false,
		webPreferences: {
			preload: path.join(__dirname, "preload.mjs"),
			nodeIntegration: false,
			contextIsolation: true,
			backgroundThrottling: false,
		},
	});

	win.setContentProtection(false);
	win.setIgnoreMouseEvents(true);
	win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

	win.webContents.on("did-finish-load", () => {
		if (!win.isDestroyed()) win.show();
	});

	win.on("closed", () => {
		if (keystrokeWindow === win) keystrokeWindow = null;
	});

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL + "?windowType=keystroke-overlay");
	} else {
		win.loadFile(path.join(RENDERER_DIST, "index.html"), {
			query: { windowType: "keystroke-overlay" },
		});
	}

	keystrokeWindow = win;
	return win;
}

export function getKeystrokeWindow(): BrowserWindow | null {
	return keystrokeWindow;
}

export function toggleKeystrokeWindow(): void {
	if (!keystrokeWindow || keystrokeWindow.isDestroyed()) {
		createKeystrokeWindow();
		return;
	}
	if (keystrokeWindow.isVisible()) {
		keystrokeWindow.hide();
	} else {
		keystrokeWindow.show();
	}
}

export function destroyKeystrokeWindow(): void {
	if (keystrokeWindow && !keystrokeWindow.isDestroyed()) {
		keystrokeWindow.close();
		keystrokeWindow = null;
	}
}

export function createMediaPresenterWindow(filePath: string): BrowserWindow {
	if (mediaPresenterWindow && !mediaPresenterWindow.isDestroyed()) {
		mediaPresenterWindow.webContents.send("media-presenter-file", filePath);
		mediaPresenterWindow.focus();
		return mediaPresenterWindow;
	}

	const win = new BrowserWindow({
		width: 800,
		height: 600,
		frame: false,
		transparent: true,
		resizable: true,
		alwaysOnTop: true,
		skipTaskbar: true,
		hasShadow: true,
		focusable: true,
		minWidth: 320,
		minHeight: 240,
		show: false,
		webPreferences: {
			preload: path.join(__dirname, "preload.mjs"),
			nodeIntegration: false,
			contextIsolation: true,
			backgroundThrottling: false,
			webSecurity: false,
		},
	});

	win.setContentProtection(false);
	win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

	win.webContents.on("did-finish-load", () => {
		if (!win.isDestroyed()) {
			win.show();
			win.focus();
			win.webContents.send("media-presenter-file", filePath);
		}
	});

	win.on("closed", () => {
		if (mediaPresenterWindow === win) {
			mediaPresenterWindow = null;
		}
	});

	const encodedPath = encodeURIComponent(filePath);
	if (VITE_DEV_SERVER_URL) {
		win.loadURL(`${VITE_DEV_SERVER_URL}?windowType=media-presenter&filePath=${encodedPath}`);
	} else {
		win.loadFile(path.join(RENDERER_DIST, "index.html"), {
			query: { windowType: "media-presenter", filePath: encodedPath },
		});
	}

	mediaPresenterWindow = win;
	return win;
}

export function getMediaPresenterWindow(): BrowserWindow | null {
	return mediaPresenterWindow;
}

export function destroyMediaPresenter(): void {
	if (mediaPresenterWindow && !mediaPresenterWindow.isDestroyed()) {
		mediaPresenterWindow.close();
		mediaPresenterWindow = null;
	}
}

export function createLaserPointerWindow(): BrowserWindow {
	const primaryDisplay = getScreen().getPrimaryDisplay();
	const { width, height } = primaryDisplay.size;

	const win = new BrowserWindow({
		width,
		height,
		x: 0,
		y: 0,
		frame: false,
		transparent: true,
		resizable: false,
		alwaysOnTop: true,
		skipTaskbar: true,
		hasShadow: false,
		focusable: false,
		show: false,
		webPreferences: {
			preload: path.join(__dirname, "preload.mjs"),
			nodeIntegration: false,
			contextIsolation: true,
			backgroundThrottling: false,
		},
	});

	win.setContentProtection(false);
	win.setIgnoreMouseEvents(true);
	win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

	win.webContents.on("did-finish-load", () => {
		if (!win.isDestroyed()) win.show();
	});

	win.on("closed", () => {
		if (laserPointerWindow === win) laserPointerWindow = null;
	});

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL + "?windowType=laser-pointer");
	} else {
		win.loadFile(path.join(RENDERER_DIST, "index.html"), {
			query: { windowType: "laser-pointer" },
		});
	}

	laserPointerWindow = win;
	return win;
}

export function getLaserPointerWindow(): BrowserWindow | null {
	return laserPointerWindow;
}

export function toggleLaserPointer(): void {
	if (!laserPointerWindow || laserPointerWindow.isDestroyed()) {
		createLaserPointerWindow();
		return;
	}
	if (laserPointerWindow.isVisible()) {
		laserPointerWindow.hide();
	} else {
		laserPointerWindow.show();
	}
}

export function destroyLaserPointer(): void {
	if (laserPointerWindow && !laserPointerWindow.isDestroyed()) {
		laserPointerWindow.close();
		laserPointerWindow = null;
	}
}
