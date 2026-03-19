import { execFile, spawnSync } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { app } from "electron";
import type { SystemCursorAsset } from "./contracts";

const execFileAsync = promisify(execFile);

export type NativeMacWindowSource = {
	id: string;
	name: string;
	display_id?: string;
	appName?: string;
	windowTitle?: string;
	bundleId?: string;
	appIcon?: string | null;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
};

let cachedNativeMacWindowSources: NativeMacWindowSource[] | null = null;
let cachedNativeMacWindowSourcesAtMs = 0;
let cachedSystemCursorAssets: Record<string, SystemCursorAsset> | null = null;
let cachedSystemCursorAssetsSourceMtimeMs: number | null = null;

/**
 * Resolve a path within the app bundle, handling asar unpacking in production.
 * Files listed in asarUnpack are extracted to app.asar.unpacked/ and must be
 * accessed via that path instead of the asar virtual filesystem.
 */
export function resolveUnpackedAppPath(...segments: string[]) {
	const base = app.getAppPath();
	const resolved = path.join(base, ...segments);
	if (app.isPackaged) {
		return resolved.replace(/\.asar([/\\])/, ".asar.unpacked$1");
	}
	return resolved;
}

function getNativeArchTag() {
	return process.arch === "arm64" ? "darwin-arm64" : "darwin-x64";
}

function getPrebundledNativeHelperPath(binaryName: string) {
	return resolveUnpackedAppPath("electron", "native", "bin", getNativeArchTag(), binaryName);
}

function getNativeCaptureHelperSourcePath() {
	return resolveUnpackedAppPath("electron", "native", "ScreenCaptureKitRecorder.swift");
}

function getNativeCaptureHelperBinaryPath() {
	return path.join(app.getPath("userData"), "native-tools", "openscreen-screencapturekit-helper");
}

function getSystemCursorHelperSourcePath() {
	return resolveUnpackedAppPath("electron", "native", "SystemCursorAssets.swift");
}

function getSystemCursorHelperBinaryPath() {
	return path.join(app.getPath("userData"), "native-tools", "openscreen-system-cursors");
}

function getNativeCursorMonitorSourcePath() {
	return resolveUnpackedAppPath("electron", "native", "NativeCursorMonitor.swift");
}

function getNativeCursorMonitorBinaryPath() {
	return path.join(app.getPath("userData"), "native-tools", "openscreen-native-cursor-monitor");
}

function getNativeWindowListSourcePath() {
	return resolveUnpackedAppPath("electron", "native", "ScreenCaptureKitWindowList.swift");
}

function getNativeWindowListBinaryPath() {
	return path.join(app.getPath("userData"), "native-tools", "openscreen-window-list");
}

async function ensureSwiftHelperBinary(
	sourcePath: string,
	binaryPath: string,
	label: string,
	prebundledBinaryName?: string,
) {
	if (prebundledBinaryName) {
		const prebundledPath = getPrebundledNativeHelperPath(prebundledBinaryName);
		try {
			await fs.access(prebundledPath, fsConstants.X_OK);
			return prebundledPath;
		} catch {
			if (app.isPackaged) {
				throw new Error(
					`${label} is missing from this app build (${prebundledPath}). Reinstall or update the app.`,
				);
			}
		}
	}

	const helperDir = path.dirname(binaryPath);
	await fs.mkdir(helperDir, { recursive: true });

	let shouldCompile = false;
	try {
		const [sourceStat, binaryStat] = await Promise.all([
			fs.stat(sourcePath),
			fs.stat(binaryPath).catch(() => null),
		]);
		shouldCompile = !binaryStat || sourceStat.mtimeMs > binaryStat.mtimeMs;
	} catch (error) {
		throw new Error(`${label} source is unavailable: ${String(error)}`);
	}

	if (!shouldCompile) {
		return binaryPath;
	}

	const result = spawnSync("swiftc", ["-O", sourcePath, "-o", binaryPath], {
		encoding: "utf8",
		timeout: 120000,
	});

	if (result.status !== 0) {
		const details = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
		throw new Error(details || `Failed to compile ${label}`);
	}

	return binaryPath;
}

export async function ensureNativeCaptureHelperBinary() {
	return ensureSwiftHelperBinary(
		getNativeCaptureHelperSourcePath(),
		getNativeCaptureHelperBinaryPath(),
		"native ScreenCaptureKit helper",
		"openscreen-screencapturekit-helper",
	);
}

export async function ensureNativeCursorMonitorBinary() {
	return ensureSwiftHelperBinary(
		getNativeCursorMonitorSourcePath(),
		getNativeCursorMonitorBinaryPath(),
		"native cursor monitor helper",
		"openscreen-native-cursor-monitor",
	);
}

async function ensureNativeWindowListBinary() {
	return ensureSwiftHelperBinary(
		getNativeWindowListSourcePath(),
		getNativeWindowListBinaryPath(),
		"native ScreenCaptureKit window list helper",
		"openscreen-window-list",
	);
}

export async function getNativeMacWindowSources(options?: { maxAgeMs?: number }) {
	if (process.platform !== "darwin") {
		return [] as NativeMacWindowSource[];
	}

	const maxAgeMs = options?.maxAgeMs ?? 5000;
	const now = Date.now();
	if (cachedNativeMacWindowSources && now - cachedNativeMacWindowSourcesAtMs < maxAgeMs) {
		return cachedNativeMacWindowSources;
	}

	const binaryPath = await ensureNativeWindowListBinary();
	const { stdout } = await execFileAsync(binaryPath, [], {
		timeout: 30000,
		maxBuffer: 10 * 1024 * 1024,
	});

	const parsed = JSON.parse(stdout);
	if (!Array.isArray(parsed)) {
		return [] as NativeMacWindowSource[];
	}

	const entries = parsed.filter((entry: unknown): entry is NativeMacWindowSource => {
		if (!entry || typeof entry !== "object") {
			return false;
		}

		const candidate = entry as Partial<NativeMacWindowSource>;
		return typeof candidate.id === "string" && typeof candidate.name === "string";
	});

	cachedNativeMacWindowSources = entries;
	cachedNativeMacWindowSourcesAtMs = now;
	return entries;
}

export async function getSystemCursorAssets() {
	if (process.platform !== "darwin") {
		cachedSystemCursorAssets = {};
		cachedSystemCursorAssetsSourceMtimeMs = null;
		return cachedSystemCursorAssets;
	}

	const sourcePath = getSystemCursorHelperSourcePath();
	const sourceStat = await fs.stat(sourcePath);
	if (cachedSystemCursorAssets && cachedSystemCursorAssetsSourceMtimeMs === sourceStat.mtimeMs) {
		return cachedSystemCursorAssets;
	}

	const binaryPath = await ensureSwiftHelperBinary(
		sourcePath,
		getSystemCursorHelperBinaryPath(),
		"system cursor helper",
		"openscreen-system-cursors",
	);

	const { stdout } = await execFileAsync(binaryPath, [], {
		timeout: 15000,
		maxBuffer: 20 * 1024 * 1024,
	});
	const parsed = JSON.parse(stdout) as Record<string, Partial<SystemCursorAsset>>;
	cachedSystemCursorAssets = Object.fromEntries(
		Object.entries(parsed).filter(
			([, asset]) =>
				typeof asset?.dataUrl === "string" &&
				typeof asset?.hotspotX === "number" &&
				typeof asset?.hotspotY === "number" &&
				typeof asset?.width === "number" &&
				typeof asset?.height === "number",
		),
	) as Record<string, SystemCursorAsset>;
	cachedSystemCursorAssetsSourceMtimeMs = sourceStat.mtimeMs;

	return cachedSystemCursorAssets;
}
