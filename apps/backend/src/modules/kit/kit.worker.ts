import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../../config/redis';
import { Kit } from './kit.model';
import { workflow } from './graph/workflow';
import { generateSchedule } from './scheduler.service';
import { KitSchema } from '@zeno/shared';

export const KIT_QUEUE_NAME = 'kit-generation-queue';

export interface KitGenerationJobData {
  kitId: string;
  userId?: string;
  jobDescription: string;
  companyUrl?: string;
  days?: number;
}

/**
 * BullMQ Queue for orchestrating asynchronous Interview Kit generation jobs
 */
export const KitGenerationQueue = new Queue<KitGenerationJobData>(KIT_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      count: 10,
    },
    removeOnFail: {
      count: 10,
    },
  },
});

/**
 * BullMQ Worker processor function to execute the LangGraph AI generation pipeline
 * and deterministic scheduler
 */
export const kitGenerationWorker = new Worker<KitGenerationJobData>(
  KIT_QUEUE_NAME,
  async (job: Job<KitGenerationJobData>) => {
    const { kitId, jobDescription, companyUrl, days } = job.data;
    console.log(`⏳ [Worker] Processing Kit generation job ${job.id} for Kit ID: ${kitId}`);

    try {
      // 1. Mark kit as processing (optional, tracking active status in DB)
      await Kit.findByIdAndUpdate(kitId, {
        $set: { status: 'generating', errorMessage: null },
      });

      // 2. Invoke the LangGraph Pipeline
      // Pass the initial state to the graph
      console.log(`🤖 [Worker] Invoking LangGraph workflow for Kit ID: ${kitId}`);
      const finalState = await workflow.invoke({
        jdText: jobDescription,
        companyUrl: companyUrl,
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

      // 3. Run the Deterministic Scheduler
      const daysAvailable = days && days > 0 ? days : 3;
      const questions = finalState.questions || [];
      const requirements = finalState.role?.requirements || [];
      const schedule = generateSchedule(questions, requirements, daysAvailable);

      // Determine extracted company name 
      const companyName =
        companyUrl
          ? new URL(
              companyUrl.startsWith('http')
                ? companyUrl
                : `https://${companyUrl}`
            ).hostname.replace('www.', '')
          : (finalState.role as any)?.company ||
            finalState.role?.title?.split(' at ')[1] ||
            'Target Company';

      // 4. Construct the final Kit matching Appendix A exactly
      const draftKit = {
        source: {
          company: companyName,
          company_url: companyUrl || 'https://example.com',
          role: finalState.role?.title || 'Software Engineer',
          location: 'Remote/Unspecified',
          jd_chars: jobDescription.length,
          researched_at: new Date().toISOString(),
          pages_used: finalState.crawlerData?.pagesUsed || [],
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
            (companyUrl ? [companyUrl] : ['https://example.com']),
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
              text: 'Software Engineering and Backend Systems',
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

      // 5. STRICT VALIDATION: Ensure it matches Appendix A before saving
      const validKit = KitSchema.parse(draftKit);

      // 6. Save to Database
      await Kit.findByIdAndUpdate(kitId, {
        $set: {
          status: 'completed',
          data: validKit,
          errorMessage: null,
        },
      });

      console.log(`✅ [Worker] Successfully generated and saved Kit ID: ${kitId}`);
      return { kitId, status: 'completed' };
    } catch (error: any) {
      // 7. Handle Failures Gracefully
      console.error(`Failed to generate kit ${job.data.kitId}:`, error);

      await Kit.findByIdAndUpdate(job.data.kitId, {
        $set: {
          status: 'failed',
          errorMessage:
            error instanceof Error ? error.message : 'Unknown pipeline error',
        },
      });

      // Throw error to trigger BullMQ's automatic retry backoff
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 3,
  }
);

// Worker Lifecycle & Diagnostic Listeners
kitGenerationWorker.on('completed', (job: Job) => {
  console.log(`🎉 [BullMQ] Job ${job.id} for kit ${job.data?.kitId} completed successfully.`);
});

kitGenerationWorker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(
    `💥 [BullMQ] Job ${job?.id} for kit ${job?.data?.kitId} failed after attempt ${job?.attemptsMade}:`,
    err.message
  );
});

kitGenerationWorker.on('error', (err: Error) => {
  console.error('❌ [BullMQ] Worker encountered internal error:', err.message);
});

export default kitGenerationWorker;
