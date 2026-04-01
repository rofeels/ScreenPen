import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { ImageViewer } from "./ImageViewer";
import { PdfViewer } from "./PdfViewer";
import { PresenterControls } from "./PresenterControls";
import { VideoViewer } from "./VideoViewer";

type MediaType = "pdf" | "image" | "video" | null;

function getMediaType(filePath: string): MediaType {
	const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
	if (ext === "pdf") return "pdf";
	if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "image";
	if (["mp4", "mov", "webm"].includes(ext)) return "video";
	return null;
}

export function MediaPresenterApp() {
	const initialPath = new URLSearchParams(window.location.search).get("filePath");
	const [filePath, setFilePath] = useState<string | null>(
		initialPath ? decodeURIComponent(initialPath) : null,
	);
	const [mediaType, setMediaType] = useState<MediaType>(
		initialPath ? getMediaType(decodeURIComponent(initialPath)) : null,
	);
	const [opacity, setOpacity] = useState(1);
	useEffect(() => {
		const off = window.electronAPI.onMediaPresenterFile((path) => {
			setFilePath(path);
			setMediaType(getMediaType(path));
		});
		const offPpt = window.electronAPI.onMediaPresenterPptWarning(() => {
			toast.warning("PPT/PPTX 파일은 직접 열 수 없습니다. PDF로 변환 후 사용해주세요.");
		});
		return () => {
			off();
			offPpt();
		};
	}, []);

	useEffect(() => {
		window.electronAPI.setMediaPresenterOpacity(opacity);
	}, [opacity]);

	return (
		<div className="relative flex h-screen w-screen flex-col overflow-hidden rounded-xl bg-zinc-900/90 shadow-2xl">
			<Toaster theme="dark" />
			{/* 드래그 핸들 — Electron WebkitAppRegion으로 창 이동 */}
			<div
				className="absolute inset-x-0 top-0 z-20 h-8 cursor-move"
				style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
			/>
			{/* 컨텐츠 영역 */}
			<div className="flex-1 overflow-hidden">
				{!filePath && (
					<div className="flex h-full items-center justify-center text-white/40">
						<p className="text-sm">Cmd+Shift+P로 파일을 열어주세요</p>
					</div>
				)}
				{filePath && mediaType === "pdf" && <PdfViewer filePath={filePath} />}
				{filePath && mediaType === "image" && <ImageViewer filePath={filePath} />}
				{filePath && mediaType === "video" && <VideoViewer filePath={filePath} />}
				{filePath && mediaType === null && (
					<div className="flex h-full items-center justify-center text-white/40">
						<p className="text-sm">지원하지 않는 파일 형식입니다</p>
					</div>
				)}
			</div>
			{/* 컨트롤 */}
			<PresenterControls opacity={opacity} onOpacityChange={setOpacity} />
		</div>
	);
}
