import type {
  AnalysisContext,
  AnalysisReport,
  Finding,
  FindingId,
  ToolEvent
} from "./types";

const FINDING_COPY: Record<FindingId, { description: string; suggestion: string }> = {
  viewport_recheck_after_resize: {
    description: "runJS re-read viewport data shortly after resize",
    suggestion: "Trust resize.actualViewport/verified; use runJS only when verified is false or more state is needed."
  },
  viewport_recheck_after_screenshot: {
    description: "runJS re-read viewport data shortly after screenshot",
    suggestion: "Use the screenshot metadata block for backend and dimensions."
  },
  fixed_wait: {
    description: "waitFor used a fixed delay instead of a page condition",
    suggestion: "Prefer selector/text/textGone or an action-specific settle condition."
  },
  discovery_round_trip: {
    description: "an empty tool catalog lookup was followed by tool/group activation",
    suggestion: "Enable a known tool or enableGroups directly."
  },
  duplicate_call: {
    description: "the same tool and argument fingerprint repeated nearby",
    suggestion: "Reuse the prior result or return a stronger postcondition from the first call."
  },
  repeated_screenshot: {
    description: "screenshots repeated within a small call window",
    suggestion: "Capture once after the page settles, or target the relevant selector/block."
  },
  serial_form_fill: {
    description: "multiple fillInput calls were issued serially",
    suggestion: "Use fillForm for independent fields so one model round can fill them together."
  }
};

type MutableFinding = {
  id: FindingId;
  occurrences: number;
  sessions: Set<string>;
  avoidableEventIds: Set<string>;
};

function finding(map: Map<FindingId, MutableFinding>, id: FindingId): MutableFinding {
  let current = map.get(id);
  if (!current) {
    current = { id, occurrences: 0, sessions: new Set(), avoidableEventIds: new Set() };
    map.set(id, current);
  }
  return current;
}

function addFinding(
  map: Map<FindingId, MutableFinding>,
  id: FindingId,
  sessionKey: string,
  eventIds: string[]
): void {
  const current = finding(map, id);
  current.occurrences++;
  current.sessions.add(sessionKey);
  for (const eventId of eventIds) current.avoidableEventIds.add(eventId);
}

function bySession(events: ToolEvent[]): Map<string, ToolEvent[]> {
  const sessions = new Map<string, ToolEvent[]>();
  for (const event of events) {
    const current = sessions.get(event.sessionKey) ?? [];
    current.push(event);
    sessions.set(event.sessionKey, current);
  }
  for (const current of sessions.values()) {
    current.sort((a, b) =>
      (a.timestampMs ?? 0) - (b.timestampMs ?? 0) || a.sequence - b.sequence
    );
  }
  return sessions;
}

function isStateBoundary(tool: string): boolean {
  return /^(?:browser_)?(?:click|clickByUid|fill|fillInput|fillByUid|fillForm|selectOption|setCheckbox|submitForm|navigate|openTab|closeTab|switchToTab|scroll|resize|pressKey|drag|drop|uploadFile|runJS|waitFor)$/.test(tool);
}

function previousStableWindow(events: ToolEvent[], index: number): ToolEvent[] {
  const previous: ToolEvent[] = [];
  for (let cursor = index - 1; cursor >= 0 && previous.length < 3; cursor--) {
    const candidate = events[cursor];
    previous.unshift(candidate);
    if (isStateBoundary(candidate.tool)) break;
  }
  return previous;
}

export function analyzeEvents(events: ToolEvent[], context: AnalysisContext): AnalysisReport {
  const findings = new Map<FindingId, MutableFinding>();
  const avoidableEventIds = new Set<string>();

  for (const current of bySession(events).values()) {
    for (let index = 0; index < current.length; index++) {
      const event = current[index];
      const previous = current.slice(Math.max(0, index - 3), index);
      const stablePrevious = previousStableWindow(current, index);

      if (event.signals.fixedWait) {
        addFinding(findings, "fixed_wait", event.sessionKey, [event.id]);
      }
      if (event.signals.viewportProbe) {
        const trigger = [...stablePrevious].reverse().find((candidate) =>
          candidate.tool === "browser_resize" || candidate.tool === "browser_screenshot"
        );
        if (trigger) {
          addFinding(
            findings,
            trigger.tool === "browser_resize"
              ? "viewport_recheck_after_resize"
              : "viewport_recheck_after_screenshot",
            event.sessionKey,
            [event.id]
          );
        }
      }
      if (event.signals.enablesDiscovery) {
        const catalog = [...previous].reverse().find((candidate) => candidate.signals.emptyDiscovery);
        if (catalog) addFinding(findings, "discovery_round_trip", event.sessionKey, [catalog.id]);
      }
      if (
        event.argHash &&
        stablePrevious.some((candidate) => candidate.tool === event.tool && candidate.argHash === event.argHash)
      ) {
        addFinding(findings, "duplicate_call", event.sessionKey, [event.id]);
      }
      if (
        event.tool === "browser_screenshot" &&
        stablePrevious.some((candidate) => candidate.tool === "browser_screenshot")
      ) {
        addFinding(findings, "repeated_screenshot", event.sessionKey, [event.id]);
      }
    }

    for (let start = 0; start < current.length;) {
      if (current[start].tool !== "browser_fillInput") {
        start++;
        continue;
      }
      let end = start + 1;
      while (end < current.length && current[end].tool === "browser_fillInput") end++;
      if (end - start >= 2) {
        addFinding(
          findings,
          "serial_form_fill",
          current[start].sessionKey,
          current.slice(start + 1, end).map((event) => event.id)
        );
      }
      start = end;
    }
  }

  for (const current of findings.values()) {
    for (const eventId of current.avoidableEventIds) avoidableEventIds.add(eventId);
  }

  const tools = new Map<string, number>();
  const sessions = new Set<string>();
  const rounds = new Map<string, { input: number; output: number }>();
  let exactCalls = 0;
  let derivedCalls = 0;
  let resultBytes = 0;
  for (const event of events) {
    tools.set(event.tool, (tools.get(event.tool) ?? 0) + 1);
    sessions.add(event.sessionKey);
    if (event.confidence === "exact") exactCalls++;
    else derivedCalls++;
    resultBytes += event.resultBytes ?? 0;
    const roundId = `${event.sessionKey}:${event.roundKey}`;
    const prior = rounds.get(roundId) ?? { input: 0, output: 0 };
    rounds.set(roundId, {
      input: Math.max(prior.input, event.roundInputTokens ?? 0),
      output: Math.max(prior.output, event.roundOutputTokens ?? 0)
    });
  }

  const publicFindings: Finding[] = [...findings.values()]
    .map((current) => ({
      id: current.id,
      ...FINDING_COPY[current.id],
      occurrences: current.occurrences,
      affectedSessions: current.sessions.size,
      estimatedAvoidableRounds: current.avoidableEventIds.size
    }))
    .sort((a, b) => b.estimatedAvoidableRounds - a.estimatedAvoidableRounds || a.id.localeCompare(b.id));

  return {
    generatedAt: context.generatedAt,
    since: context.since,
    clients: context.clients,
    summary: {
      toolCalls: events.length,
      exactCalls,
      derivedCalls,
      sessions: sessions.size,
      modelToolRounds: rounds.size,
      toolRoundInputTokens: [...rounds.values()].reduce((sum, usage) => sum + usage.input, 0),
      toolRoundOutputTokens: [...rounds.values()].reduce((sum, usage) => sum + usage.output, 0),
      resultBytes,
      estimatedAvoidableRounds: avoidableEventIds.size
    },
    tools: [...tools.entries()]
      .map(([name, calls]) => ({ name, calls }))
      .sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name)),
    findings: publicFindings,
    privacy: {
      rawContentRetained: false,
      rawPathsRetained: false,
      argumentValuesRetained: false
    }
  };
}
