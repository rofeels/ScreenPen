import { describe, expect, it, vi } from "vitest";
import type { SelectedSource } from "./contracts";
import type { WindowBounds } from "./cursorTelemetry";
import {
	createSelectedWindowBoundsTracker,
	getDisplayBoundsForSource,
	parseWindowId,
	parseXwininfoBounds,
	resolveLinuxWindowBounds,
	resolveMacWindowBounds,
} from "./windowBounds";

describe("windowBounds helpers", () => {
	it("parses window ids and xwininfo bounds", () => {
		expect(parseWindowId("window:42")).toBe(42);
		expect(parseWindowId("screen:3")).toBeNull();
		expect(
			parseXwininfoBounds(
				"Absolute upper-left X: 10\nAbsolute upper-left Y: 20\nWidth: 300\nHeight: 400",
			),
		).toEqual({
			x: 10,
			y: 20,
			width: 300,
			height: 400,
		});
		expect(parseXwininfoBounds("Width: 100")).toBeNull();
	});

	it("matches display bounds by display id and falls back to primary bounds", () => {
		const displays = [
			{ id: 5, bounds: { x: 50, y: 60, width: 700, height: 500 } },
			{ id: 7, bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
		];
		const primaryBounds = { x: 10, y: 20, width: 1280, height: 720 };

		expect(
			getDisplayBoundsForSource(
				{ id: "screen:1", name: "Display", display_id: "5" },
				displays,
				primaryBounds,
			),
		).toEqual(displays[0]?.bounds);
		expect(
			getDisplayBoundsForSource(
				{ id: "screen:1", name: "Display", display_id: "99" },
				displays,
				primaryBounds,
			),
		).toEqual(primaryBounds);
	});

	it("resolves linux bounds by id before falling back to the window title", async () => {
		const execFileAsync = vi
			.fn()
			.mockResolvedValueOnce({
				stdout: "Absolute upper-left X: 1\nAbsolute upper-left Y: 2\nWidth: 300\nHeight: 200\n",
			})
			.mockRejectedValueOnce(new Error("missing id"))
			.mockResolvedValueOnce({
				stdout: "Absolute upper-left X: 10\nAbsolute upper-left Y: 20\nWidth: 500\nHeight: 600\n",
			});

		expect(
			await resolveLinuxWindowBounds(
				{ id: "window:17", name: "Docs" },
				{ execFileAsync: execFileAsync as never },
			),
		).toEqual({ x: 1, y: 2, width: 300, height: 200 });
		expect(
			await resolveLinuxWindowBounds(
				{ id: "window:19", name: "Docs", windowTitle: "Docs window" },
				{ execFileAsync: execFileAsync as never },
			),
		).toEqual({ x: 10, y: 20, width: 500, height: 600 });
		expect(execFileAsync).toHaveBeenNthCalledWith(1, "xwininfo", ["-id", "17"], { timeout: 1500 });
		expect(execFileAsync).toHaveBeenNthCalledWith(2, "xwininfo", ["-id", "19"], { timeout: 1500 });
		expect(execFileAsync).toHaveBeenNthCalledWith(3, "xwininfo", ["-name", "Docs window"], {
			timeout: 1500,
		});
	});

	it("resolves mac bounds from native window sources", async () => {
		const getNativeWindowSources = vi.fn().mockResolvedValue([
			{ id: "window:7", name: "Other", x: 1, y: 1, width: 1, height: 1 },
			{ id: "window:11", name: "Docs", x: 9, y: 8, width: 300, height: 250 },
		]);

		expect(
			await resolveMacWindowBounds({ id: "window:11", name: "Docs" }, { getNativeWindowSources }),
		).toEqual({ x: 9, y: 8, width: 300, height: 250 });
	});

	it("tracks selected window bounds for supported platforms", async () => {
		let selectedSource: SelectedSource | null = { id: "window:21", name: "Docs" };
		let selectedWindowBounds: WindowBounds | null = null;
		const setIntervalFn = vi.fn((callback: () => void) => {
			void callback();
			return 1 as never;
		});
		const clearIntervalFn = vi.fn();
		const resolveMacWindowBoundsImpl = vi.fn().mockResolvedValue({
			x: 15,
			y: 25,
			width: 640,
			height: 480,
		});
		const tracker = createSelectedWindowBoundsTracker({
			platform: "darwin",
			getSelectedSource: () => selectedSource,
			setSelectedWindowBounds: (bounds) => {
				selectedWindowBounds = bounds;
			},
			getNativeWindowSources: vi.fn().mockResolvedValue([]),
			resolveMacWindowBounds: resolveMacWindowBoundsImpl as never,
			setIntervalFn: setIntervalFn as never,
			clearIntervalFn: clearIntervalFn as never,
		});

		await tracker.refresh();
		expect(selectedWindowBounds).toEqual({ x: 15, y: 25, width: 640, height: 480 });

		selectedSource = { id: "screen:1", name: "Display" };
		tracker.start();
		expect(selectedWindowBounds).toBeNull();

		tracker.stop();
		expect(clearIntervalFn).not.toHaveBeenCalled();
	});
});
