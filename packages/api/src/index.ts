import express from 'express';
import cors from 'cors';
import { healthCheckResponseSchema, type HealthCheckResponse } from '@docquiz/shared';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5050;

app.use(cors());
app.use(express.json());

app.get('/api/healthz', (_req, res) => {
  const payload: HealthCheckResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  };

  const parsed = healthCheckResponseSchema.safeParse(payload);
  if (!parsed.success) {
    res.status(500).json({ error: 'Internal health check validation failed' });
    return;
  }

  res.json(parsed.data);
});

app.listen(PORT, () => {
  console.log(`[API] Server listening on http://localhost:${PORT}`);
});
