import type { ConductorEvent } from "../../../src/utils/logger";

export type { ConductorEvent };

export interface CodexUsage {
	input_tokens?: number;
	cached_input_tokens?: number;
	output_tokens?: number;
	reasoning_output_tokens?: number;
	[key: string]: unknown;
}

export interface CodexItem {
	id: string;
	type: string;
	status?: string;
	text?: string;
	command?: string;
	aggregated_output?: string;
	exit_code?: number;
	changes?: Array<Record<string, unknown>>;
	[key: string]: unknown;
}

export interface CodexEventData {
	type: string;
	thread_id?: string;
	item?: CodexItem;
	usage?: CodexUsage;
	error?: unknown;
	message?: string;
	[key: string]: unknown;
}

export interface GeminiStats {
	total_tokens?: number;
	input_tokens?: number;
	output_tokens?: number;
	duration_ms?: number;
	[key: string]: unknown;
}

export interface GeminiEventData {
	type: string;
	_isMessageBus?: boolean;
	role?: string;
	content?: string;
	delta?: boolean;
	timestamp?: string;
	session_id?: string;
	model?: string;
	tool_name?: string;
	tool_id?: string;
	parameters?: Record<string, unknown>;
	status?: string;
	output?: string;
	response?: string;
	error?: string;
	stats?: GeminiStats;
	toolCalls?: Array<Record<string, unknown>>;
	schedulerId?: string;
	method?: string;
	args?: Record<string, unknown>;
	data?: Record<string, unknown>;
	[key: string]: unknown;
}

export interface GeminiInitEvent {
	type: "init";
	session_id: string;
	model: string;
	timestamp: string;
	_isMessageBus: boolean;
}

export interface GeminiMessageEvent {
	type: "message";
	role: "user" | "assistant";
	content: string;
	delta: boolean;
	timestamp: string;
	_isMessageBus: boolean;
}

export type GeminiToolUseEvent = {
	type: "tool_use";
	tool_id: string;
	timestamp: string;
	_isMessageBus: boolean;
	tool_name: string;
	parameters: Record<string, unknown>;
};

export type GeminiToolResultEvent = {
	type: "tool_result";
	tool_id: string;
	output: string;
	timestamp: string;
	_isMessageBus: boolean;
} & ({ status: "success" } | { status: "error"; error: string });

export type GeminiResultEvent = {
	type: "result";
	timestamp: string;
	_isMessageBus: boolean;
} & (
	| {
			status: "success";
			stats?: GeminiStats;
			response?: string;
	  }
	| { status: "error"; error: string }
);

export interface GeminiToolCallsUpdateEvent {
	type: "tool-calls-update";
	toolCalls: Array<Record<string, unknown>>;
	schedulerId: string;
	_isMessageBus: boolean;
}

export interface GeminiCallEvent {
	type: "call";
	method: string;
	args: Record<string, unknown>;
	_isMessageBus: boolean;
}

export interface GeminiContextUpdateEvent {
	type: "context-update";
	data: Record<string, unknown>;
	_isMessageBus: boolean;
}

export type KnownGeminiEventData =
	| GeminiInitEvent
	| GeminiMessageEvent
	| GeminiToolUseEvent
	| GeminiToolResultEvent
	| GeminiResultEvent
	| GeminiToolCallsUpdateEvent
	| GeminiCallEvent
	| GeminiContextUpdateEvent;

export interface WorkflowRun {
	id: number;
	name: string;
	display_title: string;
	status: string;
	conclusion: string | null;
	html_url: string;
	created_at: string;
	updated_at: string;
	head_branch: string;
	head_sha: string;
	pull_requests: {
		number: number;
		html_url: string;
	}[];
}

export interface WorkflowRunsResponse {
	total_count: number;
	workflow_runs: WorkflowRun[];
}

export interface Issue {
	number: number;
	title: string;
	html_url: string;
	labels: { name: string }[];
	pull_request?: {
		html_url: string;
	};
}

export interface WorkflowStep {
	name: string;
	status: string;
	conclusion: string | null;
	number: number;
	started_at: string;
	completed_at: string | null;
}

export interface WorkflowJob {
	id: number;
	run_id: number;
	name: string;
	status: string;
	conclusion: string | null;
	started_at: string;
	completed_at: string | null;
	steps: WorkflowStep[];
	html_url: string;
}
