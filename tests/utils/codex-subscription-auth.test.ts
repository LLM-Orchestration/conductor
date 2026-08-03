import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	buildSubscriptionCodexConfig,
	prepareSubscriptionAuth,
	refreshSubscriptionAuth,
} from "../../src/codex-subscription-auth";

describe("Codex subscription auth", () => {
	let tmpDir: string;
	let codexHome: string;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(
			path.join(os.homedir(), ".conductor-codex-auth-test-"),
		);
		codexHome = path.join(tmpDir, "codex-home");
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("creates an isolated file-backed credential snapshot", () => {
		const githubEnv = path.join(tmpDir, "github-env");
		prepareSubscriptionAuth({
			authJson: '{"tokens":{"access_token":"secret"}}',
			codexHome,
			githubEnvPath: githubEnv,
		});

		expect(fs.statSync(codexHome).mode & 0o777).toBe(0o700);
		expect(fs.statSync(path.join(codexHome, "auth.json")).mode & 0o777).toBe(
			0o600,
		);
		expect(fs.readFileSync(githubEnv, "utf8")).toBe(
			`CODEX_HOME=${codexHome}\n`,
		);
		expect(fs.readFileSync(path.join(codexHome, "auth.json"), "utf8")).toBe(
			'{"tokens":{"access_token":"secret"}}\n',
		);
	});

	it("generates a fail-closed workspace profile that denies the credential home", () => {
		const config = buildSubscriptionCodexConfig(codexHome);

		expect(config).toContain('default_permissions = "conductor-worker"');
		expect(config).toContain('extends = ":workspace"');
		expect(config).toContain(`${JSON.stringify(codexHome)} = "deny"`);
		expect(config).toContain('":root" = "deny"');
		expect(config).toContain('"*" = "allow"');
	});

	it("rejects malformed auth and relative credential paths", () => {
		expect(() =>
			prepareSubscriptionAuth({ authJson: "[]", codexHome }),
		).toThrow("JSON object");
		expect(() => buildSubscriptionCodexConfig("relative/path")).toThrow(
			"absolute path",
		);
	});

	it("rejects credential homes beneath writable temporary roots", () => {
		expect(() =>
			prepareSubscriptionAuth({
				authJson: '{"version":1}',
				codexHome: path.join(os.tmpdir(), "unsafe-codex-home"),
			}),
		).toThrow("writable temporary root");
	});

	it("skips writeback when Codex did not refresh the snapshot", () => {
		prepareSubscriptionAuth({ authJson: '{"version":1}', codexHome });
		const setSecret = vi.fn();

		expect(
			refreshSubscriptionAuth({
				codexHome,
				repository: "owner/credentials",
				githubToken: "token",
				setSecret,
			}),
		).toBe(false);
		expect(setSecret).not.toHaveBeenCalled();
	});

	it("persists a changed snapshot once without serializing other workers", () => {
		prepareSubscriptionAuth({ authJson: '{"version":1}', codexHome });
		fs.writeFileSync(path.join(codexHome, "auth.json"), '{"version":2}\n');
		const setSecret = vi.fn();
		const options = {
			codexHome,
			repository: "owner/credentials",
			secretName: "CODEX_AUTH_JSON",
			githubToken: "token",
			setSecret,
		};

		expect(refreshSubscriptionAuth(options)).toBe(true);
		expect(setSecret).toHaveBeenCalledWith(
			'{"version":2}\n',
			"owner/credentials",
			"CODEX_AUTH_JSON",
			"token",
		);
		expect(refreshSubscriptionAuth(options)).toBe(false);
		expect(setSecret).toHaveBeenCalledTimes(1);
	});
});
