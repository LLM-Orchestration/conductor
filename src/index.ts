import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";
import {
	DEFAULT_COMMENT_LIMIT,
	resolveCommentLimit,
} from "./utils/comment-limit";
import { runStreamingCommand } from "./utils/exec";
import {
	collectAllMediaUrls,
	downloadMedia,
	extractEventData,
	type GitHubEvent,
	GitHubEventSchema,
	injectMediaPaths,
	isPersonaComment,
	postPickupNote,
} from "./utils/github";
import { logEvent, logger } from "./utils/logger";
import { sanitize } from "./utils/sanitize";

function verifyGitHubCli(repository: string, issueNumber: number): string {
	const repoCheck = spawnSync(
		"gh",
		["api", `repos/${repository}`, "--jq", ".full_name"],
		{
			encoding: "utf8",
			env: process.env,
		},
	);

	if (repoCheck.status !== 0) {
		const authStatus = spawnSync("gh", ["auth", "status"], {
			encoding: "utf8",
			env: process.env,
		});

		const failureDetails = (
			[
				repoCheck.stderr,
				repoCheck.stdout,
				authStatus.stderr,
				authStatus.stdout,
				"No gh output captured",
			].find(Boolean) || ""
		).trim();

		logger.error(`GitHub CLI preflight failed for ${repository}.`);
		if (failureDetails) process.stderr.write(`${failureDetails}\n`);

		const body = `I am the **automation**

### ❌ GitHub CLI Preflight Failed

Issue #${issueNumber} could not verify \`gh\` access to \`${repository}\` before invoking Codex.

<details>
<summary>Preflight output</summary>

\`\`\`
${failureDetails}
\`\`\`
</details>

*Automated report by Conductor*`;

		spawnSync(
			"gh",
			[
				"issue",
				"comment",
				String(issueNumber),
				"-R",
				repository,
				"--body",
				sanitize(body),
			],
			{
				stdio: "inherit",
				env: process.env,
			},
		);

		process.exit(repoCheck.status || 1);
	}

	return repoCheck.stdout.trim();
}

export const DEFAULT_CODEX_MODEL = "gpt-5.6-sol";
export const DEFAULT_CODEX_EFFORT = "xhigh";

export type CodexAuthMode = "api-proxy" | "subscription";

export type CodexReasoningEffort =
	| "none"
	| "low"
	| "medium"
	| "high"
	| "xhigh"
	| "max";

const CodexReasoningEffortSchema = z.enum([
	"none",
	"low",
	"medium",
	"high",
	"xhigh",
	"max",
]);

const CodexAuthModeSchema = z.enum(["api-proxy", "subscription"]);

function buildCodexEnv(): NodeJS.ProcessEnv {
	const forwardedKeys = [
		"PATH",
		"HOME",
		"LANG",
		"SHELL",
		"TERM",
		"TMPDIR",
		"TMP",
		"TEMP",
		"USER",
		"LOGNAME",
		"COLORTERM",
		"CI",
		"GITHUB_ACTIONS",
		"GITHUB_ACTOR",
		"GITHUB_EVENT_NAME",
		"GITHUB_EVENT_PATH",
		"GITHUB_REPOSITORY",
		"GITHUB_RUN_ATTEMPT",
		"GITHUB_RUN_ID",
		"GITHUB_RUN_NUMBER",
		"RUNNER_ARCH",
		"RUNNER_OS",
		"RUNNER_TEMP",
		"RUNNER_TOOL_CACHE",
		"CODEX_HOME",
		"CODEX_API_KEY",
		"CONDUCTOR_TOKEN",
		"GH_TOKEN",
		"GITHUB_TOKEN",
	];
	const env: NodeJS.ProcessEnv = {};

	for (const key of forwardedKeys) {
		const value = process.env[key];
		if (value) env[key] = value;
	}

	return env;
}

export function resolveCodexReasoningEffort(
	value = process.env.CONDUCTOR_CODEX_EFFORT,
): CodexReasoningEffort {
	const parsed = CodexReasoningEffortSchema.safeParse(value);
	return parsed.success ? parsed.data : DEFAULT_CODEX_EFFORT;
}

export function resolveCodexAuthMode(
	value = process.env.CONDUCTOR_CODEX_AUTH_MODE,
): CodexAuthMode {
	const parsed = CodexAuthModeSchema.safeParse(value);
	return parsed.success ? parsed.data : "api-proxy";
}

export function buildCodexCliArgs(
	prompt: string,
	model = process.env.CONDUCTOR_CODEX_MODEL || DEFAULT_CODEX_MODEL,
	effort = resolveCodexReasoningEffort(),
	authMode = resolveCodexAuthMode(),
): string[] {
	const args = ["--ask-for-approval", "never", "exec", "--json"];

	if (authMode === "subscription") {
		args.push("--strict-config", "--ephemeral");
	} else {
		args.push("--sandbox", "danger-full-access");
	}

	args.push(
		"--model",
		model,
		"--color",
		"never",
		"--config",
		`model_reasoning_effort=${JSON.stringify(effort)}`,
		prompt,
	);
	return args;
}

const CommentSchema = z.object({
	body: z.string(),
	html_url: z.string(),
});

type Comment = z.infer<typeof CommentSchema>;

function loadIssueState(
	repository: string,
	issueNumber: number,
): {
	labels: string[];
	body: string;
	commentCount: number;
	htmlUrl: string;
	nodeId: string;
} | null {
	const issueData = spawnSync(
		"gh",
		["api", `repos/${repository}/issues/${issueNumber}`],
		{
			encoding: "utf8",
			env: process.env,
		},
	);

	if (issueData.status !== 0 || !issueData.stdout.trim()) {
		return null;
	}

	const IssueStateSchema = z.object({
		labels: z.array(z.object({ name: z.string() })),
		body: z
			.string()
			.nullable()
			.transform((val) => val ?? ""),
		comments: z.number().default(0),
		html_url: z.string(),
		node_id: z.string(),
	});

	const parsed = IssueStateSchema.parse(JSON.parse(issueData.stdout));

	return {
		labels: parsed.labels.map((label) => label.name),
		body: parsed.body,
		commentCount: parsed.comments,
		htmlUrl: parsed.html_url,
		nodeId: parsed.node_id,
	};
}

function loadIssueComments(
	repository: string,
	issueNumber: number,
	commentCount: number,
): Comment[] {
	if (commentCount < 1) return [];

	const perPage = 100;
	const pages = Math.ceil(commentCount / perPage);
	const allComments: Comment[] = [];

	for (let page = 1; page <= pages; page += 1) {
		const commentsData = spawnSync(
			"gh",
			[
				"api",
				`repos/${repository}/issues/${issueNumber}/comments?per_page=${perPage}&page=${page}`,
			],
			{
				encoding: "utf8",
				env: process.env,
			},
		);

		if (commentsData.status !== 0 || !commentsData.stdout.trim()) {
			const details = (
				commentsData.stderr ||
				commentsData.stdout ||
				"No gh output captured"
			).trim();
			logger.warn(
				`Failed to load comment page ${page} for ${repository}#${issueNumber}.`,
			);
			if (details) process.stderr.write(`${details}\n`);
			return allComments;
		}

		const parsed = z
			.array(CommentSchema)
			.parse(JSON.parse(commentsData.stdout));
		allComments.push(...parsed);
	}

	return allComments;
}

function getEffectiveCommentLimit(comments: Comment[]): number {
	const bodies = comments.map((c) => c.body);
	return resolveCommentLimit(bodies, DEFAULT_COMMENT_LIMIT);
}
function moveToHumanReview(
	repository: string,
	issueNumber: number,
	issueNodeId: string,
	projectNumber: number | null,
	projectUrl: string,
	commentCount: number,
	commentLimit: number,
): void {
	const body = `I am the **automation**

### Comment Limit Reached

Automation is aborting for this issue because the comment count exceeded the configured limit.

- Current comments: ${commentCount}
- Comment limit: ${commentLimit}

If you need more automated iterations on this issue, add a comment with:

\`SET COMMENT LIMIT: NNN\`

Then move the item back to \`In Progress\`.

*Automated report by Conductor*`;

	const args = [
		"run",
		"human-review",
		"--",
		"--issue-number",
		String(issueNumber),
		"--repo",
		repository,
	];

	if (issueNodeId) {
		args.push("--issue-node-id", issueNodeId);
	}

	if (projectNumber !== null) {
		args.push("--project-number", String(projectNumber));
	}

	if (projectUrl) {
		args.push("--project-url", projectUrl);
	}

	const result = spawnSync("npm", args, {
		encoding: "utf8",
		env: process.env,
		input: body,
	});

	if (result.status !== 0) {
		const details = (
			result.stderr ||
			result.stdout ||
			"No output captured"
		).trim();
		logger.error(
			`Failed to move ${repository}#${issueNumber} to Human Review after comment-limit check.`,
		);
		if (details) process.stderr.write(`${details}\n`);
		process.exit(result.status || 1);
	}
}

function activatePersonaLabel(
	repository: string,
	issueNumber: number,
	persona: "conductor" | "coder",
): void {
	const result = spawnSync(
		"gh",
		[
			"issue",
			"edit",
			String(issueNumber),
			"-R",
			repository,
			"--add-label",
			`persona: ${persona}`,
		],
		{
			encoding: "utf8",
			env: process.env,
		},
	);

	if (result.status !== 0) {
		const details = (
			result.stderr ||
			result.stdout ||
			"No gh output captured"
		).trim();
		logger.error(
			`Failed to activate ${persona} persona on issue #${issueNumber} in ${repository}`,
		);
		if (details) process.stderr.write(`${details}\n`);
	}
}

export function loadPrompts(conductorRoot: string, persona: string): string {
	const efficiencyPath = path.join(conductorRoot, "prompts", "efficiency.md");
	let efficiencyPrompt = "";
	if (fs.existsSync(efficiencyPath)) {
		efficiencyPrompt = fs.readFileSync(efficiencyPath, "utf8");
	} else {
		logger.warn(`Efficiency prompt not found at ${efficiencyPath}`);
	}

	const promptPath = path.join(conductorRoot, "prompts", `${persona}.md`);
	if (!fs.existsSync(promptPath)) {
		logger.error(`Prompt not found at ${promptPath} for persona: ${persona}`);
		process.exit(1);
	}
	const personaPrompt = fs.readFileSync(promptPath, "utf8");

	if (efficiencyPrompt) {
		return `${efficiencyPrompt}\n\n${personaPrompt}`;
	}
	return personaPrompt;
}

async function main() {
	dotenv.config();

	const eventPath = process.env.GITHUB_EVENT_PATH;
	if (!eventPath) {
		logger.error("GITHUB_EVENT_PATH not set");
		process.exit(1);
	}

	const event: GitHubEvent = GitHubEventSchema.parse(
		JSON.parse(fs.readFileSync(eventPath, "utf8")),
	);
	const eventName = process.env.GITHUB_EVENT_NAME;

	let {
		repository,
		issueNumber,
		issueUrl,
		issueNodeId,
		labels,
		issueBody,
		commentBody,
		commentUrl,
		projectNumber,
		projectUrl,
		projectItemId,
		eventName: extractedEventName,
		action,
	} = extractEventData(event, process.env);

	let persona: "conductor" | "coder" | undefined;
	let lastCommentUrl = commentUrl;
	let comments: Comment[] = [];

	try {
		if (!issueNumber) {
			logger.error("No issue number found in event");
			process.exit(0);
		}

		if (!repository) {
			logger.error("No repository found in event");
			process.exit(1);
		}

		const liveIssueState = loadIssueState(repository, issueNumber);
		if (liveIssueState) {
			labels = liveIssueState.labels;
			issueBody = liveIssueState.body;
			issueUrl = liveIssueState.htmlUrl;
			issueNodeId = liveIssueState.nodeId;

			comments = loadIssueComments(
				repository,
				issueNumber,
				liveIssueState.commentCount,
			);
			const commentLimit = getEffectiveCommentLimit(comments);

			if (liveIssueState.commentCount > commentLimit) {
				logger.info(
					`Comment limit exceeded for ${repository}#${issueNumber} ` +
						`(${liveIssueState.commentCount} > ${commentLimit}). Moving item to Human Review.`,
				);
				moveToHumanReview(
					repository,
					issueNumber,
					issueNodeId,
					projectNumber ?? null,
					projectUrl || "",
					liveIssueState.commentCount,
					commentLimit,
				);
				process.exit(0);
			}

			if (comments.length > 0) {
				const last = comments[comments.length - 1];
				commentBody = last.body;
				lastCommentUrl = last.html_url;
			}
		}

		if (
			eventName === "repository_dispatch" &&
			!labels.some((label) => label.startsWith("persona:"))
		) {
			const targetPersona =
				event.client_payload?.persona === "coder" ||
				event.client_payload?.persona === "conductor"
					? event.client_payload.persona
					: "conductor";
			logger.info(
				`repository_dispatch received for issue #${issueNumber} in ${repository}. Activating ${targetPersona} persona.`,
			);
			activatePersonaLabel(repository, issueNumber, targetPersona);
			labels.push(`persona: ${targetPersona}`);
		}

		// 1. Determine Persona
		const payloadPersona = event.client_payload?.persona;
		if (payloadPersona === "coder" || payloadPersona === "conductor") {
			persona = payloadPersona;
		} else if (labels.includes("persona: coder")) {
			persona = "coder";
		} else if (labels.includes("persona: conductor")) {
			persona = "conductor";
		} else {
			// Implicit initiation check
			const body = commentBody || issueBody || "";
			if (body.includes("@conductor")) {
				persona = "conductor";
			}
		}

		if (!persona) {
			logger.info("No active persona found. Exiting.");
			process.exit(0);
		}

		// 2. Determine Branch (for context)
		const branchLabel = labels.find((l) => l.startsWith("branch:"));
		const currentBranch = branchLabel
			? branchLabel.split(":")[1].trim()
			: "main";

		logger.info(`Activating persona: ${persona} on branch: ${currentBranch}`);

		logEvent(
			"session_start",
			{ branch: currentBranch, labels },
			{ persona, issue: issueNumber },
		);

		// Post pickup note (non-critical)
		postPickupNote(
			repository,
			issueNumber,
			persona,
			currentBranch,
			process.env.GITHUB_RUN_ID,
		);

		// 3. Load Prompt
		const conductorRoot =
			process.env.CONDUCTOR_ROOT || path.join(__dirname, "..");
		const systemPrompt = loadPrompts(conductorRoot, persona);

		// 4. Prepare Context
		let lastHumanCommentBody = "N/A (No human comments found)";
		let activitySinceLastHumanComment = "N/A";

		const reversedComments = [...comments].reverse();
		const lastHumanCommentIndex = reversedComments.findIndex(
			(c) => !isPersonaComment(c.body),
		);

		if (lastHumanCommentIndex !== -1) {
			const actualIndex = comments.length - 1 - lastHumanCommentIndex;
			lastHumanCommentBody = comments[actualIndex].body;
			const activityComments = comments.slice(actualIndex + 1);
			if (activityComments.length > 0) {
				activitySinceLastHumanComment = activityComments
					.map((c) => c.body)
					.join("\n\n---\n\n");
			} else {
				activitySinceLastHumanComment = "None";
			}
		} else if (comments.length > 0) {
			activitySinceLastHumanComment = comments
				.map((c) => c.body)
				.join("\n\n---\n\n");
		}

		// Extract and download media URLs
		const mediaUrls = collectAllMediaUrls(issueBody, commentBody);
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-media-"));
		const urlToPath = new Map<string, string>();

		try {
			for (const url of mediaUrls) {
				const fileName = path.basename(url);
				const localPath = path.join(tmpDir, fileName);
				logger.info(`Downloading media: ${url} -> ${localPath}`);
				try {
					await downloadMedia(url, localPath);
					urlToPath.set(url, localPath);
				} catch (error) {
					logger.error(`Failed to download media: ${url}`, {
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}

			// Inject paths into components
			const injectedIssueBody = injectMediaPaths(issueBody, urlToPath);
			const injectedLastHumanCommentBody = injectMediaPaths(
				lastHumanCommentBody,
				urlToPath,
			);
			const injectedActivity = injectMediaPaths(
				activitySinceLastHumanComment,
				urlToPath,
			);

			const context = `
Issue #${issueNumber}
Repository: ${repository}
Issue URL: ${issueUrl}
Issue Node ID: ${issueNodeId}
Project: ${projectUrl || "N/A"} (#${projectNumber || "N/A"})
Project Item ID: ${projectItemId || "N/A"}
Event: ${extractedEventName}${action ? ` (${action})` : ""}
Current Branch: ${currentBranch}
Labels: ${labels.join(", ")}
---
ISSUE BODY:
${injectedIssueBody}
---
LAST HUMAN COMMENT:
${injectedLastHumanCommentBody}
---
ACTIVITY SINCE LAST HUMAN COMMENT:
${injectedActivity}
`;

			const verifiedRepo = verifyGitHubCli(repository, issueNumber);
			logger.info(`Verified GitHub CLI access to ${verifiedRepo}`);

			// Ensure downstream tools (like gh) use the correct repository
			process.env.GITHUB_REPOSITORY = repository;

			const prompt = `${systemPrompt}\n\n${context}
---
ENVIRONMENT:
- GitHub CLI repository access has been preflight-verified for ${verifiedRepo}.
- If a gh command fails, report the exact command and stderr instead of inferring an authentication problem.`;

			const codexModel =
				process.env.CONDUCTOR_CODEX_MODEL || DEFAULT_CODEX_MODEL;
			const codexEffort = resolveCodexReasoningEffort();
			const codexAuthMode = resolveCodexAuthMode();
			logger.info(
				`Invoking Codex CLI with model '${codexModel}', effort '${codexEffort}', and auth mode '${codexAuthMode}'...`,
			);
			const childEnv = buildCodexEnv();
			childEnv.CONDUCTOR_PERSONA = persona;
			childEnv.CONDUCTOR_LAST_COMMENT_URL = lastCommentUrl;
			childEnv.CONDUCTOR_ROOT = conductorRoot;

			// The target repository directory
			const targetCwd =
				process.env.CONDUCTOR_TARGET_DIR ||
				process.env.GITHUB_WORKSPACE ||
				path.resolve(process.cwd(), "..");
			childEnv.CONDUCTOR_TARGET_DIR = targetCwd;

			const args = buildCodexCliArgs(
				prompt,
				codexModel,
				codexEffort,
				codexAuthMode,
			);

			const result = await runStreamingCommand(
				"codex",
				args,
				childEnv,
				targetCwd,
				"CODEX_EVENT",
			);

			if (result.status !== 0) {
				logger.error("Codex CLI execution failed");

				const errorOutput = (
					result.stderr ||
					result.stdout ||
					"No output captured"
				).trim();
				const lines = errorOutput.split("\n");
				const snippet =
					lines.length > 50 ? lines.slice(-50).join("\n") : errorOutput;

				const body = `I am the **automation**

### ❌ Codex CLI Execution Failed

**Exit Code**: ${result.status}

<details>
<summary>Error Snippet (Last 50 lines)</summary>

\`\`\`
${snippet}
\`\`\`
</details>

*Automated report by Conductor*`;

				logger.info("Posting failure comment to GitHub...");
				spawnSync(
					"gh",
					[
						"issue",
						"comment",
						String(issueNumber),
						"-R",
						repository,
						"--body",
						sanitize(body),
					],
					{
						stdio: "inherit",
						env: childEnv,
					},
				);

				logEvent(
					"session_end",
					{
						status: "failure",
						exitCode: result.status ?? 1,
						error: "Command failed",
					},
					{ persona, issue: issueNumber },
				);
				process.exit(result.status || 1);
			}
		} finally {
			// Cleanup temp dir
			try {
				if (fs.existsSync(tmpDir)) {
					fs.rmSync(tmpDir, { recursive: true, force: true });
				}
			} catch (e) {
				logger.error(`Failed to cleanup temp dir: ${tmpDir}`, {
					error: e instanceof Error ? e.message : String(e),
				});
			}
		}

		logEvent(
			"session_end",
			{ status: "success" },
			{ persona, issue: issueNumber },
		);
	} catch (error) {
		logger.error("An unexpected error occurred", {
			error: error instanceof Error ? error.message : String(error),
		});
		logEvent(
			"session_end",
			{
				status: "failure",
				exitCode: 1,
				error: error instanceof Error ? error.message : String(error),
			},
			{ persona, issue: issueNumber },
		);
		process.exit(1);
	}
}

if (require.main === module) {
	main().catch((err) => {
		logger.error("Fatal error", {
			error: err instanceof Error ? err.message : String(err),
		});
		process.exit(1);
	});
}
