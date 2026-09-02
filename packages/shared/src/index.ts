import { z } from 'zod';

// Placeholder schema to be populated with full Kit schemas in the next step
export const PlaceholderSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export type PlaceholderType = z.infer<typeof PlaceholderSchema>;
