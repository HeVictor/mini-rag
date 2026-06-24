import { AgentRequest, AgentResponse } from "./types";
import { pineconeClient } from "@/app/libs/pinecone";
import { openaiClient } from "@/app/libs/openai/openai";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

export async function ragAgent(request: AgentRequest): Promise<AgentResponse> {
  //   1. Generate embedding for the query
  const embeddingResponse = await openaiClient.embeddings.create({
    model: "text-embedding-3-small",
    dimensions: 512,
    input: request.query,
  });

  const embedding = embeddingResponse.data[0].embedding;
  //   2. Query Pinecone for similar documents
  const index = pineconeClient.Index(process.env.PINECONE_INDEX as string);

  const queryResponse = await index.query({
    vector: embedding,
    topK: 5,
    includeMetadata: true,
  });

  //   3. Extract text from results
  const retrievedContext = queryResponse.matches
    .map((match) => match.metadata?.text)
    .filter(Boolean)
    .join("\n\n");

  //   4. Build system prompt with context
  const systemPrompt = `You are a helpful assistant that answers questions based on the provided context.

	Use the provided context to answer the user's question. If the context doesn't contain enough information, state so clearly but still try your best to answer the query.`;
  //   5. Stream the response
  return streamText({
    model: openai("gpt-4o"),
    system: systemPrompt,
    prompt: `Context: ${retrievedContext}\n\nUser Query: ${request.query}`,
  });

  // Then follow Module 9.2 to add reranking for better retrieval quality.
}
