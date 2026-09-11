import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  CHATGPT_WEB_ASTRA_BACKEND_MODEL,
  CHATGPT_WEB_BACKEND_MODEL,
} from "../src/chatgpt-web-models";
import { ChatGptWebThreadModelStore } from "../src/web-model-routing";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function statePath(): string {
  const root = mkdtempSync(join(tmpdir(), "codex-web-routing-"));
  roots.push(root);
  return join(root, "runtime", "thread-model-routes.json");
}

describe("per-task Web model routing", () => {
  test("keeps the first Web selection across a native-model detour and process restart", () => {
    const path = statePath();
    const store = new ChatGptWebThreadModelStore(path);
    expect(store.resolve("thread-1", { model: CHATGPT_WEB_BACKEND_MODEL, effort: "high" }))
      .toEqual({ model: CHATGPT_WEB_BACKEND_MODEL, effort: "high" });
    // Native turns never touch this store. Returning to Web with a changed launcher default must
    // therefore recover the task's original Web choice rather than silently switching it.
    expect(store.resolve("thread-1", { model: CHATGPT_WEB_ASTRA_BACKEND_MODEL, effort: "max" }))
      .toEqual({ model: CHATGPT_WEB_BACKEND_MODEL, effort: "high" });
    expect(new ChatGptWebThreadModelStore(path)
      .resolve("thread-1", { model: CHATGPT_WEB_ASTRA_BACKEND_MODEL, effort: "max" }))
      .toEqual({ model: CHATGPT_WEB_BACKEND_MODEL, effort: "high" });
  });

  test("uses the current launcher default when Codex provides no task identity", () => {
    const path = statePath();
    const store = new ChatGptWebThreadModelStore(path);
    expect(store.resolve(undefined, { model: CHATGPT_WEB_ASTRA_BACKEND_MODEL, effort: "low" }))
      .toEqual({ model: CHATGPT_WEB_ASTRA_BACKEND_MODEL, effort: "low" });
    expect(() => readFileSync(path, "utf8")).toThrow();
  });

  test("ignores a corrupt optional cache and repairs it on the first identified task", () => {
    const path = statePath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "not json");
    const store = new ChatGptWebThreadModelStore(path);
    expect(store.resolve("thread-2", { model: CHATGPT_WEB_ASTRA_BACKEND_MODEL, effort: "medium" }))
      .toEqual({ model: CHATGPT_WEB_ASTRA_BACKEND_MODEL, effort: "medium" });
    expect(JSON.parse(readFileSync(path, "utf8")).threads["thread-2"])
      .toMatchObject({ model: CHATGPT_WEB_ASTRA_BACKEND_MODEL, effort: "medium" });
  });
});
