import { z } from "zod";

/**
 * Conductor Structured Logging
 *
 * This utility emits structured JSON events to stdout, which can be parsed
 * by the Conductor Observability UI to provide a rich timeline of actions.
 */

const BaseEventSchema = z.object({
	v: z.number(),
	ts: z.string(),
	run_id: z.string(),
	repo: z.string(),
	issue: z.number(),
	persona: z.string(),
});

const ListDirectoryParametersSchema = z
	.object({
		dir_path: z.string(),
		ignore: z.array(z.string()).optional(),
		file_filtering_options: z
			.object({
				respect_git_ignore: z.boolean().optional(),
				respect_gemini_ignore: z.boolean().optional(),
			})
			.optional(),
	})
	.strict();

const ReadFileParametersSchema = z
	.object({
		file_path: z.string(),
		start_line: z.number().optional(),
		end_line: z.number().optional(),
	})
	.strict();

const GrepSearchParametersSchema = z
	.object({
		pattern: z.string(),
		dir_path: z.string().optional(),
		include_pattern: z.string().optional(),
		exclude_pattern: z.string().optional(),
		case_sensitive: z.boolean().optional(),
		fixed_strings: z.boolean().optional(),
		before: z.number().optional(),
		after: z.number().optional(),
		context: z.number().optional(),
		total_max_matches: z.number().optional(),
		max_matches_per_file: z.number().optional(),
		names_only: z.boolean().optional(),
		no_ignore: z.boolean().optional(),
	})
	.strict();

const GlobParametersSchema = z
	.object({
		pattern: z.string(),
		dir_path: z.string().optional(),
		respect_git_ignore: z.boolean().optional(),
		respect_gemini_ignore: z.boolean().optional(),
		case_sensitive: z.boolean().optional(),
	})
	.strict();

const ReplaceParametersSchema = z
	.object({
		file_path: z.string(),
		instruction: z.string(),
		old_string: z.string(),
		new_string: z.string(),
		allow_multiple: z.boolean().optional(),
	})
	.strict();

const WriteFileParametersSchema = z
	.object({
		file_path: z.string(),
		content: z.string(),
	})
	.strict();

const WebFetchParametersSchema = z
	.object({
		prompt: z.string(),
	})
	.strict();

const GoogleWebSearchParametersSchema = z
	.object({
		query: z.string(),
	})
	.strict();

const RunShellCommandParametersSchema = z
	.object({
		command: z.string(),
		description: z.string().optional(),
		dir_path: z.string().optional(),
		is_background: z.boolean().optional(),
		delay_ms: z.number().optional(),
	})
	.strict();

const ListBackgroundProcessesParametersSchema = z
	.object({
		wait_for_previous: z.boolean().optional(),
	})
	.strict();

const ReadBackgroundOutputParametersSchema = z
	.object({
		pid: z.number(),
		lines: z.number().optional(),
		delay_ms: z.number().optional(),
		wait_for_previous: z.boolean().optional(),
	})
	.strict();

const SaveMemoryParametersSchema = z
	.object({
		fact: z.string(),
		scope: z.enum(["global", "project"]).optional(),
	})
	.strict();

const EnterPlanModeParametersSchema = z
	.object({
		reason: z.string().optional(),
	})
	.strict();

const InvokeAgentParametersSchema = z
	.object({
		agent_name: z.string(),
		prompt: z.string(),
		wait_for_previous: z.boolean().optional(),
	})
	.strict();

const ActivateSkillParametersSchema = z
	.object({
		name: z.literal("skill-creator"),
	})
	.strict();

const ToolParametersSchema = z.union([
	ListDirectoryParametersSchema,
	ReadFileParametersSchema,
	GrepSearchParametersSchema,
	GlobParametersSchema,
	ReplaceParametersSchema,
	WriteFileParametersSchema,
	WebFetchParametersSchema,
	GoogleWebSearchParametersSchema,
	RunShellCommandParametersSchema,
	ListBackgroundProcessesParametersSchema,
	ReadBackgroundOutputParametersSchema,
	SaveMemoryParametersSchema,
	EnterPlanModeParametersSchema,
	InvokeAgentParametersSchema,
	ActivateSkillParametersSchema,
	z.record(z.string(), z.unknown()), // Fallback
]);

const GeminiContextUpdateDataSchema = z
	.object({
		memories: z
			.array(z.object({ scope: z.string(), fact: z.string() }))
			.optional(),
		branch: z.string().optional(),
		labels: z.array(z.string()).optional(),
	})
	.passthrough();

const GeminiCallArgsSchema = z
	.object({
		prompt: z.string().optional(),
		agent_name: z.string().optional(),
		wait_for_previous: z.boolean().optional(),
		method: z.string().optional(),
	})
	.passthrough();

const JsonObjectSchema = z.record(z.string(), z.unknown());

const LogEventDataSchema = z.union([
	z.object({ message: z.string() }).strict(),
	z.object({ message: z.string(), error: z.string() }).strict(),
	z.object({ message: z.string(), details: JsonObjectSchema }).strict(),
	z
		.object({
			message: z.string(),
			error: z.string(),
			details: JsonObjectSchema,
		})
		.strict(),
]);

const StdoutStderrDataSchema = z.object({
	text: z.string(),
});

const SessionStartDataSchema = z.object({
	branch: z.string(),
	labels: z.array(z.string()),
});

const SessionEndDataSchema = z.discriminatedUnion("status", [
	z.object({
		status: z.literal("success"),
	}),
	z.object({
		status: z.literal("failure"),
		exitCode: z.number(),
		error: z.string(),
	}),
]);

const GeminiBaseSchema = z
	.object({
		_isMessageBus: z.boolean().default(false),
	})
	.passthrough();

const GeminiInitEventSchema = GeminiBaseSchema.extend({
	type: z.literal("init"),
	session_id: z.string(),
	model: z.string(),
	timestamp: z.string(),
});

const GeminiMessageEventSchema = GeminiBaseSchema.extend({
	type: z.literal("message"),
	role: z.enum(["user", "assistant"]),
	content: z.string(),
	delta: z.boolean().default(false),
	timestamp: z.string(),
});

const GeminiToolUseEventSchema = GeminiBaseSchema.extend({
	type: z.literal("tool_use"),
	tool_name: z.string(),
	tool_id: z.string(),
	parameters: ToolParametersSchema,
	timestamp: z.string(),
});

const GeminiToolResultEventSchema = GeminiBaseSchema.extend({
	type: z.literal("tool_result"),
	tool_id: z.string(),
	output: z.string().optional(),
	timestamp: z.string(),
}).and(
	z.object({
		status: z.string(),
		error: z.string().optional(),
	}),
);

const GeminiResultEventSchema = GeminiBaseSchema.extend({
	type: z.literal("result"),
	timestamp: z.string(),
	status: z.string(),
	stats: z
		.object({
			total_tokens: z.number().optional(),
			input_tokens: z.number().optional(),
			output_tokens: z.number().optional(),
			duration_ms: z.number().optional(),
		})
		.passthrough()
		.optional(),
	response: z.string().optional(),
	error: z.string().optional(),
});

const GeminiToolCallsUpdateEventSchema = GeminiBaseSchema.extend({
	type: z.literal("tool-calls-update"),
	toolCalls: z.array(z.record(z.string(), z.unknown())),
	schedulerId: z.string(),
});

const GeminiCallEventSchema = GeminiBaseSchema.extend({
	type: z.literal("call"),
	method: z.string(),
	args: GeminiCallArgsSchema,
});

const GeminiContextUpdateEventSchema = GeminiBaseSchema.extend({
	type: z.literal("context-update"),
	data: GeminiContextUpdateDataSchema,
});

const RawGeminiEventDataSchema = GeminiBaseSchema.extend({
	type: z.string(),
});

const GeminiEventDataSchema = z.union([
	GeminiInitEventSchema,
	GeminiMessageEventSchema,
	GeminiToolUseEventSchema,
	GeminiToolResultEventSchema,
	GeminiResultEventSchema,
	GeminiToolCallsUpdateEventSchema,
	GeminiCallEventSchema,
	GeminiContextUpdateEventSchema,
	RawGeminiEventDataSchema,
]);

const CodexItemSchema = z
	.object({
		id: z.string(),
		type: z.string(),
		status: z.string().optional(),
	})
	.passthrough();

const CodexThreadStartedEventSchema = z
	.object({
		type: z.literal("thread.started"),
		thread_id: z.string(),
	})
	.passthrough();

const CodexTurnStartedEventSchema = z
	.object({
		type: z.literal("turn.started"),
	})
	.passthrough();

const CodexItemEventSchema = z
	.object({
		type: z.enum(["item.started", "item.updated", "item.completed"]),
		item: CodexItemSchema,
	})
	.passthrough();

const CodexTurnCompletedEventSchema = z
	.object({
		type: z.literal("turn.completed"),
		usage: z
			.object({
				input_tokens: z.number().optional(),
				cached_input_tokens: z.number().optional(),
				output_tokens: z.number().optional(),
				reasoning_output_tokens: z.number().optional(),
			})
			.passthrough()
			.optional(),
	})
	.passthrough();

const CodexTurnFailedEventSchema = z
	.object({
		type: z.literal("turn.failed"),
		error: z.unknown().optional(),
	})
	.passthrough();

const CodexErrorEventSchema = z
	.object({
		type: z.literal("error"),
		message: z.string().optional(),
	})
	.passthrough();

const RawCodexEventDataSchema = z
	.object({
		type: z.string(),
	})
	.passthrough();

const CodexEventDataSchema = z.union([
	CodexThreadStartedEventSchema,
	CodexTurnStartedEventSchema,
	CodexItemEventSchema,
	CodexTurnCompletedEventSchema,
	CodexTurnFailedEventSchema,
	CodexErrorEventSchema,
	RawCodexEventDataSchema,
]);

type BaseEvent = {
	v: number;
	ts: string;
	run_id: string;
	repo: string;
	issue: number;
	persona: string;
};

export type GeminiEventData = z.infer<typeof GeminiEventDataSchema>;
export type CodexEventData = z.infer<typeof CodexEventDataSchema>;

export type ConductorEvent = BaseEvent &
	(
		| { event: "LOG_INFO"; data: z.infer<typeof LogEventDataSchema> }
		| { event: "LOG_WARN"; data: z.infer<typeof LogEventDataSchema> }
		| { event: "LOG_ERROR"; data: z.infer<typeof LogEventDataSchema> }
		| { event: "LOG_DEBUG"; data: z.infer<typeof LogEventDataSchema> }
		| { event: "STDOUT"; data: { text: string } }
		| { event: "STDERR"; data: { text: string } }
		| {
				event: "session_start";
				data: { branch: string; labels: string[] };
		  }
		| {
				event: "session_end";
				data:
					| { status: "success" }
					| {
							status: "failure";
							exitCode: number;
							error: string;
					  };
		  }
		| { event: "GEMINI_EVENT"; data: GeminiEventData }
		| { event: "CODEX_EVENT"; data: CodexEventData }
		| { event: "TASK"; data: { message: string } }
		| { event: "LOG_DEBUG_GROUP"; data: { events: ConductorEvent[] } }
	);

export const ConductorEventSchema: z.ZodType<ConductorEvent> =
	z.discriminatedUnion("event", [
		BaseEventSchema.extend({
			event: z.literal("LOG_INFO"),
			data: LogEventDataSchema,
		}),
		BaseEventSchema.extend({
			event: z.literal("LOG_WARN"),
			data: LogEventDataSchema,
		}),
		BaseEventSchema.extend({
			event: z.literal("LOG_ERROR"),
			data: LogEventDataSchema,
		}),
		BaseEventSchema.extend({
			event: z.literal("LOG_DEBUG"),
			data: LogEventDataSchema,
		}),
		BaseEventSchema.extend({
			event: z.literal("STDOUT"),
			data: StdoutStderrDataSchema,
		}),
		BaseEventSchema.extend({
			event: z.literal("STDERR"),
			data: StdoutStderrDataSchema,
		}),
		BaseEventSchema.extend({
			event: z.literal("session_start"),
			data: SessionStartDataSchema,
		}),
		BaseEventSchema.extend({
			event: z.literal("session_end"),
			data: SessionEndDataSchema,
		}),
		BaseEventSchema.extend({
			event: z.literal("GEMINI_EVENT"),
			data: GeminiEventDataSchema,
		}),
		BaseEventSchema.extend({
			event: z.literal("CODEX_EVENT"),
			data: CodexEventDataSchema,
		}),
		BaseEventSchema.extend({
			event: z.literal("TASK"),
			data: z.object({ message: z.string() }),
		}),
		BaseEventSchema.extend({
			event: z.literal("LOG_DEBUG_GROUP"),
			data: z.object({ events: z.array(z.lazy(() => ConductorEventSchema)) }),
		}),
	]);

/**
 * Logs a structured event to stdout.
 *
 * @param event The event type (e.g., 'session_start', 'session_end')
 * @param data  The event payload
 * @param context Optional context to override default values
 */
export function logEvent(
	event: ConductorEvent["event"],
	data: ConductorEvent["data"],
	context: { persona?: string; issue?: number } = {},
) {
	let finalData = data;
	if (event === "GEMINI_EVENT") {
		const parsed = GeminiEventDataSchema.safeParse(data);
		if (parsed.success) finalData = parsed.data;
	} else if (event === "CODEX_EVENT") {
		const parsed = CodexEventDataSchema.safeParse(data);
		if (parsed.success) finalData = parsed.data;
	} else if (event === "session_end") {
		const parsed = SessionEndDataSchema.safeParse(data);
		if (parsed.success) finalData = parsed.data;
	}

	const payload = {
		v: 1,
		ts: new Date().toISOString(),
		run_id: process.env.GITHUB_RUN_ID || "local",
		repo: process.env.GITHUB_REPOSITORY || "local",
		issue:
			context.issue ||
			(process.env.CONDUCTOR_ISSUE
				? parseInt(process.env.CONDUCTOR_ISSUE, 10)
				: 0),
		persona: context.persona || process.env.CONDUCTOR_PERSONA || "system",
		event,
		data: finalData,
	} as ConductorEvent;

	process.stdout.write(`::CONDUCTOR_EVENT::${JSON.stringify(payload)}\n`);
}

export const logger = {
	info: <T extends Record<string, unknown>>(
		message: string,
		details?: T,
		context?: { persona?: string; issue?: number },
	) =>
		logEvent("LOG_INFO", details ? { message, details } : { message }, context),

	warn: <T extends Record<string, unknown>>(
		message: string,
		details?: T,
		context?: { persona?: string; issue?: number },
	) =>
		logEvent("LOG_WARN", details ? { message, details } : { message }, context),

	error: <T extends Record<string, unknown>>(
		message: string,
		errorOrDetails?: string | T,
		context?: { persona?: string; issue?: number },
	) => {
		if (typeof errorOrDetails === "string") {
			return logEvent("LOG_ERROR", { message, error: errorOrDetails }, context);
		}
		return logEvent(
			"LOG_ERROR",
			errorOrDetails ? { message, details: errorOrDetails } : { message },
			context,
		);
	},

	debug: <T extends Record<string, unknown>>(
		message: string,
		details?: T,
		context?: { persona?: string; issue?: number },
	) =>
		logEvent(
			"LOG_DEBUG",
			details ? { message, details } : { message },
			context,
		),

	stdout: (text: string, context?: { persona?: string; issue?: number }) =>
		logEvent("STDOUT", { text }, context),

	stderr: (text: string, context?: { persona?: string; issue?: number }) =>
		logEvent("STDERR", { text }, context),
};
