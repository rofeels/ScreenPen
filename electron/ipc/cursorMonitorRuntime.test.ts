import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { consumeCursorMonitorOutput, createCursorMonitorRuntime } from "./cursorMonitorRuntime";

type FakeProcess = EventEmitter & {
	stdin: { write: ReturnType<typeof vi.fn> };
	stdout: PassThrough;
	kill: ReturnType<typeof vi.fn>;
	once: EventEmitter["once"];
};

function createFakeProcess() {
	const process = new EventEmitter() as FakeProcess;
	process.stdin = { write: vi.fn() };
	process.stdout = new PassThrough();
	process.kill = vi.fn();
	return process;
}

describe("cursorMonitorRuntime", () => {
	it("consumes buffered cursor state lines and preserves remainders", () => {
		expect(consumeCursorMonitorOutput("STATE:arrow", "\nSTATE:text\nSTAT")).toEqual({
			cursorStates: ["arrow", "text"],
			remainder: "STAT",
		});
	});

	it("starts the runtime, emits unique cursor states, and resets on stop", async () => {
		const fakeProcess = createFakeProcess();
		const spawnProcess = vi.fn().mockReturnValue(fakeProcess);
		const detectedStates: string[] = [];
		let currentCursorType: string | undefined;
		const runtime = createCursorMonitorRuntime({
			platform: "darwin",
			resolveHelperPath: vi.fn().mockResolvedValue("/tmp/monitor"),
			getCurrentCursorType: () => currentCursorType as never,
			setCurrentCursorType: (cursorType) => {
				currentCursorType = cursorType;
			},
			onCursorTypeDetected: (cursorType) => {
				detectedStates.push(cursorType);
			},
			spawnProcess: spawnProcess as never,
		});

		await runtime.start();
		fakeProcess.stdout.write("STATE:text\nSTATE:text\nSTATE:pointer\n");

		expect(spawnProcess).toHaveBeenCalledWith("/tmp/monitor", [], {
			stdio: ["pipe", "pipe", "pipe"],
		});
		expect(detectedStates).toEqual(["text", "pointer"]);
		expect(currentCursorType).toBe("pointer");

		runtime.stop();
		expect(fakeProcess.stdin.write).toHaveBeenCalledWith("stop\n");
		expect(fakeProcess.kill).toHaveBeenCalled();
		expect(currentCursorType).toBe("arrow");
	});

	it("returns to arrow when the runtime is unsupported or the helper is unavailable", async () => {
		let currentCursorType: string | undefined = "pointer";
		const runtime = createCursorMonitorRuntime({
			platform: "linux",
			resolveHelperPath: vi.fn().mockResolvedValue(null),
			getCurrentCursorType: () => currentCursorType as never,
			setCurrentCursorType: (cursorType) => {
				currentCursorType = cursorType;
			},
			onCursorTypeDetected: vi.fn(),
		});

		await runtime.start();
		expect(currentCursorType).toBe("arrow");
	});
});
