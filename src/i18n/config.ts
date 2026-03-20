export const DEFAULT_LOCALE = "ko" as const;

export const SUPPORTED_LOCALES = ["en", "es", "ko", "zh-CN"] as const;

export const I18N_NAMESPACES = [
	"common",
	"launch",
	"editor",
	"timeline",
	"settings",
	"dialogs",
	"shortcuts",
] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export type I18nNamespace = (typeof I18N_NAMESPACES)[number];

export const LOCALE_OPTIONS: Readonly<
	Record<AppLocale, { shortLabel: string; nativeLabel: string }>
> = {
	en: {
		shortLabel: "EN",
		nativeLabel: "English",
	},
	es: {
		shortLabel: "ES",
		nativeLabel: "Español",
	},
	ko: {
		shortLabel: "KO",
		nativeLabel: "한국어",
	},
	"zh-CN": {
		shortLabel: "中文",
		nativeLabel: "简体中文",
	},
};
