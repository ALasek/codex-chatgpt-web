import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CHATGPT_WEB_ASTRA_BACKEND_MODEL,
  CHATGPT_WEB_BACKEND_MODEL,
  type ChatGptWebAdapterEffort,
  type ChatGptWebModelPreference,
} from "./chatgpt-web-models";
import { atomicWriteFile, getConfigDir } from "./config";

interface StoredPreference extends ChatGptWebModelPreference {
  updatedAt: string;
}
interface RoutingState {
  version: 1;
  threads: Record<string, StoredPreference>;
}

const VALID_EFFORTS = new Set<ChatGptWebAdapterEffort>(["low", "medium", "high", "xhigh", "max"]);
const MAX_PINNED_THREADS = 1_024;

function validPreference(value: unknown): value is ChatGptWebModelPreference {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as { model?: unknown; effort?: unknown };
  return (candidate.model === CHATGPT_WEB_BACKEND_MODEL
      || candidate.model === CHATGPT_WEB_ASTRA_BACKEND_MODEL)
    && typeof candidate.effort === "string"
    && VALID_EFFORTS.has(candidate.effort as ChatGptWebAdapterEffort);
}

export class ChatGptWebThreadModelStore {
  private readonly threads = new Map<string, StoredPreference>();

  constructor(private readonly path = join(getConfigDir(), "runtime", "thread-model-routes.json")) {
    if (!existsSync(path)) return;
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<RoutingState>;
      if (parsed.version !== 1 || !parsed.threads || typeof parsed.threads !== "object") return;
      const entries = Object.entries(parsed.threads)
        .filter((entry): entry is [string, StoredPreference] => (
          Boolean(entry[0])
          && validPreference(entry[1])
          && typeof entry[1].updatedAt === "string"
        ))
        .sort((left, right) => left[1].updatedAt.localeCompare(right[1].updatedAt))
        .slice(-MAX_PINNED_THREADS);
      for (const [threadId, preference] of entries) this.threads.set(threadId, preference);
    } catch {
      // A corrupt optional preference cache must not prevent the bridge from starting.
    }
  }

  resolve(threadId: string | undefined, fallback: ChatGptWebModelPreference): ChatGptWebModelPreference {
    if (!threadId) return fallback;
    const pinned = this.threads.get(threadId);
    if (pinned) return { model: pinned.model, effort: pinned.effort };
    this.threads.set(threadId, { ...fallback, updatedAt: new Date().toISOString() });
    while (this.threads.size > MAX_PINNED_THREADS) {
      const oldest = this.threads.keys().next().value as string | undefined;
      if (!oldest) break;
      this.threads.delete(oldest);
    }
    this.persist();
    return fallback;
  }

  clear(): void {
    this.threads.clear();
    this.persist();
  }

  private persist(): void {
    const state: RoutingState = { version: 1, threads: Object.fromEntries(this.threads) };
    atomicWriteFile(this.path, `${JSON.stringify(state, null, 2)}\n`);
  }
}

const stores = new Map<string, ChatGptWebThreadModelStore>();

export function chatGptWebThreadModelStore(
  path = join(getConfigDir(), "runtime", "thread-model-routes.json"),
): ChatGptWebThreadModelStore {
  let store = stores.get(path);
  if (!store) {
    store = new ChatGptWebThreadModelStore(path);
    stores.set(path, store);
  }
  return store;
}
