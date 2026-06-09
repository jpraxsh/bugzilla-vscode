import { z } from 'zod';

export const bugSchema = z.object({
  id: z.number(),
  summary: z.string(),
  severity: z.string(),
  priority: z.string(),
  status: z.string(),
  assigned_to: z.string(),
  product: z.string(),
  component: z.string(),
  version: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});

export const bugSearchResponseSchema = z.object({
  bugs: z.array(bugSchema),
});

export const commentSchema = z.object({
  id: z.number(),
  bug_id: z.number(),
  text: z.string(),
  creator: z.string(),
  creation_time: z.string(),
  time: z.string(),
  count: z.number(),
  attachment_id: z.number().nullable(),
  is_private: z.boolean(),
  tags: z.array(z.string()),
});

export const commentSearchResponseSchema = z.object({
  bugs: z.record(
    z.string(),
    z.object({ comments: z.array(commentSchema) })
  ),
});

export const updateResponseSchema = z.object({
  bugs: z.array(
    z.object({
      id: z.number(),
      last_change_time: z.string(),
      changes: z.record(
        z.string(),
        z.object({
          added: z.string(),
          removed: z.string(),
        })
      ),
    })
  ),
});

export const urlSchema = z.string().url('Please enter a valid URL');

export const apiKeySchema = z.string().min(1, 'API Key is required');

export const emailSchema = z.string().min(1, 'Email is required');

export type Bug = z.infer<typeof bugSchema>;
export type Comment = z.infer<typeof commentSchema>;
