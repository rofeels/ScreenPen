import type { ProcessedDesktopSource } from "./contracts";
import type { NativeMacWindowSource } from "./nativeHelpers";

const KNOWN_OWN_APP_NAMES = ["screencraft", "recordly"] as const;

type AppIconLike = {
	toDataURL: () => string;
};

type ThumbnailLike = AppIconLike & {
	isEmpty: () => boolean;
	getSize: () => { width: number; height: number };
};

type DesktopSourceLike = {
	id: string;
	name: string;
	display_id: string;
	thumbnail?: ThumbnailLike | null;
	appIcon?: AppIconLike | null;
};

type DisplayLike = {
	id: number;
	label: string;
	internal: boolean;
	bounds: {
		width: number;
		height: number;
	};
};

function toDataUrl(image: AppIconLike | null | undefined) {
	return image ? image.toDataURL() : null;
}

function toProcessedSource(source: DesktopSourceLike): ProcessedDesktopSource {
	return {
		id: source.id,
		name: source.name,
		display_id: source.display_id,
		thumbnail: toDataUrl(source.thumbnail),
		appIcon: toDataUrl(source.appIcon),
	};
}

export function normalizeDesktopSourceName(value: string) {
	return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function hasUsableSourceThumbnail(thumbnail: ThumbnailLike | null | undefined) {
	if (!thumbnail || thumbnail.isEmpty()) {
		return false;
	}

	const size = thumbnail.getSize();
	return size.width > 1 && size.height > 1;
}

export function collectOwnWindowNames(appName: string, windowTitles: string[]) {
	return new Set(
		[appName, "ScreenCraft", "Recordly", ...windowTitles]
			.map((name) => normalizeDesktopSourceName(name))
			.filter(Boolean),
	);
}

function isOwnWindowName(
	normalizedName: string,
	ownWindowNames: Set<string>,
	allowPartialMatch: boolean,
) {
	for (const ownName of ownWindowNames) {
		if (!ownName) continue;
		if (normalizedName === ownName) {
			return true;
		}

		if (
			allowPartialMatch &&
			(normalizedName.includes(ownName) || ownName.includes(normalizedName))
		) {
			return true;
		}
	}

	return false;
}

export function buildScreenSources(electronSources: DesktopSourceLike[]) {
	return electronSources.filter((source) => source.id.startsWith("screen:")).map(toProcessedSource);
}

function formatDisplayResolution(display: DisplayLike) {
	return `${display.bounds.width}×${display.bounds.height}`;
}

function formatDisplayLabel(display: DisplayLike, index: number, primaryDisplayId: number) {
	const parts: string[] = [];
	if (display.id === primaryDisplayId) {
		parts.push("Main");
	}

	if (display.internal) {
		parts.push("Built-in");
	} else if (display.label.trim()) {
		parts.push(display.label.trim());
	} else {
		parts.push(`Display ${index + 1}`);
	}

	parts.push(formatDisplayResolution(display));
	return parts.join(" · ");
}

export function buildScreenSourcesWithDisplayMetadata(
	electronSources: DesktopSourceLike[],
	displays: DisplayLike[],
	primaryDisplayId: number,
) {
	const screenSources = electronSources.filter((source) => source.id.startsWith("screen:"));
	const displaysById = new Map(
		displays.map((display, index) => [String(display.id), { display, index }] as const),
	);

	return screenSources.map((source, sourceIndex) => {
		const processed = toProcessedSource(source);
		const matched = displaysById.get(source.display_id);
		if (!matched) {
			return {
				...processed,
				displayOrder: sourceIndex + 1,
				displayLabel: `${source.name} · ${sourceIndex + 1}`,
			};
		}

		return {
			...processed,
			displayOrder: matched.index + 1,
			displayLabel: formatDisplayLabel(matched.display, matched.index, primaryDisplayId),
			displayResolution: formatDisplayResolution(matched.display),
		};
	});
}

export function buildElectronWindowSources(
	electronSources: DesktopSourceLike[],
	options: {
		allowRecordlyWindowCapture: boolean;
		ownWindowNames: Set<string>;
		allowPartialOwnWindowMatch?: boolean;
	},
) {
	const {
		allowRecordlyWindowCapture,
		ownWindowNames,
		allowPartialOwnWindowMatch = false,
	} = options;

	return electronSources
		.filter((source) => source.id.startsWith("window:"))
		.filter((source) => hasUsableSourceThumbnail(source.thumbnail))
		.filter((source) => {
			const normalizedName = normalizeDesktopSourceName(source.name);
			if (!normalizedName) {
				return true;
			}

			if (
				allowRecordlyWindowCapture &&
				KNOWN_OWN_APP_NAMES.some((name) => normalizedName.includes(name))
			) {
				return true;
			}

			return !isOwnWindowName(normalizedName, ownWindowNames, allowPartialOwnWindowMatch);
		})
		.map(toProcessedSource);
}

export function buildMacWindowSources(
	nativeWindowSources: NativeMacWindowSource[],
	electronSources: DesktopSourceLike[],
	options: {
		allowRecordlyWindowCapture: boolean;
		ownAppName: string;
		ownWindowNames: Set<string>;
	},
): ProcessedDesktopSource[] {
	const { allowRecordlyWindowCapture, ownAppName, ownWindowNames } = options;
	const electronWindowSourceMap = new Map(
		electronSources
			.filter((source) => source.id.startsWith("window:"))
			.map((source) => [source.id, source] as const),
	);

	return nativeWindowSources
		.filter((source) => {
			const normalizedWindowName = normalizeDesktopSourceName(source.windowTitle ?? source.name);
			const normalizedAppName = normalizeDesktopSourceName(source.appName ?? "");

			if (!allowRecordlyWindowCapture && normalizedAppName && normalizedAppName === ownAppName) {
				return false;
			}

			if (
				allowRecordlyWindowCapture &&
				(KNOWN_OWN_APP_NAMES.includes(normalizedAppName as (typeof KNOWN_OWN_APP_NAMES)[number]) ||
					KNOWN_OWN_APP_NAMES.some((name) => normalizedWindowName.includes(name)))
			) {
				return true;
			}

			if (!normalizedWindowName) {
				return true;
			}

			return !isOwnWindowName(normalizedWindowName, ownWindowNames, false);
		})
		.map((source) => {
			const electronWindowSource = electronWindowSourceMap.get(source.id);
			return {
				id: source.id,
				name: source.name,
				display_id: source.display_id ?? electronWindowSource?.display_id ?? "",
				thumbnail: toDataUrl(electronWindowSource?.thumbnail),
				appIcon: source.appIcon ?? toDataUrl(electronWindowSource?.appIcon),
				appName: source.appName,
				windowTitle: source.windowTitle,
			};
		})
		.filter((source) => Boolean(source.thumbnail));
}
