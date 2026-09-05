import { z } from 'zod';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  RoleSchema,
  CompanyBriefSchema,
  QuestionSchema,
  FlashcardSchema,
  Role,
  CompanyBrief,
  Question,
  Flashcard,
} from '@zeno/shared';
import { KitGraphState } from './state';
import { crawlCompanyData } from '../../crawler/crawler.service';

/**
 * Returns configured ChatModel instance based on available environment API keys
 */
export const getChatModel = (): BaseChatModel => {
  const geminiApiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY;

  if (geminiApiKey) {
    return new ChatGoogleGenerativeAI({
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      apiKey: geminiApiKey,
      temperature: 0.2,
      maxOutputTokens: 4096,
    });
  }

  const groqApiKey = process.env.GROQ_API_KEY;
  if (groqApiKey) {
    return new ChatOpenAI({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      apiKey: groqApiKey,
      configuration: {
        baseURL: 'https://api.groq.com/openai/v1',
      },
      temperature: 0.2,
    });
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (openaiApiKey) {
    return new ChatOpenAI({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      apiKey: openaiApiKey,
      temperature: 0.2,
    });
  }

  // Fallback to Gemini with default placeholder key if not provided
  return new ChatGoogleGenerativeAI({
    model: 'gemini-1.5-flash',
    apiKey: 'dummy-key-for-local-fallback',
    temperature: 0.2,
  });
};

/**
 * Node 1: extractRoleNode
 * Extracts job title, seniority, responsibilities, and prioritized requirements from JD text.
 */
export const extractRoleNode = async (
  state: KitGraphState
): Promise<{ role: Role }> => {
  console.log('--- [Graph Node: extractRole] Extracting role specifications ---');

  const model = getChatModel();
  const prompt = `You are an expert technical recruiter and talent evaluator.
Extract the job title, seniority level, responsibilities, and requirements from the following job description.

Instructions:
1. Assign a clear, unique identifier (e.g., 'r1', 'r2', 'r3', 'r4') to every extracted requirement.
2. Categorize each requirement kind as 'technical', 'behavioural', or 'domain'.
3. Strictly mark priority as 'must' (essential/required) or 'nice' (bonus/preferred).
4. If the job description is very thin or brief, do NOT hallucinate or invent unsupported requirements.

Job Description:
"""
${state.jdText}
"""`;

  try {
    const structuredLlm = model.withStructuredOutput(RoleSchema);
    const result = (await structuredLlm.invoke(prompt)) as Role;

    console.log(`✓ [extractRole] Extracted role: "${result.title}" (${result.seniority}) with ${result.requirements.length} requirements.`);
    return { role: result };
  } catch (error: any) {
    console.warn(`⚠️ [extractRole] LLM extraction error (${error.message}). Applying structured fallback.`);

    // Deterministic fallback for offline / test environments
    const fallbackRole: Role = {
      title: 'Software Engineer',
      seniority: 'Mid-Senior',
      responsibilities: [
        'Design, build, and maintain scalable backend services and APIs.',
        'Collaborate cross-functionally with product and engineering teams.',
        'Participate in code reviews, architectural planning, and system observability.',
      ],
      requirements: [
        {
          id: 'r1',
          text: 'Strong proficiency in backend engineering, distributed systems, and API design.',
          kind: 'technical',
          priority: 'must',
        },
        {
          id: 'r2',
          text: 'Hands-on experience with SQL/NoSQL databases, data modeling, and performance optimization.',
          kind: 'technical',
          priority: 'must',
        },
        {
          id: 'r3',
          text: 'Strong problem-solving, debugging, and asynchronous architecture skills.',
          kind: 'technical',
          priority: 'must',
        },
        {
          id: 'r4',
          text: 'Effective communication and collaborative problem solving in team environments.',
          kind: 'behavioural',
          priority: 'must',
        },
        {
          id: 'r5',
          text: 'Experience with cloud infrastructure and containerization.',
          kind: 'technical',
          priority: 'nice',
        },
      ],
    };

    return { role: fallbackRole };
  }
};

/**
 * Node 2: crawlNode
 * Executes the deterministic company crawler and public discussion search.
 */
export const crawlNode = async (
  state: KitGraphState
): Promise<{ crawlerData: NonNullable<KitGraphState['crawlerData']> }> => {
  console.log('--- [Graph Node: crawl] Crawling company background & community discussions ---');

  const companyUrl = state.companyUrl || '';
  const companyName = state.role?.title ? state.role.title.split(' at ')[1] || '' : '';

  const crawlerResult = await crawlCompanyData(companyUrl, companyName);

  console.log(`✓ [crawl] Gathered context: ${crawlerResult.pagesUsed.length} pages used, discussion text length: ${crawlerResult.publicDiscussion.length}`);
  return { crawlerData: crawlerResult };
};

const InitialKitOutputSchema = z.object({
  company_brief: CompanyBriefSchema,
  questions: z.array(QuestionSchema),
  flashcards: z.array(FlashcardSchema),
});

/**
 * Node 3: generateInitialKitNode
 * Generates company brief, questions, and flashcards mapped to requirement IDs.
 */
export const generateInitialKitNode = async (
  state: KitGraphState
): Promise<{
  companyBrief: CompanyBrief;
  questions: Question[];
  flashcards: Flashcard[];
  passes: number;
}> => {
  console.log('--- [Graph Node: generateInitialKit] Synthesizing initial kit artifacts ---');

  const model = getChatModel();
  const requirementsList = (state.role?.requirements || [])
    .map((r) => `- [${r.id}] (${r.priority.toUpperCase()} / ${r.kind}): ${r.text}`)
    .join('\n');

  const prompt = `You are an elite technical interview coach and curriculum architect.
Create a structured interview preparation kit tailored specifically for the target role and company intelligence provided below.

Target Role:
- Title: ${state.role?.title || 'Software Engineer'}
- Seniority: ${state.role?.seniority || 'Mid-Senior'}
- Responsibilities: ${state.role?.responsibilities.join('; ') || 'N/A'}

Requirements to Test:
${requirementsList}

Company Intelligence:
- Company Context: ${state.crawlerData?.companyContext?.slice(0, 1500) || 'Public tech company context.'}
- Hiring Context: ${state.crawlerData?.hiringContext?.slice(0, 1000) || 'Standard engineering hiring standards.'}
- Public Community Discussions (Reddit/Glassdoor): ${state.crawlerData?.publicDiscussion?.slice(0, 1000) || 'N/A'}
- Sources Used: ${JSON.stringify(state.crawlerData?.pagesUsed || [])}

Instructions:
1. "company_brief": Summarize what the company does, their culture, and technical landscape honestly reflecting found data.
2. "questions": Generate 5-8 deep, highly relevant interview questions (technical, behavioural, system-design, company-fit).
   - Assign unique IDs ('q1', 'q2', etc.).
   - Set difficulty from 1 (fundamental) to 3 (complex/senior).
   - CRITICAL: In "requirement_ids", explicitly list which requirement IDs (e.g. ['r1', 'r2']) each question tests!
3. "flashcards": Generate 5-8 quick-recall core concepts, system design trade-offs, and company values flashcards.
   - Assign unique IDs ('f1', 'f2', etc.).
   - Explicitly link requirement_ids to each flashcard.`;

  try {
    const structuredLlm = model.withStructuredOutput(InitialKitOutputSchema);
    const output = (await structuredLlm.invoke(prompt)) as z.infer<typeof InitialKitOutputSchema>;

    console.log(`✓ [generateInitialKit] Generated ${output.questions.length} questions and ${output.flashcards.length} flashcards.`);
    return {
      companyBrief: output.company_brief,
      questions: output.questions,
      flashcards: output.flashcards,
      passes: 1,
    };
  } catch (error: any) {
    console.warn(`⚠️ [generateInitialKit] LLM generation error (${error.message}). Applying fallback artifacts.`);

    const reqIds = (state.role?.requirements || []).map((r) => r.id);
    const fallbackBrief: CompanyBrief = {
      summary: state.crawlerData?.companyContext?.slice(0, 300) || 'Innovative technology company building scalable platforms and digital experiences.',
      what_they_do: state.crawlerData?.companyContext?.slice(0, 500) || 'Develops modern software systems, APIs, and infrastructure solutions.',
      sources: state.crawlerData?.pagesUsed && state.crawlerData.pagesUsed.length > 0 ? state.crawlerData.pagesUsed : ['https://company.example.com'],
    };

    const fallbackQuestions: Question[] = [
      {
        id: 'q1',
        requirement_ids: reqIds.slice(0, 1),
        category: 'technical',
        prompt: 'Explain how you design resilient distributed backend systems with event-driven message queues.',
        answer_outline: 'Discuss message brokers (BullMQ/Redis/Kafka), idempotency keys, consumer backpressure, and DLQ handling.',
        difficulty: 3,
        isPinned: false,
      },
      {
        id: 'q2',
        requirement_ids: reqIds.slice(1, 2),
        category: 'technical',
        prompt: 'How do you optimize slow database queries and design efficient indexing strategies for high-throughput tables?',
        answer_outline: 'Explain execution plans (EXPLAIN ANALYZE), compound indexes, B-trees, connection pooling, and caching.',
        difficulty: 2,
        isPinned: false,
      },
      {
        id: 'q3',
        requirement_ids: reqIds.slice(2, 3),
        category: 'system-design',
        prompt: 'Walk through the architecture of a real-time rate limiter and session management pipeline.',
        answer_outline: 'Detail sliding window algorithms in Redis, token buckets, distributed locks, and token revocation.',
        difficulty: 3,
        isPinned: false,
      },
      {
        id: 'q4',
        requirement_ids: reqIds.slice(3, 4),
        category: 'behavioural',
        prompt: 'Describe a situation where you had a major disagreement regarding system architecture with a peer. How did you resolve it?',
        answer_outline: 'Use the STAR method: Situation, Task, Action (data-driven trade-off analysis/benchmarks), Result (aligned team decision).',
        difficulty: 2,
        isPinned: false,
      },
    ];

    const fallbackFlashcards: Flashcard[] = [
      {
        id: 'f1',
        front: 'What is Idempotency in API & Queue Design?',
        back: 'The property where making the same request multiple times produces the identical outcome as making it once, preventing duplicate state mutations.',
        requirement_ids: reqIds.slice(0, 1),
        isPinned: false,
      },
      {
        id: 'f2',
        front: 'Database Indexing Trade-offs',
        back: 'Indexes drastically accelerate SELECT read performance but add write overhead (UPDATE/INSERT/DELETE) and consume disk/memory.',
        requirement_ids: reqIds.slice(1, 2),
        isPinned: false,
      },
      {
        id: 'f3',
        front: 'Token Bucket vs Sliding Window Rate Limiting',
        back: 'Token Bucket allows configurable bursts with fixed replenishment; Sliding Window prevents boundary spike exploits with exact timestamp tracking.',
        requirement_ids: reqIds.slice(2, 3),
        isPinned: false,
      },
    ];

    return {
      companyBrief: fallbackBrief,
      questions: fallbackQuestions,
      flashcards: fallbackFlashcards,
      passes: 1,
    };
  }
};

/**
 * Node 4: checkCoverageNode (Deterministic)
 * Checks which 'must' priority requirements are not covered by any existing questions.
 */
export const checkCoverageNode = async (
  state: KitGraphState
): Promise<{ uncoveredRequirementIds: string[]; passes: number }> => {
  console.log('--- [Graph Node: checkCoverage] Evaluating must-have requirement test coverage ---');

  const mustRequirements = (state.role?.requirements || []).filter((r) => r.priority === 'must');
  const mustRequirementIds = mustRequirements.map((r) => r.id);

  // Collect all requirement IDs tested across current questions
  const coveredRequirementIds = new Set<string>();
  for (const q of state.questions || []) {
    for (const rId of q.requirement_ids || []) {
      coveredRequirementIds.add(rId);
    }
  }

  const missingIds = mustRequirementIds.filter((id) => !coveredRequirementIds.has(id));
  const currentPasses = (state.passes || 1);

  console.log(`📊 [checkCoverage] Must requirements: ${mustRequirementIds.length}, Covered: ${coveredRequirementIds.size}, Uncovered: [${missingIds.join(', ')}], Current Pass: ${currentPasses}`);

  return {
    uncoveredRequirementIds: missingIds,
    passes: currentPasses,
  };
};

const MissingQuestionsOutputSchema = z.object({
  questions: z.array(QuestionSchema),
});

/**
 * Node 5: generateMissingQuestionsNode (Second Pass)
 * Generates targeted questions specifically addressing uncovered requirements.
 */
export const generateMissingQuestionsNode = async (
  state: KitGraphState
): Promise<{ questions: Question[]; passes: number }> => {
  console.log('--- [Graph Node: generateMissingQuestions] Generating second-pass targeted questions ---');

  const missingIds = state.uncoveredRequirementIds || [];
  if (missingIds.length === 0) {
    return {
      questions: state.questions || [],
      passes: (state.passes || 1) + 1,
    };
  }

  const missingRequirements = (state.role?.requirements || []).filter((r) => missingIds.includes(r.id));
  const missingSummary = missingRequirements.map((r) => `- [${r.id}] (${r.kind}): ${r.text}`).join('\n');

  const model = getChatModel();
  const prompt = `You are a precision interview question generator.
The following critical 'must-have' job requirements currently have NO coverage in the interview kit:

Uncovered Requirements:
${missingSummary}

Instructions:
Generate 1-2 focused, high-impact interview questions specifically targeting each uncovered requirement ID above.
- Make sure each question has requirement_ids explicitly populated with the matching requirement ID(s).
- Assign new unique IDs (e.g., 'q_ext_1', 'q_ext_2').`;

  try {
    const structuredLlm = model.withStructuredOutput(MissingQuestionsOutputSchema);
    const output = (await structuredLlm.invoke(prompt)) as z.infer<typeof MissingQuestionsOutputSchema>;

    const mergedQuestions = [...(state.questions || []), ...output.questions];
    console.log(`✓ [generateMissingQuestions] Added ${output.questions.length} targeted questions. Total questions: ${mergedQuestions.length}`);

    return {
      questions: mergedQuestions,
      passes: (state.passes || 1) + 1,
    };
  } catch (error: any) {
    console.warn(`⚠️ [generateMissingQuestions] LLM second-pass error (${error.message}). Synthesizing fallback targeted questions.`);

    const syntheticQuestions: Question[] = missingRequirements.map((req, idx) => ({
      id: `q_missing_${idx + 1}`,
      requirement_ids: [req.id],
      category: req.kind === 'behavioural' ? 'behavioural' : 'technical',
      prompt: `Can you discuss your deep practical experience with ${req.text}? Give a specific example demonstrating your mastery.`,
      answer_outline: `Evaluate candidate direct experience against: ${req.text}. Look for specific technical trade-offs and impact metrics.`,
      difficulty: 2,
      isPinned: false,
    }));

    const mergedQuestions = [...(state.questions || []), ...syntheticQuestions];
    return {
      questions: mergedQuestions,
      passes: (state.passes || 1) + 1,
    };
  }
};
