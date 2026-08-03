import { describe, expect, it } from "vitest";
import { parseLogs } from "../../src/utils/parser";

describe("parseLogs", () => {
	it("should parse conductor events from logs", () => {
		const logs = `
some prefix
2026-04-15T12:00:00Z ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-15T12:00:00Z","event":"session_start","data":{"branch":"main","labels":[]}}
some intermediate log
2026-04-15T12:00:05Z ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-15T12:00:05Z","event":"TASK","data":{"message":"Doing something"}}
some suffix
    `;
		const events = parseLogs(logs);
		expect(events).toHaveLength(2);
		expect(events[0].event).toBe("session_start");
		expect(events[1].event).toBe("TASK");
		expect(events[1].data.message).toBe("Doing something");
	});

	it("should skip invalid JSON", () => {
		const logs = `
2026-04-15T12:00:00Z ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-15T12:00:00Z","event":"session_start","data":{"branch":"main","labels":[]}}
2026-04-15T12:00:05Z ::CONDUCTOR_EVENT:: {invalid json}
2026-04-15T12:00:10Z ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-15T12:00:10Z","event":"session_end","data":{"status":"success"}}
    `;
		const events = parseLogs(logs);
		expect(events).toHaveLength(2);
		expect(events[0].event).toBe("session_start");
		expect(events[1].event).toBe("session_end");
	});

	it("should return empty array if no events found", () => {
		const logs = "some regular logs\nwithout any markers";
		const events = parseLogs(logs);
		expect(events).toEqual([]);
	});

	it("should handle marker appearing multiple times in a line", () => {
		const logs =
			'prefix ::CONDUCTOR_EVENT:: ignored ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-15T12:00:00Z","event":"GEMINI_EVENT","data":{"type":"init","session_id":"s1","model":"m1","timestamp":"t1"}}';
		const events = parseLogs(logs);
		expect(events).toHaveLength(1);
		expect(events[0].event).toBe("GEMINI_EVENT");
		expect(events[0].data.type).toBe("init");
	});

	it("should handle partial lines silently", () => {
		const logs = `
2026-04-15T12:00:00Z ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-15T12:00:00Z","event":"session_start","data":{"branch":"main","labels":[]}}
2026-04-15T12:00:05Z ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-15T12:0
2026-04-15T12:00:10Z ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-15T12:00:10Z","event":"session_end","data":{"status":"success"}}
    `;
		const events = parseLogs(logs);
		expect(events).toHaveLength(2);
		expect(events[0].event).toBe("session_start");
		expect(events[1].event).toBe("session_end");
	});

	it("should parse message bus debug logs", () => {
		const logs = `
[stderr] [MESSAGE_BUS] publish: {"type":"tool-calls-update","toolCalls":[],"schedulerId":"root"}
some other log
[stderr] [MESSAGE_BUS] publish: {"type":"tool-calls-update","toolCalls":[{"id":"call_1","function":{"name":"read_file","arguments":"{}"}}],"schedulerId":"root"}
    `;
		const events = parseLogs(logs);
		expect(events).toHaveLength(2);
		expect(events[0].event).toBe("GEMINI_EVENT");
		expect(events[0].data.type).toBe("tool-calls-update");
		expect(events[0].data._isMessageBus).toBe(true);
		expect(events[1].event).toBe("GEMINI_EVENT");
		expect(events[1].data.toolCalls).toHaveLength(1);
		expect(events[1].data.toolCalls[0].function.name).toBe("read_file");
		expect(events[1].data.toolCalls[0].function.arguments).toBe("{}");
	});

	it("should parse current Gemini stream-json event shapes", () => {
		const logs = `
::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-24T19:03:04.844Z","event":"GEMINI_EVENT","data":{"type":"message","timestamp":"2026-04-24T19:03:04.833Z","role":"user","content":"Investigate the issue"}}
::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-24T19:03:05.000Z","event":"GEMINI_EVENT","data":{"type":"tool-calls-update","toolCalls":[{"status":"validating","request":{"callId":"g8x1xk14","name":"read_file","args":{"file_path":"DOCUMENTATION_PLAN.md"},"schedulerId":"root"},"tool":{"name":"read_file","displayName":"ReadFile","parameterSchema":{"type":"object"}}}],"schedulerId":"root"}}
::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-24T19:04:01.977Z","event":"GEMINI_EVENT","data":{"type":"result","timestamp":"2026-04-24T19:04:01.977Z","status":"success","stats":{"total_tokens":213764,"input_tokens":208748,"output_tokens":2056,"duration_ms":57218,"cached":138120,"tool_calls":12}}}
    `;

		const events = parseLogs(logs);

		expect(events).toHaveLength(3);
		expect(events[0].data).toMatchObject({
			type: "message",
			role: "user",
			content: "Investigate the issue",
			delta: false,
			_isMessageBus: false,
		});
		expect(events[1].data.toolCalls[0].request.name).toBe("read_file");
		expect(events[2].data.response).toBeUndefined();
		expect(events[2].data.stats.cached).toBe(138120);
	});

	it("should parse current Codex JSONL event shapes", () => {
		const logs = `
::CONDUCTOR_EVENT::{"v":1,"ts":"2026-08-03T12:00:00.000Z","event":"CODEX_EVENT","data":{"type":"thread.started","thread_id":"thread-123"}}
::CONDUCTOR_EVENT::{"v":1,"ts":"2026-08-03T12:00:01.000Z","event":"CODEX_EVENT","data":{"type":"item.completed","item":{"id":"item-1","type":"agent_message","text":"Implemented the change."}}}
::CONDUCTOR_EVENT::{"v":1,"ts":"2026-08-03T12:00:02.000Z","event":"CODEX_EVENT","data":{"type":"turn.completed","usage":{"input_tokens":100,"cached_input_tokens":80,"output_tokens":20,"reasoning_output_tokens":10}}}
    `;

		const events = parseLogs(logs);

		expect(events).toHaveLength(3);
		expect(events[0].event).toBe("CODEX_EVENT");
		expect(events[0].data.thread_id).toBe("thread-123");
		expect(events[1].data.item.text).toBe("Implemented the change.");
		expect(events[2].data.usage.cached_input_tokens).toBe(80);
	});
});
