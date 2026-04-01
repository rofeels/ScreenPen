/**
 * Analyzes audio from a video URL and returns silent segments as time ranges.
 *
 * @param videoUrl  - blob: or file: URL of the video
 * @param options.silenceThresholdDb - RMS level below which a frame is considered silent (default -45 dB)
 * @param options.minSilenceDurationMs - minimum duration to report as a silence segment (default 700 ms)
 * @param options.paddingMs - shrink each silence segment by this amount on each side (default 100 ms)
 * @returns Array of { startMs, endMs } silence segments
 */
export async function detectSilenceSegments(
	videoUrl: string,
	options: {
		silenceThresholdDb?: number;
		minSilenceDurationMs?: number;
		paddingMs?: number;
	} = {},
): Promise<{ startMs: number; endMs: number }[]> {
	const {
		silenceThresholdDb = -45,
		minSilenceDurationMs = 700,
		paddingMs = 100,
	} = options;

	const silenceThresholdLinear = Math.pow(10, silenceThresholdDb / 20);

	// Fetch and decode audio
	const response = await fetch(videoUrl);
	const arrayBuffer = await response.arrayBuffer();

	const audioCtx = new OfflineAudioContext(1, 1, 44100);
	const decoded = await audioCtx.decodeAudioData(arrayBuffer);

	// Mix down to mono
	const sampleRate = decoded.sampleRate;
	const length = decoded.length;
	const monoData = new Float32Array(length);

	for (let c = 0; c < decoded.numberOfChannels; c++) {
		const channelData = decoded.getChannelData(c);
		for (let i = 0; i < length; i++) {
			monoData[i] += channelData[i] / decoded.numberOfChannels;
		}
	}

	// Analyze in ~50ms frames
	const frameSizeSamples = Math.floor(sampleRate * 0.05);
	const segments: { startMs: number; endMs: number }[] = [];

	let silenceStart: number | null = null;

	for (let i = 0; i < length; i += frameSizeSamples) {
		const frameEnd = Math.min(i + frameSizeSamples, length);
		let sumSq = 0;
		for (let j = i; j < frameEnd; j++) {
			sumSq += monoData[j] * monoData[j];
		}
		const rms = Math.sqrt(sumSq / (frameEnd - i));
		const isSilent = rms < silenceThresholdLinear;

		const timeMs = (i / sampleRate) * 1000;

		if (isSilent && silenceStart === null) {
			silenceStart = timeMs;
		} else if (!isSilent && silenceStart !== null) {
			const silenceEnd = timeMs;
			const duration = silenceEnd - silenceStart;
			if (duration >= minSilenceDurationMs) {
				segments.push({
					startMs: Math.round(silenceStart + paddingMs),
					endMs: Math.round(silenceEnd - paddingMs),
				});
			}
			silenceStart = null;
		}
	}

	// Handle trailing silence
	if (silenceStart !== null) {
		const silenceEnd = (length / sampleRate) * 1000;
		const duration = silenceEnd - silenceStart;
		if (duration >= minSilenceDurationMs) {
			segments.push({
				startMs: Math.round(silenceStart + paddingMs),
				endMs: Math.round(silenceEnd - paddingMs),
			});
		}
	}

	return segments;
}
