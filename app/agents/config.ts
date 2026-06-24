import { AgentType, AgentConfig } from "./types";

export const agentConfigs: Record<AgentType, AgentConfig> = {
  linkedin: {
    name: "LinkedIn Agent",
    description: "For writing posts in a certain voice and tone for LinkedIn",
  },
  rag: {
    name: "RAG Agent",
    description:
      "For questions about documentation regarding Typescript, NextJS, Pinecone, Vercel AI SDK technical content, or information that requires knowledge base retrieval",
  },
  unknown: {
    name: "Unknown Agent fallback",
    description:
      "For explaining to users when their queries cannot be answered by one of the other existing agents, and will do its best to still try and answer the user's query",
  },
};
