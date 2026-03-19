import path from "node:path";
import type { NativeMacRecordingOptions, SelectedSource } from "./contracts";
import { normalizeDesktopSourceName } from "./sourceSelection";
import { parseWindowId } from "./windowBounds";

export function shouldBlockOwnWindowCapture(options: {
	source: SelectedSource;
	ownAppName: string;
	allowRecordlyWindowCapture: boolean;
}) {
	const { source, ownAppName, allowRecordlyWindowCapture } = options;
	const appName = normalizeDesktopSourceName(String(source.appName ?? ""));

	return (
		!allowRecordlyWindowCapture &&
		source.id?.startsWith("window:") &&
		Boolean(appName) &&
		(appName === ownAppName || appName === "recordly")
	);
}

export function buildNativeMacCaptureArtifacts(options: {
	recordingsDir: string;
	recordingTimestamp?: number;
	recordingOptions?: NativeMacRecordingOptions;
}) {
	const { recordingsDir, recordingTimestamp = Date.now(), recordingOptions } = options;
	const capturesSystemAudio = Boolean(recordingOptions?.capturesSystemAudio);
	const capturesMicrophone = Boolean(recordingOptions?.capturesMicrophone);
	const outputPath = path.join(recordingsDir, `recording-${recordingTimestamp}.mp4`);
	const microphoneOutputPath =
		capturesSystemAudio && capturesMicrophone
			? path.join(recordingsDir, `recording-${recordingTimestamp}.mic.m4a`)
			: null;

	return {
		capturesSystemAudio,
		capturesMicrophone,
		outputPath,
		microphoneOutputPath,
	};
}

export function buildNativeMacCaptureConfig(options: {
	source: SelectedSource;
	recordingsDir: string;
	primaryDisplayId: number;
	recordingTimestamp?: number;
	recordingOptions?: NativeMacRecordingOptions;
}) {
	const { source, recordingsDir, primaryDisplayId, recordingTimestamp, recordingOptions } = options;
	const { capturesSystemAudio, capturesMicrophone, outputPath, microphoneOutputPath } =
		buildNativeMacCaptureArtifacts({
			recordingsDir,
			recordingTimestamp,
			recordingOptions,
		});

	const config: Record<string, unknown> = {
		fps: 60,
		outputPath,
		capturesSystemAudio,
		capturesMicrophone,
	};

	if (recordingOptions?.microphoneDeviceId) {
		config.microphoneDeviceId = recordingOptions.microphoneDeviceId;
	}

	if (recordingOptions?.microphoneLabel) {
		config.microphoneLabel = recordingOptions.microphoneLabel;
	}

	if (microphoneOutputPath) {
		config.microphoneOutputPath = microphoneOutputPath;
	}

	const windowId = parseWindowId(source.id);
	const screenId = Number(source.display_id);

	if (Number.isFinite(windowId) && windowId && source.id?.startsWith("window:")) {
		config.windowId = windowId;
	} else if (Number.isFinite(screenId) && screenId > 0) {
		config.displayId = screenId;
	} else {
		config.displayId = primaryDisplayId;
	}

	return {
		config,
		outputPath,
		microphoneOutputPath,
	};
}
