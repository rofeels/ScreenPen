import {
	AppWindow,
	ChevronUp,
	Eye,
	EyeOff,
	FolderOpen,
	Languages,
	Mic,
	MicOff,
	Minus,
	Monitor,
	MoreVertical,
	Pause,
	Pipette,
	Play,
	Settings2,
	Square,
	Timer,
	Video,
	VideoIcon,
	VideoOff,
	Volume2,
	VolumeX,
	X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { RxDragHandleDots2 } from "react-icons/rx";
import { useI18n } from "@/contexts/I18nContext";
import type { AppLocale } from "@/i18n/config";
import { LOCALE_OPTIONS, SUPPORTED_LOCALES } from "@/i18n/config";
import { useScopedT } from "../../contexts/I18nContext";
import { useAudioLevelMeter } from "../../hooks/useAudioLevelMeter";
import { useMicrophoneDevices } from "../../hooks/useMicrophoneDevices";
import { useScreenRecorder } from "../../hooks/useScreenRecorder";
import { useVideoDevices } from "../../hooks/useVideoDevices";
import { toast } from "sonner";
import { AudioLevelMeter } from "../ui/audio-level-meter";
import { ContentClamp } from "../ui/content-clamp";
import { loadEditorPreferences, saveEditorPreferences } from "../video-editor/editorPreferences";
import { DEFAULT_CHROMA_KEY } from "../video-editor/types";
import Block from "@uiw/react-color-block";
import styles from "./LaunchWindow.module.css";

interface DesktopSource {
	id: string;
	name: string;
	thumbnail: string | null;
	display_id: string;
	appIcon: string | null;
	displayOrder?: number;
	displayLabel?: string;
	displayResolution?: string;
	sourceType?: "screen" | "window";
	appName?: string;
	windowTitle?: string;
}

const COUNTDOWN_OPTIONS = [0, 3, 5, 10];

function IconButton({
	onClick,
	title,
	className = "",
	children,
}: {
	onClick?: () => void;
	title?: string;
	className?: string;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			className={`${styles.ib} ${styles.electronNoDrag} ${className}`}
			onClick={onClick}
			title={title}
		>
			{children}
		</button>
	);
}

function DropdownItem({
	onClick,
	onMouseEnter,
	selected,
	icon,
	children,
	trailing,
}: {
	onClick: () => void;
	onMouseEnter?: () => void;
	selected?: boolean;
	icon: ReactNode;
	children: ReactNode;
	trailing?: ReactNode;
}) {
	return (
		<button
			type="button"
			className={`${styles.ddItem} ${selected ? styles.ddItemSelected : ""}`}
			onClick={onClick}
			onMouseEnter={onMouseEnter}
		>
			<span className="shrink-0">{icon}</span>
			<span className="truncate">{children}</span>
			{trailing}
		</button>
	);
}

function Separator() {
	return <div className={styles.sep} />;
}

function MicDeviceRow({
	device,
	selected,
	onSelect,
}: {
	device: { deviceId: string; label: string };
	selected: boolean;
	onSelect: () => void;
}) {
	const { level } = useAudioLevelMeter({
		enabled: true,
		deviceId: device.deviceId,
	});

	return (
		<button
			type="button"
			className={`${styles.ddItem} ${selected ? styles.ddItemSelected : ""}`}
			onClick={onSelect}
		>
			<span className="shrink-0">{selected ? <Mic size={16} /> : <MicOff size={16} />}</span>
			<span className="truncate flex-1">{device.label}</span>
			<AudioLevelMeter level={level} className="w-16 shrink-0" />
		</button>
	);
}

export function LaunchWindow() {
	const { locale, setLocale } = useI18n();
	const t = useScopedT("launch");
	const tSettings = useScopedT("settings");

	const {
		recording,
		paused,
		countdownActive,
		toggleRecording,
		pauseRecording,
		resumeRecording,
		cancelRecording,
		microphoneEnabled,
		setMicrophoneEnabled,
		microphoneDeviceId,
		setMicrophoneDeviceId,
		systemAudioEnabled,
		setSystemAudioEnabled,
		webcamEnabled,
		setWebcamEnabled,
		webcamDeviceId,
		setWebcamDeviceId,
		countdownDelay,
		setCountdownDelay,
	} = useScreenRecorder();

	const [recordingStart, setRecordingStart] = useState<number | null>(null);
	const [elapsed, setElapsed] = useState(0);
	const [pausedAt, setPausedAt] = useState<number | null>(null);
	const [pausedTotal, setPausedTotal] = useState(0);
	const [selectedSource, setSelectedSource] = useState("");
	const [hasSelectedSource, setHasSelectedSource] = useState(false);
	const [, setRecordingsDirectory] = useState<string | null>(null);
	const [activeDropdown, setActiveDropdown] = useState<
		"none" | "sources" | "more" | "mic" | "countdown" | "webcam"
	>("none");
	const [sources, setSources] = useState<DesktopSource[]>([]);
	const [sourcesLoading, setSourcesLoading] = useState(false);
	const [hideHudFromCapture, setHideHudFromCapture] = useState(true);
	const [platform, setPlatform] = useState<string | null>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const webcamPreviewRef = useRef<HTMLVideoElement | null>(null);
	const webcamPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
	const webcamPreviewChromaRafRef = useRef<number | null>(null);
	const [webcamPreviewSize, setWebcamPreviewSize] = useState<number>(() => {
		try {
			const stored = globalThis.localStorage?.getItem("recordly.webcam.previewSize");
			const parsed = stored ? Number(stored) : NaN;
			return Number.isFinite(parsed) && parsed >= 80 && parsed <= 260 ? parsed : 160;
		} catch {
			return 160;
		}
	});

	const [chromaKey, setChromaKey] = useState(() => {
		const prefs = loadEditorPreferences();
		return prefs.webcam?.chromaKey ?? DEFAULT_CHROMA_KEY;
	});

	const updateChromaKey = useCallback((patch: Partial<typeof DEFAULT_CHROMA_KEY>) => {
		setChromaKey((prev) => {
			const next = { ...prev, ...patch };
			const prefs = loadEditorPreferences();
			saveEditorPreferences({ webcam: { ...prefs.webcam, chromaKey: next } });
			return next;
		});
	}, []);

	const [eyedropperActive, setEyedropperActive] = useState(false);

	const micDropdownOpen = activeDropdown === "mic";
	const webcamDropdownOpen = activeDropdown === "webcam";
	const showWebcamControls = webcamEnabled && !recording;
	const { devices, selectedDeviceId, setSelectedDeviceId } = useMicrophoneDevices(
		microphoneEnabled || micDropdownOpen,
	);
	const {
		devices: videoDevices,
		selectedDeviceId: selectedVideoDeviceId,
		setSelectedDeviceId: setSelectedVideoDeviceId,
	} = useVideoDevices(webcamEnabled || webcamDropdownOpen);

	const supportsHudCaptureProtection = platform !== "linux";
	const selectedSourceLabel = hasSelectedSource ? selectedSource : t("recording.screens");

	useEffect(() => {
		if (selectedDeviceId && selectedDeviceId !== "default") {
			setMicrophoneDeviceId(selectedDeviceId);
		}
	}, [selectedDeviceId, setMicrophoneDeviceId]);

	useEffect(() => {
		if (selectedVideoDeviceId && selectedVideoDeviceId !== "default") {
			setWebcamDeviceId(selectedVideoDeviceId);
		}
	}, [selectedVideoDeviceId, setWebcamDeviceId]);

	useEffect(() => {
		let mounted = true;
		let previewStream: MediaStream | null = null;

		const startPreview = async () => {
			if (!showWebcamControls || !webcamPreviewRef.current) {
				return;
			}

			try {
				previewStream = await navigator.mediaDevices.getUserMedia({
					video: webcamDeviceId
						? {
								deviceId: { exact: webcamDeviceId },
								width: { ideal: 320 },
								height: { ideal: 320 },
								frameRate: { ideal: 24, max: 30 },
							}
						: {
								width: { ideal: 320 },
								height: { ideal: 320 },
								frameRate: { ideal: 24, max: 30 },
							},
					audio: false,
				});

				if (!mounted || !webcamPreviewRef.current) {
					previewStream.getTracks().forEach((track) => track.stop());
					return;
				}

				webcamPreviewRef.current.srcObject = previewStream;
				const playPromise = webcamPreviewRef.current.play();
				if (playPromise) {
					playPromise.catch(() => {
						// Ignore transient autoplay race conditions for the preview element.
					});
				}
			} catch (error) {
				console.warn("Failed to start live webcam preview:", error);
			}
		};

		void startPreview();

		return () => {
			mounted = false;
			if (webcamPreviewRef.current) {
				webcamPreviewRef.current.pause();
				webcamPreviewRef.current.srcObject = null;
			}
			previewStream?.getTracks().forEach((track) => track.stop());
		};
	}, [showWebcamControls, webcamDeviceId]);

	useEffect(() => {
		const video = webcamPreviewRef.current;
		const canvas = webcamPreviewCanvasRef.current;
		if (!canvas || !video || !showWebcamControls) {
			if (webcamPreviewChromaRafRef.current) {
				cancelAnimationFrame(webcamPreviewChromaRafRef.current);
				webcamPreviewChromaRafRef.current = null;
			}
			return;
		}

		if (!chromaKey?.enabled) {
			if (webcamPreviewChromaRafRef.current) {
				cancelAnimationFrame(webcamPreviewChromaRafRef.current);
				webcamPreviewChromaRafRef.current = null;
			}
			return;
		}

		const ctx = canvas.getContext("2d", { willReadFrequently: true });
		if (!ctx) return;

		const hex = chromaKey.color.replace("#", "");
		const kr = parseInt(hex.slice(0, 2), 16) / 255;
		const kg = parseInt(hex.slice(2, 4), 16) / 255;
		const kb = parseInt(hex.slice(4, 6), 16) / 255;
		const toHsv = (r: number, g: number, b: number): [number, number, number] => {
			const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
			const s = max === 0 ? 0 : d / max;
			let h = 0;
			if (d > 0) {
				if (max === r) h = ((g - b) / d + 6) % 6;
				else if (max === g) h = (b - r) / d + 2;
				else h = (r - g) / d + 4;
				h /= 6;
			}
			return [h, s, max];
		};
		const [kh, ks] = toHsv(kr, kg, kb);
		const lo = Math.max(0, chromaKey.tolerance - chromaKey.smoothness);
		const hi = chromaKey.tolerance;
		const bgColor = chromaKey.backgroundColor ?? null;
		let bgR = 0, bgG = 0, bgB = 0;
		if (bgColor) {
			const bgHex = bgColor.replace("#", "");
			bgR = parseInt(bgHex.slice(0, 2), 16);
			bgG = parseInt(bgHex.slice(2, 4), 16);
			bgB = parseInt(bgHex.slice(4, 6), 16);
		}

		let lastW = 0;
		let lastH = 0;

		const tick = () => {
			if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
				const vw = video.videoWidth;
				const vh = video.videoHeight;
				if (vw !== lastW || vh !== lastH) {
					canvas.width = vw;
					canvas.height = vh;
					lastW = vw;
					lastH = vh;
				}
				ctx.drawImage(video, 0, 0);
				const imageData = ctx.getImageData(0, 0, vw, vh);
				const data = imageData.data;
				for (let i = 0; i < data.length; i += 4) {
					const r = data[i] / 255;
					const g = data[i + 1] / 255;
					const b = data[i + 2] / 255;
					const [h, s] = toHsv(r, g, b);
					if (s < 0.15 || ks < 0.15) continue;
					let hueDist = Math.abs(h - kh);
					if (hueDist > 0.5) hueDist = 1 - hueDist;
					const dist = hueDist * 1.5 + Math.abs(s - ks) * 1.5;
					let alpha: number;
					if (dist < lo) {
						alpha = 0;
					} else if (dist < hi) {
						alpha = Math.round(((dist - lo) / (hi - lo)) * 255);
					} else {
						alpha = data[i + 3];
					}
					if (bgColor && alpha < 255) {
						const t = alpha / 255;
						data[i] = Math.round(bgR * (1 - t) + data[i] * t);
						data[i + 1] = Math.round(bgG * (1 - t) + data[i + 1] * t);
						data[i + 2] = Math.round(bgB * (1 - t) + data[i + 2] * t);
						data[i + 3] = 255;
					} else {
						data[i + 3] = alpha;
					}
				}
				ctx.putImageData(imageData, 0, 0);
			}
			webcamPreviewChromaRafRef.current = requestAnimationFrame(tick);
		};
		webcamPreviewChromaRafRef.current = requestAnimationFrame(tick);

		return () => {
			if (webcamPreviewChromaRafRef.current) {
				cancelAnimationFrame(webcamPreviewChromaRafRef.current);
				webcamPreviewChromaRafRef.current = null;
			}
		};
	}, [showWebcamControls, webcamDeviceId, chromaKey]);

	useEffect(() => {
		let timer: NodeJS.Timeout | null = null;
		if (recording) {
			if (!recordingStart) {
				setRecordingStart(Date.now());
				setPausedTotal(0);
			}
			if (paused) {
				if (!pausedAt) setPausedAt(Date.now());
				if (timer) clearInterval(timer);
			} else {
				if (pausedAt) {
					setPausedTotal((prev) => prev + (Date.now() - pausedAt));
					setPausedAt(null);
				}
				timer = setInterval(() => {
					if (recordingStart) {
						setElapsed(Math.floor((Date.now() - recordingStart - pausedTotal) / 1000));
					}
				}, 1000);
			}
		} else {
			setRecordingStart(null);
			setElapsed(0);
			setPausedAt(null);
			setPausedTotal(0);
			if (timer) clearInterval(timer);
		}
		return () => {
			if (timer) clearInterval(timer);
		};
	}, [recording, recordingStart, paused, pausedAt, pausedTotal]);

	const formatTime = (seconds: number) => {
		const m = Math.floor(seconds / 60)
			.toString()
			.padStart(2, "0");
		const s = (seconds % 60).toString().padStart(2, "0");
		return `${m}:${s}`;
	};

	useEffect(() => {
		const checkSelectedSource = async () => {
			if (!window.electronAPI) return;
			const source = await window.electronAPI.getSelectedSource();
			if (source) {
				setSelectedSource(source.name);
				setHasSelectedSource(true);
			} else {
				setSelectedSource("");
				setHasSelectedSource(false);
			}
		};
		void checkSelectedSource();
		const interval = setInterval(checkSelectedSource, 500);
		return () => clearInterval(interval);
	}, []);

	useEffect(() => {
		const load = async () => {
			const result = await window.electronAPI.getRecordingsDirectory();
			if (result.success) setRecordingsDirectory(result.path);
		};
		void load();
	}, []);

	useEffect(() => {
		let cancelled = false;
		const loadPlatform = async () => {
			try {
				const nextPlatform = await window.electronAPI.getPlatform();
				if (!cancelled) setPlatform(nextPlatform);
			} catch (error) {
				console.error("Failed to load platform:", error);
			}
		};
		void loadPlatform();
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		let cancelled = false;
		const loadHudCaptureProtection = async () => {
			try {
				const result = await window.electronAPI.getHudOverlayCaptureProtection();
				if (!cancelled && result.success) {
					setHideHudFromCapture(result.enabled);
				}
			} catch (error) {
				console.error("Failed to load HUD capture protection state:", error);
			}
		};
		void loadHudCaptureProtection();
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		const expanded = activeDropdown !== "none";
		window.electronAPI.setHudOverlayExpanded(expanded);

		return () => {
			window.electronAPI.setHudOverlayExpanded(false);
		};
	}, [activeDropdown]);

	useEffect(() => {
		const handleClick = (e: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
				setActiveDropdown("none");
			}
		};
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, []);

	useEffect(() => {
		if (!window.electronAPI?.onChapterMark) return;
		return window.electronAPI.onChapterMark(({ timeMs }) => {
			const totalSec = Math.floor(timeMs / 1000);
			const m = Math.floor(totalSec / 60).toString().padStart(2, "0");
			const s = (totalSec % 60).toString().padStart(2, "0");
			toast.success(`챕터 마크 추가됨 — ${m}:${s}`, { duration: 2000 });
		});
	}, []);


	const fetchSources = useCallback(async () => {
		if (!window.electronAPI) return;
		setSourcesLoading(true);
		try {
			const rawSources = await window.electronAPI.getSources({
				types: ["screen", "window"],
				thumbnailSize: { width: 160, height: 90 },
				fetchWindowIcons: true,
			});
			setSources(
				rawSources.map((s) => {
					const isWindow = s.id.startsWith("window:");
					const type = s.sourceType ?? (isWindow ? "window" : "screen");
					let displayName = s.name;
					let appName = s.appName;
					if (isWindow && !appName && s.name.includes(" — ")) {
						const parts = s.name.split(" — ");
						appName = parts[0]?.trim();
						displayName = parts.slice(1).join(" — ").trim() || s.name;
					} else if (isWindow && s.windowTitle) {
						displayName = s.windowTitle;
					}
					return {
						id: s.id,
						name: displayName,
						thumbnail: s.thumbnail,
						display_id: s.display_id,
						appIcon: s.appIcon,
						displayOrder: s.displayOrder,
						displayLabel: s.displayLabel,
						displayResolution: s.displayResolution,
						sourceType: type,
						appName,
						windowTitle: s.windowTitle ?? displayName,
					};
				}),
			);
		} catch (error) {
			console.error("Failed to fetch sources:", error);
		} finally {
			setSourcesLoading(false);
		}
	}, []);

	const toggleDropdown = (which: "sources" | "more" | "mic" | "countdown" | "webcam") => {
		setActiveDropdown(activeDropdown === which ? "none" : which);
		if (activeDropdown !== which && which === "sources") fetchSources();
	};

	const handleSourceSelect = async (source: DesktopSource) => {
		await window.electronAPI.selectSource(source);
		setSelectedSource(source.displayLabel ?? source.name);
		setHasSelectedSource(true);
		setActiveDropdown("none");
		window.electronAPI.showSourceHighlight?.({
			...source,
			name: source.appName ? `${source.appName} — ${source.name}` : source.name,
			appName: source.appName,
		});
	};

	const previewSource = (source: DesktopSource) => {
		if (source.sourceType !== "screen") {
			return;
		}

		window.electronAPI.showSourceHighlight?.(source);
	};

	const openVideoFile = async () => {
		setActiveDropdown("none");
		const result = await window.electronAPI.openVideoFilePicker();
		if (result.canceled) return;
		if (result.success && result.path) {
			await window.electronAPI.setCurrentVideoPath(result.path);
			await window.electronAPI.switchToEditor();
		}
	};

	const openProjectFile = async () => {
		setActiveDropdown("none");
		const result = await window.electronAPI.loadProjectFile();
		if (result.canceled || !result.success) return;
		await window.electronAPI.switchToEditor();
	};

	const chooseRecordingsDirectory = async () => {
		setActiveDropdown("none");
		const result = await window.electronAPI.chooseRecordingsDirectory();
		if (result.canceled) return;
		if (result.success && result.path) setRecordingsDirectory(result.path);
	};

	const toggleMicrophone = () => {
		if (recording) return;
		toggleDropdown("mic");
	};

	const toggleHudCaptureProtection = async () => {
		const nextValue = !hideHudFromCapture;
		setHideHudFromCapture(nextValue);
		try {
			const result = await window.electronAPI.setHudOverlayCaptureProtection(nextValue);
			if (!result.success) {
				setHideHudFromCapture(!nextValue);
				return;
			}
			setHideHudFromCapture(result.enabled);
		} catch (error) {
			console.error("Failed to update HUD capture protection:", error);
			setHideHudFromCapture(!nextValue);
		}
	};

	const screenSources = sources.filter((s) => s.sourceType === "screen");
	const windowSources = sources.filter((s) => s.sourceType === "window");

	const toggleWebcam = () => {
		if (recording) return;
		toggleDropdown("webcam");
	};

	return (
		<div
			className="w-full flex items-end justify-center bg-transparent overflow-visible pb-5"
			style={{ height: "100vh" }}
			ref={dropdownRef}
		>
			<div className="flex flex-col items-center overflow-visible">
				{/* Only the visible HUD content should become interactive. */}
				<div className={styles.menuArea}>
					{activeDropdown !== "none" && (
						<div className={`${styles.menuCard} ${styles.electronNoDrag}`}>
							{activeDropdown === "sources" && (
								<>
									{sourcesLoading ? (
										<div className="flex items-center justify-center py-6">
											<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#6b6b78]" />
										</div>
									) : (
										<>
											{screenSources.length > 0 && (
												<>
													<div className={styles.ddLabel}>{t("recording.screens")}</div>
													{screenSources.map((source) => (
														<DropdownItem
															key={source.id}
															icon={<Monitor size={16} />}
															selected={selectedSource === (source.displayLabel ?? source.name)}
															onClick={() => handleSourceSelect(source)}
															onMouseEnter={() => previewSource(source)}
														>
															<div className="flex flex-col">
																<span>
																	{typeof source.displayOrder === "number"
																		? `#${source.displayOrder} · ${source.displayLabel ?? source.name}`
																		: (source.displayLabel ?? source.name)}
																</span>
																{source.displayResolution && (
																	<span className="text-[10px] text-zinc-500">
																		{source.displayResolution}
																	</span>
																)}
															</div>
														</DropdownItem>
													))}
												</>
											)}
											{windowSources.length > 0 && (
												<>
													<div
														className={styles.ddLabel}
														style={screenSources.length > 0 ? { marginTop: 4 } : undefined}
													>
														{t("recording.windows")}
													</div>
													{windowSources.map((source) => (
														<DropdownItem
															key={source.id}
															icon={<AppWindow size={16} />}
															selected={selectedSource === source.name}
															onClick={() => handleSourceSelect(source)}
														>
															{source.appName && source.appName !== source.name
																? `${source.appName} — ${source.name}`
																: source.name}
														</DropdownItem>
													))}
												</>
											)}
											{screenSources.length === 0 && windowSources.length === 0 && (
												<div className="text-center text-xs text-[#6b6b78] py-4">
													{t("recording.noSourcesFound")}
												</div>
											)}
										</>
									)}
								</>
							)}

							{activeDropdown === "mic" && (
								<>
									<div className={styles.ddLabel}>{t("recording.microphone")}</div>
									<DropdownItem
										icon={systemAudioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
										selected={systemAudioEnabled}
										onClick={() => {
											setSystemAudioEnabled(!systemAudioEnabled);
										}}
									>
										{systemAudioEnabled
											? t("recording.disableSystemAudio")
											: t("recording.enableSystemAudio")}
									</DropdownItem>
									<Separator />
									{microphoneEnabled && (
										<DropdownItem
											icon={<MicOff size={16} />}
											onClick={() => {
												setMicrophoneEnabled(false);
												setActiveDropdown("none");
											}}
										>
											{t("recording.turnOffMicrophone")}
										</DropdownItem>
									)}
									{!microphoneEnabled && (
										<div className="px-3 py-2 text-xs text-[#6b6b78]">
											{t("recording.selectMicToEnable")}
										</div>
									)}
									{devices.map((device) => (
										<MicDeviceRow
											key={device.deviceId}
											device={device}
											selected={
												microphoneEnabled &&
												(microphoneDeviceId === device.deviceId ||
													selectedDeviceId === device.deviceId)
											}
											onSelect={() => {
												setMicrophoneEnabled(true);
												setSelectedDeviceId(device.deviceId);
												setMicrophoneDeviceId(device.deviceId);
											}}
										/>
									))}
									{devices.length === 0 && (
										<div className="text-center text-xs text-[#6b6b78] py-4">
											{t("recording.noMicrophonesFound")}
										</div>
									)}
								</>
							)}

							{activeDropdown === "webcam" && (
								<>
									<div className={styles.ddLabel}>{t("recording.webcam")}</div>
									{webcamEnabled && (
										<DropdownItem
											icon={<VideoOff size={16} />}
											onClick={() => {
												setWebcamEnabled(false);
												setActiveDropdown("none");
											}}
										>
											{t("recording.turnOffWebcam")}
										</DropdownItem>
									)}
									{!webcamEnabled && (
										<div className="px-3 py-2 text-xs text-[#6b6b78]">
											{t("recording.selectWebcamToEnable")}
										</div>
									)}
									{showWebcamControls && (
										<div className="flex flex-col items-center gap-2 px-3 py-2">
											<div
												className="relative flex-shrink-0 overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10"
												style={{
													width: webcamPreviewSize,
													height: webcamPreviewSize,
													cursor: eyedropperActive ? "crosshair" : undefined,
												}}
												onClick={(e) => {
													if (!eyedropperActive) return;
													const el = e.currentTarget;
													const rect = el.getBoundingClientRect();
													const xRatio = (e.clientX - rect.left) / rect.width;
													const yRatio = (e.clientY - rect.top) / rect.height;
													const srcEl = chromaKey.enabled ? webcamPreviewCanvasRef.current : webcamPreviewRef.current;
													if (!srcEl) return;
													const srcW = chromaKey.enabled ? (srcEl as HTMLCanvasElement).width : (srcEl as HTMLVideoElement).videoWidth;
													const srcH = chromaKey.enabled ? (srcEl as HTMLCanvasElement).height : (srcEl as HTMLVideoElement).videoHeight;
													if (!srcW || !srcH) return;
													// canvas는 scaleX(-1)이므로 x 반전
													const px = Math.floor((1 - xRatio) * srcW);
													const py = Math.floor(yRatio * srcH);
													const tmpCanvas = document.createElement("canvas");
													tmpCanvas.width = srcW;
													tmpCanvas.height = srcH;
													const tmpCtx = tmpCanvas.getContext("2d");
													if (!tmpCtx) return;
													tmpCtx.drawImage(srcEl as CanvasImageSource, 0, 0);
													const pixel = tmpCtx.getImageData(px, py, 1, 1).data;
													const hex = `#${pixel[0].toString(16).padStart(2, "0")}${pixel[1].toString(16).padStart(2, "0")}${pixel[2].toString(16).padStart(2, "0")}`;
													updateChromaKey({ color: hex });
													setEyedropperActive(false);
												}}
											>
												<video
													ref={webcamPreviewRef}
													className="h-full w-full object-cover"
													muted
													playsInline
													style={{
														transform: "scaleX(-1)",
														opacity: chromaKey.enabled ? 0 : undefined,
														position: chromaKey.enabled ? "absolute" : undefined,
														pointerEvents: "none",
													}}
												/>
												{chromaKey.enabled ? (
													<canvas
														ref={webcamPreviewCanvasRef}
														style={{
															position: "absolute",
															inset: 0,
															width: "100%",
															height: "100%",
															transform: "scaleX(-1)",
															pointerEvents: "none",
														}}
													/>
												) : null}
											</div>
											<input
												type="range"
												min={80}
												max={260}
												step={8}
												value={webcamPreviewSize}
												onChange={(e) => {
													const v = Number(e.target.value);
													setWebcamPreviewSize(v);
													try { globalThis.localStorage?.setItem("recordly.webcam.previewSize", String(v)); } catch {}
												}}
												style={{ width: "100%", cursor: "pointer", accentColor: "#2563EB" }}
											/>
											{/* 크로마키 컨트롤 */}
											<div className="w-full border-t border-white/10 pt-2">
												<div className="flex items-center justify-between">
													<span className="text-xs text-slate-300">{tSettings("preferences.webcamChromaKeyTitle")}</span>
													<input
														type="checkbox"
														checked={chromaKey.enabled}
														onChange={(e) => updateChromaKey({ enabled: e.target.checked })}
														style={{ accentColor: "#2563EB", cursor: "pointer" }}
													/>
												</div>
												{chromaKey.enabled && (
													<div className="mt-2 flex flex-col gap-2">
														<div className="flex items-center justify-between">
															<span className="text-xs text-slate-400">{tSettings("preferences.webcamChromaKeyColor")}</span>
															<div className="flex items-center gap-1">
																<button
																	type="button"
																	title="스포이드로 색상 선택"
																	onClick={() => setEyedropperActive((v) => !v)}
																	style={{
																		background: eyedropperActive ? "#2563EB" : "rgba(255,255,255,0.08)",
																		border: "none",
																		borderRadius: 4,
																		padding: "3px 5px",
																		cursor: "pointer",
																		display: "flex",
																		alignItems: "center",
																	}}
																>
																	<Pipette size={13} color={eyedropperActive ? "#fff" : "#94a3b8"} />
																</button>
																<Block
																	color={chromaKey.color}
																	onChange={(c) => updateChromaKey({ color: c.hex })}
																	style={{ boxShadow: "none" }}
																/>
															</div>
														</div>
														<div className="flex items-center justify-between">
															<span className="text-xs text-slate-400">배경색</span>
															<div className="flex items-center gap-2">
																<input
																	type="checkbox"
																	checked={chromaKey.backgroundColor !== null}
																	onChange={(e) => updateChromaKey({ backgroundColor: e.target.checked ? "#ffffff" : null })}
																	style={{ accentColor: "#2563EB", cursor: "pointer" }}
																/>
																{chromaKey.backgroundColor !== null && (
																	<Block
																		color={chromaKey.backgroundColor}
																		onChange={(c) => updateChromaKey({ backgroundColor: c.hex })}
																		style={{ boxShadow: "none" }}
																	/>
																)}
															</div>
														</div>
														<div className="flex flex-col gap-1">
															<div className="flex items-center justify-between">
																<span className="text-xs text-slate-400">{tSettings("preferences.webcamChromaKeyTolerance")}</span>
																<span className="text-xs text-slate-400">{Math.round(chromaKey.tolerance * 100)}%</span>
															</div>
															<input
																type="range"
																min={0}
																max={1}
																step={0.01}
																value={chromaKey.tolerance}
																onChange={(e) => updateChromaKey({ tolerance: Number(e.target.value) })}
																style={{ width: "100%", cursor: "pointer", accentColor: "#2563EB" }}
															/>
														</div>
														<div className="flex flex-col gap-1">
															<div className="flex items-center justify-between">
																<span className="text-xs text-slate-400">{tSettings("preferences.webcamChromaKeySmoothness")}</span>
																<span className="text-xs text-slate-400">{Math.round(chromaKey.smoothness * 100)}%</span>
															</div>
															<input
																type="range"
																min={0}
																max={1}
																step={0.01}
																value={chromaKey.smoothness}
																onChange={(e) => updateChromaKey({ smoothness: Number(e.target.value) })}
																style={{ width: "100%", cursor: "pointer", accentColor: "#2563EB" }}
															/>
														</div>
													</div>
												)}
											</div>
										</div>
									)}
									{videoDevices.map((device) => (
										<DropdownItem
											key={device.deviceId}
											icon={
												webcamEnabled &&
												(webcamDeviceId === device.deviceId ||
													selectedVideoDeviceId === device.deviceId) ? (
													<Video size={16} />
												) : (
													<VideoOff size={16} />
												)
											}
											selected={
												webcamEnabled &&
												(webcamDeviceId === device.deviceId ||
													selectedVideoDeviceId === device.deviceId)
											}
											onClick={() => {
												setWebcamEnabled(true);
												setSelectedVideoDeviceId(device.deviceId);
												setWebcamDeviceId(device.deviceId);
											}}
										>
											{device.label}
										</DropdownItem>
									))}
									{videoDevices.length === 0 && (
										<div className="text-center text-xs text-[#6b6b78] py-4">
											{t("recording.noWebcamsFound")}
										</div>
									)}
								</>
							)}

							{activeDropdown === "countdown" && (
								<>
									<div className={styles.ddLabel}>{t("recording.countdownDelay")}</div>
									{COUNTDOWN_OPTIONS.map((delay) => (
										<DropdownItem
											key={delay}
											icon={<Timer size={16} />}
											selected={countdownDelay === delay}
											onClick={() => {
												setCountdownDelay(delay);
												setActiveDropdown("none");
											}}
										>
											{delay === 0 ? t("recording.noDelay") : `${delay}s`}
										</DropdownItem>
									))}
								</>
							)}

							{activeDropdown === "more" && (
								<>
									{supportsHudCaptureProtection && (
										<DropdownItem
											icon={hideHudFromCapture ? <EyeOff size={16} /> : <Eye size={16} />}
											selected={hideHudFromCapture}
											onClick={() => {
												void toggleHudCaptureProtection();
											}}
										>
											{hideHudFromCapture
												? t("recording.hideHudFromVideo")
												: t("recording.showHudInVideo")}
										</DropdownItem>
									)}
									{supportsHudCaptureProtection && <Separator />}
									<DropdownItem
										icon={<Settings2 size={16} />}
										onClick={() => {
											setActiveDropdown("none");
											void window.electronAPI.openSettingsWindow();
										}}
									>
										{t("recording.settings")}
									</DropdownItem>
									<DropdownItem icon={<FolderOpen size={16} />} onClick={chooseRecordingsDirectory}>
										{t("recording.recordingsFolder")}
									</DropdownItem>
									<DropdownItem icon={<VideoIcon size={16} />} onClick={openVideoFile}>
										{t("recording.openVideoFile")}
									</DropdownItem>
									<DropdownItem icon={<FolderOpen size={16} />} onClick={openProjectFile}>
										{t("recording.openProject")}
									</DropdownItem>
									<div className={styles.ddLabel} style={{ marginTop: 4 }}>
										{t("recording.language")}
									</div>
									{SUPPORTED_LOCALES.map((code) => (
										<DropdownItem
											key={code}
											icon={<Languages size={16} />}
											selected={locale === code}
											onClick={() => {
												setLocale(code as AppLocale);
												setActiveDropdown("none");
											}}
											trailing={
												<span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
													{LOCALE_OPTIONS[code].shortLabel}
												</span>
											}
										>
											{LOCALE_OPTIONS[code].nativeLabel}
										</DropdownItem>
									))}
								</>
							)}
						</div>
					)}
				</div>

				<div className="flex flex-col items-center pointer-events-auto">
					<div className={`${styles.bar} ${styles.electronDrag} mb-2`}>
						<div className={`flex items-center px-0.5 ${styles.electronDrag}`}>
							<RxDragHandleDots2 size={14} className="text-[#6b6b78]" />
						</div>

						{recording ? (
							<>
								<div className="flex items-center gap-[5px]">
									<div
										className={`w-[7px] h-[7px] rounded-full ${paused ? "bg-[#fbbf24]" : `bg-[#f43f5e] ${styles.recDotBlink}`}`}
									/>
									<span
										className={`text-[10px] font-bold tracking-[0.06em] ${paused ? "text-[#fbbf24]" : "text-[#f43f5e]"}`}
									>
										{paused ? t("recording.paused") : t("recording.rec")}
									</span>
								</div>

								<span
									className={`font-mono text-xs font-semibold min-w-[52px] text-center tracking-[0.02em] ${paused ? "text-[#fbbf24]" : "text-[#eeeef2]"}`}
								>
									{formatTime(elapsed)}
								</span>

								<Separator />

								<IconButton
									title={
										microphoneEnabled
											? t("recording.disableMicrophone")
											: t("recording.enableMicrophone")
									}
									className={microphoneEnabled ? styles.ibActive : ""}
								>
									{microphoneEnabled ? <Mic size={18} /> : <MicOff size={18} />}
								</IconButton>

								<Separator />

								<IconButton
									onClick={paused ? resumeRecording : pauseRecording}
									title={paused ? t("recording.resume") : t("recording.pause")}
									className={paused ? styles.ibGreen : ""}
								>
									{paused ? (
										<Play size={18} fill="currentColor" strokeWidth={0} />
									) : (
										<Pause size={18} />
									)}
								</IconButton>

								<IconButton
									onClick={toggleRecording}
									title={t("recording.stop")}
									className={styles.ibRed}
								>
									<Square size={16} fill="currentColor" strokeWidth={0} />
								</IconButton>

								<IconButton
									onClick={() => window.electronAPI?.hudOverlayHide?.()}
									title={t("recording.hideHud")}
								>
									<Minus size={16} />
								</IconButton>

								<IconButton onClick={cancelRecording} title={t("recording.cancel")}>
									<X size={18} />
								</IconButton>
							</>
						) : (
							<>
								<button
									type="button"
									className={`${styles.screenSel} ${styles.electronNoDrag}`}
									onClick={() => toggleDropdown("sources")}
									title={selectedSourceLabel}
								>
									<Monitor size={16} />
									<ContentClamp truncateLength={10}>{selectedSourceLabel}</ContentClamp>
									<ChevronUp
										size={10}
										className={`text-[#6b6b78] ml-0.5 transition-transform duration-200 ${activeDropdown === "sources" ? "" : "rotate-180"}`}
									/>
								</button>

								<Separator />

								<IconButton
									onClick={toggleMicrophone}
									title={
										microphoneEnabled
											? t("recording.disableMicrophone")
											: t("recording.enableMicrophone")
									}
									className={microphoneEnabled ? styles.ibActive : ""}
								>
									{microphoneEnabled ? <Mic size={18} /> : <MicOff size={18} />}
								</IconButton>

								<IconButton
									onClick={toggleWebcam}
									title={webcamEnabled ? t("recording.disableWebcam") : t("recording.enableWebcam")}
									className={webcamEnabled ? styles.ibActive : ""}
								>
									{webcamEnabled ? <Video size={18} /> : <VideoOff size={18} />}
								</IconButton>

								<IconButton
									onClick={() => toggleDropdown("countdown")}
									title={t("recording.countdownDelay")}
									className={countdownDelay > 0 ? styles.ibActive : ""}
								>
									<Timer size={18} />
								</IconButton>

								<Separator />

								<button
									type="button"
									className={`${styles.recBtn} ${styles.electronNoDrag}`}
									onClick={hasSelectedSource ? toggleRecording : () => toggleDropdown("sources")}
									disabled={countdownActive}
									title={t("recording.record")}
								>
									<div className={styles.recDot} />
								</button>

								<Separator />

								<IconButton onClick={() => toggleDropdown("more")} title={t("recording.more")}>
									<MoreVertical size={18} />
								</IconButton>

								<IconButton
									onClick={() => window.electronAPI?.hudOverlayHide?.()}
									title={t("recording.hideHud")}
								>
									<Minus size={16} />
								</IconButton>

								<IconButton
									onClick={() => window.electronAPI?.hudOverlayClose?.()}
									title={t("recording.closeApp")}
								>
									<X size={16} />
								</IconButton>
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
