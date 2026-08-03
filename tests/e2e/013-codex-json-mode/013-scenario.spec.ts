import { expect, test } from "@playwright/test";
import { TestStepHelper } from "../helpers/test-step-helper";

test("Codex JSONL Observability", async ({ page }, testInfo) => {
	const helper = new TestStepHelper(page, testInfo);
	helper.setMetadata(
		"Codex JSONL Observability",
		"Verify that Codex CLI JSONL events are parsed and rendered as a readable workflow timeline.",
	);

	await page.goto("/debug");

	await helper.step("debug_page_loaded", {
		description: "User opens the Conductor log parser",
		verifications: [
			{
				spec: "Debug log input is ready",
				check: async () => {
					await expect(
						page.getByRole("heading", { name: "Conductor Log Parser Debug" }),
					).toBeVisible();
					await expect(page.getByRole("textbox")).toBeVisible();
				},
			},
		],
	});

	const codexEvents = [
		{ type: "thread.started", thread_id: "thread-123" },
		{ type: "turn.started" },
		{
			type: "item.completed",
			item: {
				id: "item-1",
				type: "agent_message",
				text: "## Implementation complete\n\nThe **Codex worker** updated the feature.",
			},
		},
		{
			type: "item.completed",
			item: {
				id: "item-2",
				type: "command_execution",
				command: "npm test",
				status: "completed",
				aggregated_output: "93 tests passed",
				exit_code: 0,
			},
		},
		{
			type: "item.completed",
			item: {
				id: "item-3",
				type: "file_change",
				status: "completed",
				changes: [{ path: "src/index.ts", kind: "update" }],
			},
		},
		{
			type: "turn.completed",
			usage: {
				input_tokens: 100,
				cached_input_tokens: 80,
				output_tokens: 20,
				reasoning_output_tokens: 10,
			},
		},
	];
	const sampleLogs = codexEvents
		.map(
			(data, index) =>
				`::CONDUCTOR_EVENT::${JSON.stringify({
					v: 1,
					ts: `2026-08-03T12:00:0${index}.000Z`,
					event: "CODEX_EVENT",
					data,
				})}`,
		)
		.join("\n");

	await page.getByRole("textbox").fill(sampleLogs);
	await page.locator(".other-events").scrollIntoViewIfNeeded();

	await helper.step("codex_events_rendered", {
		description: "User inspects a Codex CLI JSONL run",
		verifications: [
			{
				spec: "Thread and turn lifecycle are visible",
				check: async () => {
					await expect(page.getByText("Codex Thread Started")).toBeVisible();
					await expect(page.getByText("thread-123")).toBeVisible();
					await expect(page.getByText("Codex Turn Started")).toBeVisible();
					await expect(page.getByText("Codex Turn Completed")).toBeVisible();
				},
			},
			{
				spec: "Agent markdown is rendered",
				check: async () => {
					const message = page.locator(".codex-event.agent-message");
					await expect(message.getByRole("heading", { level: 2 })).toHaveText(
						"Implementation complete",
					);
					await expect(message.locator("strong")).toHaveText("Codex worker");
				},
			},
			{
				spec: "Command result and file change are visible",
				check: async () => {
					await expect(
						page.getByText("npm test", { exact: true }),
					).toBeVisible();
					await expect(page.getByText("93 tests passed")).toBeVisible();
					await expect(page.getByText('"path": "src/index.ts"')).toBeVisible();
				},
			},
			{
				spec: "Token usage is visible",
				check: async () => {
					await expect(page.getByText("Input tokens: 100")).toBeVisible();
					await expect(page.getByText("Cached input: 80")).toBeVisible();
					await expect(page.getByText("Output tokens: 20")).toBeVisible();
					await expect(page.getByText("Reasoning output: 10")).toBeVisible();
				},
			},
		],
	});

	helper.generateDocs();
});
