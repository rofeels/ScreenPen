export type DesktopSourceType = "screen" | "window";

export interface ProcessedDesktopSource {
	id: string;
	name: string;
	display_id: string;
	thumbnail: string | null;
	appIcon: string | null;
	displayOrder?: number;
	displayLabel?: string;
	displayResolution?: string;
	originalName?: string;
	sourceType?: DesktopSourceType;
	appName?: string;
	windowTitle?: string;
}

export interface SelectedSource {
	id?: string;
	name: string;
	display_id?: string;
	sourceType?: DesktopSourceType;
	appName?: string;
	windowTitle?: string;
}

export interface NativeMacRecordingOptions {
	capturesSystemAudio?: boolean;
	capturesMicrophone?: boolean;
	microphoneDeviceId?: string;
	microphoneLabel?: string;
}

export interface RecordingSessionData {
	videoPath: string;
	webcamPath?: string | null;
}

export interface CursorTelemetryPoint {
	timeMs: number;
	cx: number;
	cy: number;
	interactionType?: "move" | "click" | "double-click" | "right-click" | "middle-click" | "mouseup";
	cursorType?:
		| "arrow"
		| "text"
		| "pointer"
		| "crosshair"
		| "open-hand"
		| "closed-hand"
		| "resize-ew"
		| "resize-ns"
		| "not-allowed";
}

export interface SystemCursorAsset {
	dataUrl: string;
	hotspotX: number;
	hotspotY: number;
	width: number;
	height: number;
}
