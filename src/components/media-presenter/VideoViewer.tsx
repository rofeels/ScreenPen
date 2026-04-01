import { useEffect, useState } from "react";

interface Props {
	filePath: string;
}

export function VideoViewer({ filePath }: Props) {
	const [blobUrl, setBlobUrl] = useState<string | null>(null);

	useEffect(() => {
		let url: string | null = null;
		window.electronAPI.readLocalFile(filePath).then((result) => {
			if (result.success && result.data) {
				const blob = new Blob([result.data.buffer as ArrayBuffer]);
				url = URL.createObjectURL(blob);
				setBlobUrl(url);
			}
		});
		return () => {
			if (url) URL.revokeObjectURL(url);
		};
	}, [filePath]);

	if (!blobUrl) {
		return (
			<div className="flex h-full items-center justify-center text-white/40">
				<p className="text-sm">영상 로딩 중...</p>
			</div>
		);
	}

	return (
		<div className="flex h-full w-full items-center justify-center bg-black p-2">
			<video
				src={blobUrl}
				controls
				autoPlay={false}
				className="max-h-full max-w-full"
			/>
		</div>
	);
}
