import { RequirementSchema } from '@zeno/shared';

async function evaluate() {
  console.log('--- Starting Zeno Interview Kit Evaluation Pipeline ---');
  const sampleRequirement = {
    id: 'req-eval-1',
    text: 'Demonstrate deep understanding of distributed systems and caching strategies',
    kind: 'technical' as const,
    priority: 'must' as const,
  };
  const validated = RequirementSchema.parse(sampleRequirement);
  console.log('Validated sample requirement with @zeno/shared schema:', validated);
  console.log('Evaluation pipeline execution completed successfully.');
}

evaluate().catch((err) => {
  console.error('Evaluation failed:', err);
  process.exit(1);
});
