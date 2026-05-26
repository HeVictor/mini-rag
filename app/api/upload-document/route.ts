import { NextRequest, NextResponse } from "next/server";
import { DataProcessor } from "@/app/libs/dataProcessor";
import { openaiClient } from "@/app/libs/openai/openai";
import { pineconeClient } from "@/app/libs/pinecone";
import { z } from "zod";

const uploadDocumentSchema = z.object({
  urls: z.array(z.string().url()).min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const parsedBody = uploadDocumentSchema.parse(body);
    const { urls } = parsedBody;

    const dataProcessor = new DataProcessor();
    const chunks = await dataProcessor.processUrls(urls);

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "No content retrieved from URL's provided" },
        { status: 400 },
      );
    }

    const indexName = process.env.PINECONE_INDEX;
    if (!indexName) {
      throw new Error("PINECONE_INDEX environment variable not set");
    }

    const index = pineconeClient.Index(indexName);

    const batchSize = 100;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      console.log(
        `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
          chunks.length / batchSize,
        )}...`,
      );

      try {
        const embeddingResponse = await openaiClient.embeddings.create({
          model: "text-embedding-3-small",
          dimensions: 512,
          input: batch.map((chunk) => chunk.content),
        });

        const vectors = batch.map((chunk, idx) => ({
          id: chunk.id,
          values: embeddingResponse.data[idx].embedding,
          metadata: {
            text: chunk.content,
            ...chunk.metadata,
          },
        }));

        // Upload to Pinecone
        await index.upsert(vectors);
        successCount += batch.length;
      } catch (error) {
        failCount += batch.length;
        console.error(`❌ Failed to process batch:`, error);
      }
    }

    return NextResponse.json(
      {
        success: true,
        chunksProcessed: chunks.length,
        vectorsUploaded: successCount,
      },

      { status: 200 },
    );
  } catch (error) {
    console.error("Error uploading documents:", error);
    return NextResponse.json(
      { error: "Failed to upload documents" },
      { status: 500 },
    );
  }
}
