import { z } from 'zod';

export const whoamiResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  real_name: z.string(),
});

export const bugSchema = z.object({
  id: z.number(),
  summary: z.string(),
  severity: z.string(),
  priority: z.string(),
  status: z.string(),
  assigned_to: z.string(),
  product: z.string(),
  component: z.string(),
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
});

export const commentSearchResponseSchema = z.object({
  bugs: z.record(
    z.string(),
    z.object({ comments: z.array(commentSchema) })
  ),
});

export const statusUpdateResponseSchema = z.object({
  bugs: z.array(
    z.object({
      id: z.number(),
      last_change_time: z.string(),
      changes: z.object({
        status: z.object({
          removed: z.string(),
          added: z.string(),
        }).optional(),
        resolution: z.object({
          removed: z.string(),
          added: z.string(),
        }).optional(),
      }),
    })
  ),
});

export const urlSchema = z.string().url('Please enter a valid URL');

export const apiKeySchema = z.string().min(1, 'API Key is required');

export type WhoamiResponse = z.infer<typeof whoamiResponseSchema>;
export type Bug = z.infer<typeof bugSchema>;
export type Comment = z.infer<typeof commentSchema>;
export type StatusUpdateResponse = z.infer<typeof statusUpdateResponseSchema>;
