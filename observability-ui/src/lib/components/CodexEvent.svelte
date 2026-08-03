<script lang="ts">
import { marked } from "marked";
import type { CodexEventData, CodexItem, ConductorEvent } from "../types";
import JsonTree from "./JsonTree.svelte";

let { event }: { event: ConductorEvent } = $props();

const eventData = $derived(
	event.event === "CODEX_EVENT" ? (event.data as CodexEventData) : null,
);

const item = $derived(eventData?.item ?? null);

const markdownContent = $derived.by(() => {
	if (!item) return "";
	if (item.type !== "agent_message" && item.type !== "reasoning") return "";
	return marked.parse(typeof item.text === "string" ? item.text : "") as string;
});

function eventClass(data: CodexEventData): string {
	const eventType = data.type.replace(/[._]/g, "-");
	const itemType = data.item?.type?.replace(/[._]/g, "-") || "";
	return `codex-event ${eventType} ${itemType}`.trim();
}

function itemTitle(current: CodexItem): string {
	return current.type.replace(/_/g, " ");
}

function errorText(error: unknown): string {
	if (typeof error === "string") return error;
	return JSON.stringify(error ?? "Unknown error", null, 2);
}
</script>

{#if eventData}
<div class={eventClass(eventData)}>
  {#if eventData.type === 'thread.started'}
    <div class="event-header">
      <span class="icon">🤖</span>
      <span class="event-type">Codex Thread Started</span>
    </div>
    <div class="event-body">
      <p><strong>Thread ID:</strong> <code>{eventData.thread_id}</code></p>
    </div>
  {:else if eventData.type === 'turn.started'}
    <div class="event-header">
      <span class="icon">🚀</span>
      <span class="event-type">Codex Turn Started</span>
    </div>
  {:else if eventData.type.startsWith('item.') && item}
    <div class="event-header">
      <span class="icon">{item.type === 'agent_message' ? '✨' : item.type === 'command_execution' ? '⌨️' : item.type === 'file_change' ? '📝' : '🔧'}</span>
      <span class="event-type">{itemTitle(item)} ({eventData.type.slice(5)})</span>
      <span class="item-id">({item.id})</span>
    </div>
    <div class="event-body">
      {#if item.type === 'agent_message' || item.type === 'reasoning'}
        <div class="markdown">{@html markdownContent}</div>
      {:else if item.type === 'command_execution'}
        <p><strong>Command:</strong> <code>{item.command || 'N/A'}</code></p>
        {#if item.status}<p><strong>Status:</strong> {item.status}</p>{/if}
        {#if item.exit_code !== undefined}<p><strong>Exit code:</strong> {item.exit_code}</p>{/if}
        {#if item.aggregated_output}<pre class="terminal-output"><code>{item.aggregated_output}</code></pre>{/if}
      {:else if item.type === 'file_change'}
        <pre><code>{JSON.stringify(item.changes || item, null, 2)}</code></pre>
      {:else}
        <pre><code>{JSON.stringify(item, null, 2)}</code></pre>
      {/if}
    </div>
  {:else if eventData.type === 'turn.completed'}
    <div class="event-header">
      <span class="icon">🏁</span>
      <span class="event-type">Codex Turn Completed</span>
    </div>
    <div class="event-body stats">
      <p><strong>Input tokens:</strong> {eventData.usage?.input_tokens || 0}</p>
      <p><strong>Cached input:</strong> {eventData.usage?.cached_input_tokens || 0}</p>
      <p><strong>Output tokens:</strong> {eventData.usage?.output_tokens || 0}</p>
      <p><strong>Reasoning output:</strong> {eventData.usage?.reasoning_output_tokens || 0}</p>
    </div>
  {:else if eventData.type === 'turn.failed' || eventData.type === 'error'}
    <div class="event-header error">
      <span class="icon">❌</span>
      <span class="event-type">Codex {eventData.type.replace('.', ' ')}</span>
    </div>
    <div class="event-body"><pre><code>{eventData.message || errorText(eventData.error)}</code></pre></div>
  {:else}
    <div class="event-header">
      <span class="icon">❓</span>
      <span class="event-type">Codex Event: {eventData.type}</span>
    </div>
    <div class="event-body"><pre><code>{JSON.stringify(eventData, null, 2)}</code></pre></div>
  {/if}

  <div class="raw-json-section">
    <JsonTree data={event} isRoot={true} label="Event JSON" />
  </div>
</div>
{/if}

<style>
  .codex-event {
    border: 1px solid #ddd;
    border-left: 4px solid #111827;
    border-radius: 4px;
    padding: 0.75rem;
    background: #fff;
    margin-bottom: 1rem;
  }

  .event-header {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 0.5rem;
    border-bottom: 1px solid #eee;
    padding-bottom: 0.25rem;
  }

  .event-header.error {
    color: #b91c1c;
  }

  .event-type {
    color: #374151;
    font-size: 0.85rem;
    font-weight: bold;
    text-transform: uppercase;
  }

  .item-id {
    color: #888;
    font-family: monospace;
    font-size: 0.75rem;
  }

  .event-body {
    font-size: 0.95rem;
  }

  .event-body p {
    margin: 0.25rem 0;
    white-space: pre-wrap;
  }

  pre {
    overflow-x: auto;
    padding: 0.75rem;
    background: #f5f5f5;
    border-radius: 4px;
    white-space: pre-wrap;
  }

  .terminal-output {
    color: #d4d4d4;
    background: #1e1e1e;
  }

  .markdown :global(p) {
    margin: 0.5rem 0;
  }

  .markdown :global(p:first-child) {
    margin-top: 0;
  }

  .markdown :global(p:last-child) {
    margin-bottom: 0;
  }

  .raw-json-section {
    margin-top: 0.75rem;
    padding-top: 0.5rem;
    border-top: 1px dashed #ddd;
  }
</style>
