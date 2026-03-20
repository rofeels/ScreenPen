import { describe, expect, it } from "vitest";

import {
	buildNativeMacCaptureArtifacts,
	buildNativeMacCaptureConfig,
	shouldBlockOwnWindowCapture,
} from "./macCapture";

describe("macCapture helpers", () => {
	it("blocks own ScreenCraft window capture when self-capture is disabled", () => {
		expect(
			shouldBlockOwnWindowCapture({
				source: { id: "window:1", name: "ScreenCraft", appName: "ScreenCraft" },
				ownAppName: "screencraft",
				allowRecordlyWindowCapture: false,
			}),
		).toBe(true);

		expect(
			shouldBlockOwnWindowCapture({
				source: { id: "window:1", name: "Safari", appName: "Safari" },
				ownAppName: "screencraft",
				allowRecordlyWindowCapture: false,
			}),
		).toBe(false);
	});

	it("creates mac capture artifacts with optional mic sidecar", () => {
		expect(
			buildNativeMacCaptureArtifacts({
				recordingsDir: "/tmp/recordly",
				recordingTimestamp: 42,
				recordingOptions: {
					capturesSystemAudio: true,
					capturesMicrophone: true,
				},
			}),
		).toEqual({
			capturesSystemAudio: true,
			capturesMicrophone: true,
			outputPath: "/tmp/recordly/recording-42.mp4",
			microphoneOutputPath: "/tmp/recordly/recording-42.mic.m4a",
		});
	});

	it("builds native capture config from a window source", () => {
		const { config, outputPath, microphoneOutputPath } = buildNativeMacCaptureConfig({
			source: {
				id: "window:17",
				name: "Docs",
				display_id: "5",
			},
			recordingsDir: "/tmp/recordly",
			primaryDisplayId: 99,
			recordingTimestamp: 100,
			recordingOptions: {
				capturesSystemAudio: true,
				capturesMicrophone: true,
				microphoneDeviceId: "mic-1",
				microphoneLabel: "Built-in Mic",
			},
		});

		expect(outputPath).toBe("/tmp/recordly/recording-100.mp4");
		expect(microphoneOutputPath).toBe("/tmp/recordly/recording-100.mic.m4a");
		expect(config).toEqual({
			fps: 60,
			outputPath: "/tmp/recordly/recording-100.mp4",
			capturesSystemAudio: true,
			capturesMicrophone: true,
			microphoneDeviceId: "mic-1",
			microphoneLabel: "Built-in Mic",
			microphoneOutputPath: "/tmp/recordly/recording-100.mic.m4a",
			windowId: 17,
		});
	});

	it("falls back to display or primary display ids for non-window sources", () => {
		expect(
			buildNativeMacCaptureConfig({
				source: { id: "screen:2", name: "Display", display_id: "7" },
				recordingsDir: "/tmp/recordly",
				primaryDisplayId: 99,
				recordingTimestamp: 1,
			}).config,
		).toMatchObject({ displayId: 7 });

		expect(
			buildNativeMacCaptureConfig({
				source: { id: "screen:2", name: "Display", display_id: "" },
				recordingsDir: "/tmp/recordly",
				primaryDisplayId: 99,
				recordingTimestamp: 1,
			}).config,
		).toMatchObject({ displayId: 99 });
	});
});
