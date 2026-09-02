import { PlaceholderSchema } from '@zeno/shared';

async function evaluate() {
  console.log('--- Starting Zeno Interview Kit Evaluation Pipeline ---');
  const sample = { id: 'eval-1', name: 'Evaluation Pipeline Demo' };
  const validated = PlaceholderSchema.parse(sample);
  console.log('Validated sample input with shared schema:', validated);
  console.log('Evaluation pipeline execution completed successfully.');
}

evaluate().catch((err) => {
  console.error('Evaluation failed:', err);
  process.exit(1);
});
