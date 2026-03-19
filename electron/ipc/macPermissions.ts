import { shell, systemPreferences } from "electron";

function getMacPrivacySettingsUrl(pane: "screen" | "accessibility") {
	return pane === "screen"
		? "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
		: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";
}

export function getAccessibilityPermissionStatus() {
	if (process.platform !== "darwin") {
		return { success: true, trusted: true, prompted: false };
	}

	return {
		success: true,
		trusted: systemPreferences.isTrustedAccessibilityClient(false),
		prompted: false,
	};
}

export function requestAccessibilityPermission() {
	if (process.platform !== "darwin") {
		return { success: true, trusted: true, prompted: false };
	}

	return {
		success: true,
		trusted: systemPreferences.isTrustedAccessibilityClient(true),
		prompted: true,
	};
}

export function getScreenRecordingPermissionStatus() {
	if (process.platform !== "darwin") {
		return { success: true, status: "granted" };
	}

	try {
		return {
			success: true,
			status: systemPreferences.getMediaAccessStatus("screen"),
		};
	} catch (error) {
		console.error("Failed to get screen recording permission status:", error);
		return { success: false, status: "unknown", error: String(error) };
	}
}

export async function openScreenRecordingPreferences() {
	if (process.platform !== "darwin") {
		return { success: true };
	}

	try {
		await shell.openExternal(getMacPrivacySettingsUrl("screen"));
		return { success: true };
	} catch (error) {
		console.error("Failed to open Screen Recording preferences:", error);
		return { success: false, error: String(error) };
	}
}

export async function openAccessibilityPreferences() {
	if (process.platform !== "darwin") {
		return { success: true };
	}

	try {
		await shell.openExternal(getMacPrivacySettingsUrl("accessibility"));
		return { success: true };
	} catch (error) {
		console.error("Failed to open Accessibility preferences:", error);
		return { success: false, error: String(error) };
	}
}
