import { ChatOpenAI } from "@langchain/openai";

const globalForModel = globalThis as unknown as {
  llmModel: ChatOpenAI | undefined;
};

export function getModel(): ChatOpenAI {
  if (globalForModel.llmModel) {
    return globalForModel.llmModel;
  }

  const model = new ChatOpenAI({
    model: process.env.OPENROUTER_MODEL || "glm-4.5-air",
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
    },
    apiKey: process.env.OPENROUTER_API_KEY,
    temperature: 0.1,
    maxTokens: 4096,
  });

  if (process.env.NODE_ENV !== "production") {
    globalForModel.llmModel = model;
  }

  return model;
}
