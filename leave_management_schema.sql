-- Leave Management System Database Schema
-- This table will store all teacher leave applications and their approval workflow

CREATE TABLE public.leave_applications (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    teacher_id uuid NOT NULL,
    leave_type text NOT NULL CHECK (leave_type = ANY (ARRAY[
        'Sick Leave'::text, 
        'Casual Leave'::text, 
        'Earned Leave'::text, 
        'Maternity Leave'::text, 
        'Paternity Leave'::text, 
        'Emergency Leave'::text, 
        'Personal Leave'::text,
        'Medical Leave'::text,
        'Other'::text
    ])),
    start_date date NOT NULL,
    end_date date NOT NULL,
    total_days integer NOT NULL DEFAULT 1,
    reason text NOT NULL,
    attachment_url text, -- For medical certificates or other supporting documents
    
    -- Application details
    applied_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    applied_by uuid NOT NULL, -- Either the teacher themselves or admin on behalf
    
    -- Approval workflow
    status text NOT NULL DEFAULT 'Pending'::text CHECK (status = ANY (ARRAY[
        'Pending'::text, 
        'Approved'::text, 
        'Rejected'::text, 
        'Cancelled'::text
    ])),
    
    -- Admin action details
    reviewed_by uuid, -- Admin who approved/rejected
    reviewed_at timestamp with time zone,
    admin_remarks text, -- Admin's comments on approval/rejection
    
    -- Replacement/Coverage details
    replacement_teacher_id uuid, -- Teacher who will cover the classes
    replacement_notes text, -- Instructions for replacement teacher
    
    -- Academic tracking
    academic_year text NOT NULL DEFAULT (EXTRACT(year FROM CURRENT_DATE))::text,
    
    -- System timestamps
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    
    -- Primary key
    CONSTRAINT leave_applications_pkey PRIMARY KEY (id),
    
    -- Foreign key constraints
    CONSTRAINT leave_applications_teacher_id_fkey 
        FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE,
    CONSTRAINT leave_applications_applied_by_fkey 
        FOREIGN KEY (applied_by) REFERENCES public.users(id),
    CONSTRAINT leave_applications_reviewed_by_fkey 
        FOREIGN KEY (reviewed_by) REFERENCES public.users(id),
    CONSTRAINT leave_applications_replacement_teacher_id_fkey 
        FOREIGN KEY (replacement_teacher_id) REFERENCES public.teachers(id),
    
    -- Business logic constraints
    CONSTRAINT leave_applications_date_check CHECK (end_date >= start_date),
    CONSTRAINT leave_applications_total_days_check CHECK (total_days > 0),
    CONSTRAINT leave_applications_reviewed_requirements_check 
        CHECK (
            (status = 'Pending' AND reviewed_by IS NULL AND reviewed_at IS NULL) OR
            (status IN ('Approved', 'Rejected') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
        )
);

-- Create indexes for better query performance
CREATE INDEX idx_leave_applications_teacher_id ON public.leave_applications(teacher_id);
CREATE INDEX idx_leave_applications_status ON public.leave_applications(status);
CREATE INDEX idx_leave_applications_applied_date ON public.leave_applications(applied_date);
CREATE INDEX idx_leave_applications_date_range ON public.leave_applications(start_date, end_date);
CREATE INDEX idx_leave_applications_academic_year ON public.leave_applications(academic_year);

-- Create a function to automatically calculate total_days
CREATE OR REPLACE FUNCTION calculate_leave_days()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_days := (NEW.end_date - NEW.start_date) + 1;
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically calculate leave days
CREATE TRIGGER trigger_calculate_leave_days
    BEFORE INSERT OR UPDATE ON public.leave_applications
    FOR EACH ROW
    EXECUTE FUNCTION calculate_leave_days();

-- Create a table for leave balance tracking (optional enhancement)
CREATE TABLE public.teacher_leave_balance (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    teacher_id uuid NOT NULL,
    academic_year text NOT NULL,
    
    -- Leave balances by type
    sick_leave_total integer DEFAULT 12, -- Total allowed per year
    sick_leave_used integer DEFAULT 0,
    casual_leave_total integer DEFAULT 12,
    casual_leave_used integer DEFAULT 0,
    earned_leave_total integer DEFAULT 20,
    earned_leave_used integer DEFAULT 0,
    
    -- Tracking
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT teacher_leave_balance_pkey PRIMARY KEY (id),
    CONSTRAINT teacher_leave_balance_teacher_id_fkey 
        FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE,
    
    -- Unique constraint to prevent duplicate records per teacher per year
    CONSTRAINT teacher_leave_balance_unique 
        UNIQUE (teacher_id, academic_year),
    
    -- Check constraints for valid balances
    CONSTRAINT teacher_leave_balance_sick_check 
        CHECK (sick_leave_used >= 0 AND sick_leave_used <= sick_leave_total),
    CONSTRAINT teacher_leave_balance_casual_check 
        CHECK (casual_leave_used >= 0 AND casual_leave_used <= casual_leave_total),
    CONSTRAINT teacher_leave_balance_earned_check 
        CHECK (earned_leave_used >= 0 AND earned_leave_used <= earned_leave_total)
);

-- Index for leave balance
CREATE INDEX idx_teacher_leave_balance_teacher_year ON public.teacher_leave_balance(teacher_id, academic_year);

-- Function to update leave balance when leave is approved
CREATE OR REPLACE FUNCTION update_leave_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update balance when status changes to 'Approved'
    IF NEW.status = 'Approved' AND (OLD.status IS NULL OR OLD.status != 'Approved') THEN
        -- Update the appropriate leave balance
        IF NEW.leave_type = 'Sick Leave' THEN
            UPDATE public.teacher_leave_balance 
            SET sick_leave_used = sick_leave_used + NEW.total_days,
                updated_at = CURRENT_TIMESTAMP
            WHERE teacher_id = NEW.teacher_id AND academic_year = NEW.academic_year;
        ELSIF NEW.leave_type = 'Casual Leave' THEN
            UPDATE public.teacher_leave_balance 
            SET casual_leave_used = casual_leave_used + NEW.total_days,
                updated_at = CURRENT_TIMESTAMP
            WHERE teacher_id = NEW.teacher_id AND academic_year = NEW.academic_year;
        ELSIF NEW.leave_type = 'Earned Leave' THEN
            UPDATE public.teacher_leave_balance 
            SET earned_leave_used = earned_leave_used + NEW.total_days,
                updated_at = CURRENT_TIMESTAMP
            WHERE teacher_id = NEW.teacher_id AND academic_year = NEW.academic_year;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update leave balance
CREATE TRIGGER trigger_update_leave_balance
    AFTER UPDATE ON public.leave_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_leave_balance();

-- Sample data insertion (optional - for testing)
-- Insert initial leave balance for all teachers for current academic year
/*
INSERT INTO public.teacher_leave_balance (teacher_id, academic_year)
SELECT id, EXTRACT(year FROM CURRENT_DATE)::text
FROM public.teachers
ON CONFLICT (teacher_id, academic_year) DO NOTHING;
*/
