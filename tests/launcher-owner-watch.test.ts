import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultConfig } from "../src/config";
import { launcherOwnerPid, watchLauncherOwner } from "../src/launcher-owner-watch";

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 1_000;
  while (!predicate() && Date.now() < deadline) await Bun.sleep(2);
  expect(predicate()).toBe(true);
}

function withConfigDir<T>(prepare: (root: string) => void, run: (root: string) => T): T {
  const root = mkdtempSync(join(tmpdir(), "codex-chatgpt-web-owner-watch-"));
  const previous = process.env.CODEX_CHATGPT_WEB_HOME;
  process.env.CODEX_CHATGPT_WEB_HOME = root;
  try {
    prepare(root);
    return run(root);
  } finally {
    if (previous === undefined) delete process.env.CODEX_CHATGPT_WEB_HOME;
    else process.env.CODEX_CHATGPT_WEB_HOME = previous;
    rmSync(root, { recursive: true, force: true });
  }
}

function writeMarker(root: string, ownerPid: unknown): void {
  mkdirSync(join(root, "runtime"), { recursive: true });
  writeFileSync(
    join(root, "runtime", "launcher-supervisor.json"),
    JSON.stringify({ version: 1, ownerPid, daemonPid: process.pid, tunnelPid: null, status: "starting" }),
  );
}

const launcherConfig = (root: string) => ({
  ...defaultConfig("browser-only"),
  browserHost: "launcher" as const,
  browserHostDescriptorPath: join(root, "runtime", "launcher-browser.json"),
});

test("launcher owner watch fires exactly once after the owner process disappears", async () => {
  let alive = true;
  let fired = 0;
  const probed: number[] = [];
  watchLauncherOwner({
    ownerPid: 4242,
    intervalMs: 2,
    isRunning: (pid) => { probed.push(pid); return alive; },
    onOwnerGone: () => { fired += 1; },
  });

  await Bun.sleep(20);
  expect(fired).toBe(0);
  alive = false;
  await waitFor(() => fired === 1);
  await Bun.sleep(20);
  expect(fired).toBe(1);
  expect(new Set(probed)).toEqual(new Set([4242]));
});

test("a stopped launcher owner watch never fires", async () => {
  let fired = 0;
  const stop = watchLauncherOwner({
    ownerPid: 4242,
    intervalMs: 2,
    isRunning: () => false,
    onOwnerGone: () => { fired += 1; },
  });
  stop();
  await Bun.sleep(20);
  expect(fired).toBe(0);
});

test("only launcher-hosted runtimes have an owner to watch", () => {
  withConfigDir((root) => writeMarker(root, process.pid), () => {
    expect(launcherOwnerPid(defaultConfig("browser-only"))).toBeUndefined();
  });
});

test("the live supervisor ownership marker names the launcher owner", () => {
  withConfigDir((root) => writeMarker(root, process.pid), (root) => {
    expect(launcherOwnerPid(launcherConfig(root))).toBe(process.pid);
  });
});

test("a stale or missing ownership marker falls back to the browser descriptor", () => {
  withConfigDir((root) => writeMarker(root, 2_147_483_646), (root) => {
    expect(launcherOwnerPid(launcherConfig(root))).toBeUndefined();
  });
  withConfigDir(() => {}, (root) => {
    expect(launcherOwnerPid(launcherConfig(root))).toBeUndefined();
  });
});
