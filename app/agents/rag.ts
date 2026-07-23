import { AgentRequest, AgentResponse, Source } from "./types";
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
    topK: 10,
    includeMetadata: true,
  });

  //   2a. Re-rank the results using Pinecone's inference API
  const documents = queryResponse.matches
    .map((match) => (match.metadata?.text ?? match.metadata?.content) as string)
    .filter(Boolean);

  // topN: Number of top results to return after reranking
  // - Lower values (3-5) = more focused, highest relevance only
  // - Higher values (10+) = more context, but may include less relevant docs
  // returnDocuments: true means we get the actual text back, not just scores
  const reranked = await pineconeClient.inference.rerank(
    "bge-reranker-v2-m3",
    request.query,
    documents,
    { topN: 5, returnDocuments: true },
  );

  //   2b. Only keep documents above a score threshold
  const scoreThreshold = 0.1;
  const rerankedDataWithThreshold = reranked.data.filter(
    (result) => result.score >= scoreThreshold,
  );

  //   3. Extract text from results
  const retrievedContext = rerankedDataWithThreshold
    .map((result) => result.document?.text)
    .filter(Boolean)
    .join("\n\n");

  //   3a. Extract the sources from the documents we used for the response context
  const contextSources: Source[] = rerankedDataWithThreshold.map((data) => {
    const metadata = queryResponse.matches[data.index].metadata;

    return {
      title: (metadata?.title || "Untitled") as string,
      textSample: ((data.document?.text)
        .trim()
        .split(/\s+/)
        .slice(0, 3)
        .join(" ") + "...") as string, // Get the first 3 words from the chunk
      url: (metadata?.url || "") as string,
      score: data.score || 0,
    };
  });

  //   4. Build system prompt with context or inform the user that there is not enough info if
  //      no results pass threshold
  const systemPrompt =
    rerankedDataWithThreshold.length > 0
      ? `You are a helpful assistant that answers questions based on the provided context.
   Use the provided context to answer the user's question.`
      : `Respond with "I don't have enough information to answer that"`;

  const discardedData = reranked.data.filter(
    (result) => result.score < scoreThreshold,
  );

  //   5. Stream the response
  return {
    streamResult: streamText({
      model: openai("gpt-4o"),
      system: systemPrompt,
      prompt: `Context: ${retrievedContext}\n\nUser Query: ${request.query}`,
    }),
    sources: contextSources,
  };
}
