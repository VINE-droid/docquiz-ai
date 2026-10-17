import { z } from 'zod';

export const healthCheckResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string(),
  uptime: z.number().optional(),
});

export type HealthCheckResponse = z.infer<typeof healthCheckResponseSchema>;
