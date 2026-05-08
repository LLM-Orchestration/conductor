import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	buildGeminiCliArgs,
	loadPrompts,
	selectGeminiCliModel,
} from "../src/index";

describe("buildGeminiCliArgs", () => {
	it("runs Gemini CLI in auto model mode with stream-json output", () => {
		expect(buildGeminiCliArgs("test prompt")).toEqual([
			"-y",
			"@google/gemini-cli",
			"--debug",
			"--model",
			"auto",
			"--prompt",
			"test prompt",
			"--approval-mode",
			"yolo",
			"-o",
			"stream-json",
		]);
	});

	it("can pin Gemini CLI to an explicit model", () => {
		expect(buildGeminiCliArgs("test prompt", "pro")).toContain("pro");
	});
});

describe("selectGeminiCliModel", () => {
	it("prefers pro when all model families have quota remaining", () => {
		expect(
			selectGeminiCliModel("coder", [
				{ modelId: "gemini-2.5-flash", remainingFraction: 0.1 },
				{ modelId: "gemini-2.5-flash-lite", remainingFraction: 0.1 },
				{ modelId: "gemini-2.5-pro", remainingFraction: 0.1 },
			]),
		).toBe("pro");
	});

	it("prefers pro for conductor when available", () => {
		expect(
			selectGeminiCliModel("conductor", [
				{ modelId: "gemini-2.5-flash", remainingFraction: 0.1 },
				{ modelId: "gemini-2.5-flash-lite", remainingFraction: 0 },
				{ modelId: "gemini-2.5-pro", remainingFraction: 0.1 },
			]),
		).toBe("pro");
	});

	it("prefers flash for conductor when pro is exhausted", () => {
		expect(
			selectGeminiCliModel("conductor", [
				{ modelId: "gemini-2.5-flash", remainingFraction: 0.1 },
				{ modelId: "gemini-2.5-flash-lite", remainingFraction: 0.1 },
				{ modelId: "gemini-2.5-pro", remainingFraction: 0 },
			]),
		).toBe("flash");
	});

	it("pins a model when any returned model bucket is exhausted", () => {
		expect(
			selectGeminiCliModel("coder", [
				{ modelId: "gemini-2.5-flash", remainingFraction: 0.1 },
				{ modelId: "gemini-3-flash-preview", remainingFraction: 0 },
				{ modelId: "gemini-2.5-flash-lite", remainingFraction: 0.1 },
				{ modelId: "gemini-2.5-pro", remainingFraction: 0.1 },
			]),
		).toBe("pro");
	});

	it("prefers pro for coder when flash is exhausted", () => {
		expect(
			selectGeminiCliModel("coder", [
				{ modelId: "gemini-2.5-flash", remainingFraction: 0 },
				{ modelId: "gemini-2.5-flash-lite", remainingFraction: 0.1 },
				{ modelId: "gemini-2.5-pro", remainingFraction: 0.1 },
			]),
		).toBe("pro");
	});

	it("falls back to an available model when the persona preference is exhausted", () => {
		expect(
			selectGeminiCliModel("coder", [
				{ modelId: "gemini-2.5-flash", remainingFraction: 0 },
				{ modelId: "gemini-2.5-flash-lite", remainingFraction: 0.5 },
				{ modelId: "gemini-2.5-pro", remainingFraction: 0 },
			]),
		).toBe("flash-lite");
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
