import { z } from 'zod';

export const searchSchema = z.object({
  searchText: z.string().trim().min(1).max(50),
});

export const instrumentRateSchema = z.object({
  instrumentId: z.number().int().positive(),
});

export const alertSchema = z.object({
  instrumentId: z.number().int().positive(),
  symbol: z.string().trim().min(1).max(20),
  displayName: z.string().trim().min(1).max(120),
  targetPrice: z.number().positive(),
  condition: z.enum(['gte', 'lte']),
  frequencyMinutes: z.number().int().min(1).max(1440),
});

export const alertUpdateSchema = alertSchema.partial().extend({
  id: z.string().trim().min(1),
});

export const alertDeleteSchema = z.object({
  id: z.string().trim().min(1),
});
