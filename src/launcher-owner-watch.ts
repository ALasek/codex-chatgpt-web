import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getConfigDir, type AppConfig } from "./config";
import { readLauncherBrowserHostDescriptor } from "./launcher-browser-host";
import { processRunning } from "./process";

export interface LauncherOwnerWatchOptions {
  ownerPid: number;
  onOwnerGone: () => void;
  intervalMs?: number;
  isRunning?: (pid: number) => boolean;
}

// The launcher connects the Codex route while it owns this daemon. If the launcher dies without
// running its quit path (crash, task kill, logoff), nobody else can restore the native route, so the
// daemon watches its owner and fires exactly once when it disappears.
export function watchLauncherOwner({
  ownerPid,
  onOwnerGone,
  intervalMs = 2_000,
  isRunning = processRunning,
}: LauncherOwnerWatchOptions): () => void {
  let fired = false;
  const timer = setInterval(() => {
    if (fired || isRunning(ownerPid)) return;
    fired = true;
    clearInterval(timer);
    onOwnerGone();
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}

function validPid(value: unknown): number | undefined {
  return Number.isInteger(value) && (value as number) >= 1 ? (value as number) : undefined;
}

// The supervisor writes its ownership marker before spawning the daemon; the browser descriptor is
// the fallback because the launcher may still be initializing its browser surface at that moment.
export function launcherOwnerPid(config: AppConfig): number | undefined {
  if (config.browserHost !== "launcher") return undefined;
  const marker = join(getConfigDir(), "runtime", "launcher-supervisor.json");
  if (existsSync(marker)) {
    try {
      const state = JSON.parse(readFileSync(marker, "utf8")) as Record<string, unknown>;
      const pid = validPid(state.ownerPid);
      if (pid !== undefined && processRunning(pid)) return pid;
    } catch {
      // fall through to the descriptor
    }
  }
  if (!config.browserHostDescriptorPath) return undefined;
  try {
    return readLauncherBrowserHostDescriptor(config.browserHostDescriptorPath).pid;
  } catch {
    return undefined;
  }
}
