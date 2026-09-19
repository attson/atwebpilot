export type SessionClient = "claude" | "codex";
export type EventConfidence = "exact" | "derived";

export type EventSignals = {
  fixedWait?: boolean;
  viewportProbe?: boolean;
  emptyDiscovery?: boolean;
  enablesDiscovery?: boolean;
};

export type ToolEvent = {
  /** Non-reversible identifier used only to deduplicate findings. */
  id: string;
  client: SessionClient;
  /** SHA-256-derived session identifier; never the client's raw session id/path. */
  sessionKey: string;
  /** Hashed or synthetic model response identifier. */
  roundKey: string;
  sequence: number;
  timestampMs?: number;
  tool: string;
  argFields: string[];
  argHash?: string;
  resultBytes?: number;
  isError?: boolean;
  confidence: EventConfidence;
  signals: EventSignals;
  roundInputTokens?: number;
  roundOutputTokens?: number;
};

export type ParsedSession = {
  events: ToolEvent[];
  malformedLines: number;
};

export type ClientScanStats = {
  available: boolean;
  filesSeen: number;
  filesScanned: number;
  malformedLines: number;
  toolCalls: number;
  exactCalls: number;
  derivedCalls: number;
};

export type FindingId =
  | "viewport_recheck_after_resize"
  | "viewport_recheck_after_screenshot"
  | "fixed_wait"
  | "discovery_round_trip"
  | "duplicate_call"
  | "repeated_screenshot"
  | "serial_form_fill";

export type Finding = {
  id: FindingId;
  description: string;
  suggestion: string;
  occurrences: number;
  affectedSessions: number;
  estimatedAvoidableRounds: number;
};

export type AnalysisReport = {
  generatedAt: string;
  since: string;
  clients: Record<SessionClient, ClientScanStats>;
  summary: {
    toolCalls: number;
    exactCalls: number;
    derivedCalls: number;
    sessions: number;
    modelToolRounds: number;
    toolRoundInputTokens: number;
    toolRoundOutputTokens: number;
    resultBytes: number;
    estimatedAvoidableRounds: number;
  };
  tools: Array<{ name: string; calls: number }>;
  findings: Finding[];
  privacy: {
    rawContentRetained: false;
    rawPathsRetained: false;
    argumentValuesRetained: false;
  };
};

export type AnalysisContext = {
  generatedAt: string;
  since: string;
  clients: Record<SessionClient, ClientScanStats>;
};

export type CliOptions = {
  clients: SessionClient[];
  sinceMs: number;
  sinceLabel: string;
  format: "text" | "json";
  claudeDir: string;
  codexDir: string;
  help: boolean;
};
