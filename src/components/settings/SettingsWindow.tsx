import {
	CheckCircle2,
	EyeOff,
	FolderOpen,
	Keyboard,
	Languages,
	RefreshCw,
	ShieldAlert,
	ShieldCheck,
	SlidersHorizontal,
	TimerReset,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useI18n, useScopedT } from "@/contexts/I18nContext";
import { useShortcuts } from "@/contexts/ShortcutsContext";
import { type AppLocale, LOCALE_OPTIONS } from "@/i18n/config";
import { FIXED_SHORTCUTS, formatBinding, SHORTCUT_ACTIONS, SHORTCUT_LABELS } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { formatShortcut } from "@/utils/platformUtils";

const COUNTDOWN_OPTIONS = [0, 3, 5, 10] as const;

function SectionCard({
	icon,
	title,
	description,
	children,
	action,
}: {
	icon: ReactNode;
	title: string;
	description: string;
	children: ReactNode;
	action?: ReactNode;
}) {
	return (
		<Card className="border-white/10 bg-white/[0.03] text-white shadow-2xl shadow-black/20">
			<CardHeader className="gap-3 pb-4">
				<div className="flex items-start justify-between gap-4">
					<div className="flex items-start gap-3">
						<div className="rounded-xl border border-white/10 bg-white/5 p-2 text-blue-400">
							{icon}
						</div>
						<div className="space-y-1">
							<CardTitle className="text-base text-white">{title}</CardTitle>
							<CardDescription className="text-sm leading-6 text-slate-400">
								{description}
							</CardDescription>
						</div>
					</div>
					{action}
				</div>
			</CardHeader>
			<CardContent>{children}</CardContent>
		</Card>
	);
}

function OptionButton({
	active,
	children,
	onClick,
}: {
	active: boolean;
	children: ReactNode;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"rounded-xl border px-3 py-2 text-left text-sm transition-colors",
				active
					? "border-blue-500/60 bg-blue-500/15 text-white shadow-lg shadow-blue-950/30"
					: "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10 hover:text-white",
			)}
		>
			{children}
		</button>
	);
}

function StatusBadge({ active, label }: { active: boolean; label: string }) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
				active
					? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
					: "border-amber-500/30 bg-amber-500/10 text-amber-300",
			)}
		>
			{label}
		</span>
	);
}

export function SettingsWindow() {
	const { locale, setLocale, t } = useI18n();
	const { shortcuts, isMac, openConfig } = useShortcuts();
	const tSettings = useScopedT("settings");
	const tLaunch = useScopedT("launch");
	const tShortcuts = useScopedT("shortcuts");

	const [platform, setPlatform] = useState<string | null>(null);
	const [countdownDelay, setCountdownDelay] = useState<number>(3);
	const [recordingsDirectory, setRecordingsDirectory] = useState<string | null>(null);
	const [isDefaultRecordingsDirectory, setIsDefaultRecordingsDirectory] = useState(false);
	const [hideHudFromCapture, setHideHudFromCapture] = useState(true);
	const [screenPermissionStatus, setScreenPermissionStatus] = useState<string>("unknown");
	const [accessibilityTrusted, setAccessibilityTrusted] = useState<boolean | null>(null);
	const [appVersion, setAppVersion] = useState<string>("");
	const [autoUpdateStatus, setAutoUpdateStatus] = useState<{
		status: string;
		version?: string;
		message?: string;
		progressPercent?: number;
	}>({ status: "idle" });
	const [scrollLabels, setScrollLabels] = useState({
		pan: tShortcuts("bindings.panTimeline"),
		zoom: tShortcuts("bindings.zoomTimeline"),
	});

	const showPermissions = platform === "darwin";

	useEffect(() => {
		Promise.all([formatShortcut(["shift", "mod", "Scroll"]), formatShortcut(["mod", "Scroll"])])
			.then(([pan, zoom]) => setScrollLabels({ pan, zoom }))
			.catch(() => {
				setScrollLabels({
					pan: tShortcuts("bindings.panTimeline"),
					zoom: tShortcuts("bindings.zoomTimeline"),
				});
			});
	}, [tShortcuts]);

	const loadBaseSettings = useCallback(async () => {
		try {
			const [nextPlatform, countdownResult, recordingsResult, hudCaptureResult] = await Promise.all(
				[
					window.electronAPI.getPlatform(),
					window.electronAPI.getCountdownDelay(),
					window.electronAPI.getRecordingsDirectory(),
					window.electronAPI.getHudOverlayCaptureProtection(),
				],
			);

			setPlatform(nextPlatform);
			if (countdownResult.success) {
				setCountdownDelay(countdownResult.delay);
			}
			if (recordingsResult.success) {
				setRecordingsDirectory(recordingsResult.path);
				setIsDefaultRecordingsDirectory(recordingsResult.isDefault);
			}
			if (hudCaptureResult.success) {
				setHideHudFromCapture(hudCaptureResult.enabled);
			}
		} catch (error) {
			console.error("Failed to load settings window state:", error);
		}
	}, []);

	const loadPermissions = useCallback(async () => {
		if (platform !== "darwin") {
			setScreenPermissionStatus("granted");
			setAccessibilityTrusted(true);
			return;
		}

		try {
			const [screenResult, accessibilityResult] = await Promise.all([
				window.electronAPI.getScreenRecordingPermissionStatus(),
				window.electronAPI.getAccessibilityPermissionStatus(),
			]);

			setScreenPermissionStatus(screenResult.success ? screenResult.status : "unknown");
			setAccessibilityTrusted(accessibilityResult.success ? accessibilityResult.trusted : null);
		} catch (error) {
			console.error("Failed to load macOS permissions:", error);
			setScreenPermissionStatus("unknown");
			setAccessibilityTrusted(null);
		}
	}, [platform]);

	const refreshPermissionsAndSettings = useCallback(async () => {
		await loadBaseSettings();
		if (platform === "darwin") {
			await loadPermissions();
		}
	}, [loadBaseSettings, loadPermissions, platform]);

	useEffect(() => {
		void refreshPermissionsAndSettings();
	}, [refreshPermissionsAndSettings]);

	useEffect(() => {
		let cancelled = false;

		void window.electronAPI.getAppVersion().then((version) => {
			if (!cancelled) {
				setAppVersion(version);
			}
		});

		void window.electronAPI.getAutoUpdateStatus().then((status) => {
			if (!cancelled) {
				setAutoUpdateStatus(status);
			}
		});

		const unsubscribe = window.electronAPI.onAutoUpdateStatus?.((status) => {
			if (!cancelled) {
				setAutoUpdateStatus(status);
			}
		});

		return () => {
			cancelled = true;
			unsubscribe?.();
		};
	}, []);

	useEffect(() => {
		if (!showPermissions) {
			return;
		}

		const handleWindowFocus = () => {
			void refreshPermissionsAndSettings();
		};

		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				void refreshPermissionsAndSettings();
			}
		};

		window.addEventListener("focus", handleWindowFocus);
		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			window.removeEventListener("focus", handleWindowFocus);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [refreshPermissionsAndSettings, showPermissions]);

	const schedulePermissionResync = useCallback(() => {
		let attempts = 0;
		const maxAttempts = 12;

		const tick = () => {
			attempts += 1;
			void refreshPermissionsAndSettings();
			if (attempts < maxAttempts) {
				window.setTimeout(tick, 1000);
			}
		};

		window.setTimeout(tick, 350);
	}, [refreshPermissionsAndSettings]);

	const handleCountdownChange = useCallback(
		async (delay: number) => {
			setCountdownDelay(delay);
			try {
				const result = await window.electronAPI.setCountdownDelay(delay);
				if (!result.success) {
					throw new Error(result.error || "Failed to save countdown delay");
				}
			} catch (error) {
				toast.error(String(error));
				void loadBaseSettings();
			}
		},
		[loadBaseSettings],
	);

	const handleChooseRecordingsDirectory = useCallback(async () => {
		try {
			const result = await window.electronAPI.chooseRecordingsDirectory();
			if (!result.canceled && result.success && result.path) {
				setRecordingsDirectory(result.path);
				setIsDefaultRecordingsDirectory(Boolean(result.isDefault));
				toast.success(tSettings("export.recordingsFolderUpdated"));
			}
		} catch (error) {
			toast.error(String(error));
		}
	}, [tSettings]);

	const handleOpenRecordingsFolder = useCallback(async () => {
		try {
			const result = await window.electronAPI.openRecordingsFolder();
			if (!result.success) {
				throw new Error(result.error || result.message || "Failed to open recordings folder");
			}
		} catch (error) {
			toast.error(String(error));
		}
	}, []);

	const handleHudCaptureProtectionChange = useCallback(async (checked: boolean) => {
		setHideHudFromCapture(checked);
		try {
			const result = await window.electronAPI.setHudOverlayCaptureProtection(checked);
			if (!result.success) {
				throw new Error("Failed to update HUD capture setting");
			}
			setHideHudFromCapture(result.enabled);
		} catch (error) {
			console.error("Failed to update HUD capture protection:", error);
			toast.error(String(error));
			setHideHudFromCapture(!checked);
		}
	}, []);

	const screenPermissionGranted = screenPermissionStatus === "granted";
	const screenPermissionLabel =
		screenPermissionStatus === "unknown"
			? tSettings("preferences.status.unknown")
			: screenPermissionGranted
				? tSettings("preferences.status.granted")
				: tSettings("preferences.status.notGranted");

	const accessibilityGranted = accessibilityTrusted === true;
	const accessibilityLabel =
		accessibilityTrusted === null
			? tSettings("preferences.status.unknown")
			: accessibilityGranted
				? tSettings("preferences.status.granted")
				: tSettings("preferences.status.notGranted");

	const fixedShortcutRows = useMemo(() => {
		return FIXED_SHORTCUTS.map((shortcut) => {
			if (shortcut.labelKey === "actions.panTimeline") {
				return { label: tShortcuts(shortcut.labelKey), value: scrollLabels.pan };
			}

			if (shortcut.labelKey === "actions.zoomTimeline") {
				return { label: tShortcuts(shortcut.labelKey), value: scrollLabels.zoom };
			}

			return { label: tShortcuts(shortcut.labelKey), value: shortcut.display };
		});
	}, [scrollLabels.pan, scrollLabels.zoom, tShortcuts]);

	const autoUpdateStatusLabel = useMemo(() => {
		switch (autoUpdateStatus.status) {
			case "checking":
				return tSettings("preferences.updates.status.checking");
			case "available":
				return tSettings("preferences.updates.status.available", undefined, {
					version: autoUpdateStatus.version ?? "",
				});
			case "downloading":
				return tSettings("preferences.updates.status.downloading", undefined, {
					progress: Math.round(autoUpdateStatus.progressPercent ?? 0),
				});
			case "downloaded":
				return tSettings("preferences.updates.status.downloaded");
			case "up-to-date":
				return tSettings("preferences.updates.status.upToDate");
			case "error":
				return tSettings("preferences.updates.status.error", undefined, {
					error: autoUpdateStatus.message ?? "",
				});
			case "not-supported":
				return tSettings("preferences.updates.status.notSupported");
			default:
				return tSettings("preferences.updates.status.idle");
		}
	}, [autoUpdateStatus, tSettings]);

	return (
		<div className="min-h-screen bg-[#09090b] text-white">
			<div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-8 md:px-8">
				<header className="border-b border-white/10 pb-6">
					<div className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-blue-400">
						{t("common.app.name", "ScreenCraft")}
					</div>
					<h1 className="text-3xl font-semibold tracking-tight">
						{tSettings("preferences.title")}
					</h1>
					<p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
						{tSettings("preferences.subtitle")}
					</p>
					<p className="mt-3 text-xs text-slate-500">
						{tSettings("preferences.savedAutomatically")}
					</p>
				</header>

				<div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
					<div className="space-y-6">
						<SectionCard
							icon={<SlidersHorizontal className="h-5 w-5" />}
							title={tSettings("preferences.sections.general")}
							description={tSettings("preferences.generalDescription")}
						>
							<div className="space-y-6">
								<div className="space-y-3">
									<div>
										<p className="text-sm font-medium text-slate-100">
											{tSettings("preferences.language")}
										</p>
										<p className="mt-1 text-sm text-slate-400">
											{tSettings("preferences.languageDescription")}
										</p>
									</div>
									<div className="grid gap-2 sm:grid-cols-2">
										{Object.entries(LOCALE_OPTIONS).map(([code, option]) => (
											<OptionButton
												key={code}
												active={locale === code}
												onClick={() => setLocale(code as AppLocale)}
											>
												<div className="flex items-center justify-between gap-3">
													<div className="flex items-center gap-2">
														<Languages className="h-4 w-4 text-slate-500" />
														<span>{option.nativeLabel}</span>
													</div>
													<span className="text-xs uppercase tracking-[0.16em] text-slate-500">
														{option.shortLabel}
													</span>
												</div>
											</OptionButton>
										))}
									</div>
								</div>

								<div className="space-y-3 border-t border-white/10 pt-6">
									<div>
										<p className="text-sm font-medium text-slate-100">
											{tLaunch("recording.countdownDelay")}
										</p>
										<p className="mt-1 text-sm text-slate-400">
											{tSettings("preferences.countdownDescription")}
										</p>
									</div>
									<div className="grid gap-2 sm:grid-cols-4">
										{COUNTDOWN_OPTIONS.map((delay) => (
											<OptionButton
												key={delay}
												active={countdownDelay === delay}
												onClick={() => void handleCountdownChange(delay)}
											>
												<div className="flex items-center gap-2">
													<TimerReset className="h-4 w-4 text-slate-500" />
													<span>{delay === 0 ? tLaunch("recording.noDelay") : `${delay}s`}</span>
												</div>
											</OptionButton>
										))}
									</div>
								</div>
							</div>
						</SectionCard>

						<SectionCard
							icon={<FolderOpen className="h-5 w-5" />}
							title={tSettings("preferences.sections.recordings")}
							description={tSettings("preferences.recordingsDescription")}
						>
							<div className="space-y-4">
								<div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
									<div className="flex items-center justify-between gap-3">
										<div className="min-w-0">
											<p className="text-sm font-medium text-slate-100">
												{tSettings("export.recordingsFolder")}
											</p>
											<p className="mt-1 truncate text-sm text-slate-400">
												{recordingsDirectory ?? "—"}
											</p>
										</div>
										{isDefaultRecordingsDirectory && (
											<StatusBadge active label={tSettings("preferences.defaultLocation")} />
										)}
									</div>
								</div>

								<div className="flex flex-wrap gap-3">
									<Button
										type="button"
										variant="outline"
										className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
										onClick={() => void handleChooseRecordingsDirectory()}
									>
										<FolderOpen className="h-4 w-4" />
										{tSettings("preferences.changeRecordingsFolder")}
									</Button>
									<Button
										type="button"
										variant="ghost"
										className="text-slate-300 hover:bg-white/10 hover:text-white"
										onClick={() => void handleOpenRecordingsFolder()}
									>
										{tSettings("preferences.openRecordingsFolder")}
									</Button>
								</div>
							</div>
						</SectionCard>

						<SectionCard
							icon={<EyeOff className="h-5 w-5" />}
							title={tSettings("preferences.sections.hud")}
							description={tSettings("preferences.hudDescription")}
						>
							<div className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
								<div className="space-y-1">
									<p className="text-sm font-medium text-slate-100">
										{tSettings("preferences.hideHudFromCapture")}
									</p>
									<p className="text-sm leading-6 text-slate-400">
										{tSettings("preferences.hideHudFromCaptureDescription")}
									</p>
								</div>
								<Switch
									checked={hideHudFromCapture}
									onCheckedChange={(checked) => void handleHudCaptureProtectionChange(checked)}
								/>
							</div>
						</SectionCard>
					</div>

					<div className="space-y-6">
						<SectionCard
							icon={<RefreshCw className="h-5 w-5" />}
							title={tSettings("preferences.sections.updates")}
							description={tSettings("preferences.updatesDescription")}
							action={
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="text-slate-300 hover:bg-white/10 hover:text-white"
									onClick={() => void window.electronAPI.checkForUpdates()}
								>
									{tSettings("preferences.updates.checkForUpdates")}
								</Button>
							}
						>
							<div className="space-y-4">
								<div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
									<div className="flex items-center justify-between gap-4">
										<div>
											<p className="text-sm font-medium text-slate-100">
												{tSettings("preferences.updates.currentVersion")}
											</p>
											<p className="mt-1 text-sm text-slate-400">{appVersion || "—"}</p>
										</div>
										<StatusBadge
											active={autoUpdateStatus.status === "up-to-date"}
											label={autoUpdateStatus.status === "up-to-date" ? "Latest" : "Updates"}
										/>
									</div>
								</div>
								<div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
									<p className="text-sm font-medium text-slate-100">
										{tSettings("preferences.updates.updateStatus")}
									</p>
									<p className="mt-1 text-sm leading-6 text-slate-400">{autoUpdateStatusLabel}</p>
								</div>
							</div>
						</SectionCard>

						<SectionCard
							icon={<Keyboard className="h-5 w-5" />}
							title={tSettings("preferences.sections.shortcuts")}
							description={tSettings("preferences.shortcutsDescription")}
						>
							<div className="space-y-6">
								<div className="flex flex-wrap justify-end">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="text-slate-300 hover:bg-white/10 hover:text-white"
										onClick={openConfig}
									>
										{tSettings("preferences.customizeShortcuts")}
									</Button>
								</div>

								<div className="space-y-2">
									<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
										{tSettings("preferences.configurableShortcuts")}
									</p>
									<div className="space-y-2">
										{SHORTCUT_ACTIONS.map((action) => (
											<div
												key={action}
												className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
											>
												<span className="text-sm text-slate-300">
													{tShortcuts(SHORTCUT_LABELS[action])}
												</span>
												<kbd className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-mono text-blue-300">
													{formatBinding(shortcuts[action], isMac)}
												</kbd>
											</div>
										))}
									</div>
								</div>

								<div className="space-y-2 border-t border-white/10 pt-6">
									<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
										{tSettings("preferences.fixedShortcuts")}
									</p>
									<div className="space-y-2">
										{fixedShortcutRows.map((shortcut) => (
											<div
												key={shortcut.label}
												className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
											>
												<span className="text-sm text-slate-400">{shortcut.label}</span>
												<kbd className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-mono text-slate-300">
													{shortcut.value}
												</kbd>
											</div>
										))}
									</div>
								</div>
							</div>
						</SectionCard>

						{showPermissions && (
							<SectionCard
								icon={
									screenPermissionGranted && accessibilityGranted ? (
										<ShieldCheck className="h-5 w-5" />
									) : (
										<ShieldAlert className="h-5 w-5" />
									)
								}
								title={tSettings("preferences.sections.permissions")}
								description={tSettings("preferences.permissionsDescription")}
								action={
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="text-slate-300 hover:bg-white/10 hover:text-white"
										onClick={() => void refreshPermissionsAndSettings()}
									>
										<RefreshCw className="h-4 w-4" />
										{tSettings("preferences.refreshPermissions")}
									</Button>
								}
							>
								<div className="space-y-4">
									<div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
										<div className="flex items-start justify-between gap-4">
											<div className="space-y-1">
												<p className="text-sm font-medium text-slate-100">
													{tSettings("preferences.screenRecordingPermission")}
												</p>
												<p className="text-sm leading-6 text-slate-400">
													{tSettings("preferences.screenRecordingPermissionDescription")}
												</p>
											</div>
											<StatusBadge active={screenPermissionGranted} label={screenPermissionLabel} />
										</div>
										<Button
											type="button"
											variant="ghost"
											className="mt-4 px-0 text-slate-300 hover:bg-transparent hover:text-white"
											onClick={async () => {
												await window.electronAPI.openScreenRecordingPreferences();
												schedulePermissionResync();
											}}
										>
											{tSettings("preferences.openSystemSettings")}
										</Button>
									</div>

									<div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
										<div className="flex items-start justify-between gap-4">
											<div className="space-y-1">
												<p className="text-sm font-medium text-slate-100">
													{tSettings("preferences.accessibilityPermission")}
												</p>
												<p className="text-sm leading-6 text-slate-400">
													{tSettings("preferences.accessibilityPermissionDescription")}
												</p>
											</div>
											<StatusBadge active={accessibilityGranted} label={accessibilityLabel} />
										</div>
										<Button
											type="button"
											variant="ghost"
											className="mt-4 px-0 text-slate-300 hover:bg-transparent hover:text-white"
											onClick={async () => {
												await window.electronAPI.openAccessibilityPreferences();
												schedulePermissionResync();
											}}
										>
											{tSettings("preferences.openSystemSettings")}
										</Button>
									</div>

									<p className="flex items-center gap-2 text-xs text-slate-500">
										<CheckCircle2 className="h-3.5 w-3.5" />
										{tSettings("preferences.permissionRestartHint")}
									</p>
								</div>
							</SectionCard>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
