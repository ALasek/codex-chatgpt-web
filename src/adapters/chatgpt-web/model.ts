import {
  CHATGPT_WEB_ASTRA_BACKEND_MODEL,
  CHATGPT_WEB_BACKEND_MODEL,
  CHATGPT_WEB_LUNA_BACKEND_MODEL,
} from "../../chatgpt-web-models";

export const CHATGPT_WEB_MODEL_ID = CHATGPT_WEB_BACKEND_MODEL;
export const CHATGPT_WEB_ASTRA_MODEL_ID = CHATGPT_WEB_ASTRA_BACKEND_MODEL;
export const CHATGPT_WEB_LUNA_MODEL_ID = CHATGPT_WEB_LUNA_BACKEND_MODEL;

export interface ChatGptWebCapabilities {
  localToolsEnabled: boolean;
  solAvailable: boolean;
  proAvailable: boolean;
}

export interface ChatGptWebModelMode {
  modelId: string;
  effort: "low" | "medium" | "high" | "xhigh" | "max";
  displayLabel: string;
  modelLabel: "Luna" | "Sol" | "Astra";
  uiEffortIndex: 0 | 1 | 2 | 3 | 4 | null;
  thinkEnabled: boolean;
  localTools: boolean;
}

export function resolveChatGptWebModelMode(
  modelId: string,
  reasoning: string | undefined,
  capabilities: ChatGptWebCapabilities,
): ChatGptWebModelMode {
  if (modelId === CHATGPT_WEB_LUNA_MODEL_ID) {
    if (capabilities.solAvailable) {
      throw new Error("ChatGPT Luna is not available while the account exposes the Sol model selector");
    }
    const effort = reasoning ?? "low";
    if (effort !== "low" && effort !== "medium") {
      throw new Error(`ChatGPT Luna mode is not supported: ${effort}`);
    }
    const thinkEnabled = effort === "medium";
    return {
      modelId,
      effort,
      displayLabel: thinkEnabled ? "Think" : "Luna",
      modelLabel: "Luna",
      uiEffortIndex: null,
      thinkEnabled,
      localTools: capabilities.localToolsEnabled,
    };
  }
  if (modelId !== CHATGPT_WEB_MODEL_ID && modelId !== CHATGPT_WEB_ASTRA_MODEL_ID) {
    throw new Error(`ChatGPT web model is not supported: ${modelId}`);
  }
  const modelLabel = modelId === CHATGPT_WEB_ASTRA_MODEL_ID ? "Astra" : "Sol";
  if (!capabilities.solAvailable) {
    throw new Error("ChatGPT model controls are not available for this Luna-only account");
  }
  const effort = reasoning ?? "high";
  switch (effort) {
    case "low":
      return { modelId, effort, modelLabel, displayLabel: `${modelLabel} · Low`, uiEffortIndex: 0, thinkEnabled: false, localTools: capabilities.localToolsEnabled };
    case "medium":
      return { modelId, effort, modelLabel, displayLabel: `${modelLabel} · Medium`, uiEffortIndex: 1, thinkEnabled: false, localTools: capabilities.localToolsEnabled };
    case "high":
      return { modelId, effort, modelLabel, displayLabel: `${modelLabel} · High`, uiEffortIndex: 2, thinkEnabled: false, localTools: capabilities.localToolsEnabled };
    case "xhigh":
      if (!capabilities.proAvailable) throw new Error("ChatGPT Extra High effort is not available for this account");
      return { modelId, effort, modelLabel, displayLabel: `${modelLabel} · Extra High`, uiEffortIndex: 3, thinkEnabled: false, localTools: capabilities.localToolsEnabled };
    case "max":
      if (!capabilities.proAvailable) throw new Error("ChatGPT Pro effort is not available for this account");
      return { modelId, effort, modelLabel, displayLabel: `${modelLabel} · Max`, uiEffortIndex: 4, thinkEnabled: false, localTools: capabilities.localToolsEnabled };
    default:
      throw new Error(`ChatGPT web effort is not supported: ${effort}`);
  }
}
