import { z } from "zod";
import { StreamTextResult } from "ai";

export const agentTypeSchema = z
  .enum(["linkedin", "rag", "unknown"])
  .describe(
    "The agent to use: linkedin for help writing posts, rag for help with technical questions, and unknown if the request cannot be handled",
  );

export type AgentType = z.infer<typeof agentTypeSchema>;

export const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

export type Message = z.infer<typeof messageSchema>;

export interface AgentRequest {
  type: AgentType;
  query: string; // Refined/summarized query from selector
  originalQuery: string; // Original user message
  messages: Message[]; // Conversation history
}

export interface Source {
  title: string;
  textSample: string;
  url: string;
  score: number;
}

export type AgentResponse = {
  streamResult: StreamTextResult<Record<string, never>, never>;
  sources?: Source[];
};

export interface AgentConfig {
  name: string;
  description: string;
}
