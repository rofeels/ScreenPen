import { describe, expect, it } from "vitest";

import { normalizeLocale, translateForLocale } from "./I18nContext";

describe("normalizeLocale", () => {
	it("keeps exact supported locales", () => {
		expect(normalizeLocale("ko")).toBe("ko");
		expect(normalizeLocale("zh-CN")).toBe("zh-CN");
	});

	it("normalizes locale case and extended subtags", () => {
		expect(normalizeLocale("ZH-cn")).toBe("zh-CN");
		expect(normalizeLocale("ko-KR")).toBe("ko");
		expect(normalizeLocale("zh-Hans-CN")).toBe("zh-CN");
	});

	it("falls back to english for unsupported locales", () => {
		expect(normalizeLocale("fr")).toBe("en");
		expect(normalizeLocale(undefined)).toBe("en");
	});
});

describe("translateForLocale", () => {
	it("supports default common namespace lookups", () => {
		expect(translateForLocale("en", "app.name")).toBe("Recordly");
	});

	it("returns Korean translations for registered locale bundles", () => {
		expect(translateForLocale("ko", "app.language")).toBe("언어");
		expect(translateForLocale("ko", "dialogs.addFont.cancel")).toBe("취소");
		expect(translateForLocale("ko", "timeline.customAspect.invalidPositive")).toBe(
			"사용자 지정 화면 비율은 양수여야 합니다.",
		);
	});

	it("falls back to english when a locale key is missing", () => {
		expect(translateForLocale("ko", "common.nonexistent.key", "Fallback text")).toBe(
			"Fallback text",
		);
	});
});
