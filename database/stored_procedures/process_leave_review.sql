-- ===================================================================
-- LEAVE MANAGEMENT OPTIMIZATION: Batch Operations Stored Procedure
-- ===================================================================
-- This procedure combines multiple database operations into a single call:
-- 1. Update leave application status
-- 2. Find teacher user account
-- 3. Create notification
-- 4. Create notification recipient
-- 5. Return all necessary data for UI updates
--
-- Performance Impact: Reduces 4+ API calls to 1 RPC call
-- ===================================================================

CREATE OR REPLACE FUNCTION process_leave_review(
  p_leave_id UUID,
  p_new_status TEXT,
  p_admin_remarks TEXT,
  p_replacement_teacher_id UUID DEFAULT NULL,
  p_replacement_notes TEXT DEFAULT NULL,
  p_reviewed_by UUID,
  p_tenant_id UUID
) RETURNS JSON AS $$
DECLARE
  v_updated_leave RECORD;
  v_teacher_user_id UUID;
  v_notification_id UUID;
  v_teacher_name TEXT;
  v_leave_type TEXT;
  v_start_date DATE;
  v_end_date DATE;
  v_push_tokens JSON;
  v_result JSON;
BEGIN
  -- Validate input parameters
  IF p_leave_id IS NULL OR p_new_status IS NULL OR p_reviewed_by IS NULL OR p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Missing required parameters';
  END IF;

  -- Validate status
  IF p_new_status NOT IN ('Approved', 'Rejected') THEN
    RAISE EXCEPTION 'Invalid status: must be Approved or Rejected';
  END IF;

  -- Step 1: Update leave application with all changes
  UPDATE leave_applications 
  SET 
    status = p_new_status,
    reviewed_by = p_reviewed_by,
    reviewed_at = NOW(),
    admin_remarks = COALESCE(p_admin_remarks, ''),
    replacement_teacher_id = p_replacement_teacher_id,
    replacement_notes = p_replacement_notes,
    updated_at = NOW()
  WHERE id = p_leave_id 
    AND tenant_id = p_tenant_id
    AND status = 'Pending' -- Only update pending applications
  RETURNING 
    id, teacher_id, leave_type, start_date, end_date, reason, status,
    applied_date, reviewed_at, admin_remarks, replacement_teacher_id, 
    replacement_notes, total_days
  INTO v_updated_leave;

  -- Check if update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leave application not found, not pending, or access denied';
  END IF;

  -- Step 2: Get teacher details and user account in single query
  SELECT 
    u.id as user_id,
    t.name as teacher_name
  INTO v_teacher_user_id, v_teacher_name
  FROM teachers t
  LEFT JOIN users u ON u.linked_teacher_id = t.id AND u.tenant_id = p_tenant_id
  WHERE t.id = v_updated_leave.teacher_id 
    AND t.tenant_id = p_tenant_id;

  -- Step 3: Create notification and recipient atomically
  IF v_teacher_user_id IS NOT NULL THEN
    -- Create notification
    INSERT INTO notifications (
      message, 
      type, 
      sent_by, 
      delivery_mode, 
      delivery_status, 
      tenant_id,
      created_at
    )
    VALUES (
      CASE 
        WHEN p_new_status = 'Approved' THEN 
          'Your ' || v_updated_leave.leave_type || ' request has been approved.' ||
          CASE WHEN p_admin_remarks IS NOT NULL AND p_admin_remarks != '' 
               THEN ' Remarks: ' || p_admin_remarks 
               ELSE '' 
          END
        ELSE 
          'Your ' || v_updated_leave.leave_type || ' request has been rejected.' ||
          CASE WHEN p_admin_remarks IS NOT NULL AND p_admin_remarks != '' 
               THEN ' Remarks: ' || p_admin_remarks 
               ELSE '' 
          END
      END,
      'General',
      p_reviewed_by,
      'InApp',
      'Sent',
      p_tenant_id,
      NOW()
    )
    RETURNING id INTO v_notification_id;

    -- Create notification recipient
    INSERT INTO notification_recipients (
      notification_id, 
      recipient_id, 
      recipient_type, 
      delivery_status, 
      sent_at, 
      is_read, 
      tenant_id
    )
    VALUES (
      v_notification_id,
      v_teacher_user_id,
      'Teacher',
      'Sent',
      NOW(),
      false,
      p_tenant_id
    );
  END IF;

  -- Step 4: Get push tokens for the teacher (for external push notifications)
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'token', pt.token,
        'user_id', pt.user_id
      )
    ) FILTER (WHERE pt.token IS NOT NULL), 
    '[]'::json
  ) INTO v_push_tokens
  FROM push_tokens pt
  INNER JOIN users u ON u.id = pt.user_id AND u.tenant_id = p_tenant_id
  WHERE pt.user_id = v_teacher_user_id 
    AND pt.is_active = true;

  -- Step 5: Build comprehensive result
  SELECT json_build_object(
    'success', true,
    'updated_leave', json_build_object(
      'id', v_updated_leave.id,
      'teacher_id', v_updated_leave.teacher_id,
      'leave_type', v_updated_leave.leave_type,
      'start_date', v_updated_leave.start_date,
      'end_date', v_updated_leave.end_date,
      'reason', v_updated_leave.reason,
      'status', v_updated_leave.status,
      'applied_date', v_updated_leave.applied_date,
      'reviewed_at', v_updated_leave.reviewed_at,
      'admin_remarks', v_updated_leave.admin_remarks,
      'replacement_teacher_id', v_updated_leave.replacement_teacher_id,
      'replacement_notes', v_updated_leave.replacement_notes,
      'total_days', v_updated_leave.total_days,
      'teacher', json_build_object(
        'id', v_updated_leave.teacher_id,
        'name', v_teacher_name
      ),
      'reviewed_by_user', json_build_object(
        'id', p_reviewed_by
      )
    ),
    'notification', json_build_object(
      'id', v_notification_id,
      'created', v_notification_id IS NOT NULL
    ),
    'teacher_user_id', v_teacher_user_id,
    'teacher_name', v_teacher_name,
    'push_tokens', v_push_tokens,
    'timestamp', extract(epoch from now()) * 1000
  ) INTO v_result;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return structured error response
    RAISE NOTICE 'Error in process_leave_review: %', SQLERRM;
    
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
-- GRANT EXECUTE ON FUNCTION process_leave_review TO authenticated;

-- Add helpful comment for future maintenance
COMMENT ON FUNCTION process_leave_review IS 
'Optimized batch function for leave review operations. 
Combines update, notification creation, and data retrieval into single atomic operation.
Performance: Reduces 4+ API calls to 1 RPC call.
Created for leave management optimization.';