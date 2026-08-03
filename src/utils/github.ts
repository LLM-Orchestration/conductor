import { spawnSync } from "node:child_process";
import { z } from "zod";
import { logger } from "./logger";
import { sanitize } from "./sanitize";

export const GitHubEventSchema = z
	.object({
		action: z.string().optional(),
		issue: z
			.object({
				number: z.number(),
				labels: z.array(
					z.object({
						name: z.string(),
					}),
				),
				body: z.string().default(""),
				html_url: z.string(),
				node_id: z.string(),
			})
			.optional(),
		comment: z
			.object({
				body: z.string(),
				html_url: z.string(),
			})
			.optional(),
		client_payload: z
			.object({
				repository: z.string().optional(),
				issue_number: z.number().optional(),
				issue_node_id: z.string().optional(),
				project_item_id: z.string().optional(),
				project_number: z.number().optional(),
				project_url: z.string().optional(),
				persona: z.string().nullable().optional(),
				event_name: z.string().optional(),
				action: z.string().optional(),
				last_comment_url: z.string().optional(),
			})
			.optional(),
	})
	.passthrough();

export type GitHubEvent = z.infer<typeof GitHubEventSchema>;

export function extractEventData(event: GitHubEvent, env: NodeJS.ProcessEnv) {
	const repository =
		event.client_payload?.repository || env.GITHUB_REPOSITORY || "";
	const issueNumber = event.issue?.number ?? event.client_payload?.issue_number;
	const issueUrl = event.issue?.html_url || "";
	const issueNodeId =
		event.issue?.node_id || event.client_payload?.issue_node_id || "";
	const labels = event.issue?.labels?.map((l) => l.name) || [];
	const issueBody = event.issue?.body || "";
	const commentBody = event.comment?.body || "";
	const commentUrl =
		event.comment?.html_url || event.client_payload?.last_comment_url || "";
	const projectNumber = event.client_payload?.project_number;
	const projectUrl = event.client_payload?.project_url;
	const projectItemId = event.client_payload?.project_item_id;
	const eventName =
		event.client_payload?.event_name || env.GITHUB_EVENT_NAME || "";
	const action = event.client_payload?.action || event.action || "";

	return {
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
		eventName,
		action,
	};
}

/**
 * Extracts GitHub user-attachment URLs from a given text.
 */
export function extractMediaUrls(text: string): string[] {
	if (!text) return [];
	const regex =
		/https:\/\/github\.com\/user-attachments\/assets\/[0-9a-fA-F-]+/g;
	const matches = text.match(regex);
	if (!matches) return [];
	return [...new Set(matches)];
}

/**
 * Collects all unique media URLs from issue body and latest comment.
 */
export function collectAllMediaUrls(
	issueBody: string,
	latestCommentBody: string,
): string[] {
	const mediaUrls = new Set<string>([
		...extractMediaUrls(issueBody),
		...extractMediaUrls(latestCommentBody),
	]);
	return [...mediaUrls];
}

/**
 * Downloads a media file from a URL to a local path using curl.
 */
export async function downloadMedia(
	url: string,
	destPath: string,
): Promise<void> {
	const result = spawnSync("curl", ["-L", "-s", "-o", destPath, url]);
	if (result.status !== 0) {
		throw new Error(
			`Failed to download media from ${url}: ${result.stderr?.toString() || "Unknown error"}`,
		);
	}
}

/**
 * Injects local media paths into text after their corresponding URLs.
 */
export function injectMediaPaths(
	text: string,
	urlToPath: Map<string, string>,
): string {
	if (!text) return "";
	let updatedText = text;
	for (const [url, localPath] of urlToPath.entries()) {
		const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const regex = new RegExp(escapedUrl, "g");
		// Using a marker that is less likely to break HTML attributes if an agent repeats it,
		// but primarily so we can strip it before posting back to GitHub.
		updatedText = updatedText.replace(
			regex,
			`${url} <!-- CONDUCTOR_MEDIA_PATH: ${localPath} -->`,
		);
	}
	return updatedText;
}

/**
 * Identifies if a comment was made by a persona (conductor, coder, automation).
 * Persona comments always start with "I am the **persona**".
 */
export function isPersonaComment(body: string): boolean {
	return /^I am the \*\*(conductor|coder|automation|human)\*\*/.test(
		body.trim(),
	);
}

/**
 * Posts a comment to the issue indicating that a persona has picked up the task.
 */
export function postPickupNote(
	repository: string,
	issueNumber: number,
	persona: string,
	branch: string,
	runId?: string,
): void {
	const pickupText = runId
		? `[picked up this task](https://llm-orchestration.github.io/conductor/run/?id=${runId})`
		: "picked up this task";

	const body = `I am the **automation**

The **${persona}** has ${pickupText} and is working on **${branch}**.`;

	logger.info(
		`Posting pickup note to issue #${issueNumber} in ${repository}...`,
	);

	try {
		const result = spawnSync(
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

		if (result.error || result.status !== 0) {
			logger.error(
				`Failed to post pickup note to issue #${issueNumber} in ${repository}`,
			);
			if (result.error) logger.error(result.error.message);
		} else {
			logger.info("Pickup note posted successfully.");
		}
	} catch (err) {
		logger.error(
			`Error attempting to post pickup note: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
}
