import { beforeEach, describe, expect, it, vi } from "vitest";
import { runStreamingCommand } from "../../src/utils/exec";
import { logEvent, logger } from "../../src/utils/logger";

vi.mock("../../src/utils/logger", () => ({
	logEvent: vi.fn(),
	logger: {
		stdout: vi.fn(),
		stderr: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	},
}));

describe("JSON mode and Debug intercept", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should intercept CODEX_EVENT from stdout", async () => {
		// We'll use sh -c to echo a JSON line
		const json = JSON.stringify({
			type: "thread.started",
			thread_id: "123",
		});
		await runStreamingCommand("sh", ["-c", `echo '${json}'`], process.env);

		expect(logEvent).toHaveBeenCalledWith(
			"CODEX_EVENT",
			expect.objectContaining({
				type: "thread.started",
				thread_id: "123",
			}),
		);
		expect(logger.stdout).not.toHaveBeenCalled();
	});

	it("should fallback to regular stdout if not valid JSON or missing type", async () => {
		await runStreamingCommand("sh", ["-c", "echo 'not json'"], process.env);
		expect(logger.stdout).toHaveBeenCalledWith("not json\n");
		expect(logEvent).not.toHaveBeenCalledWith(
			"CODEX_EVENT",
			expect.any(Object),
		);

		vi.clearAllMocks();
		await runStreamingCommand(
			"sh",
			["-c", 'echo "{\\"no\\": \\"type\\"}"'],
			process.env,
		);
		expect(logger.stdout).toHaveBeenCalled();
		expect(logEvent).not.toHaveBeenCalledWith(
			"CODEX_EVENT",
			expect.any(Object),
		);
	});

	it("should fallback to regular stderr for other logs", async () => {
		await runStreamingCommand(
			"sh",
			["-c", 'echo "some error" >&2'],
			process.env,
		);
		expect(logger.stderr).toHaveBeenCalledWith("[stderr] some error\n");
		expect(logEvent).not.toHaveBeenCalledWith("LOG_DEBUG", expect.any(Object));
	});
});
