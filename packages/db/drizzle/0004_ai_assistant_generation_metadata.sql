-- Migration: adiciona metadados de geração ao assistente de IA
ALTER TABLE ai_assistant_message ADD COLUMN provider text;--> statement-breakpoint
ALTER TABLE ai_assistant_message ADD COLUMN model text;--> statement-breakpoint
ALTER TABLE ai_assistant_message ADD COLUMN generation_status text;--> statement-breakpoint
ALTER TABLE ai_assistant_message ADD COLUMN latency_ms integer;--> statement-breakpoint
ALTER TABLE ai_assistant_message ADD COLUMN error_message text;--> statement-breakpoint