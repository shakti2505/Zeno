import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PlaceholderSchema } from '@zeno/shared';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'zeno-backend'
  });
});

app.get('/api/test-shared', (req: Request, res: Response) => {
  const result = PlaceholderSchema.safeParse({ id: 'test-1', name: 'Zeno Interview Prep' });
  res.json({
    success: result.success,
    data: result.success ? result.data : null
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Zeno Backend running on http://localhost:${PORT}`);
});

export default app;
