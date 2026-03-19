import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const openExternal = vi.fn();
const isTrustedAccessibilityClient = vi.fn();
const getMediaAccessStatus = vi.fn();

vi.mock("electron", () => ({
	shell: {
		openExternal,
	},
	systemPreferences: {
		isTrustedAccessibilityClient,
		getMediaAccessStatus,
	},
}));

function setPlatform(value: NodeJS.Platform) {
	Object.defineProperty(process, "platform", {
		value,
		configurable: true,
	});
}

describe("macPermissions", () => {
	const originalPlatform = process.platform;
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.clearAllMocks();
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
			// suppress expected error-path logging in tests
		});
	});

	afterEach(() => {
		setPlatform(originalPlatform);
		consoleErrorSpy.mockRestore();
	});

	it("returns non-darwin accessibility status without prompting", async () => {
		setPlatform("linux");
		const { getAccessibilityPermissionStatus } = await import("./macPermissions");

		expect(getAccessibilityPermissionStatus()).toEqual({
			success: true,
			trusted: true,
			prompted: false,
		});
		expect(isTrustedAccessibilityClient).not.toHaveBeenCalled();
	});

	it("queries accessibility trust on darwin for status and request", async () => {
		setPlatform("darwin");
		isTrustedAccessibilityClient.mockReturnValueOnce(false).mockReturnValueOnce(true);
		const { getAccessibilityPermissionStatus, requestAccessibilityPermission } = await import(
			"./macPermissions"
		);

		expect(getAccessibilityPermissionStatus()).toEqual({
			success: true,
			trusted: false,
			prompted: false,
		});
		expect(requestAccessibilityPermission()).toEqual({
			success: true,
			trusted: true,
			prompted: true,
		});
		expect(isTrustedAccessibilityClient).toHaveBeenNthCalledWith(1, false);
		expect(isTrustedAccessibilityClient).toHaveBeenNthCalledWith(2, true);
	});

	it("returns screen recording status on darwin and handles errors", async () => {
		setPlatform("darwin");
		getMediaAccessStatus.mockReturnValueOnce("granted").mockImplementationOnce(() => {
			throw new Error("boom");
		});
		const { getScreenRecordingPermissionStatus } = await import("./macPermissions");

		expect(getScreenRecordingPermissionStatus()).toEqual({
			success: true,
			status: "granted",
		});
		expect(getScreenRecordingPermissionStatus()).toEqual({
			success: false,
			status: "unknown",
			error: "Error: boom",
		});
	});

	it("opens the correct privacy panes and returns failures", async () => {
		setPlatform("darwin");
		openExternal.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("nope"));
		const { openAccessibilityPreferences, openScreenRecordingPreferences } = await import(
			"./macPermissions"
		);

		expect(await openScreenRecordingPreferences()).toEqual({ success: true });
		expect(openExternal).toHaveBeenNthCalledWith(
			1,
			"x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
		);
		expect(await openAccessibilityPreferences()).toEqual({
			success: false,
			error: "Error: nope",
		});
		expect(openExternal).toHaveBeenNthCalledWith(
			2,
			"x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
		);
	});
});
