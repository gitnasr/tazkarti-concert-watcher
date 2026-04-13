export type ShowRecord = {
  id: number;
  name?: string;
  portalStatus?: number;
};

export type EventRecord = {
  id: number;
  name: string;
  description?: string;
  startDate?: string;
  minimumPrice?: number;
  venue?: { name?: string | null } | null;
  shows?: ShowRecord[];
};

export type MatchResult = {
  event: EventRecord;
  score: number;
  matchedShowIds: number[];
};

export type ReleaseDecision = {
  shouldAlert: boolean;
  newEventIds: number[];
  newShowIds: number[];
};

export type FaultKind =
  | "http-403"
  | "http-429"
  | "http-5xx"
  | "timeout"
  | "invalid-json"
  | "invalid-payload"
  | "network";

export type FaultInfo = {
  kind: FaultKind;
  message: string;
};

export type FaultSnapshot = FaultInfo & {
  sinceMs: number;
  lastAlertMs: number;
  escalated: boolean;
};

export type WatcherState = {
  alertedEventIds: number[];
  alertedShowIds: number[];
  activeFault: FaultSnapshot | null;
};

export type FaultTransition =
  | {
      type: "entered";
      snapshot: FaultSnapshot;
      previous: FaultSnapshot | null;
    }
  | {
      type: "escalated";
      snapshot: FaultSnapshot;
      durationMs: number;
    }
  | {
      type: "recovered";
      snapshot: FaultSnapshot;
      durationMs: number;
    };

export type NotificationPriority = "high" | "urgent";

export type NotificationInput = {
  title: string;
  message: string;
  priority: NotificationPriority;
  tags: string[];
};

export type WatcherConfig = {
  targetName: string;
  ntfyEndpoint: string;
  pollIntervalMs: number;
  ntfyToken?: string;
  host: string;
};

export type RuntimeState = {
  stopped: boolean;
  pollCount: number;
  activeFetchController: AbortController | null;
  lastMatch: MatchResult | null;
  lastPollStartedAt: number | null;
  lastSuccessfulPollAt: number | null;
  sleepTimer: NodeJS.Timeout | null;
  sleepResolve: (() => void) | null;
};

export type RunContext = {
  config: WatcherConfig;
  runtime: RuntimeState;
  stateRef: { current: WatcherState };
};
