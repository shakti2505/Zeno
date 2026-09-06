import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { workflow } from '../modules/kit/graph/workflow';
import { generateSchedule } from '../modules/kit/scheduler.service';
import { KitSchema, Kit } from '@zeno/shared';

interface EvaluationCase {
  id: string;
  jd: string;
  company_url?: string;
  days?: number;
}

interface EvaluationSuccessResult {
  id: string;
  status: 'ok';
  kit: Kit;
  error: null;
}

interface EvaluationFailureResult {
  id: string;
  status: 'failed';
  kit: null;
  error: {
    code: string;
    message: string;
  };
}

type EvaluationResult = EvaluationSuccessResult | EvaluationFailureResult;

interface EvaluationBatchOutput {
  version: string;
  generated_at: string;
  kits: EvaluationResult[];
}

/**
 * Extracts command line argument value for a specific flag (e.g., --input or -i).
 */
function getArgValue(flag: string, alias?: string): string | undefined {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag || (alias && args[i] === alias)) {
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        return args[i + 1];
      }
    }
    if (args[i].startsWith(`${flag}=`)) {
      return args[i].slice(flag.length + 1);
    }
    if (alias && args[i].startsWith(`${alias}=`)) {
      return args[i].slice(alias.length + 1);
    }
  }
  return undefined;
}

async function runEvaluationCli(): Promise<void> {
  // 1. Argument Parsing
  let inputArg = getArgValue('--input', '-i');
  let outputArg = getArgValue('--output', '-o');

  // Fallback to positional arguments if flags are stripped by npm workspace forwarding
  if (!inputArg || !outputArg) {
    const positionalArgs = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
    if (!inputArg && positionalArgs.length >= 1) {
      inputArg = positionalArgs[0];
    }
    if (!outputArg && positionalArgs.length >= 2) {
      outputArg = positionalArgs[1];
    }
  }

  if (!inputArg || !outputArg) {
    console.error('Usage: npm run evaluate -- --input <path> --output <path>');
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), inputArg);
  const outputPath = path.resolve(process.cwd(), outputArg);

  console.log('=====================================================');
  console.log('🚀 Batch Evaluation Pipeline CLI');
  console.log(`📂 Input Path:  ${inputPath}`);
  console.log(`💾 Output Path: ${outputPath}`);
  console.log('=====================================================\n');

  // 2. Read and parse input file
  let rawCases: EvaluationCase[];
  try {
    const rawFileContent = await fs.readFile(inputPath, 'utf-8');
    const parsed = JSON.parse(rawFileContent);
    rawCases = Array.isArray(parsed) ? parsed : [parsed];
  } catch (err: any) {
    console.error(`❌ Failed to read or parse input JSON file at "${inputPath}":`, err.message);
    process.exit(1);
  }

  console.log(`📋 Found ${rawCases.length} case(s) to process sequentially.\n`);

  const results: EvaluationResult[] = [];

  // 3. Process each case sequentially to respect LLM rate limits
  for (let i = 0; i < rawCases.length; i++) {
    const caseData = rawCases[i];
    const caseId = caseData.id || `case_${i + 1}`;
    console.log(`-----------------------------------------------------`);
    console.log(`[${i + 1}/${rawCases.length}] Processing case: ${caseId}...`);

    try {
      if (!caseData.jd || typeof caseData.jd !== 'string' || caseData.jd.trim().length === 0) {
        throw new Error("Job description ('jd') is missing or empty.");
      }

      // 1. Invoke LangGraph Pipeline
      const finalState = await workflow.invoke({
        jdText: caseData.jd,
        companyUrl: caseData.company_url,
        crawlerData: {
          companyContext: '',
          hiringContext: '',
          publicDiscussion: '',
          pagesUsed: [],
        },
        passes: 0,
        uncoveredRequirementIds: [],
        questions: [],
        flashcards: [],
      });

      // 2. Run Deterministic Scheduler
      const daysAvailable = caseData.days && caseData.days > 0 ? caseData.days : 3;
      const questions = finalState.questions || [];
      const requirements = finalState.role?.requirements || [];
      const schedule = generateSchedule(questions, requirements, daysAvailable);

      // Determine extracted company name
      const companyName =
        caseData.company_url
          ? new URL(
            caseData.company_url.startsWith('http')
              ? caseData.company_url
              : `https://${caseData.company_url}`
          ).hostname.replace('www.', '')
          : (finalState.role as any)?.company ||
          finalState.role?.title?.split(' at ')[1] ||
          'Target Company';

      // 3. Construct Kit matching Appendix A
      const draftKit = {
        source: {
          company: companyName,
          company_url: caseData.company_url || 'https://example.com',
          role: finalState.role?.title || 'Software Engineer',
          location: 'Unspecified',
          jd_chars: caseData.jd.length,
          researched_at: new Date().toISOString(),
          pages_used:
            finalState.crawlerData?.pagesUsed && finalState.crawlerData.pagesUsed.length > 0
              ? finalState.crawlerData.pagesUsed
              : caseData.company_url
                ? [caseData.company_url]
                : ['https://example.com'],
        },
        company_brief: finalState.companyBrief || {
          summary:
            finalState.crawlerData?.companyContext?.slice(0, 300) ||
            'Company context extracted via pipeline.',
          what_they_do:
            finalState.crawlerData?.companyContext?.slice(0, 500) ||
            'Software and platform development.',
          sources:
            finalState.crawlerData?.pagesUsed ||
            (caseData.company_url ? [caseData.company_url] : ['https://example.com']),
        },
        role: finalState.role || {
          title: 'Software Engineer',
          seniority: 'Mid-Senior',
          responsibilities: [
            'Build backend systems and APIs',
            'Collaborate across engineering teams',
          ],
          requirements: [
            {
              id: 'r1',
              text: 'Backend Engineering and Systems Design',
              kind: 'technical',
              priority: 'must',
            },
          ],
        },
        questions: finalState.questions || [],
        flashcards: finalState.flashcards || [],
        schedule: schedule,
        coverage: {
          uncovered_requirement_ids: finalState.uncoveredRequirementIds || [],
          passes: finalState.passes || 1,
        },
      };

      // 4. Validate with strict KitSchema
      const validKit = KitSchema.parse(draftKit);

      // 5. Push Success
      results.push({
        id: caseId,
        status: 'ok',
        kit: validKit,
        error: null,
      });

      console.log(`✓ Case ${caseId} completed successfully.`);
    } catch (error: any) {
      console.error(`❌ Case ${caseId} failed:`, error.message);

      let errorCode = 'GENERATION_FAILED';
      const msg = error instanceof Error ? error.message : String(error);
      if (
        msg.toLowerCase().includes('unreachable') ||
        msg.toLowerCase().includes('timeout') ||
        msg.toLowerCase().includes('econnrefused') ||
        msg.toLowerCase().includes('ssrf') ||
        msg.toLowerCase().includes('company site')
      ) {
        errorCode = 'COMPANY_UNREACHABLE';
      } else if (
        msg.toLowerCase().includes('job description') ||
        msg.toLowerCase().includes('empty') ||
        msg.toLowerCase().includes('missing')
      ) {
        errorCode = 'INVALID_INPUT';
      }

      // 6. Push Failure (CRITICAL: Do not throw/abort the loop)
      results.push({
        id: caseId,
        status: 'failed',
        kit: null,
        error: {
          code: errorCode,
          message: msg || 'Unknown error occurred',
        },
      });
    }
  }
  
  // 4. Save structured batch results to output file
  const outputPayload: EvaluationBatchOutput = {
    version: '1.0',
    generated_at: new Date().toISOString(),
    kits: results,
  };

  try {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(outputPayload, null, 2), 'utf-8');
    console.log('\n=====================================================');
    console.log(`🎉 Batch evaluation completed!`);
    console.log(`📊 Total Cases: ${results.length}`);
    console.log(`✅ Successful:  ${results.filter((r) => r.status === 'ok').length}`);
    console.log(`❌ Failed:      ${results.filter((r) => r.status === 'failed').length}`);
    console.log(`💾 Results saved to: ${outputPath}`);
    console.log('=====================================================');
  } catch (err: any) {
    console.error(`❌ Failed to write results to "${outputPath}":`, err.message);
    process.exit(1);
  }
}

runEvaluationCli().catch((err) => {
  console.error('❌ Unexpected fatal CLI error:', err);
  process.exit(1);
});
