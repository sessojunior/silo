-- Migration: cria conversas persistidas do assistente de IA por usuário
CREATE TABLE ai_assistant_thread (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id text NOT NULL,
  title text NOT NULL,
  last_message_preview text NOT NULL DEFAULT '',
  message_count integer NOT NULL DEFAULT 0,
  last_message_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE ai_assistant_message (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  thread_id uuid NOT NULL,
  sender_type text NOT NULL DEFAULT 'user',
  sender_user_id text,
  sender_name text NOT NULL,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint

ALTER TABLE ai_assistant_thread ADD CONSTRAINT ai_assistant_thread_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE ai_assistant_message ADD CONSTRAINT ai_assistant_message_thread_id_ai_assistant_thread_id_fk FOREIGN KEY (thread_id) REFERENCES public.ai_assistant_thread(id) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE ai_assistant_message ADD CONSTRAINT ai_assistant_message_sender_user_id_user_id_fk FOREIGN KEY (sender_user_id) REFERENCES public."user"(id) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE INDEX idx_ai_assistant_thread_user_id ON ai_assistant_thread (user_id);--> statement-breakpoint
CREATE INDEX idx_ai_assistant_thread_last_message_at ON ai_assistant_thread (last_message_at);--> statement-breakpoint
CREATE INDEX idx_ai_assistant_message_thread_id ON ai_assistant_message (thread_id);--> statement-breakpoint
CREATE INDEX idx_ai_assistant_message_created_at ON ai_assistant_message (created_at);