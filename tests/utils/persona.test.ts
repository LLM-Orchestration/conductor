import { describe, expect, it } from "vitest";
import { isPersonaComment } from "../../src/utils/github";

describe("isPersonaComment", () => {
	it("identifies conductor comments", () => {
		expect(
			isPersonaComment(
				"I am the **conductor**, and I am responding to comment [123](url) on branch feature.",
			),
		).toBe(true);
	});

	it("identifies coder comments", () => {
		expect(
			isPersonaComment(
				"I am the **coder**, and I am responding to the [original issue](url) on branch feature.",
			),
		).toBe(true);
	});

	it("identifies automation comments", () => {
		expect(
			isPersonaComment(
				"I am the **automation**\n\n### ❌ Codex CLI Execution Failed",
			),
		).toBe(true);
	});

	it("identifies human handoff comments", () => {
		expect(
			isPersonaComment(
				"I am the **human**, and I am responding to comment [456](url) on branch feature.",
			),
		).toBe(true);
	});

	it("identifies comments with leading/trailing whitespace", () => {
		expect(isPersonaComment("  I am the **conductor**, ... ")).toBe(true);
	});

	it("does not identify human comments without annotation", () => {
		expect(isPersonaComment("Please fix this bug.")).toBe(false);
		expect(
			isPersonaComment("I think we should use a different approach."),
		).toBe(false);
		expect(isPersonaComment("I am a human but not using the annotation.")).toBe(
			false,
		);
	});

	it("does not identify partial matches", () => {
		expect(
			isPersonaComment("This is not how it starts: I am the **conductor**"),
		).toBe(false);
	});
});
