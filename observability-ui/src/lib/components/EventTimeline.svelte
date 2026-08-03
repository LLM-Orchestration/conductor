<script lang="ts">
import type { ConductorEvent, GeminiEventData } from "../types";
import CodexEvent from "./CodexEvent.svelte";
import GeminiEvent from "./GeminiEvent.svelte";

let { events = [] }: { events: ConductorEvent[] } = $props();

const processedEvents = $derived.by(() => {
	const result: ConductorEvent[] = [];
	let lastMessage: GeminiEventData | null = null;
	let currentDebugGroup: ConductorEvent[] = [];

	const flushDebugGroup = () => {
		if (currentDebugGroup.length >= 2) {
			result.push({
				v: 1,
				ts: currentDebugGroup[0].ts,
				run_id: currentDebugGroup[0].run_id,
				repo: currentDebugGroup[0].repo,
				issue: currentDebugGroup[0].issue,
				persona: currentDebugGroup[0].persona,
				event: "LOG_DEBUG_GROUP",
				data: { events: [...currentDebugGroup] },
			});
		} else if (currentDebugGroup.length === 1) {
			result.push(currentDebugGroup[0]);
		}
		currentDebugGroup = [];
	};

	for (const event of events) {
		const geminiData =
			event.event === "GEMINI_EVENT" ? (event.data as GeminiEventData) : null;
		const isDebug =
			event.event === "LOG_DEBUG" ||
			(geminiData !== null &&
				(geminiData._isMessageBus === true ||
					geminiData.type === "init" ||
					geminiData.type === "tool-calls-update" ||
					geminiData.type === "call" ||
					geminiData.type === "context-update"));

		if (isDebug) {
			currentDebugGroup.push(event);
			lastMessage = null;
			continue;
		} else {
			flushDebugGroup();
		}

		if (event.event === "GEMINI_EVENT" && geminiData) {
			if (geminiData.type === "message") {
				if (
					lastMessage &&
					lastMessage.type === "message" &&
					lastMessage.role === geminiData.role
				) {
					// Aggregate content
					lastMessage.content += String(geminiData.content || "");
				} else {
					// New message turn
					lastMessage = { ...geminiData };
					result.push({ ...event, data: lastMessage } as ConductorEvent);
				}
			} else {
				lastMessage = null;
				result.push(event);
			}
		} else {
			lastMessage = null;
			result.push(event);
		}
	}
	flushDebugGroup();
	return result;
});

const terminalEvents = $derived(
	processedEvents.filter((e) => e.event === "STDOUT" || e.event === "STDERR"),
);
const otherEvents = $derived(
	processedEvents.filter((e) => e.event !== "STDOUT" && e.event !== "STDERR"),
);

const toolNameMap = $derived.by(() => {
	const map = new Map<string, string>();
	for (const event of events) {
		if (event.event === "GEMINI_EVENT") {
			const data = event.data as GeminiEventData;
			if (data.type === "tool_use") {
				const tool_id = data.tool_id;
				const name = data.tool_name;
				if (typeof tool_id === "string" && typeof name === "string") {
					map.set(tool_id, name);
				}
			}
		}
	}
	return map;
});

let terminalBody: HTMLDivElement;

$effect(() => {
	if (terminalEvents && terminalBody) {
		terminalBody.scrollTop = terminalBody.scrollHeight;
	}
});

function formatTimestamp(ts: string) {
	try {
		const date = new Date(ts);
		// Return HH:MM:SS in UTC for consistency
		return date.toISOString().slice(11, 19);
	} catch (e) {
		return ts;
	}
}

function getMessage(event: ConductorEvent): string {
	const data = event.data;
	if ("text" in data && typeof data.text === "string") return data.text;
	if ("message" in data && typeof data.message === "string")
		return data.message;
	return JSON.stringify(data);
}
</script>

<div class="timeline">
  <div class="terminal-window">
    <div class="terminal-header">
      <span class="terminal-title">LLM Log Output</span>
    </div>
    <div class="terminal-body" bind:this={terminalBody}>
      {#if terminalEvents.length === 0}
        <p class="empty-terminal">Waiting for terminal output...</p>
      {:else}
        {#each terminalEvents as event}
          {#each (getMessage(event).split('\n')) as line}
            <p class="terminal-line {event.event.toLowerCase()}">
              <span class="line-ts">[{formatTimestamp(event.ts)}]</span>
              <span class="line-content">{line}</span>
            </p>
          {/each}
        {/each}
      {/if}
    </div>
  </div>

  <div class="other-events">
    <h3>Event Log</h3>
    {#if otherEvents.length === 0}
      <p class="empty">No other events found.</p>
    {:else}
      {#each otherEvents as event}
        {#if event.event === 'session_start'}
          {@const data = event.data}
          <div class="event-card session-start">
            <div class="event-header">
              <span class="icon">🚀</span>
              <span class="event-type">Session Started</span>
              {#if event.persona}
                <span class="persona">({event.persona})</span>
              {/if}
              <span class="timestamp">{formatTimestamp(event.ts)}</span>
            </div>
            <div class="event-body">
              <p><strong>Branch:</strong> {data.branch || 'N/A'}</p>
              {#if data.labels}
                <p><strong>Labels:</strong> {data.labels.join(', ')}</p>
              {/if}
            </div>
          </div>
        {:else if event.event === 'session_end'}
          {@const data = event.data}
          <div class="event-card session-end {data.status}">
            <div class="event-header">
              <span class="icon">{data.status === 'success' ? '✅' : '❌'}</span>
              <span class="event-type">Session Ended ({data.status || 'unknown'})</span>
              {#if event.persona}
                <span class="persona">({event.persona})</span>
              {/if}
              <span class="timestamp">{formatTimestamp(event.ts)}</span>
            </div>
            <div class="event-body">
              {#if data.status === 'failure'}
                <p class="error-msg"><strong>Error:</strong> {data.error}</p>
                <p><strong>Exit Code:</strong> {data.exitCode}</p>
              {/if}
            </div>
          </div>
        {:else if event.event === 'LOG_DEBUG_GROUP'}
            {@const data = event.data}
            <details class="event-card log-card log_debug_group">
              <summary class="event-header group-header">
                <span class="icon">🔍</span>
                <span class="event-type">DEBUG MESSAGES ({(data as { events: ConductorEvent[] }).events?.length || 0})</span>
                {#if event.persona}
                  <span class="persona">({event.persona})</span>
                {/if}
                <span class="timestamp">{formatTimestamp(event.ts)}</span>
              </summary>
              <div class="event-body group-body">
                {#each (data as { events: ConductorEvent[] }).events || [] as debugEvent}
                  <div class="nested-debug-event">
                    {#if debugEvent.event === 'GEMINI_EVENT'}
                      <GeminiEvent event={debugEvent} {toolNameMap} />
                    {:else if debugEvent.event === 'CODEX_EVENT'}
                      <CodexEvent event={debugEvent} />
                    {:else}
                      <div class="nested-header">
                        <span class="timestamp">{formatTimestamp(debugEvent.ts)}</span>
                      </div>
                      <p>{getMessage(debugEvent)}</p>
                      {#if Object.keys(debugEvent.data || {}).filter(k => k !== 'message').length > 0}
                        <pre>{JSON.stringify(Object.fromEntries(Object.entries(debugEvent.data).filter(([k]) => k !== 'message')), null, 2)}</pre>
                      {/if}
                    {/if}
                  </div>
                {/each}
              </div>
            </details>
          {:else if event.event.startsWith('LOG_')}
          <div class="event-card log-card {event.event.toLowerCase()}">
            <div class="event-header">
              <span class="icon">
                {#if event.event === 'LOG_ERROR'}❌{:else if event.event === 'LOG_WARN'}⚠️{:else if event.event === 'LOG_DEBUG'}🔍{:else}ℹ️{/if}
              </span>
              <span class="event-type">{event.event.replace('LOG_', '')}</span>
              {#if event.persona}
                <span class="persona">({event.persona})</span>
              {/if}
              <span class="timestamp">{formatTimestamp(event.ts)}</span>
            </div>
            <div class="event-body">
              <p>{getMessage(event)}</p>
              {#if 'message' in event.data && Object.keys(event.data).length > 1}
                <pre>{JSON.stringify(Object.fromEntries(Object.entries(event.data).filter(([k]) => k !== 'message')), null, 2)}</pre>
              {/if}
            </div>
          </div>
        {:else if event.event === 'TASK'}
          <div class="event-card task-card">
            <div class="event-header">
              <span class="icon">📋</span>
              <span class="event-type">TASK</span>
              {#if event.persona}
                <span class="persona">({event.persona})</span>
              {/if}
              <span class="timestamp">{formatTimestamp(event.ts)}</span>
            </div>
            <div class="event-body task-content">
              {getMessage(event)}
            </div>
          </div>
        {:else if event.event === 'GEMINI_EVENT'}
          <GeminiEvent {event} {toolNameMap} />
        {:else if event.event === 'CODEX_EVENT'}
          <CodexEvent {event} />
        {:else}
          <div class="event-card">
            <div class="event-header">
              <span class="event-type">{event.event}</span>
              {#if event.persona}
                <span class="persona">({event.persona})</span>
              {/if}
              <span class="timestamp">{formatTimestamp(event.ts)}</span>
            </div>
            <div class="event-body">
              <pre>{JSON.stringify(event.data, null, 2)}</pre>
            </div>
          </div>
        {/if}
      {/each}
    {/if}
  </div>
</div>

<style>
  .timeline {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    padding: 1rem;
    font-family: sans-serif;
  }

  .terminal-window {
    background: #1e1e1e;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: 60vh;
  }

  .terminal-header {
    background: #333;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid #444;
  }

  .terminal-title {
    color: #ccc;
    font-size: 0.85rem;
    font-family: 'Roboto Mono', monospace;
    font-weight: 500;
  }

  .terminal-body {
    padding: 1rem;
    overflow-y: auto;
    flex-grow: 1;
    font-family: 'Roboto Mono', monospace;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .terminal-line {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .terminal-line.stdout {
    color: #d4d4d4;
  }

  .terminal-line.stderr {
    color: #f14c4c;
  }

  .line-ts {
    color: #666;
    margin-right: 0.5rem;
    user-select: none;
  }

  .empty-terminal {
    color: #666;
    font-style: italic;
  }

  .other-events h3 {
    margin-top: 0;
    color: #444;
    border-bottom: 2px solid #eee;
    padding-bottom: 0.5rem;
  }

  .empty {
    color: #666;
    font-style: italic;
  }

  .event-card {
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 0.75rem;
    background: #f9f9f9;
    margin-bottom: 1rem;
  }

  .event-header {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
    margin-bottom: 0.5rem;
    border-bottom: 1px solid #eee;
    padding-bottom: 0.25rem;
  }

  .timestamp {
    font-size: 0.8rem;
    color: #888;
    margin-left: auto;
  }

  .event-type {
    font-weight: bold;
    text-transform: uppercase;
    color: #007bff;
  }

  .persona {
    font-size: 0.9rem;
    color: #555;
  }

  .event-body pre {
    margin: 0.5rem 0 0 0;
    font-size: 0.85rem;
    background: #eee;
    padding: 0.5rem;
    border-radius: 2px;
    overflow-x: auto;
  }

  .session-start {
    border-left: 4px solid #007bff;
  }
  .session-end.success {
    border-left: 4px solid #28a745;
  }
  .session-end.failure {
    border-left: 4px solid #dc3545;
  }
  .log-card.log_info { border-left: 4px solid #17a2b8; }
  .log-card.log_warn { border-left: 4px solid #ffc107; }
  .log-card.log_error { border-left: 4px solid #dc3545; }
  .log-card.log_debug { border-left: 4px solid #6c757d; }
  .log-card.log_debug_group { border-left: 4px solid #6c757d; }
  
  .group-header {
    cursor: pointer;
    user-select: none;
    list-style: none;
    display: flex;
  }
  .group-header::-webkit-details-marker {
    display: none;
  }
  .group-header:hover {
    background-color: rgba(0,0,0,0.02);
  }
  
  .nested-debug-event {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px dashed #ccc;
  }
  .nested-debug-event:first-child {
    margin-top: 0;
    padding-top: 0.5rem;
    border-top: none;
  }
  .nested-header {
    margin-bottom: 0.25rem;
  }
  .nested-header .timestamp {
    font-size: 0.75rem;
    color: #888;
    margin-left: 0;
  }
  
  .task-card { 
    border-left: 4px solid #6f42c1;
    background: #f3e5f5;
  }
  
  .task-content {
    font-weight: bold;
    font-size: 1.1rem;
    margin-top: 0.5rem;
  }
  
  .error-msg {
    color: #dc3545;
  }
  
  .icon {
    font-size: 1.1rem;
  }
</style>
