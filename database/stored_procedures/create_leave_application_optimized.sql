-- ===================================================================
-- LEAVE APPLICATION OPTIMIZATION: Streamlined Creation Procedure
-- ===================================================================
-- This procedure optimizes leave application creation by:
-- 1. Validating all inputs in a single transaction
-- 2. Creating the leave application record
-- 3. Calculating total days automatically
-- 4. Returning enriched data for UI updates
--
-- Performance Impact: Reduces multiple round-trips to single RPC call
-- ===================================================================

CREATE OR REPLACE FUNCTION create_leave_application_optimized(
  p_teacher_id UUID,
  p_leave_type TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_reason TEXT,
  p_applied_by UUID,
  p_attachment_url TEXT DEFAULT NULL,
  p_tenant_id UUID
) RETURNS JSON AS $$
DECLARE
  v_new_application RECORD;
  v_teacher_name TEXT;
  v_total_days INTEGER;
  v_result JSON;
BEGIN
  -- Input validation
  IF p_teacher_id IS NULL OR p_leave_type IS NULL OR p_start_date IS NULL 
     OR p_end_date IS NULL OR p_reason IS NULL OR p_applied_by IS NULL 
     OR p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Missing required parameters for leave application';
  END IF;

  -- Validate date range
  IF p_start_date > p_end_date THEN
    RAISE EXCEPTION 'Start date cannot be after end date';
  END IF;

  -- Calculate total days
  v_total_days := (p_end_date - p_start_date) + 1;

  -- Validate teacher exists and belongs to tenant
  SELECT name INTO v_teacher_name
  FROM teachers 
  WHERE id = p_teacher_id 
    AND tenant_id = p_tenant_id;
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Teacher not found or access denied';
  END IF;

  -- Create leave application
  INSERT INTO leave_applications (
    teacher_id,
    leave_type,
    start_date,
    end_date,
    reason,
    applied_by,
    attachment_url,
    status,
    applied_date,
    total_days,
    tenant_id,
    created_at
  ) VALUES (
    p_teacher_id,
    p_leave_type,
    p_start_date,
    p_end_date,
    TRIM(p_reason),
    p_applied_by,
    p_attachment_url,
    'Pending',
    CURRENT_DATE,
    v_total_days,
    p_tenant_id,
    NOW()
  )
  RETURNING 
    id, teacher_id, leave_type, start_date, end_date, reason,
    applied_by, attachment_url, status, applied_date, total_days
  INTO v_new_application;

  -- Build comprehensive result with teacher information
  SELECT json_build_object(
    'success', true,
    'application', json_build_object(
      'id', v_new_application.id,
      'teacher_id', v_new_application.teacher_id,
      'leave_type', v_new_application.leave_type,
      'start_date', v_new_application.start_date,
      'end_date', v_new_application.end_date,
      'reason', v_new_application.reason,
      'applied_by', v_new_application.applied_by,
      'attachment_url', v_new_application.attachment_url,
      'status', v_new_application.status,
      'applied_date', v_new_application.applied_date,
      'total_days', v_new_application.total_days,
      'teacher', json_build_object(
        'id', v_new_application.teacher_id,
        'name', v_teacher_name
      )
    ),
    'message', 'Leave application submitted successfully',
    'timestamp', extract(epoch from now()) * 1000
  ) INTO v_result;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return structured error response
    RAISE NOTICE 'Error in create_leave_application_optimized: %', SQLERRM;
    
    SELECT json_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE,
      'timestamp', extract(epoch from now()) * 1000
    ) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to appropriate roles
-- GRANT EXECUTE ON FUNCTION create_leave_application_optimized TO authenticated;

-- Add helpful comment for future maintenance
COMMENT ON FUNCTION create_leave_application_optimized IS 
'Optimized function for leave application creation with validation and enrichment.
Performance: Reduces multiple API calls to single RPC call.
Created for leave application optimization.';