import { useEffect, useState } from "react";
import { CountdownOverlay } from "./components/countdown/CountdownOverlay";
import { ClickEffectOverlay } from "./components/recording-overlays/ClickEffectOverlay";
import { DrawingOverlayApp } from "./components/drawing-overlay/DrawingOverlayApp";
import { KeystrokeOverlay } from "./components/recording-overlays/KeystrokeOverlay";
import { MediaPresenterApp } from "./components/media-presenter/MediaPresenterApp";
import { LaserPointerOverlay } from "./components/recording-overlays/LaserPointerOverlay";
import { LaunchWindow } from "./components/launch/LaunchWindow";
import { SourceSelector } from "./components/launch/SourceSelector";
import { SettingsWindow } from "./components/settings/SettingsWindow";
import { Toaster } from "./components/ui/sonner";
import { ShortcutsConfigDialog } from "./components/video-editor/ShortcutsConfigDialog";
import VideoEditor from "./components/video-editor/VideoEditor";
import { useI18n } from "./contexts/I18nContext";
import { ShortcutsProvider } from "./contexts/ShortcutsContext";
import { loadAllCustomFonts } from "./lib/customFonts";

export default function App() {
	const [windowType, setWindowType] = useState("");
	const { t } = useI18n();

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const type = params.get("windowType") || "";
		setWindowType(type);

		if (type === "hud-overlay" || type === "source-selector" || type === "countdown" || type === "drawing-overlay" || type === "click-effect" || type === "keystroke-overlay" || type === "media-presenter" || type === "laser-pointer") {
			document.body.style.background = "transparent";
			document.documentElement.style.background = "transparent";
			document.getElementById("root")?.style.setProperty("background", "transparent");
		}

		if (type === "hud-overlay") {
			document.documentElement.style.overflow = "visible";
			document.body.style.overflow = "visible";
			document.getElementById("root")?.style.setProperty("overflow", "visible");
		}

		loadAllCustomFonts().catch((error) => {
			console.error("Failed to load custom fonts:", error);
		});
	}, []);

	useEffect(() => {
		document.title =
			windowType === "editor"
				? t("app.editorTitle", "ScreenPen Editor")
				: windowType === "settings"
					? `${t("app.name", "ScreenPen")} · ${t("settings.preferences.title", "Settings")}`
					: t("app.name", "ScreenPen");
	}, [windowType, t]);

	switch (windowType) {
		case "hud-overlay":
			return (
				<>
					<LaunchWindow />
					<Toaster theme="dark" className="pointer-events-auto" />
				</>
			);
		case "source-selector":
			return <SourceSelector />;
		case "countdown":
			return <CountdownOverlay />;
		case "drawing-overlay":
			return <DrawingOverlayApp />;
		case "click-effect":
			return <ClickEffectOverlay />;
		case "keystroke-overlay":
			return <KeystrokeOverlay />;
		case "media-presenter":
			return <MediaPresenterApp />;
		case "laser-pointer":
			return <LaserPointerOverlay />;
		case "editor":
			return (
				<ShortcutsProvider>
					<VideoEditor />
					<ShortcutsConfigDialog />
				</ShortcutsProvider>
			);
		case "settings":
			return (
				<ShortcutsProvider>
					<SettingsWindow />
					<ShortcutsConfigDialog />
					<Toaster theme="dark" />
				</ShortcutsProvider>
			);
		default:
			return (
				<div className="flex h-full w-full items-center justify-center bg-slate-950 text-white">
					<div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-6 py-5 shadow-2xl shadow-black/30 backdrop-blur-xl">
						<img
							src="/app-icons/screenpen-128.png"
							alt={t("app.name", "ScreenPen")}
							className="h-12 w-12 rounded-xl"
						/>
						<div>
							<h1 className="text-xl font-semibold tracking-tight">
								{t("app.name", "ScreenPen")}
							</h1>
							<p className="text-sm text-white/65">
								{t("app.subtitle", "Screen recording and editing")}
							</p>
						</div>
					</div>
				</div>
			);
	}
}
