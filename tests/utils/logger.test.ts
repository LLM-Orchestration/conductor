import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type MockInstance,
	vi,
} from "vitest";
import { logEvent, logger } from "../../src/utils/logger";

describe("logger", () => {
	let stdoutSpy: MockInstance;

	beforeEach(() => {
		stdoutSpy = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);
		process.env.GITHUB_RUN_ID = "12345";
		process.env.GITHUB_REPOSITORY = "test/repo";
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should log a structured event to stdout", () => {
		logEvent(
			"LOG_INFO",
			{ message: "test message" },
			{ persona: "test_persona", issue: 42 },
		);

		expect(stdoutSpy).toHaveBeenCalled();
		const output = stdoutSpy.mock.calls[0][0] as string;
		expect(output).toContain("::CONDUCTOR_EVENT::");

		const jsonStr = output.split("::CONDUCTOR_EVENT::")[1];
		const payload = JSON.parse(jsonStr);

		expect(payload.v).toBe(1);
		expect(payload.event).toBe("LOG_INFO");
		expect(payload.data).toEqual({ message: "test message" });
		expect(payload.persona).toBe("test_persona");
		expect(payload.issue).toBe(42);
		expect(payload.run_id).toBe("12345");
		expect(payload.repo).toBe("test/repo");
		expect(payload.ts).toBeDefined();
	});

	it("should use environment variables as fallback", () => {
		process.env.CONDUCTOR_PERSONA = "env_persona";
		process.env.CONDUCTOR_ISSUE = "99";

		logEvent("LOG_INFO", { message: "env test" });

		const output = stdoutSpy.mock.calls[0][0] as string;
		const payload = JSON.parse(output.split("::CONDUCTOR_EVENT::")[1]);

		expect(payload.persona).toBe("env_persona");
		expect(payload.issue).toBe(99);
	});

	it("should use strict defaults when env vars are missing", () => {
		delete process.env.GITHUB_RUN_ID;
		delete process.env.GITHUB_REPOSITORY;
		delete process.env.CONDUCTOR_PERSONA;
		delete process.env.CONDUCTOR_ISSUE;

		logEvent("LOG_INFO", { message: "default test" });

		const output = stdoutSpy.mock.calls[0][0] as string;
		const payload = JSON.parse(output.split("::CONDUCTOR_EVENT::")[1]);

		expect(payload.run_id).toBe("local");
		expect(payload.repo).toBe("local");
		expect(payload.persona).toBe("system");
		expect(payload.issue).toBe(0);
	});

	it("logger.info should log LOG_INFO event", () => {
		logger.info("hello world");
		const output = stdoutSpy.mock.calls[0][0];
		const payload = JSON.parse(output.split("::CONDUCTOR_EVENT::")[1]);
		expect(payload.event).toBe("LOG_INFO");
		expect(payload.data.message).toBe("hello world");
	});

	it("logger.error should log LOG_ERROR event with extra data in details", () => {
		logger.error("oops", { code: 500 });
		const output = stdoutSpy.mock.calls[0][0];
		const payload = JSON.parse(output.split("::CONDUCTOR_EVENT::")[1]);
		expect(payload.event).toBe("LOG_ERROR");
		expect(payload.data.message).toBe("oops");
		expect(payload.data.details).toEqual({ code: 500 });
	});

	it("logger.error should log LOG_ERROR event with error string", () => {
		logger.error("oops", "something failed");
		const output = stdoutSpy.mock.calls[0][0];
		const payload = JSON.parse(output.split("::CONDUCTOR_EVENT::")[1]);
		expect(payload.event).toBe("LOG_ERROR");
		expect(payload.data.message).toBe("oops");
		expect(payload.data.error).toBe("something failed");
	});

	it("logger.stdout should log STDOUT event", () => {
		logger.stdout("some command output");
		const output = stdoutSpy.mock.calls[0][0];
		const payload = JSON.parse(output.split("::CONDUCTOR_EVENT::")[1]);
		expect(payload.event).toBe("STDOUT");
		expect(payload.data.text).toBe("some command output");
	});

	it("should tighten session_end failure data", () => {
		logEvent("session_end", {
			status: "failure",
			exitCode: 1,
			error: "something went wrong",
		});

		const output = stdoutSpy.mock.calls[0][0] as string;
		const payload = JSON.parse(output.split("::CONDUCTOR_EVENT::")[1]);

		expect(payload.data.status).toBe("failure");
		expect(payload.data.error).toBe("something went wrong");
		expect(payload.data.exitCode).toBe(1);
	});

	it("should normalize known GEMINI_EVENT data with defaults", () => {
		logEvent("GEMINI_EVENT", {
			type: "tool_result",
			tool_id: "123",
			status: "success",
			output: "ok",
			timestamp: "now",
		});

		const output = stdoutSpy.mock.calls[0][0] as string;
		const payload = JSON.parse(output.split("::CONDUCTOR_EVENT::")[1]);

		expect(payload.data.type).toBe("tool_result");
		expect(payload.data.error).toBeUndefined(); // Should be absent in success
		expect(payload.data._isMessageBus).toBe(false); // Filled by default false
	});

	it("should preserve Gemini user messages without delta", () => {
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		logEvent("GEMINI_EVENT", {
			type: "message",
			timestamp: "2026-04-24T19:03:04.833Z",
			role: "user",
			content: "Investigate the issue",
		});

		const output = stdoutSpy.mock.calls[0][0] as string;
		const payload = JSON.parse(output.split("::CONDUCTOR_EVENT::")[1]);

		expect(consoleErrorSpy).not.toHaveBeenCalled();
		expect(payload.data).toEqual({
			type: "message",
			timestamp: "2026-04-24T19:03:04.833Z",
			role: "user",
			content: "Investigate the issue",
			delta: false,
			_isMessageBus: false,
		});
	});

	it("should preserve current Gemini tool-calls-update payloads", () => {
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const toolCall = {
			status: "validating",
			request: {
				callId: "g8x1xk14",
				name: "read_file",
				args: { file_path: "DOCUMENTATION_PLAN.md" },
				schedulerId: "root",
			},
			tool: {
				name: "read_file",
				displayName: "ReadFile",
				parameterSchema: { type: "object" },
			},
		};

		logEvent("GEMINI_EVENT", {
			type: "tool-calls-update",
			toolCalls: [toolCall],
			schedulerId: "root",
		});

		const output = stdoutSpy.mock.calls[0][0] as string;
		const payload = JSON.parse(output.split("::CONDUCTOR_EVENT::")[1]);

		expect(consoleErrorSpy).not.toHaveBeenCalled();
		expect(payload.data.type).toBe("tool-calls-update");
		expect(payload.data.toolCalls[0]).toEqual(toolCall);
		expect(payload.data._isMessageBus).toBe(false);
	});

	it("should preserve successful Gemini results without response", () => {
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		logEvent("GEMINI_EVENT", {
			type: "result",
			timestamp: "2026-04-24T19:04:01.977Z",
			status: "success",
			stats: {
				total_tokens: 213764,
				input_tokens: 208748,
				output_tokens: 2056,
				duration_ms: 57218,
				cached: 138120,
				tool_calls: 12,
			},
		});

		const output = stdoutSpy.mock.calls[0][0] as string;
		const payload = JSON.parse(output.split("::CONDUCTOR_EVENT::")[1]);

		expect(consoleErrorSpy).not.toHaveBeenCalled();
		expect(payload.data.response).toBeUndefined();
		expect(payload.data.stats.cached).toBe(138120);
		expect(payload.data.stats.tool_calls).toBe(12);
		expect(payload.data._isMessageBus).toBe(false);
	});

	it("should preserve Codex thread events", () => {
		logEvent("CODEX_EVENT", {
			type: "thread.started",
			thread_id: "thread-123",
		});

		const output = stdoutSpy.mock.calls[0][0] as string;
		const payload = JSON.parse(output.split("::CONDUCTOR_EVENT::")[1]);

		expect(payload.event).toBe("CODEX_EVENT");
		expect(payload.data).toEqual({
			type: "thread.started",
			thread_id: "thread-123",
		});
	});

	it("should preserve Codex item and usage details", () => {
		logEvent("CODEX_EVENT", {
			type: "item.completed",
			item: {
				id: "item-1",
				type: "command_execution",
				status: "completed",
				command: "npm test",
				exit_code: 0,
			},
		});
		logEvent("CODEX_EVENT", {
			type: "turn.completed",
			usage: {
				input_tokens: 100,
				cached_input_tokens: 80,
				output_tokens: 20,
				reasoning_output_tokens: 10,
			},
		});

		const itemPayload = JSON.parse(
			(stdoutSpy.mock.calls[0][0] as string).split("::CONDUCTOR_EVENT::")[1],
		);
		const turnPayload = JSON.parse(
			(stdoutSpy.mock.calls[1][0] as string).split("::CONDUCTOR_EVENT::")[1],
		);

		expect(itemPayload.data.item.command).toBe("npm test");
		expect(itemPayload.data.item.exit_code).toBe(0);
		expect(turnPayload.data.usage.cached_input_tokens).toBe(80);
		expect(turnPayload.data.usage.reasoning_output_tokens).toBe(10);
	});
});
