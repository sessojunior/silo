-- Migration: cria tabela para deduplicação de mensagens consumidas do Kafka
CREATE TABLE IF NOT EXISTS kafka_processed_messages (
  topic text NOT NULL,
  message_id text NOT NULL,
  handler text,
  processed_at timestamptz DEFAULT now(),
  UNIQUE (topic, message_id)
);
