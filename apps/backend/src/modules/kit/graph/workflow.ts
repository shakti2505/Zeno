import { StateGraph, START, END } from '@langchain/langgraph';
import { KitGraphAnnotation, KitGraphState } from './state';
import {
  extractRoleNode,
  crawlNode,
  generateInitialKitNode,
  checkCoverageNode,
  generateMissingQuestionsNode,
} from './nodes';
import { Kit, KitSchema } from '@zeno/shared';
import { generateSchedule } from '../scheduler.service';

/**
 * Conditional routing function after coverage analysis
 * If uncovered 'must' requirements exist and pass count is below 2, trigger second-pass generation.
 */
export const shouldGenerateMissing = (state: KitGraphState): 'generateMissing' | typeof END => {
  const missingCount = state.uncoveredRequirementIds?.length || 0;
  const currentPasses = state.passes || 1;

  if (missingCount > 0 && currentPasses < 2) {
    console.log(`🔄 [Workflow Router] Route -> generateMissing (${missingCount} uncovered requirements, pass ${currentPasses}/2)`);
    return 'generateMissing';
  }

  console.log(`🏁 [Workflow Router] Route -> END (Coverage verified or max passes reached. Passes: ${currentPasses})`);
  return END;
};

/**
 * LangGraph StateGraph Definition for Interview Kit Generation Pipeline
 */
export const createKitWorkflow = () => {
  const workflow = new StateGraph(KitGraphAnnotation)
    // 1. Register all nodes
    .addNode('extractRole', extractRoleNode)
    .addNode('crawl', crawlNode)
    .addNode('generateInitial', generateInitialKitNode)
    .addNode('checkCoverage', checkCoverageNode)
    .addNode('generateMissing', generateMissingQuestionsNode)

    // 2. Add standard forward transitions
    .addEdge(START, 'extractRole')
    .addEdge('extractRole', 'crawl')
    .addEdge('crawl', 'generateInitial')
    .addEdge('generateInitial', 'checkCoverage')

    // 3. Add conditional edge for second-pass coverage
    .addConditionalEdges('checkCoverage', shouldGenerateMissing, {
      generateMissing: 'generateMissing',
      [END]: END,
    })

    // 4. Loop back to re-check coverage after generating missing questions
    .addEdge('generateMissing', 'checkCoverage');

  return workflow.compile();
};

export const kitWorkflow = createKitWorkflow();

/**
 * Complete Pipeline Runner: Executes the LangGraph workflow and builds the final validated Kit
 */
export const executeKitPipeline = async (input: {
  jdText: string;
  companyUrl?: string;
  days?: number;
}): Promise<Kit> => {
  const daysAvailable = input.days && input.days > 0 ? input.days : 3;

  console.log('🚀 [Pipeline] Executing LangGraph multi-step interview kit generation pipeline...');

  const finalState = await kitWorkflow.invoke({
    jdText: input.jdText,
    companyUrl: input.companyUrl,
    passes: 0,
  });

  const companyName =
    input.companyUrl
      ? new URL(
          input.companyUrl.startsWith('http')
            ? input.companyUrl
            : `https://${input.companyUrl}`
        ).hostname.replace('www.', '')
      : finalState.role?.title?.split(' at ')[1] || 'Target Company';

  // Build deterministic schedule across requested days using the scheduler service
  const questions = finalState.questions || [];
  const requirements = finalState.role?.requirements || [];
  const schedule = generateSchedule(questions, requirements, daysAvailable);

  // Construct complete Kit matching Appendix A & KitSchema
  const rawKit: Kit = {
    source: {
      company: companyName,
      company_url: input.companyUrl || 'https://example.com',
      role: finalState.role?.title || 'Software Engineer',
      location: 'Remote',
      jd_chars: input.jdText.length,
      researched_at: new Date().toISOString(),
      pages_used:
        finalState.crawlerData?.pagesUsed && finalState.crawlerData.pagesUsed.length > 0
          ? finalState.crawlerData.pagesUsed
          : input.companyUrl
          ? [input.companyUrl]
          : ['https://example.com'],
    },
    company_brief: finalState.companyBrief || {
      summary: finalState.crawlerData?.companyContext?.slice(0, 300) || 'Company context extracted via pipeline.',
      what_they_do: finalState.crawlerData?.companyContext?.slice(0, 500) || 'Software and platform development.',
      sources: finalState.crawlerData?.pagesUsed || ['https://example.com'],
    },
    role: finalState.role || {
      title: 'Software Engineer',
      seniority: 'Mid-Senior',
      responsibilities: ['Build backend systems', 'Collaborate across teams'],
      requirements: [
        { id: 'r1', text: 'Backend Development', kind: 'technical', priority: 'must' },
      ],
    },
    questions: finalState.questions || [],
    flashcards: finalState.flashcards || [],
    schedule,
    coverage: {
      uncovered_requirement_ids: finalState.uncoveredRequirementIds || [],
      passes: finalState.passes || 1,
    },
  };

  // Validate the final kit against strict Zod KitSchema
  return KitSchema.parse(rawKit);
};

export default kitWorkflow;
