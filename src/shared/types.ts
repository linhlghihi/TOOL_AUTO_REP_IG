import { z } from 'zod';
export const MediaSchema = z.object({ kind: z.enum(['image', 'audio', 'unsupported']), url: z.string().max(6000).optional(), label: z.string().max(300).optional() });
export const MessageSchema = z.object({ id: z.string().min(1).max(300), sender: z.enum(['customer', 'self', 'unknown', 'system']), text: z.string().max(20000), timestamp: z.number().optional(), media: z.array(MediaSchema).max(8).default([]), deleted: z.boolean().optional() });
export const SnapshotSchema = z.object({ account: z.string().min(1).max(100), thread: z.string().regex(/^\d{5,40}$/), customer: z.string().max(150), messages: z.array(MessageSchema).max(500), confirmed: z.boolean(), source: z.enum(['network', 'dom']) });
export type Message = z.infer<typeof MessageSchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;
export const SettingsSchema = z.object({ model: z.string().regex(/^[a-zA-Z0-9._-]{1,120}$/).default('gemini-3.8-flash-high'), website: z.string().max(2000).default(''), context: z.string().max(150000).default(''), tone: z.string().max(2000).default('Thân thiện, ngắn gọn. Không hứa điều chưa xác nhận.'), language: z.string().max(80).default('auto') });
export type Settings = z.infer<typeof SettingsSchema>;
export const ResultSchema = z.object({
 language: z.string().max(100),
 reply: z.string().max(16000), questions: z.array(z.string().max(2000)).max(10), needsWebsite: z.boolean(), searchTerms: z.array(z.string().max(200)).max(8), warnings: z.array(z.string().max(2000)).max(20)
});
export type AIResult = z.infer<typeof ResultSchema>;
export type Source = { url: string; title: string; text: string; fetchedAt: number };
export type Job = { id: string; status: 'queued' | 'running' | 'done' | 'error' | 'cancelled'; phase: string; result?: AIResult; sources?: Source[]; error?: string; cached?: boolean; snapshot: Snapshot };
export const AnswerSchema = z.object({ snapshot: SnapshotSchema, question: z.string().min(1).max(10000), answer: z.string().min(1).max(10000) });
export const resultJsonSchema = {
 type: 'object', additionalProperties: false,
 properties: {
  language: { type: 'string' },
  reply: { type: 'string' }, questions: { type: 'array', items: { type: 'string' } }, needsWebsite: { type: 'boolean' }, searchTerms: { type: 'array', items: { type: 'string' } }, warnings: { type: 'array', items: { type: 'string' } }
 }, required: ['language', 'reply', 'questions', 'needsWebsite', 'searchTerms', 'warnings']
};
