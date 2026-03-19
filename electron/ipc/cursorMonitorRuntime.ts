import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { CursorVisualType } from "./cursorTelemetry";

const CURSOR_VISUAL_TYPES = new Set<CursorVisualType>([
	"arrow",
	"text",
	"pointer",
	"crosshair",
	"open-hand",
	"closed-hand",
	"resize-ew",
	"resize-ns",
	"not-allowed",
]);

export function consumeCursorMonitorOutput(buffer: string, chunk: Buffer | string) {
	const nextBuffer = `${buffer}${chunk.toString()}`;
	const lines = nextBuffer.split(/\r?\n/);
	const remainder = lines.pop() ?? "";
	const cursorStates = lines
		.map((line) => line.match(/^STATE:(.+)$/)?.[1]?.trim())
		.filter((value): value is CursorVisualType =>
			value != null && CURSOR_VISUAL_TYPES.has(value as CursorVisualType),
		);

	return {
		cursorStates,
		remainder,
	};
}

export function createCursorMonitorRuntime(options: {
	platform?: NodeJS.Platform;
	resolveHelperPath: () => Promise<string | null>;
	getCurrentCursorType: () => CursorVisualType | undefined;
	setCurrentCursorType: (cursorType: CursorVisualType) => void;
	onCursorTypeDetected: (cursorType: CursorVisualType) => void;
	onWarning?: (message: string, error: unknown) => void;
	spawnProcess?: typeof spawn;
}) {
	const platform = options.platform ?? process.platform;
	const spawnProcess = options.spawnProcess ?? spawn;
	let nativeCursorMonitorProcess: ChildProcessWithoutNullStreams | null = null;
	let nativeCursorMonitorOutputBuffer = "";

	function resetCursorMonitor() {
		nativeCursorMonitorProcess = null;
		nativeCursorMonitorOutputBuffer = "";
		options.setCurrentCursorType("arrow");
	}

	function stop() {
		options.setCurrentCursorType("arrow");

		if (!nativeCursorMonitorProcess) {
			return;
		}

		try {
			nativeCursorMonitorProcess.stdin.write("stop\n");
		} catch {
			// ignore stop signal issues
		}
		try {
			nativeCursorMonitorProcess.kill();
		} catch {
			// ignore kill issues
		}

		resetCursorMonitor();
	}

	function handleCursorMonitorOutput(chunk: Buffer | string) {
		const { cursorStates, remainder } = consumeCursorMonitorOutput(
			nativeCursorMonitorOutputBuffer,
			chunk,
		);
		nativeCursorMonitorOutputBuffer = remainder;

		for (const cursorType of cursorStates) {
			if (options.getCurrentCursorType() === cursorType) {
				continue;
			}

			options.setCurrentCursorType(cursorType);
			options.onCursorTypeDetected(cursorType);
		}
	}

	async function start() {
		stop();

		if (platform !== "darwin" && platform !== "win32") {
			options.setCurrentCursorType("arrow");
			return;
		}

		try {
			const helperPath = await options.resolveHelperPath();
			if (!helperPath) {
				options.setCurrentCursorType("arrow");
				return;
			}

			nativeCursorMonitorOutputBuffer = "";
			options.setCurrentCursorType("arrow");
			nativeCursorMonitorProcess = spawnProcess(helperPath, [], {
				stdio: ["pipe", "pipe", "pipe"],
			});

			nativeCursorMonitorProcess.once("error", (error) => {
				options.onWarning?.("Native cursor monitor process error:", error);
				resetCursorMonitor();
			});

			nativeCursorMonitorProcess.stdout.on("data", handleCursorMonitorOutput);

			nativeCursorMonitorProcess.once("close", () => {
				resetCursorMonitor();
			});
		} catch (error) {
			options.onWarning?.("Failed to start native cursor monitor:", error);
			resetCursorMonitor();
		}
	}

	return {
		start,
		stop,
	};
}
