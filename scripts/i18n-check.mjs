import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const localesDir = path.join(root, "src", "i18n", "locales");
const sourceDir = path.join(root, "src");

const locales = fs.readdirSync(localesDir).filter((entry) => {
	const fullPath = path.join(localesDir, entry);
	return fs.statSync(fullPath).isDirectory();
});

if (!locales.includes("en")) {
	console.error('i18n-check: expected base locale directory "en"');
	process.exit(1);
}

function loadJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function collectKeyPaths(obj, prefix = "") {
	if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
		return prefix ? [prefix] : [];
	}

	const keys = Object.keys(obj);
	if (keys.length === 0) {
		return prefix ? [prefix] : [];
	}

	const paths = [];
	for (const key of keys) {
		const nextPrefix = prefix ? `${prefix}.${key}` : key;
		const value = obj[key];
		if (value && typeof value === "object" && !Array.isArray(value)) {
			paths.push(...collectKeyPaths(value, nextPrefix));
		} else {
			paths.push(nextPrefix);
		}
	}
	return paths;
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function walkSourceFiles(directory, result = []) {
	const entries = fs.readdirSync(directory, { withFileTypes: true });

	for (const entry of entries) {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			if (entryPath.startsWith(localesDir)) {
				continue;
			}
			walkSourceFiles(entryPath, result);
			continue;
		}

		if (!/\.(ts|tsx)$/.test(entry.name) || /\.test\.(ts|tsx)$/.test(entry.name)) {
			continue;
		}

		result.push(entryPath);
	}

	return result;
}

function parseTranslationKey(rawKey, namespaceNames) {
	const [first, ...rest] = rawKey.split(".");
	if (namespaceNames.has(first) && rest.length > 0) {
		return { namespace: first, path: rest.join(".") };
	}
	return { namespace: "common", path: rawKey };
}

const baseLocaleDir = path.join(localesDir, "en");
const namespaceFiles = fs.readdirSync(baseLocaleDir).filter((file) => file.endsWith(".json"));
const namespaceNames = new Set(namespaceFiles.map((file) => file.replace(/\.json$/, "")));
const baseKeysByNamespace = {};

for (const namespaceFile of namespaceFiles) {
	const namespace = namespaceFile.replace(/\.json$/, "");
	baseKeysByNamespace[namespace] = new Set(
		collectKeyPaths(loadJson(path.join(baseLocaleDir, namespaceFile))),
	);
}

let hasErrors = false;

for (const namespaceFile of namespaceFiles) {
	const namespace = namespaceFile.replace(/\.json$/, "");
	const baseKeys = baseKeysByNamespace[namespace];

	for (const locale of locales) {
		if (locale === "en") continue;

		const localeFile = path.join(localesDir, locale, namespaceFile);
		if (!fs.existsSync(localeFile)) {
			console.error(`i18n-check: missing namespace file ${locale}/${namespaceFile}`);
			hasErrors = true;
			continue;
		}

		const localeData = loadJson(localeFile);
		const localeKeys = new Set(collectKeyPaths(localeData));

		for (const key of baseKeys) {
			if (!localeKeys.has(key)) {
				console.error(`i18n-check: missing key ${locale}/${namespaceFile}:${key}`);
				hasErrors = true;
			}
		}

		for (const key of localeKeys) {
			if (!baseKeys.has(key)) {
				console.error(`i18n-check: extra key ${locale}/${namespaceFile}:${key}`);
				hasErrors = true;
			}
		}
	}
}

const sourceFiles = walkSourceFiles(sourceDir);

for (const filePath of sourceFiles) {
	const source = fs.readFileSync(filePath, "utf8");
	const relativePath = path.relative(root, filePath);
	const scopedTranslators = [];

	for (const match of source.matchAll(
		/\b(?:const|let|var)\s+(\w+)\s*=\s*useScopedT\((['"])([^'"]+)\2\)/g,
	)) {
		scopedTranslators.push({ name: match[1], namespace: match[3] });
	}

	for (const translator of scopedTranslators) {
		const translatorPattern = new RegExp(
			`(?<![\\w$.])${escapeRegExp(translator.name)}\\((['\"])([^'\"]+)\\1`,
			"g",
		);

		for (const match of source.matchAll(translatorPattern)) {
			const key = match[2];
			const namespaceKeys = baseKeysByNamespace[translator.namespace];
			if (!namespaceKeys) {
				console.error(`i18n-check: ${relativePath} uses unknown namespace ${translator.namespace}`);
				hasErrors = true;
				continue;
			}

			if (!namespaceKeys.has(key)) {
				console.error(
					`i18n-check: missing source key ${relativePath}:${translator.namespace}.${key}`,
				);
				hasErrors = true;
			}
		}
	}

	const usesScopedTAsBareT = scopedTranslators.some((translator) => translator.name === "t");
	if (usesScopedTAsBareT) {
		continue;
	}

	const directTranslatorPattern = /(?<![\w$.])t\((['"])([^'"]+)\1/g;
	for (const match of source.matchAll(directTranslatorPattern)) {
		const rawKey = match[2];
		const parsed = parseTranslationKey(rawKey, namespaceNames);
		const namespaceKeys = baseKeysByNamespace[parsed.namespace];

		if (!namespaceKeys) {
			console.error(`i18n-check: ${relativePath} references unknown namespace ${parsed.namespace}`);
			hasErrors = true;
			continue;
		}

		if (!namespaceKeys.has(parsed.path)) {
			console.error(
				`i18n-check: missing source key ${relativePath}:${parsed.namespace}.${parsed.path}`,
			);
			hasErrors = true;
		}
	}
}

if (hasErrors) {
	process.exit(1);
}

console.log("i18n-check: locale files and source translation keys are consistent");
