import { ChatOpenAI } from "@langchain/openai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

type LLMProvider = "openrouter" | "ollama";

const globalForModel = globalThis as unknown as {
  llmModel: BaseChatModel | undefined;
  llmProvider: string | undefined;
};

function getProvider(): LLMProvider {
  const provider = (process.env.LLM_PROVIDER || "openrouter").toLowerCase();
  if (provider === "ollama") return "ollama";
  return "openrouter";
}

export function getModel(): BaseChatModel {
  const provider = getProvider();

  // Return cached model if provider hasn't changed
  if (globalForModel.llmModel && globalForModel.llmProvider === provider) {
    return globalForModel.llmModel;
  }

  let model: BaseChatModel;

  if (provider === "ollama") {
    // Ollama exposes an OpenAI-compatible API at /v1
    const baseURL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const modelName = process.env.OLLAMA_MODEL || "llama3.1";

    console.log(`[LLM] Using Ollama provider: ${modelName} @ ${baseURL}`);

    model = new ChatOpenAI({
      model: modelName,
      configuration: {
        baseURL: `${baseURL.replace(/\/$/, "")}/v1`,
      },
      apiKey: "ollama", // Ollama doesn't need a real key, but the field is required
      temperature: 0.1,
      maxTokens: 4096,
    });
  } else {
    // OpenRouter (default)
    const modelName = process.env.OPENROUTER_MODEL || "qwen/qwen3-coder";
    console.log(`[LLM] Using OpenRouter provider: ${modelName}`);

    model = new ChatOpenAI({
      model: modelName,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
      },
      apiKey: process.env.OPENROUTER_API_KEY,
      temperature: 0.1,
      maxTokens: 4096,
    });
  }

  if (process.env.NODE_ENV !== "production") {
    globalForModel.llmModel = model;
    globalForModel.llmProvider = provider;
  }

  return model;
}

/** Returns the current provider name and model for display purposes. */
export function getModelInfo(): { provider: string; model: string } {
  const provider = getProvider();
  if (provider === "ollama") {
    return {
      provider: "Ollama",
      model: process.env.OLLAMA_MODEL || "llama3.1",
    };
  }
  return {
    provider: "OpenRouter",
    model: process.env.OPENROUTER_MODEL || "qwen/qwen3-coder",
  };
}
