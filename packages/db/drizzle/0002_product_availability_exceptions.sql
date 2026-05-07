-- Migration: cria excecoes de disponibilidade por produto e dia
CREATE TABLE IF NOT EXISTS product_availability_exception (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  product_id text NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  date date NOT NULL,
  type text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, date, type)
);

CREATE INDEX IF NOT EXISTS idx_product_availability_exception_product_date
  ON product_availability_exception (product_id, date);