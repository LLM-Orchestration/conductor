import { expect, test } from "@playwright/test";
import { TestStepHelper } from "../helpers/test-step-helper";

test("Parallel Codex Subscription Workers", async ({ page }, testInfo) => {
	const helper = new TestStepHelper(page, testInfo);
	helper.setMetadata(
		"Parallel Codex Subscription Workers",
		"Verify that concurrent subscription-backed Codex CLI runs remain individually visible and reviewable.",
	);

	await page.goto("/debug");

	await helper.step("debug_page_loaded", {
		description: "User opens the Conductor log parser for subscription workers",
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

	const records = [
		{
			run_id: "worker-1",
			event: "LOG_INFO",
			data: {
				message:
					"Invoking Codex CLI with model 'gpt-5.6-sol', effort 'high', and auth mode 'subscription'...",
			},
		},
		{
			run_id: "worker-1",
			event: "CODEX_EVENT",
			data: { type: "thread.started", thread_id: "subscription-worker-1" },
		},
		{
			run_id: "worker-1",
			event: "CODEX_EVENT",
			data: {
				type: "item.completed",
				item: {
					id: "worker-1-message",
					type: "agent_message",
					text: "Parallel subscription worker **1 passed**.",
				},
			},
		},
		{
			run_id: "worker-2",
			event: "CODEX_EVENT",
			data: { type: "thread.started", thread_id: "subscription-worker-2" },
		},
		{
			run_id: "worker-2",
			event: "CODEX_EVENT",
			data: {
				type: "item.completed",
				item: {
					id: "worker-2-message",
					type: "agent_message",
					text: "Parallel subscription worker **2 passed**.",
				},
			},
		},
	];
	const sampleLogs = records
		.map((record, index) =>
			[
				"::CONDUCTOR_EVENT::",
				JSON.stringify({
					v: 1,
					ts: `2026-08-03T14:30:0${index}.000Z`,
					repo: "anicolao/conductor-credentials",
					issue: 0,
					persona: "system",
					...record,
				}),
			].join(""),
		)
		.join("\n");

	await page.getByRole("textbox").fill(sampleLogs);
	await page.locator(".other-events").scrollIntoViewIfNeeded();

	await helper.step("parallel_workers_rendered", {
		description: "User reviews two subscription-backed Codex workers",
		verifications: [
			{
				spec: "Subscription authentication mode is explicit",
				check: async () => {
					await expect(
						page.getByText(/auth mode 'subscription'/),
					).toBeVisible();
				},
			},
			{
				spec: "Both worker threads are independently visible",
				check: async () => {
					await expect(page.getByText("subscription-worker-1")).toBeVisible();
					await expect(page.getByText("subscription-worker-2")).toBeVisible();
				},
			},
			{
				spec: "Both workers report successful completion",
				check: async () => {
					await expect(page.getByText("1 passed")).toBeVisible();
					await expect(page.getByText("2 passed")).toBeVisible();
				},
			},
		],
	});

	helper.generateDocs();
});
