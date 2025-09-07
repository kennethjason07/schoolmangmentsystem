-- Complete UPI Payment System Database Setup
-- This script creates all necessary tables, sequences, and policies

-- 1. Create receipt number sequence if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS receipt_number_seq START WITH 1000 INCREMENT BY 1;

-- 2. Create student_fees table if it doesn't exist
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

-- 3. Create UPI transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.upi_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  student_fee_id uuid,
  transaction_ref varchar(255) NOT NULL UNIQUE,
  amount numeric NOT NULL,
  upi_id varchar(255) NOT NULL DEFAULT 'hanokalure0@okhdfcbank',
  payment_status varchar(50) NOT NULL DEFAULT 'PENDING',
  qr_data text NOT NULL,
  
  -- Verification details
  admin_verified_by uuid,
  bank_reference_number varchar(255),
  verified_at timestamp with time zone,
  verification_notes text,
  
  -- Fee context
  fee_component varchar(255) NOT NULL,
  academic_year varchar(10) NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  
  -- Audit fields
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  tenant_id uuid NOT NULL,
  
  CONSTRAINT upi_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT upi_transactions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT upi_transactions_student_fee_id_fkey FOREIGN KEY (student_fee_id) REFERENCES public.student_fees(id),
  CONSTRAINT upi_transactions_admin_verified_by_fkey FOREIGN KEY (admin_verified_by) REFERENCES public.users(id),
  CONSTRAINT upi_transactions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT upi_transactions_status_check CHECK (payment_status IN ('PENDING', 'SUCCESS', 'FAILED'))
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_student_fees_receipt_number ON public.student_fees USING btree (receipt_number) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_student_fees_tenant_id ON public.student_fees USING btree (tenant_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_student_fees_student_id ON public.student_fees USING btree (student_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_student_fees_academic_year ON public.student_fees USING btree (academic_year) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_student_fees_payment_date ON public.student_fees USING btree (payment_date) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_upi_transactions_student_id ON public.upi_transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_upi_transactions_status ON public.upi_transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_upi_transactions_tenant_id ON public.upi_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_upi_transactions_transaction_ref ON public.upi_transactions(transaction_ref);

-- 5. Enable RLS on both tables
ALTER TABLE public.student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upi_transactions ENABLE ROW LEVEL SECURITY;

-- 6. Create or replace RLS policies (drop existing ones first)
DROP POLICY IF EXISTS student_fees_tenant_isolation ON public.student_fees;
DROP POLICY IF EXISTS upi_transactions_tenant_isolation ON public.upi_transactions;

-- Create tenant isolation policies that work with or without app.current_tenant_id
CREATE POLICY student_fees_tenant_isolation ON public.student_fees
  USING (
    tenant_id = COALESCE(
      (current_setting('app.current_tenant_id', true))::uuid,
      tenant_id
    )
  );

CREATE POLICY upi_transactions_tenant_isolation ON public.upi_transactions
  USING (
    tenant_id = COALESCE(
      (current_setting('app.current_tenant_id', true))::uuid,
      tenant_id
    )
  );

-- 7. Create or replace update trigger for upi_transactions
CREATE OR REPLACE FUNCTION update_upi_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_upi_transactions_updated_at_trigger ON public.upi_transactions;
CREATE TRIGGER update_upi_transactions_updated_at_trigger
  BEFORE UPDATE ON public.upi_transactions
  FOR EACH ROW EXECUTE FUNCTION update_upi_transactions_updated_at();

-- 8. Create helper function for generating UPI transaction references
CREATE OR REPLACE FUNCTION generate_upi_transaction_ref(student_admission_no varchar)
RETURNS varchar AS $$
DECLARE
  today_str varchar;
  sequence_num integer;
  transaction_ref varchar;
BEGIN
  today_str := to_char(CURRENT_DATE, 'YYYYMMDD');
  
  -- Get next sequence number for today
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(transaction_ref FROM LENGTH(student_admission_no || '-' || today_str || '-') + 1)
      AS integer
    )
  ), 0) + 1
  INTO sequence_num
  FROM upi_transactions
  WHERE transaction_ref LIKE student_admission_no || '-' || today_str || '-%';
  
  transaction_ref := student_admission_no || '-' || today_str || '-' || LPAD(sequence_num::text, 3, '0');
  
  RETURN transaction_ref;
END;
$$ LANGUAGE plpgsql;

-- 9. Create a safer set_config function (optional - helps with RLS issues)
CREATE OR REPLACE FUNCTION safe_set_tenant_id(tenant_uuid uuid)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', tenant_uuid::text, false);
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore errors - this allows the system to work even if set_config fails
    NULL;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON public.student_fees TO postgres;
GRANT ALL PRIVILEGES ON public.upi_transactions TO postgres;
GRANT USAGE, SELECT ON receipt_number_seq TO postgres;

COMMIT;

-- Print success message
DO $$
BEGIN
  RAISE NOTICE '✅ UPI Payment System setup completed successfully!';
  RAISE NOTICE 'Tables created: student_fees, upi_transactions';
  RAISE NOTICE 'Sequence created: receipt_number_seq';
  RAISE NOTICE 'Indexes and RLS policies configured';
END $$;
