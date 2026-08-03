import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	buildCodexCliArgs,
	DEFAULT_CODEX_EFFORT,
	DEFAULT_CODEX_MODEL,
	loadPrompts,
	resolveCodexReasoningEffort,
} from "../src/index";

describe("buildCodexCliArgs", () => {
	it("runs Codex CLI non-interactively with JSONL output", () => {
		expect(buildCodexCliArgs("test prompt")).toEqual([
			"--ask-for-approval",
			"never",
			"exec",
			"--json",
			"--model",
			DEFAULT_CODEX_MODEL,
			"--sandbox",
			"danger-full-access",
			"--color",
			"never",
			"--config",
			`model_reasoning_effort=${JSON.stringify(DEFAULT_CODEX_EFFORT)}`,
			"test prompt",
		]);
	});

	it("can pin the model and reasoning effort", () => {
		expect(buildCodexCliArgs("test prompt", "custom-model", "high")).toContain(
			"custom-model",
		);
		expect(buildCodexCliArgs("test prompt", "custom-model", "high")).toContain(
			'model_reasoning_effort="high"',
		);
	});
});

describe("resolveCodexReasoningEffort", () => {
	it("accepts supported effort values", () => {
		expect(resolveCodexReasoningEffort("none")).toBe("none");
		expect(resolveCodexReasoningEffort("max")).toBe("max");
	});

	it("falls back when the configured effort is invalid", () => {
		expect(resolveCodexReasoningEffort("impossible")).toBe(
			DEFAULT_CODEX_EFFORT,
		);
	});
});

describe("Conductor workflow", () => {
	const workflow = fs.readFileSync(
		path.join(process.cwd(), ".github", "workflows", "conductor.yml"),
		"utf8",
	);

	it("boots the pinned Codex CLI with the official action", () => {
		expect(workflow).toContain("uses: openai/codex-action@v1");
		expect(workflow).toContain(
			"openai-api-key: $" + "{{ secrets.OPENAI_API_KEY }}",
		);
		expect(workflow).toContain('codex-version: "0.146.0"');
	});

	it("configures the Codex model without Gemini credentials", () => {
		expect(workflow).toContain("CONDUCTOR_CODEX_MODEL:");
		expect(workflow).toContain("CONDUCTOR_CODEX_EFFORT:");
		expect(workflow).not.toContain("GEMINI_API_KEY");
		expect(workflow).not.toContain("GEMINI_OAUTH_CREDENTIALS");
	});
});

describe("loadPrompts", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "conductor-prompts-test-"));
		fs.mkdirSync(path.join(tmpDir, "prompts"));
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("should load both efficiency and persona prompts", () => {
		fs.writeFileSync(
			path.join(tmpDir, "prompts", "efficiency.md"),
			"efficiency content",
		);
		fs.writeFileSync(
			path.join(tmpDir, "prompts", "conductor.md"),
			"conductor content",
		);

		const result = loadPrompts(tmpDir, "conductor");
		expect(result).toBe("efficiency content\n\nconductor content");
	});

	it("should load only persona prompt if efficiency is missing", () => {
		fs.writeFileSync(
			path.join(tmpDir, "prompts", "conductor.md"),
			"conductor content",
		);

		const result = loadPrompts(tmpDir, "conductor");
		expect(result).toBe("conductor content");
	});

	it("should throw/exit if persona prompt is missing", () => {
		// Mocking process.exit to avoid killing the test runner
		const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
			throw new Error("process.exit");
		});

		expect(() => loadPrompts(tmpDir, "nonexistent")).toThrow("process.exit");
		exitSpy.mockRestore();
	});
});
