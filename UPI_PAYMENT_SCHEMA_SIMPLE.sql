-- Simplified UPI Payment System Database Schema
-- This version works without multi-tenant setup

-- 1. Create payment_transactions table for QR code payments (simplified)
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  merchant_transaction_id text NOT NULL UNIQUE,
  amount numeric NOT NULL CHECK (amount > 0),
  fee_components jsonb NOT NULL, -- Store fee breakdown as JSON
  payment_status text NOT NULL DEFAULT 'QR_GENERATED' 
    CHECK (payment_status IN ('QR_GENERATED', 'SUCCESS', 'FAILED', 'PENDING')),
  qr_code_data text, -- UPI string for QR code
  qr_code_url text, -- Optional: if storing QR images
  verified_by uuid, -- Admin who verified the payment
  verification_notes text,
  payment_proof_url text, -- Screenshot/proof uploaded by user
  bank_reference_number text, -- UPI reference number
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  completed_at timestamp with time zone,
  created_by uuid NOT NULL, -- Admin who initiated payment
  
  CONSTRAINT payment_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT payment_transactions_student_id_fkey FOREIGN KEY (student_id) 
    REFERENCES public.students(id),
  CONSTRAINT payment_transactions_created_by_fkey FOREIGN KEY (created_by) 
    REFERENCES public.users(id),
  CONSTRAINT payment_transactions_verified_by_fkey FOREIGN KEY (verified_by) 
    REFERENCES public.users(id)
);

-- 2. Create payment_verifications table for admin verification log (simplified)
CREATE TABLE IF NOT EXISTS public.payment_verifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL,
  verified_by uuid NOT NULL,
  verification_status text NOT NULL 
    CHECK (verification_status IN ('VERIFIED', 'REJECTED', 'PENDING_INFO')),
  verification_notes text,
  bank_reference_number text,
  verified_amount numeric,
  payment_proof_url text,
  verified_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT payment_verifications_pkey PRIMARY KEY (id),
  CONSTRAINT payment_verifications_transaction_id_fkey FOREIGN KEY (transaction_id) 
    REFERENCES public.payment_transactions(id),
  CONSTRAINT payment_verifications_verified_by_fkey FOREIGN KEY (verified_by) 
    REFERENCES public.users(id)
);

-- 3. Add indexes for better performance
CREATE INDEX IF NOT EXISTS payment_transactions_student_id_idx 
  ON public.payment_transactions(student_id);
CREATE INDEX IF NOT EXISTS payment_transactions_merchant_txn_id_idx 
  ON public.payment_transactions(merchant_transaction_id);
CREATE INDEX IF NOT EXISTS payment_transactions_status_idx 
  ON public.payment_transactions(payment_status);
CREATE INDEX IF NOT EXISTS payment_transactions_created_at_idx 
  ON public.payment_transactions(created_at);

CREATE INDEX IF NOT EXISTS payment_verifications_transaction_id_idx 
  ON public.payment_verifications(transaction_id);

-- 4. Create function to generate receipt numbers (simplified)
CREATE OR REPLACE FUNCTION generate_payment_receipt_number()
RETURNS TEXT AS $$
DECLARE
  receipt_num TEXT;
  counter INTEGER;
BEGIN
  -- Get current date in YYYYMMDD format
  receipt_num := 'UPI' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  
  -- Get the count of payments for today
  SELECT COUNT(*) + 1 INTO counter
  FROM payment_transactions 
  WHERE DATE(created_at) = CURRENT_DATE;
    
  -- Append counter with leading zeros (e.g., 001, 002, etc.)
  receipt_num := receipt_num || LPAD(counter::TEXT, 3, '0');
  
  RETURN receipt_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Update student_fees table to add UPI mode if not exists
DO $$
BEGIN
  -- Check if 'UPI' is already in the payment_mode constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name LIKE '%payment_mode%' 
    AND check_clause LIKE '%UPI%'
  ) THEN
    -- Add UPI to payment_mode if it doesn't exist
    ALTER TABLE public.student_fees 
    DROP CONSTRAINT IF EXISTS student_fees_payment_mode_check;
    
    ALTER TABLE public.student_fees 
    ADD CONSTRAINT student_fees_payment_mode_check 
    CHECK (payment_mode = ANY (ARRAY['Cash'::text, 'Card'::text, 'Online'::text, 'UPI'::text]));
  END IF;
END $$;

-- 6. Create view for payment dashboard (simplified)
CREATE OR REPLACE VIEW payment_transactions_with_student_details AS
SELECT 
  pt.id,
  pt.merchant_transaction_id,
  pt.amount,
  pt.fee_components,
  pt.payment_status,
  pt.bank_reference_number,
  pt.created_at,
  pt.completed_at,
  s.id as student_id,
  s.name as student_name,
  s.admission_no,
  c.class_name,
  u.full_name as created_by_name,
  v.full_name as verified_by_name
FROM payment_transactions pt
JOIN students s ON pt.student_id = s.id
LEFT JOIN classes c ON s.class_id = c.id
LEFT JOIN users u ON pt.created_by = u.id
LEFT JOIN users v ON pt.verified_by = v.id;

-- 7. Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE ON public.payment_transactions TO authenticated;
GRANT SELECT, INSERT ON public.payment_verifications TO authenticated;
GRANT SELECT ON payment_transactions_with_student_details TO authenticated;

-- Success message
SELECT 'Simplified UPI Payment System database schema created successfully!' as status;
