import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

interface Props {
	filePath: string;
}

export function PdfViewer({ filePath }: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const pdfRef = useRef<PDFDocumentProxy | null>(null);
	const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
	const [currentPage, setCurrentPage] = useState(1);
	const [totalPages, setTotalPages] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setLoading(true);
		setError(null);
		setCurrentPage(1);

		window.electronAPI.readLocalFile(filePath).then((result) => {
			if (!result.success || !result.data) {
				setError("파일을 읽을 수 없습니다.");
				setLoading(false);
				return;
			}

			const loadingTask = pdfjsLib.getDocument({
				data: result.data,
				cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/",
				cMapPacked: true,
			});
			loadingTask.promise
				.then((pdf) => {
					pdfRef.current = pdf;
					setTotalPages(pdf.numPages);
					setLoading(false);
				})
				.catch((err: unknown) => {
					setError(`PDF를 불러올 수 없습니다: ${err instanceof Error ? err.message : String(err)}`);
					setLoading(false);
				});
		});
	}, [filePath]);

	const renderPage = useCallback(async (pageNum: number) => {
		if (!pdfRef.current || !canvasRef.current) return;

		if (renderTaskRef.current) {
			renderTaskRef.current.cancel();
			renderTaskRef.current = null;
		}

		const page = await pdfRef.current.getPage(pageNum);
		const canvas = canvasRef.current;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const container = canvas.parentElement;
		if (!container) return;

		const containerWidth = container.clientWidth || 800;
		const containerHeight = container.clientHeight || 600;
		const viewport = page.getViewport({ scale: 1 });
		const scale = Math.min(containerWidth / viewport.width, containerHeight / viewport.height) * 0.95;
		const scaledViewport = page.getViewport({ scale });

		canvas.width = scaledViewport.width;
		canvas.height = scaledViewport.height;

		const renderTask = page.render({ canvasContext: ctx, viewport: scaledViewport });
		renderTaskRef.current = renderTask;

		try {
			await renderTask.promise;
		} catch {
			// 취소된 경우 무시
		}
	}, []);

	useEffect(() => {
		if (loading || totalPages === 0 || !canvasRef.current) return;

		const container = canvasRef.current.parentElement;
		if (!container) {
			void renderPage(currentPage);
			return;
		}

		if (container.clientWidth > 0) {
			void renderPage(currentPage);
		}

		// 창 크기 변경 시 현재 페이지 재렌더링
		const ro = new ResizeObserver(() => {
			void renderPage(currentPage);
		});
		ro.observe(container);
		return () => ro.disconnect();
	}, [currentPage, loading, totalPages, renderPage]);

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
				setCurrentPage((p) => Math.max(1, p - 1));
			} else if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
				setCurrentPage((p) => Math.min(totalPages, p + 1));
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [totalPages]);

	return (
		<div className="flex h-full flex-col">
			<div className="flex flex-1 items-center justify-center overflow-hidden bg-zinc-800 p-2">
				{loading && <p className="text-sm text-white/50">PDF 불러오는 중...</p>}
				{error && <p className="text-sm text-red-400">{error}</p>}
				{!loading && !error && <canvas ref={canvasRef} className="max-h-full max-w-full shadow-lg" />}
			</div>
			{!loading && !error && totalPages > 1 && (
				<div className="flex items-center justify-center gap-3 border-t border-white/10 bg-zinc-900/80 py-1.5">
					<button
						onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
						disabled={currentPage <= 1}
						className="flex h-6 w-6 items-center justify-center rounded text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30"
					>
						<ChevronLeft size={14} />
					</button>
					<span className="text-xs text-white/60">{currentPage} / {totalPages}</span>
					<button
						onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
						disabled={currentPage >= totalPages}
						className="flex h-6 w-6 items-center justify-center rounded text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30"
					>
						<ChevronRight size={14} />
					</button>
				</div>
			)}
		</div>
	);
}
