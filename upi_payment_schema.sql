-- UPI Payment Tracking Table
-- This table tracks UPI payment transactions separate from student_fees
-- Links to student_fees when payment is verified

CREATE TABLE IF NOT EXISTS public.upi_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id),
  student_fee_id uuid REFERENCES public.student_fees(id), -- Links to student_fees after verification
  transaction_ref varchar(255) NOT NULL UNIQUE, -- Format: ADM123-20241207-001
  amount numeric NOT NULL,
  upi_id varchar(255) NOT NULL DEFAULT 'hanokalure0@okhdfcbank',
  payment_status varchar(50) NOT NULL DEFAULT 'PENDING', -- PENDING, SUCCESS, FAILED
  qr_data text NOT NULL, -- UPI payment string
  
  -- Verification details
  admin_verified_by uuid REFERENCES public.users(id),
  bank_reference_number varchar(255), -- UTR/Reference from UPI app
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
  CONSTRAINT upi_transactions_status_check CHECK (payment_status IN ('PENDING', 'SUCCESS', 'FAILED'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_upi_transactions_student_id ON public.upi_transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_upi_transactions_status ON public.upi_transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_upi_transactions_tenant_id ON public.upi_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_upi_transactions_transaction_ref ON public.upi_transactions(transaction_ref);

-- Enable RLS (Row Level Security)
ALTER TABLE public.upi_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy for tenant isolation
CREATE POLICY upi_transactions_tenant_isolation ON public.upi_transactions
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_upi_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_upi_transactions_updated_at_trigger
  BEFORE UPDATE ON public.upi_transactions
  FOR EACH ROW EXECUTE FUNCTION update_upi_transactions_updated_at();

-- Function to generate unique transaction reference
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

COMMIT;
