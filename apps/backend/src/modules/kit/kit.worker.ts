import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../../config/redis';
import { Kit } from './kit.model';
import { executeKitPipeline } from './graph/workflow';

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
 */
export const kitGenerationWorker = new Worker<KitGenerationJobData>(
  KIT_QUEUE_NAME,
  async (job: Job<KitGenerationJobData>) => {
    const { kitId, jobDescription, companyUrl, days } = job.data;
    console.log(`⏳ [Worker] Processing Kit generation job ${job.id} for Kit ID: ${kitId}`);

    try {
      // 1. Verify and fetch Kit document from database
      const kit = await Kit.findById(kitId);
      if (!kit) {
        throw new Error(`Kit document with ID '${kitId}' was not found in database.`);
      }

      // 2. Set status to 'generating'
      await Kit.findByIdAndUpdate(kitId, {
        $set: { status: 'generating', errorMessage: null },
      });

      // 3. Execute the multi-step LangGraph pipeline (Extract Role -> Crawl -> Generate Initial -> Check Coverage -> Generate Missing)
      console.log(`🤖 [Worker] Invoking LangGraph workflow for Kit ID: ${kitId}`);
      const generatedKit = await executeKitPipeline({
        jdText: jobDescription,
        companyUrl,
        days: days || 3,
      });

      // 4. Atomically persist completed Kit payload
      await Kit.findByIdAndUpdate(kitId, {
        $set: {
          status: 'completed',
          data: generatedKit,
          errorMessage: null,
        },
      });

      console.log(`✅ [Worker] Successfully completed LangGraph kit generation for Kit ID: ${kitId}`);
      return { kitId, status: 'completed' };
    } catch (error: any) {
      console.error(`❌ [Worker] Kit generation failed for Kit ID: ${kitId}:`, error.message);

      await Kit.findByIdAndUpdate(kitId, {
        $set: {
          status: 'failed',
          errorMessage: error.message || 'Unknown error occurred during background kit generation',
        },
      });

      // Re-throw to trigger BullMQ retry backoff
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
  console.error(`💥 [BullMQ] Job ${job?.id} for kit ${job?.data?.kitId} failed after attempt ${job?.attemptsMade}:`, err.message);
});

kitGenerationWorker.on('error', (err: Error) => {
  console.error('❌ [BullMQ] Worker encountered internal error:', err.message);
});

export default kitGenerationWorker;
