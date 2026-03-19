import type { ProcessedDesktopSource } from "./contracts";
import type { NativeMacWindowSource } from "./nativeHelpers";

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
		[appName, "Recordly", ...windowTitles]
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

			if (allowRecordlyWindowCapture && normalizedName.includes("recordly")) {
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
				(normalizedAppName === "recordly" || normalizedWindowName.includes("recordly"))
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
