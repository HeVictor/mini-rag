import { searchDocuments } from "@/app/libs/pinecone";
import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";

const searchDocumentRequestSchema = z.object({
  query: z.string(),
  topK: z.number().optional().default(5),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsedBody = searchDocumentRequestSchema.parse(body);

    const { query, topK } = parsedBody;

    const results = await searchDocuments(query, topK);

    const formattedResults = results.map((doc) => ({
      id: doc.id,
      score: doc.score,
      content: doc.metadata?.text || "",
      source: doc.metadata?.source || "unknown",
      chunkIndex: doc.metadata?.chunkIndex,
      totalChunks: doc.metadata?.totalChunks,
    }));

    return NextResponse.json(
      {
        query,
        resultsCount: formattedResults.length,
        results: formattedResults,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error searching documents:", error);
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Request body failed validation" },
        { status: 400 },
      );
    } else {
      return NextResponse.json(
        { error: "Failed to perform search documents query" },
        { status: 500 },
      );
    }
  }
}
