-- First, create the sequence if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS receipt_number_seq START WITH 1 INCREMENT BY 1;

-- Create the student_fees table with proper structure
CREATE TABLE IF NOT EXISTS public.student_fees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NULL,
  academic_year text NOT NULL,
  fee_component text NOT NULL,
  amount_paid numeric(10, 2) NOT NULL,
  payment_date date NOT NULL,
  payment_mode text NULL,
  remarks text NULL,
  created_at timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP,
  receipt_number bigint NOT NULL DEFAULT nextval('receipt_number_seq'::regclass),
  tenant_id uuid NOT NULL,
  CONSTRAINT student_fees_pkey PRIMARY KEY (id),
  CONSTRAINT student_fees_receipt_number_key UNIQUE (receipt_number),
  CONSTRAINT student_fees_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students (id) ON DELETE CASCADE,
  CONSTRAINT student_fees_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants (id),
  CONSTRAINT student_fees_payment_mode_check CHECK (
    (
      payment_mode = ANY (
        ARRAY[
          'Cash'::text,
          'Card'::text,
          'Online'::text,
          'UPI'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_student_fees_receipt_number ON public.student_fees USING btree (receipt_number) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_student_fees_tenant_id ON public.student_fees USING btree (tenant_id) TABLESPACE pg_default;

-- Additional useful indexes
CREATE INDEX IF NOT EXISTS idx_student_fees_student_id ON public.student_fees USING btree (student_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_student_fees_academic_year ON public.student_fees USING btree (academic_year) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_student_fees_payment_date ON public.student_fees USING btree (payment_date) TABLESPACE pg_default;
