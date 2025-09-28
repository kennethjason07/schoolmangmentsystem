-- ====================================================
-- FACIAL RECOGNITION ATTENDANCE SYSTEM MIGRATION (FIXED)
-- ====================================================
-- This migration adds facial recognition capabilities alongside existing attendance system
-- as an additional verification method with fallback to manual entry
-- Fixed version without subqueries in CHECK constraints

-- Create facial templates table for storing face data
CREATE TABLE public.facial_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  person_type text NOT NULL CHECK (person_type = ANY (ARRAY['student'::text, 'teacher'::text])),
  template_name text NOT NULL DEFAULT 'primary',
  face_encoding bytea, -- Encrypted face encoding data
  face_image_url text, -- URL to encrypted face image in Supabase storage
  confidence_threshold numeric DEFAULT 0.8 CHECK (confidence_threshold BETWEEN 0.0 AND 1.0),
  is_active boolean DEFAULT true,
  enrollment_method text DEFAULT 'manual' CHECK (enrollment_method = ANY (ARRAY['manual'::text, 'bulk_upload'::text, 'auto_capture'::text])),
  enrolled_by uuid, -- Admin/teacher who enrolled this template
  enrollment_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  last_used timestamp with time zone,
  usage_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  tenant_id uuid NOT NULL,
  
  CONSTRAINT facial_templates_pkey PRIMARY KEY (id),
  CONSTRAINT facial_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT facial_templates_enrolled_by_fkey FOREIGN KEY (enrolled_by) REFERENCES public.users(id),
  
  -- Unique constraint per person and template name
  CONSTRAINT facial_templates_person_template_unique UNIQUE (person_id, person_type, template_name, tenant_id)
);

-- Create facial recognition events table for audit trail
CREATE TABLE public.facial_recognition_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['enrollment'::text, 'recognition_attempt'::text, 'recognition_success'::text, 'recognition_failure'::text])),
  person_id uuid,
  person_type text CHECK (person_type = ANY (ARRAY['student'::text, 'teacher'::text, 'unknown'::text])),
  matched_template_id uuid, -- References facial_templates.id if match found
  confidence_score numeric CHECK (confidence_score BETWEEN 0.0 AND 1.0),
  recognition_method text DEFAULT 'camera' CHECK (recognition_method = ANY (ARRAY['camera'::text, 'uploaded_image'::text, 'batch_process'::text])),
  input_image_url text, -- URL to the input image used for recognition
  recognition_duration_ms integer, -- Time taken for recognition in milliseconds
  device_info jsonb, -- Camera/device information
  location_info jsonb, -- GPS or location context if available
  error_message text, -- Error details if recognition failed
  performed_by uuid, -- User who performed the recognition
  performed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  ip_address inet, -- For security audit
  user_agent text, -- Browser/app info
  session_id text, -- Session identifier
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  tenant_id uuid NOT NULL,
  
  CONSTRAINT facial_recognition_events_pkey PRIMARY KEY (id),
  CONSTRAINT facial_recognition_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT facial_recognition_events_matched_template_fkey FOREIGN KEY (matched_template_id) REFERENCES public.facial_templates(id),
  CONSTRAINT facial_recognition_events_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id)
);

-- Add facial recognition support to student_attendance table
ALTER TABLE public.student_attendance 
ADD COLUMN IF NOT EXISTS verification_method text DEFAULT 'manual' CHECK (verification_method = ANY (ARRAY['manual'::text, 'facial_recognition'::text, 'hybrid'::text])),
ADD COLUMN IF NOT EXISTS recognition_event_id uuid,
ADD COLUMN IF NOT EXISTS recognition_confidence numeric CHECK (recognition_confidence BETWEEN 0.0 AND 1.0),
ADD COLUMN IF NOT EXISTS recognition_duration_ms integer,
ADD COLUMN IF NOT EXISTS backup_verification text, -- Manual verification if facial recognition fails
ADD COLUMN IF NOT EXISTS verification_notes text;

-- Add foreign key for recognition event (only if column was added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'student_attendance_recognition_event_fkey'
  ) THEN
    ALTER TABLE public.student_attendance 
    ADD CONSTRAINT student_attendance_recognition_event_fkey 
    FOREIGN KEY (recognition_event_id) REFERENCES public.facial_recognition_events(id);
  END IF;
END $$;

-- Add facial recognition support to teacher_attendance table
ALTER TABLE public.teacher_attendance 
ADD COLUMN IF NOT EXISTS verification_method text DEFAULT 'manual' CHECK (verification_method = ANY (ARRAY['manual'::text, 'facial_recognition'::text, 'hybrid'::text])),
ADD COLUMN IF NOT EXISTS recognition_event_id uuid,
ADD COLUMN IF NOT EXISTS recognition_confidence numeric CHECK (recognition_confidence BETWEEN 0.0 AND 1.0),
ADD COLUMN IF NOT EXISTS recognition_duration_ms integer,
ADD COLUMN IF NOT EXISTS backup_verification text, -- Manual verification if facial recognition fails
ADD COLUMN IF NOT EXISTS verification_notes text;

-- Add foreign key for recognition event (only if column was added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'teacher_attendance_recognition_event_fkey'
  ) THEN
    ALTER TABLE public.teacher_attendance 
    ADD CONSTRAINT teacher_attendance_recognition_event_fkey 
    FOREIGN KEY (recognition_event_id) REFERENCES public.facial_recognition_events(id);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_facial_templates_person ON public.facial_templates(person_id, person_type, tenant_id);
CREATE INDEX IF NOT EXISTS idx_facial_templates_active ON public.facial_templates(is_active, tenant_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_facial_templates_tenant ON public.facial_templates(tenant_id);

CREATE INDEX IF NOT EXISTS idx_facial_recognition_events_person ON public.facial_recognition_events(person_id, person_type, tenant_id);
CREATE INDEX IF NOT EXISTS idx_facial_recognition_events_performed_at ON public.facial_recognition_events(performed_at, tenant_id);
CREATE INDEX IF NOT EXISTS idx_facial_recognition_events_type ON public.facial_recognition_events(event_type, tenant_id);
CREATE INDEX IF NOT EXISTS idx_facial_recognition_events_tenant ON public.facial_recognition_events(tenant_id);

CREATE INDEX IF NOT EXISTS idx_student_attendance_verification ON public.student_attendance(verification_method, tenant_id);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_verification ON public.teacher_attendance(verification_method, tenant_id);

-- Indexes for validation performance
CREATE INDEX IF NOT EXISTS idx_students_id_tenant ON public.students(id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_teachers_id_tenant ON public.teachers(id, tenant_id);

-- Create RLS policies for facial_templates
ALTER TABLE public.facial_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS facial_templates_tenant_isolation ON public.facial_templates;

CREATE POLICY facial_templates_tenant_isolation ON public.facial_templates
  FOR ALL TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Create RLS policies for facial_recognition_events
ALTER TABLE public.facial_recognition_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS facial_recognition_events_tenant_isolation ON public.facial_recognition_events;

CREATE POLICY facial_recognition_events_tenant_isolation ON public.facial_recognition_events
  FOR ALL TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Create function to validate person_id references
CREATE OR REPLACE FUNCTION validate_facial_template_person_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate that person_id exists in the appropriate table for the tenant
  IF NEW.person_type = 'student' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.students 
      WHERE id = NEW.person_id AND tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'Invalid student_id % for tenant %', NEW.person_id, NEW.tenant_id;
    END IF;
  ELSIF NEW.person_type = 'teacher' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.teachers 
      WHERE id = NEW.person_id AND tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'Invalid teacher_id % for tenant %', NEW.person_id, NEW.tenant_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid person_type %. Must be student or teacher', NEW.person_type;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate person_id references
DROP TRIGGER IF EXISTS validate_facial_template_person_trigger ON public.facial_templates;

CREATE TRIGGER validate_facial_template_person_trigger
  BEFORE INSERT OR UPDATE ON public.facial_templates
  FOR EACH ROW
  EXECUTE FUNCTION validate_facial_template_person_id();

-- Create view for facial recognition statistics
CREATE OR REPLACE VIEW facial_recognition_stats AS
SELECT 
  t.id as tenant_id,
  t.name as tenant_name,
  
  -- Template statistics
  COUNT(DISTINCT ft.id) FILTER (WHERE ft.is_active = true AND ft.person_type = 'student') as active_student_templates,
  COUNT(DISTINCT ft.id) FILTER (WHERE ft.is_active = true AND ft.person_type = 'teacher') as active_teacher_templates,
  COUNT(DISTINCT ft.id) FILTER (WHERE ft.is_active = false) as inactive_templates,
  
  -- Recognition event statistics (last 30 days)
  COUNT(DISTINCT fre.id) FILTER (
    WHERE fre.event_type = 'recognition_success' 
    AND fre.performed_at >= CURRENT_DATE - INTERVAL '30 days'
  ) as successful_recognitions_30d,
  
  COUNT(DISTINCT fre.id) FILTER (
    WHERE fre.event_type = 'recognition_failure' 
    AND fre.performed_at >= CURRENT_DATE - INTERVAL '30 days'
  ) as failed_recognitions_30d,
  
  -- Average confidence score
  AVG(fre.confidence_score) FILTER (
    WHERE fre.event_type = 'recognition_success' 
    AND fre.performed_at >= CURRENT_DATE - INTERVAL '30 days'
  ) as avg_confidence_30d,
  
  -- Attendance method distribution (last 30 days)
  COUNT(DISTINCT sa.id) FILTER (
    WHERE sa.verification_method = 'facial_recognition' 
    AND sa.date >= CURRENT_DATE - INTERVAL '30 days'
  ) as facial_student_attendance_30d,
  
  COUNT(DISTINCT ta.id) FILTER (
    WHERE ta.verification_method = 'facial_recognition' 
    AND ta.date >= CURRENT_DATE - INTERVAL '30 days'
  ) as facial_teacher_attendance_30d,
  
  COUNT(DISTINCT sa.id) FILTER (
    WHERE sa.verification_method = 'manual' 
    AND sa.date >= CURRENT_DATE - INTERVAL '30 days'
  ) as manual_student_attendance_30d,
  
  COUNT(DISTINCT ta.id) FILTER (
    WHERE ta.verification_method = 'manual' 
    AND ta.date >= CURRENT_DATE - INTERVAL '30 days'
  ) as manual_teacher_attendance_30d

FROM public.tenants t
LEFT JOIN public.facial_templates ft ON t.id = ft.tenant_id
LEFT JOIN public.facial_recognition_events fre ON t.id = fre.tenant_id
LEFT JOIN public.student_attendance sa ON t.id = sa.tenant_id
LEFT JOIN public.teacher_attendance ta ON t.id = ta.tenant_id
GROUP BY t.id, t.name;

-- Enable RLS on the view
ALTER VIEW facial_recognition_stats OWNER TO postgres;

-- Grant permissions
GRANT SELECT ON public.facial_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.facial_recognition_events TO authenticated;
GRANT SELECT ON facial_recognition_stats TO authenticated;

-- Create function to update template usage
CREATE OR REPLACE FUNCTION update_template_usage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.event_type = 'recognition_success' AND NEW.matched_template_id IS NOT NULL THEN
    UPDATE public.facial_templates 
    SET 
      last_used = NEW.performed_at,
      usage_count = usage_count + 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.matched_template_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update template usage
DROP TRIGGER IF EXISTS update_facial_template_usage ON public.facial_recognition_events;

CREATE TRIGGER update_facial_template_usage
  AFTER INSERT ON public.facial_recognition_events
  FOR EACH ROW
  EXECUTE FUNCTION update_template_usage();

-- Create function to clean up old recognition events (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_recognition_events()
RETURNS void AS $$
BEGIN
  -- Keep only last 6 months of recognition events for audit
  DELETE FROM public.facial_recognition_events 
  WHERE performed_at < CURRENT_DATE - INTERVAL '6 months'
  AND event_type NOT IN ('enrollment'); -- Keep enrollment events permanently
END;
$$ LANGUAGE plpgsql;

-- Comment the tables for documentation
COMMENT ON TABLE public.facial_templates IS 'Stores encrypted facial recognition templates for students and teachers';
COMMENT ON TABLE public.facial_recognition_events IS 'Audit log for all facial recognition activities including enrollments and recognition attempts';
COMMENT ON COLUMN public.facial_templates.face_encoding IS 'Encrypted facial encoding data for recognition';
COMMENT ON COLUMN public.facial_templates.confidence_threshold IS 'Minimum confidence score required for successful recognition';
COMMENT ON COLUMN public.student_attendance.verification_method IS 'Method used to verify attendance: manual, facial_recognition, or hybrid';
COMMENT ON COLUMN public.teacher_attendance.verification_method IS 'Method used to verify attendance: manual, facial_recognition, or hybrid';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Facial Recognition System migration completed successfully!';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Create Supabase storage buckets: facial-templates, facial-events';
  RAISE NOTICE '2. Configure environment variables for encryption';
  RAISE NOTICE '3. Implement FaceRecognitionService integration';
  RAISE NOTICE '4. Update UI components for photo capture';
  RAISE NOTICE '5. Test the system with sample enrollments and recognitions';
END $$;