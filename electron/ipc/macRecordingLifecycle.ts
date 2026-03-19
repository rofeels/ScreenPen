import type { ChildProcessWithoutNullStreams } from "node:child_process";

type ExecFileLike = (
	file: string,
	args: string[],
	options: { timeout: number; maxBuffer: number },
) => Promise<unknown>;

type MoveFileLike = (sourcePath: string, destinationPath: string) => Promise<void>;
type RemoveFileLike = (filePath: string) => Promise<void>;

export function getNativeCaptureInterruption(outputBuffer: string) {
	const reason = outputBuffer.includes("WINDOW_UNAVAILABLE")
		? "window-unavailable"
		: "capture-stopped";
	const message =
		reason === "window-unavailable"
			? "The selected window is no longer capturable. Please reselect a window."
			: "Recording stopped unexpectedly.";

	return { reason, message };
}

export function resolveNativeCaptureStopPath(
	outputBuffer: string,
	targetPath: string | null,
	code: number | null,
) {
	const match = outputBuffer.match(/Recording stopped\. Output path: (.+)/);
	if (match?.[1]) {
		return match[1].trim();
	}

	if (code === 0 && targetPath) {
		return targetPath;
	}

	return null;
}

export function buildNativeCaptureStartError(outputBuffer: string, code: number | null) {
	return new Error(
		outputBuffer.trim() ||
			`Native capture helper exited before recording started (code ${code ?? "unknown"})`,
	);
}

export function buildNativeCaptureStopError(outputBuffer: string, code: number | null) {
	return new Error(
		outputBuffer.trim() || `Native capture helper exited with code ${code ?? "unknown"}`,
	);
}

export function waitForNativeCaptureStart(
	process: ChildProcessWithoutNullStreams,
	getOutputBuffer: () => string,
	timeoutMs = 12000,
) {
	return new Promise<void>((resolve, reject) => {
		const timer = setTimeout(() => {
			cleanup();
			reject(new Error("Timed out waiting for ScreenCaptureKit recorder to start"));
		}, timeoutMs);

		const onStdout = (chunk: Buffer) => {
			const text = chunk.toString();
			if (text.includes("Recording started")) {
				cleanup();
				resolve();
			}
		};

		const onError = (error: Error) => {
			cleanup();
			reject(error);
		};

		const onExit = (code: number | null) => {
			cleanup();
			reject(buildNativeCaptureStartError(getOutputBuffer(), code));
		};

		const cleanup = () => {
			clearTimeout(timer);
			process.stdout.off("data", onStdout);
			process.off("error", onError);
			process.off("exit", onExit);
		};

		process.stdout.on("data", onStdout);
		process.once("error", onError);
		process.once("exit", onExit);
	});
}

export function waitForNativeCaptureStop(
	process: ChildProcessWithoutNullStreams,
	getOutputBuffer: () => string,
	getTargetPath: () => string | null,
) {
	return new Promise<string>((resolve, reject) => {
		const onClose = (code: number | null) => {
			cleanup();
			const resolvedPath = resolveNativeCaptureStopPath(getOutputBuffer(), getTargetPath(), code);
			if (resolvedPath) {
				resolve(resolvedPath);
				return;
			}

			reject(buildNativeCaptureStopError(getOutputBuffer(), code));
		};

		const onError = (error: Error) => {
			cleanup();
			reject(error);
		};

		const cleanup = () => {
			process.off("close", onClose);
			process.off("error", onError);
		};

		process.once("close", onClose);
		process.once("error", onError);
	});
}

export async function fileHasAudioStream(
	filePath: string,
	ffmpegPath: string,
	execFileAsync: ExecFileLike,
) {
	try {
		await execFileAsync(ffmpegPath, ["-i", filePath], {
			timeout: 30000,
			maxBuffer: 10 * 1024 * 1024,
		});
	} catch (error) {
		const stderr =
			typeof error === "object" && error !== null && "stderr" in error
				? String((error as { stderr?: unknown }).stderr ?? "")
				: "";

		if (stderr) {
			return /Audio:/i.test(stderr);
		}
	}

	return false;
}

export async function mixNativeMacAudioTracks(
	videoPath: string,
	microphonePath: string,
	deps: {
		ffmpegPath: string;
		execFileAsync: ExecFileLike;
		moveFileWithOverwrite: MoveFileLike;
		removeFile: RemoveFileLike;
	},
) {
	const { ffmpegPath, execFileAsync, moveFileWithOverwrite, removeFile } = deps;
	const mixedOutputPath = `${videoPath}.mixed.mp4`;
	const videoHasAudio = await fileHasAudioStream(videoPath, ffmpegPath, execFileAsync);

	const args = videoHasAudio
		? [
				"-y",
				"-i",
				videoPath,
				"-i",
				microphonePath,
				"-filter_complex",
				"[0:a][1:a]amix=inputs=2:duration=longest:normalize=0[aout]",
				"-map",
				"0:v:0",
				"-map",
				"[aout]",
				"-c:v",
				"copy",
				"-c:a",
				"aac",
				"-b:a",
				"192k",
				"-shortest",
				mixedOutputPath,
			]
		: [
				"-y",
				"-i",
				videoPath,
				"-i",
				microphonePath,
				"-map",
				"0:v:0",
				"-map",
				"1:a:0",
				"-c:v",
				"copy",
				"-c:a",
				"aac",
				"-b:a",
				"192k",
				"-shortest",
				mixedOutputPath,
			];

	await execFileAsync(ffmpegPath, args, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
	await moveFileWithOverwrite(mixedOutputPath, videoPath);
	await removeFile(microphonePath);
}
