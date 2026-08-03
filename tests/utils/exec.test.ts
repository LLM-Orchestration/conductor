import fs from "node:fs";

import { describe, expect, it, vi } from "vitest";
import {
	createLineForwarder,
	formatStreamChunk,
	runStreamingCommand,
} from "../../src/utils/exec";
import * as loggerModule from "../../src/utils/logger";

describe("exec utility", () => {
	describe("formatStreamChunk", () => {
		it("should prefix stderr chunks", () => {
			expect(formatStreamChunk("hello\n", "stderr")).toBe("[stderr] hello\n");
		});

		it("should not prefix stdout chunks", () => {
			expect(formatStreamChunk("hello\n", "stdout")).toBe("hello\n");
		});
	});

	describe("createLineForwarder", () => {
		it("should buffer and flush lines correctly", () => {
			const onChunk = vi.fn();
			const forwarder = createLineForwarder("stdout", onChunk);

			forwarder.push("hello");
			expect(onChunk).not.toHaveBeenCalled();

			forwarder.push(" world\n");
			expect(onChunk).toHaveBeenCalledWith(
				"hello world\n",
				"hello world\n",
				"stdout",
			);

			forwarder.push("part of a line");
			forwarder.flush();
			expect(onChunk).toHaveBeenCalledWith(
				"part of a line",
				"part of a line",
				"stdout",
			);
		});

		it("should handle multiple lines in one push", () => {
			const onChunk = vi.fn();
			const forwarder = createLineForwarder("stdout", onChunk);

			forwarder.push("line1\nline2\n");
			expect(onChunk).toHaveBeenCalledTimes(2);
			expect(onChunk).toHaveBeenNthCalledWith(
				1,
				"line1\n",
				"line1\n",
				"stdout",
			);
			expect(onChunk).toHaveBeenNthCalledWith(
				2,
				"line2\n",
				"line2\n",
				"stdout",
			);
		});
	});

	describe("runStreamingCommand", () => {
		it("should capture stdout", async () => {
			const result = await runStreamingCommand("echo", ["hello"], process.env);
			expect(result.status).toBe(0);
			expect(result.stdout).toBe("hello\n");
		});

		it("should capture stderr", async () => {
			// Use a shell to redirect to stderr
			const result = await runStreamingCommand(
				"sh",
				["-c", "echo error >&2"],
				process.env,
			);
			expect(result.status).toBe(0);
			expect(result.stderr).toBe("error\n");
		});

		it("should capture non-zero exit code", async () => {
			const result = await runStreamingCommand("false", [], process.env);
			expect(result.status).toBe(1);
		});

		it("should support custom cwd", async () => {
			const result = await runStreamingCommand("pwd", [], process.env, "/tmp");
			expect(result.status).toBe(0);
			expect(fs.realpathSync(result.stdout.trim())).toBe(
				fs.realpathSync("/tmp"),
			);
		});

		it("should emit Codex JSONL events from stdout", async () => {
			const logEventSpy = vi.spyOn(loggerModule, "logEvent");
			const msg = '{"type":"thread.started","thread_id":"thread-123"}';
			const result = await runStreamingCommand(
				"sh",
				["-c", `echo '${msg}'`],
				process.env,
			);

			expect(result.status).toBe(0);
			expect(logEventSpy).toHaveBeenCalledWith("CODEX_EVENT", {
				type: "thread.started",
				thread_id: "thread-123",
			});
			expect(logEventSpy).not.toHaveBeenCalledWith("STDOUT", expect.anything());
		});

		it("should allow callers to identify historical Gemini streams", async () => {
			const logEventSpy = vi.spyOn(loggerModule, "logEvent");
			const msg = '{"type":"message","role":"assistant","content":"hi"}';
			const result = await runStreamingCommand(
				"sh",
				["-c", `echo '${msg}'`],
				process.env,
				undefined,
				"GEMINI_EVENT",
			);

			expect(result.status).toBe(0);
			expect(logEventSpy).toHaveBeenCalledWith("GEMINI_EVENT", {
				type: "message",
				role: "assistant",
				content: "hi",
			});
		});

		it("should preserve stderr instead of interpreting it as JSONL", async () => {
			const logEventSpy = vi.spyOn(loggerModule, "logEvent");
			const stderrSpy = vi.spyOn(loggerModule.logger, "stderr");
			logEventSpy.mockClear();
			stderrSpy.mockClear();
			const msg = '{"type":"error","message":"diagnostic"}';
			const result = await runStreamingCommand(
				"sh",
				["-c", `echo '${msg}' >&2`],
				process.env,
			);

			expect(result.status).toBe(0);
			expect(logEventSpy).not.toHaveBeenCalledWith(
				"CODEX_EVENT",
				expect.anything(),
			);
			expect(stderrSpy).toHaveBeenCalledWith(`[stderr] ${msg}\n`);
		});
	});
});
