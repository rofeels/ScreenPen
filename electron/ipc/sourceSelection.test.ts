import { describe, expect, it } from "vitest";

import {
	buildElectronWindowSources,
	buildMacWindowSources,
	buildScreenSources,
	buildScreenSourcesWithDisplayMetadata,
	collectOwnWindowNames,
	normalizeDesktopSourceName,
} from "./sourceSelection";

function makeThumbnail(data = "thumb") {
	return {
		toDataURL: () => data,
		isEmpty: () => false,
		getSize: () => ({ width: 320, height: 180 }),
	};
}

describe("sourceSelection helpers", () => {
	it("collects and normalizes own window names", () => {
		const names = collectOwnWindowNames("ScreenCraft", ["  My Window  ", "Another   Window"]);

		expect(names.has("screencraft")).toBe(true);
		expect(names.has("recordly")).toBe(true);
		expect(names.has("my window")).toBe(true);
		expect(names.has("another window")).toBe(true);
		expect(normalizeDesktopSourceName("  A   B  ")).toBe("a b");
	});

	it("builds screen sources with serialized thumbnails", () => {
		const result = buildScreenSources([
			{
				id: "screen:1",
				name: "Screen 1",
				display_id: "1",
				thumbnail: makeThumbnail("screen-thumb"),
				appIcon: makeThumbnail("screen-icon"),
			},
		]);

		expect(result).toEqual([
			{
				id: "screen:1",
				name: "Screen 1",
				display_id: "1",
				thumbnail: "screen-thumb",
				appIcon: "screen-icon",
			},
		]);
	});

	it("adds readable display metadata for screen sources", () => {
		const result = buildScreenSourcesWithDisplayMetadata(
			[
				{
					id: "screen:1",
					name: "Screen 1",
					display_id: "10",
					thumbnail: makeThumbnail("screen-thumb"),
					appIcon: null,
				},
				{
					id: "screen:2",
					name: "Screen 2",
					display_id: "11",
					thumbnail: makeThumbnail("screen-thumb-2"),
					appIcon: null,
				},
			],
			[
				{ id: 10, label: "Studio Display", internal: false, bounds: { width: 2560, height: 1440 } },
				{ id: 11, label: "", internal: true, bounds: { width: 3456, height: 2234 } },
			],
			10,
		);

		expect(result[0]?.displayLabel).toBe("Main · Studio Display · 2560×1440");
		expect(result[0]?.displayResolution).toBe("2560×1440");
		expect(result[0]?.displayOrder).toBe(1);
		expect(result[1]?.displayLabel).toBe("Built-in · 3456×2234");
		expect(result[1]?.displayResolution).toBe("3456×2234");
		expect(result[1]?.displayOrder).toBe(2);
	});

	it("filters own electron windows and supports fallback partial matching", () => {
		const ownWindowNames = collectOwnWindowNames("ScreenCraft", ["Video Editor"]);
		const electronSources = [
			{
				id: "window:1",
				name: "Video Editor",
				display_id: "1",
				thumbnail: makeThumbnail("editor-thumb"),
				appIcon: makeThumbnail("editor-icon"),
			},
			{
				id: "window:2",
				name: "Recordly Helper",
				display_id: "1",
				thumbnail: makeThumbnail("helper-thumb"),
				appIcon: makeThumbnail("helper-icon"),
			},
			{
				id: "window:3",
				name: "Video Editor — Draft",
				display_id: "1",
				thumbnail: makeThumbnail("draft-thumb"),
				appIcon: makeThumbnail("draft-icon"),
			},
		];

		expect(
			buildElectronWindowSources(electronSources, {
				allowRecordlyWindowCapture: true,
				ownWindowNames,
			}).map((source) => source.id),
		).toEqual(["window:2", "window:3"]);

		expect(
			buildElectronWindowSources(electronSources, {
				allowRecordlyWindowCapture: false,
				ownWindowNames,
				allowPartialOwnWindowMatch: true,
			}).map((source) => source.id),
		).toEqual([]);
	});

	it("merges native mac window sources with electron thumbnails and filters own app windows", () => {
		const electronSources = [
			{
				id: "window:10",
				name: "Safari — Docs",
				display_id: "99",
				thumbnail: makeThumbnail("safari-thumb"),
				appIcon: makeThumbnail("safari-icon"),
			},
		];
		const nativeWindowSources = [
			{
				id: "window:10",
				name: "Docs",
				appName: "Safari",
				windowTitle: "Docs",
			},
			{
				id: "window:11",
				name: "ScreenCraft Internal",
				appName: "ScreenCraft",
				windowTitle: "ScreenCraft Internal",
			},
		];

		const result = buildMacWindowSources(nativeWindowSources, electronSources, {
			allowRecordlyWindowCapture: false,
			ownAppName: "screencraft",
			ownWindowNames: collectOwnWindowNames("ScreenCraft", ["ScreenCraft Internal"]),
		});

		expect(result).toEqual([
			{
				id: "window:10",
				name: "Docs",
				display_id: "99",
				thumbnail: "safari-thumb",
				appIcon: "safari-icon",
				appName: "Safari",
				windowTitle: "Docs",
			},
		]);
	});
});
