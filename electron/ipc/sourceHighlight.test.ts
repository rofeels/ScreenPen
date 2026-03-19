import { afterEach, describe, expect, it, vi } from "vitest";
import {
	buildSourceHighlightWindowOptions,
	getSourceHighlightAppName,
	parseAppleScriptBounds,
	resolveSourceHighlightBounds,
	showSourceHighlight,
} from "./sourceHighlight";

afterEach(() => {
	vi.useRealTimers();
});

describe("sourceHighlight helpers", () => {
	it("derives app names and parses AppleScript bounds", () => {
		expect(getSourceHighlightAppName({ id: "window:1", name: "Safari — Docs" })).toBe("Safari");
		expect(getSourceHighlightAppName({ id: "window:1", name: "Docs", appName: "Safari" })).toBe(
			"Safari",
		);
		expect(parseAppleScriptBounds("10,20,300,400")).toEqual({
			x: 10,
			y: 20,
			width: 300,
			height: 400,
		});
		expect(parseAppleScriptBounds("invalid")).toBeNull();
	});

	it("builds padded BrowserWindow options for the highlight overlay", () => {
		expect(buildSourceHighlightWindowOptions({ x: 20, y: 30, width: 200, height: 100 }, 8)).toMatchObject(
			{
				x: 12,
				y: 22,
				width: 216,
				height: 116,
				focusable: false,
				transparent: true,
			},
		);
	});

	it("prefers AppleScript bounds before falling back to display bounds", async () => {
		const getDisplayBounds = vi.fn().mockReturnValue({ x: 0, y: 0, width: 100, height: 50 });
		const execFileAsync = vi.fn().mockResolvedValue({ stdout: "11,22,333,444" });

		expect(
			await resolveSourceHighlightBounds(
				{ id: "window:7", name: "Safari — Docs", appName: "Safari" },
				{
					platform: "darwin",
					getDisplayBounds,
					getNativeWindowSources: vi.fn().mockResolvedValue([]),
					execFileAsync: execFileAsync as never,
					wait: vi.fn().mockResolvedValue(undefined),
				},
			),
		).toEqual({ x: 11, y: 22, width: 333, height: 444 });
		expect(getDisplayBounds).not.toHaveBeenCalled();
	});

	it("falls back to display bounds when window resolution fails", async () => {
		const displayBounds = { x: 5, y: 6, width: 700, height: 500 };
		const getDisplayBounds = vi.fn().mockReturnValue(displayBounds);

		expect(
			await resolveSourceHighlightBounds(
				{ id: "window:9", name: "Docs", appName: "Safari" },
				{
					platform: "darwin",
					getDisplayBounds,
					getNativeWindowSources: vi.fn().mockResolvedValue([
						{ id: "window:9", name: "Docs", x: 0, y: 0, width: 0, height: 0 },
					]),
					execFileAsync: vi.fn().mockRejectedValue(new Error("activate failed")) as never,
					wait: vi.fn().mockResolvedValue(undefined),
				},
			),
		).toEqual(displayBounds);
	});

	it("creates, loads, and closes the highlight overlay window", async () => {
		vi.useFakeTimers();
		const fakeWindow = {
			close: vi.fn(),
			isDestroyed: vi.fn().mockReturnValue(false),
			loadURL: vi.fn().mockResolvedValue(undefined),
			setIgnoreMouseEvents: vi.fn(),
		};

		await showSourceHighlight(
			{ id: "screen:1", name: "Display" },
			{
				platform: "darwin",
				getDisplayBounds: () => ({ x: 10, y: 20, width: 100, height: 60 }),
				createHighlightWindow: vi.fn().mockResolvedValue(fakeWindow),
			},
		);

		expect(fakeWindow.setIgnoreMouseEvents).toHaveBeenCalledWith(true);
		expect(fakeWindow.loadURL).toHaveBeenCalledWith(
			expect.stringContaining("data:text/html;charset=utf-8,"),
		);

		await vi.advanceTimersByTimeAsync(1700);
		expect(fakeWindow.close).toHaveBeenCalled();
	});
});
