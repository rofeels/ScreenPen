import { PassThrough } from "node:stream";
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

import {
	buildNativeCaptureStartError,
	getNativeCaptureInterruption,
	mixNativeMacAudioTracks,
	resolveNativeCaptureStopPath,
	waitForNativeCaptureStart,
	waitForNativeCaptureStop,
} from "./macRecordingLifecycle";

function createFakeProcess() {
	const process = new EventEmitter() as EventEmitter & {
		stdout: PassThrough;
		once: EventEmitter["once"];
		off: EventEmitter["off"];
	};
	process.stdout = new PassThrough();
	return process;
}

describe("macRecordingLifecycle", () => {
	it("derives interruption reason and messages from helper output", () => {
		expect(getNativeCaptureInterruption("WINDOW_UNAVAILABLE")).toEqual({
			reason: "window-unavailable",
			message: "The selected window is no longer capturable. Please reselect a window.",
		});
		expect(getNativeCaptureInterruption("anything else")).toEqual({
			reason: "capture-stopped",
			message: "Recording stopped unexpectedly.",
		});
	});

	it("resolves stop paths from stdout or fallback target path", () => {
		expect(
			resolveNativeCaptureStopPath("Recording stopped. Output path: /tmp/out.mp4", null, 1),
		).toBe("/tmp/out.mp4");
		expect(resolveNativeCaptureStopPath("", "/tmp/fallback.mp4", 0)).toBe("/tmp/fallback.mp4");
		expect(resolveNativeCaptureStopPath("", null, 1)).toBeNull();
	});

	it("waits for native capture start and stop signals", async () => {
		const startProcess = createFakeProcess();
		const stopProcess = createFakeProcess();

		const startPromise = waitForNativeCaptureStart(startProcess as never, () => "", 500);
		startProcess.stdout.write("Recording started\n");
		await expect(startPromise).resolves.toBeUndefined();

		const stopPromise = waitForNativeCaptureStop(
			stopProcess as never,
			() => "Recording stopped. Output path: /tmp/stop.mp4",
			() => "/tmp/fallback.mp4",
		);
		stopProcess.emit("close", 0);
		await expect(stopPromise).resolves.toBe("/tmp/stop.mp4");
	});

	it("mixes microphone audio into the native mac capture with injected deps", async () => {
		const execFileAsync = vi
			.fn()
			.mockRejectedValueOnce({ stderr: "Audio:" })
			.mockResolvedValueOnce(undefined);
		const moveFileWithOverwrite = vi.fn().mockResolvedValue(undefined);
		const removeFile = vi.fn().mockResolvedValue(undefined);

		await mixNativeMacAudioTracks("/tmp/video.mp4", "/tmp/mic.m4a", {
			ffmpegPath: "/usr/bin/ffmpeg",
			execFileAsync,
			moveFileWithOverwrite,
			removeFile,
		});

		expect(execFileAsync).toHaveBeenNthCalledWith(
			2,
			"/usr/bin/ffmpeg",
			expect.arrayContaining([
				"-filter_complex",
				"[0:a][1:a]amix=inputs=2:duration=longest:normalize=0[aout]",
			]),
			expect.any(Object),
		);
		expect(moveFileWithOverwrite).toHaveBeenCalledWith(
			"/tmp/video.mp4.mixed.mp4",
			"/tmp/video.mp4",
		);
		expect(removeFile).toHaveBeenCalledWith("/tmp/mic.m4a");
	});

	it("builds a useful start error when the helper exits too early", () => {
		expect(buildNativeCaptureStartError("", null).message).toContain(
			"exited before recording started",
		);
	});
});
