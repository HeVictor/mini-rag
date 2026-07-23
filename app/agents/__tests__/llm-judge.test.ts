/**
 * LLM-AS-JUDGE TESTS
 *
 * The tests evaluate response quality using another LLM as a judge - this emulates a user reading a generated response and scoring them.
 * This targets the responses returned from the RAG agent.
 * Useful for catching regressions when:
 * - Model versions change
 * - Prompts are modified
 * - RAG retrieval drifts
 */

import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { POST } from "@/app/api/chat/route";
import { openaiClient } from "@/app/libs/openai/openai";

// ============================================================================
// JUDGE CONFIGURATION
// ============================================================================

const PASSING_SCORE = 8;

// Schema for the output from the judge LLM
const JudgeResultSchema = z.object({
  score: z.number().min(1).max(10),
  reason: z.string(),
});

type JudgeResult = z.infer<typeof JudgeResultSchema>;

const JUDGE_SYSTEM_PROMPT = `You are an expert judge that evaluates AI response quality.

Compare the ACTUAL response against the REFERENCE response and score from 1-10:

SCORING CRITERIA:
- 10: Perfect - covers all key points, is equally or more comprehensive and helpful
- 8-9: Excellent - covers most key points, minor omissions which are not deal-breakers
- 6-7: Good - covers main points but missing important details in comparison
- 4-5: Fair - partially correct but significant gaps in the response regarding critical concepts
- 2-3: Poor - mostly incorrect or unhelpful in the response
- 1: Failed - completely wrong or off-topic in the response

IMPORTANT:
- Focus on factual accuracy and completeness
- The actual response doesn't need identical wording, it just needs to convey a similar level of information and context
- If one or two of the points between the actual and the reference responses are different, but the different points for the actual response are also important and vital, don't penalise the scoring
- The actual response CAN be better than the reference (in this case still score it a 10)
- Penalize incorrect information heavily
- Score higher if the user will find the response useful and helpful, and score lower if otherwise`;

async function judgeResponse(
  question: string,
  actualResponse: string,
  goldenResponse: string,
): Promise<JudgeResult> {
  const response = await openaiClient.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      { role: "system", content: JUDGE_SYSTEM_PROMPT },
      {
        role: "user",
        content: `QUESTION: ${question}

REFERENCE RESPONSE:
${goldenResponse}

ACTUAL RESPONSE:
${actualResponse}

Score the actual response against the reference.`,
      },
    ],
    response_format: zodResponseFormat(JudgeResultSchema, "judge_result"),
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return { score: 0, reason: "No response from judge" };
  }

  return JSON.parse(content) as JudgeResult;
}

async function getRAGResponse(question: string): Promise<string> {
  const request = {
    json: async () => ({
      messages: [{ role: "user", content: question }],
      agent: "rag",
      query: question,
    }),
  } as Request;

  const response = await POST(request);

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let fullResponse = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fullResponse += decoder.decode(value, { stream: true });
  }

  return fullResponse;
}

const TEST_CASES = [
  {
    name: "React useState explanation",
    question:
      "How does React's useState hook work at a high level? Give a concise but comprehensive response",
    goldenResponse: `React's useState is a Hook that allows function components to have state variables. Here's how it works at a high level:

1. **Initialization**: useState is called at the top level of a function component. You provide an initial state, and it returns an array with two elements: the current state and a function to update that state.

2. **State and Updates**: 
   - **Current State**: On the initial render, the current state matches the initial value provided.
   - **State Updater Function**: The second item in the array is a function used to update the state. When called with a new state value, it queues a re-render of the component with the updated state.

3. **Component Re-render**: Updating the state with the setter function triggers React to re-render the component, now reflecting the new state. Importantly, this update does not affect the current executing code but takes effect in the next render cycle.

4. **Constraints**: 
   - Must be called at the top level of the component or a custom Hook, not within loops or conditions.
   - In Strict Mode, React calls the state updater function twice to help identify side effects, but only the result of one call is used.

By adhering to these principles, useState enables function components to manage and react to dynamic data changes efficiently.`,
  },
  {
    name: "Pinecone getting started explanation",
    question: "What should you do to start using Pinecone for a new project?",
    goldenResponse: `To start using Pinecone for a new project, follow these steps:

1. **Instantiate the Pinecone Client:**
   - **Option A:** Pass the API key directly when instantiating the client.
     \`\`\`javascript
     const pc = new Pinecone({ apiKey: 'YOUR_API_KEY' });
     \`\`\`
   - **Option B:** Use an environment variable to manage your API key securely.
     \`\`\`javascript
     const pc = new Pinecone();
     \`\`\`

2. **Create a Serverless Index:**
   - Define the index configuration, including its name, dimension, metric, and serverless specifications.
     \`\`\`javascript
     const indexModel = await pc.createIndex({
       name: 'example-index',
       dimension: 1536,
       metric: 'cosine',
       spec: {
         serverless: {
           cloud: 'aws',
           region: 'us-east-1',
         },
       },
     });
     \`\`\`

3. **Target the Index:**
   - Once the index is created, make sure to target it for further operations such as storing and querying vectors.

4. **Optional Features:**
   - You can enable automatic generation and reranking to let Pinecone manage machine learning complexities.

5. **Security Tip:**
   - If using API keys in a browser, remember to rotate them regularly for security.

6. **Bring Your Own Vectors:**
   - If you have your own embeddings, you can add vectors and query them, giving you full control over the embedding model.

Follow these steps to get started with Pinecone and leverage its capabilities for vector management and search.`,
  },
  {
    name: "React useEffect rules explanation",
    question:
      "Give me the rules of the useEffect hook in React, provide a concise but comprehensive answer",
    goldenResponse: `Here's a summary of the rules for using the useEffect hook in React:

1. **Top-Level Call Only**: 
   - useEffect should be called at the top level of a component or your own Hooks. Avoid calling it conditionally, inside loops, or nested functions.

2. **Dependency Array**:
   - This array determines when the effect runs. Providing an empty array ([]) runs the effect only once after the initial render. Including dependencies means the effect runs whenever those variables change.

3. **Cleanup Function**:
   - You can return a cleanup function within useEffect that runs before the component unmounts or before the effect re-executes.

4. **Synchronization**:
   - Effects run after the DOM updates have been painted, which helps ensure the UI reflects any changes.

5. **Multiple Effects**:
   - You can use multiple useEffect hooks within a component to manage different effects separately.

Additional note: 
- If you need to run the effect before the browser paints, consider using useLayoutEffect instead.`,
  },
];

describe("LLM-as-Judge Response Quality", () => {
  jest.setTimeout(30000); // LLM calls take time

  test.each(TEST_CASES)(
    "should produce quality response for: $name",
    async ({ question, goldenResponse }) => {
      // 1. Get actual response from your system
      const actualResponse = await getRAGResponse(question);

      // 2. Judge the response
      const { score, reason } = await judgeResponse(
        question,
        actualResponse,
        goldenResponse,
      );

      // 3. Log for debugging
      console.log(`\n📊 ${question}`);
      console.log(`   Score: ${score}/10`);
      console.log(`   Reason: ${reason}`);
      console.log(`   Threshold: ${PASSING_SCORE}`);

      // 4. Assert quality threshold
      expect(score).toBeGreaterThanOrEqual(PASSING_SCORE);
    },
  );
});
