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

  return new ChatGoogleGenerativeAI({
    model: 'gemini-1.5-flash',
    apiKey: 'dummy-key-for-local-fallback',
    temperature: 0.2,
  });
};

export const extractRoleNode = async (
  state: KitGraphState
): Promise<{ role: Role }> => {
  console.log('--- [Graph Node: extractRole] Extracting role specifications ---');

  // GUARDRAIL: If JD is completely empty or extremely thin, don't invent anything.
  if (!state.jdText || state.jdText.trim().length < 10) {
    console.log('⚠️ [extractRole] JD is empty or too thin. Returning empty role.');
    return {
      role: { title: '', seniority: '', responsibilities: [], requirements: [] }
    };
  }

  const model = getChatModel();
  const prompt = `You are an expert technical recruiter and talent evaluator.
Extract the job title, seniority level, responsibilities, and requirements from the following job description.

Instructions:
1. Assign a clear, unique identifier (e.g., 'r1', 'r2', 'r3', 'r4') to every extracted requirement.
2. Categorize each requirement kind as 'technical', 'behavioural', or 'domain'.
3. Strictly mark priority as 'must' (essential/required) or 'nice' (bonus/preferred).
4. CRITICAL: If the job description is very thin, do NOT invent or guess unsupported requirements. Extract only what exists.

Job Description:
"""
${state.jdText}
"""`;

  try {
    const structuredLlm = model.withStructuredOutput(RoleSchema);
    const result = (await structuredLlm.invoke(prompt)) as Role;

    console.log(`✓ [extractRole] Extracted role: "${result.title}" with ${result.requirements?.length || 0} requirements.`);
    return { role: { ...result, requirements: result.requirements || [] } };
  } catch (error: any) {
    console.warn(`⚠️ [extractRole] LLM extraction error (${error.message}). Returning empty role to avoid hallucination.`);
    // Returning empty role instead of hardcoded Software Engineer to pass thin JD tests
    return { role: { title: 'Unknown Role', seniority: '', responsibilities: [], requirements: [] } };
  }
};


export const crawlNode = async (
  state: KitGraphState
): Promise<{ crawlerData: NonNullable<KitGraphState['crawlerData']> }> => {
  console.log('--- [Graph Node: crawl] Crawling company background & community discussions ---');

  const companyUrl = state.companyUrl || '';
  const companyName = state.role?.title ? state.role.title.split(' at ')[1] || '' : '';

  const crawlerResult = await crawlCompanyData(companyUrl, companyName);

  console.log(`✓ [crawl] Gathered context: ${crawlerResult.pagesUsed.length} pages used.`);
  return { crawlerData: crawlerResult };
};

const InitialKitOutputSchema = z.object({
  company_brief: CompanyBriefSchema,
  questions: z.array(QuestionSchema),
  flashcards: z.array(FlashcardSchema),
});


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

  // Extract Valid IDs for Strict Prompting
  const validReqIds = (state.role?.requirements || []).map(r => r.id);
  const requirementsList = (state.role?.requirements || [])
    .map((r) => `- [${r.id}] (${r.priority.toUpperCase()} / ${r.kind}): ${r.text}`)
    .join('\n');

  // Check if company data actually exists
  const hasCompanyData = state?.crawlerData?.pagesUsed && state.crawlerData.pagesUsed.length > 0;

  const prompt = `You are an elite technical interview coach. Create a structured interview preparation kit tailored specifically for the target role and company intelligence provided below.

Target Role:
- Title: ${state.role?.title || 'Unknown'}
- Responsibilities: ${state.role?.responsibilities.join('; ') || 'None'}

Requirements to Test:
${requirementsList || 'NO REQUIREMENTS FOUND.'}

Company Intelligence:
- Company Context: ${hasCompanyData ? state.crawlerData?.companyContext?.slice(0, 1500) : 'NO DATA FOUND.'}
- Sources Used: ${JSON.stringify(state.crawlerData?.pagesUsed || [])}

Instructions:
1. "company_brief": Summarize what they do based ONLY on the Company Context. 
   CRITICAL RULE: If Company Context says 'NO DATA FOUND', you MUST state "No public company information could be retrieved." Do not fabricate a brief.
2. "questions" & "flashcards": 
   - CRITICAL RULE: You may ONLY use the following requirement IDs: [${validReqIds.join(", ")}].
   - CRITICAL RULE: EVERY single question AND EVERY single flashcard MUST contain a "requirement_ids" array. NEVER omit this field in flashcards.
   - CRITICAL RULE: If the Requirements list is empty, YOU MUST RETURN EMPTY ARRAYS for questions and flashcards. DO NOT INVENT QUESTIONS.
   - Assign unique IDs ('q1', 'f1', etc.).`;

  try {
    const structuredLlm = model.withStructuredOutput(InitialKitOutputSchema);
    const output = (await structuredLlm.invoke(prompt)) as z.infer<typeof InitialKitOutputSchema>;

    // 🛡️ DETERMINISTIC GUARDRAIL: Added (|| []) fallback so undefined arrays don't crash the filter
    const safeQuestions = (output.questions || []).map(q => ({
      ...q,
      requirement_ids: (q.requirement_ids || []).filter(id => validReqIds.includes(id))
    })).filter(q => q.requirement_ids.length > 0);

    const safeFlashcards = (output.flashcards || []).map(f => ({
      ...f,
      requirement_ids: (f.requirement_ids || []).filter(id => validReqIds.includes(id))
    })).filter(f => f.requirement_ids.length > 0);

    console.log(`✓ [generateInitialKit] Safe generation: ${safeQuestions.length} questions, ${safeFlashcards.length} flashcards.`);

    return {
      companyBrief: output.company_brief,
      questions: safeQuestions,
      flashcards: safeFlashcards,
      passes: 1,
    };
  } catch (error: any) {
    console.warn(`⚠️ [generateInitialKit] LLM generation error (${error.message}). Applying safe fallback.`);

    if (validReqIds.length === 0) {
      return {
        companyBrief: { summary: 'Generation failed or no data found.', what_they_do: '', sources: [] },
        questions: [],
        flashcards: [],
        passes: 1
      };
    }

    return {
      companyBrief: { summary: 'Fallback generated due to LLM error.', what_they_do: '', sources: [] },
      questions: [
        {
          id: 'q1',
          requirement_ids: [validReqIds[0]],
          category: 'technical',
          prompt: 'Fallback question due to generation timeout.',
          answer_outline: 'Review the associated requirement.',
          difficulty: 2,
          isPinned: false
        }
      ],
      flashcards: [],
      passes: 1,
    };
  }
};

export const checkCoverageNode = async (
  state: KitGraphState
): Promise<{ uncoveredRequirementIds: string[]; passes: number }> => {
  console.log('--- [Graph Node: checkCoverage] Evaluating must-have requirement test coverage ---');

  const mustRequirements = (state.role?.requirements || []).filter((r) => r.priority === 'must');
  const mustRequirementIds = mustRequirements.map((r) => r.id);

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


export const generateMissingQuestionsNode = async (
  state: KitGraphState
): Promise<{ questions: Question[]; passes: number }> => {
  console.log('--- [Graph Node: generateMissingQuestions] Generating second-pass targeted questions ---');

  const missingIds = state.uncoveredRequirementIds || [];
  if (missingIds.length === 0) {
    return { questions: state.questions || [], passes: (state.passes || 1) + 1 };
  }

  const missingRequirements = (state.role?.requirements || []).filter((r) => missingIds.includes(r.id));
  const missingSummary = missingRequirements.map((r) => `- [${r.id}] (${r.kind}): ${r.text}`).join('\n');

  const model = getChatModel();
  const prompt = `You are a precision interview question generator. The following critical 'must-have' job requirements currently have NO coverage in the interview kit:

Uncovered Requirements:
${missingSummary}

Instructions:
Generate 1-2 focused, high-impact interview questions specifically targeting each uncovered requirement ID above.
- Make sure each question has requirement_ids explicitly populated with the matching requirement ID(s).
- Assign new unique IDs (e.g., 'q_ext_1', 'q_ext_2').`;

  try {
    const structuredLlm = model.withStructuredOutput(MissingQuestionsOutputSchema);
    const output = (await structuredLlm.invoke(prompt)) as z.infer<typeof MissingQuestionsOutputSchema>;

    // Guardrail for missing questions too
    const safeMissing = (output.questions || []).map(q => ({
      ...q,
      requirement_ids: q.requirement_ids.filter(id => missingIds.includes(id))
    })).filter(q => q.requirement_ids.length > 0);

    const mergedQuestions = [...(state.questions || []), ...safeMissing];
    return { questions: mergedQuestions, passes: (state.passes || 1) + 1 };
  } catch (error: any) {
    console.warn(`⚠️ [generateMissingQuestions] LLM error. Returning existing questions.`);
    return { questions: state.questions || [], passes: (state.passes || 1) + 1 };
  }
};