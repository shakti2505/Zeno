import { executeKitPipeline } from '../modules/kit/graph/workflow';
import { KitSchema } from '@zeno/shared';

async function evaluate() {
  console.log('--- Starting Zeno Interview Kit LangGraph Evaluation Pipeline ---');

  const sampleJD = `
  Position: Senior Backend Engineer
  Company: Stripe
  
  Responsibilities:
  - Design, build, and maintain APIs, services, and systems across Stripe's engineering teams.
  - Work with engineers across the company to build new features at large scale.
  - Improve engineering standards, tooling, and processes.
  
  Requirements:
  - 5+ years of software engineering experience building distributed systems.
  - Experience with relational and NoSQL databases, data modeling, and performance tuning.
  - Strong foundation in computer science fundamentals, data structures, and algorithms.
  - Excellent communication and ability to work across teams.
  - Nice to have: Experience with Go, Java, or Ruby and Cloud Infrastructure (AWS/GCP).
  `;

  console.log('🚀 Invoking LangGraph multi-step generation workflow...');
  const kit = await executeKitPipeline({
    jdText: sampleJD,
    companyUrl: 'https://stripe.com',
    days: 3,
  });

  console.log('\n--- 📋 Pipeline Output Validation ---');
  const validatedKit = KitSchema.parse(kit);

  console.log('✓ Validated Kit Schema Successfully!');
  console.log('Role Title:', validatedKit.role.title);
  console.log('Requirements Extracted:', validatedKit.role.requirements.length);
  console.log('Total Questions Generated:', validatedKit.questions.length);
  console.log('Total Flashcards Generated:', validatedKit.flashcards.length);
  console.log('Schedule Days Count:', validatedKit.schedule.days.length);
  console.log('Second-pass Coverage Analysis:', {
    uncovered: validatedKit.coverage.uncovered_requirement_ids,
    passes: validatedKit.coverage.passes,
  });
  console.log('--- Evaluation pipeline execution completed successfully! ---');
}

evaluate().catch((err) => {
  console.error('❌ Evaluation pipeline failed:', err);
  process.exit(1);
});
