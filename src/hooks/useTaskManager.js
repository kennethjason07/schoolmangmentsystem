/**
 * 📋 TASK MANAGER HOOK
 * Modern task management for both admin and personal tasks
 */

import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../utils/AuthContext';
import { useTenantAccess } from '../contexts/TenantContext';
import { 
  validateTenantAccess, 
  createTenantQuery, 
  validateDataTenancy,
  TENANT_ERROR_MESSAGES 
} from '../utils/tenantValidation';
import { TABLES } from '../utils/supabase';

export const useTaskManager = () => {
  const [adminTasks, setAdminTasks] = useState([]);
  const [personalTasks, setPersonalTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { user } = useAuth();
  const { tenantId } = useTenantAccess();

  // Fetch admin tasks (from public.tasks table)
  const fetchAdminTasks = useCallback(async () => {
    if (!user?.id || !tenantId) return [];

    try {
      console.log('🔄 [TaskManager] Fetching admin tasks...');
      
      const tenantValidation = await validateTenantAccess(user.id, tenantId);
      if (!tenantValidation.isValid) {
        console.error('❌ [TaskManager] Tenant validation failed:', tenantValidation.error);
        return [];
      }

      const tenantTaskQuery = createTenantQuery(tenantId, TABLES.TASKS);
      const { data, error } = await tenantTaskQuery
        .select('*')
        .overlaps('assigned_teacher_ids', [user.id])
        .in('status', ['Pending', 'In Progress'])
        .order('priority', { ascending: false }) // High, Medium, Low
        .order('due_date', { ascending: true })
        .execute();

      if (error) {
        console.error('❌ [TaskManager] Error fetching admin tasks:', error);
        return [];
      }

      // Validate data belongs to correct tenant
      if (data && data.length > 0) {
        const isValid = validateDataTenancy(
          data.map(task => ({ id: task.id, tenant_id: task.tenant_id })),
          tenantId,
          'Admin tasks validation'
        );
        
        if (!isValid) {
          console.error('❌ [TaskManager] Admin tasks tenant validation failed');
          return [];
        }
      }

      console.log(`✅ [TaskManager] Fetched ${data?.length || 0} admin tasks`);
      return data || [];
    } catch (err) {
      console.error('❌ [TaskManager] Error in fetchAdminTasks:', err);
      return [];
    }
  }, [user?.id, tenantId]);

  // Fetch personal tasks (from public.personal_tasks table)
  const fetchPersonalTasks = useCallback(async () => {
    if (!user?.id || !tenantId) return [];

    try {
      console.log('🔄 [TaskManager] Fetching personal tasks...');
      
      const tenantValidation = await validateTenantAccess(user.id, tenantId);
      if (!tenantValidation.isValid) {
        console.error('❌ [TaskManager] Tenant validation failed:', tenantValidation.error);
        return [];
      }

      const tenantTaskQuery = createTenantQuery(tenantId, TABLES.PERSONAL_TASKS);
      const { data, error } = await tenantTaskQuery
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('priority', { ascending: false }) // high, medium, low
        .order('due_date', { ascending: true })
        .execute();

      if (error) {
        console.error('❌ [TaskManager] Error fetching personal tasks:', error);
        return [];
      }

      // Validate data belongs to correct tenant
      if (data && data.length > 0) {
        const isValid = validateDataTenancy(
          data.map(task => ({ id: task.id, tenant_id: task.tenant_id })),
          tenantId,
          'Personal tasks validation'
        );
        
        if (!isValid) {
          console.error('❌ [TaskManager] Personal tasks tenant validation failed');
          return [];
        }
      }

      console.log(`✅ [TaskManager] Fetched ${data?.length || 0} personal tasks`);
      return data || [];
    } catch (err) {
      console.error('❌ [TaskManager] Error in fetchPersonalTasks:', err);
      return [];
    }
  }, [user?.id, tenantId]);

  // Load all tasks
  const loadTasks = useCallback(async () => {
    if (loading) return;
    
    setLoading(true);
    setError(null);

    try {
      const [adminTasksData, personalTasksData] = await Promise.all([
        fetchAdminTasks(),
        fetchPersonalTasks()
      ]);

      setAdminTasks(adminTasksData);
      setPersonalTasks(personalTasksData);
    } catch (err) {
      console.error('❌ [TaskManager] Error loading tasks:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchAdminTasks, fetchPersonalTasks, loading]);

  // Create personal task
  const createPersonalTask = useCallback(async (taskData) => {
    if (!user?.id || !tenantId) {
      throw new Error('User or tenant not available');
    }

    try {
      console.log('🔄 [TaskManager] Creating personal task:', taskData);

      const tenantValidation = await validateTenantAccess(user.id, tenantId);
      if (!tenantValidation.isValid) {
        throw new Error(tenantValidation.error);
      }

      const tenantTaskQuery = createTenantQuery(tenantId, TABLES.PERSONAL_TASKS);
      const { data, error } = await tenantTaskQuery
        .insert({
          user_id: user.id,
          task_title: taskData.title,
          task_description: taskData.description || taskData.title,
          task_type: taskData.category || 'general',
          priority: taskData.priority || 'medium',
          due_date: taskData.due_date,
          status: 'pending',
          tenant_id: tenantId
        })
        .select()
        .execute();

      if (error) {
        console.error('❌ [TaskManager] Error creating personal task:', error);
        throw new Error('Failed to create task');
      }

      if (data && data[0]) {
        console.log('✅ [TaskManager] Personal task created:', data[0]);
        setPersonalTasks(prev => [data[0], ...prev]);
        return data[0];
      }
    } catch (err) {
      console.error('❌ [TaskManager] Error in createPersonalTask:', err);
      throw err;
    }
  }, [user?.id, tenantId]);

  // Complete admin task
  const completeAdminTask = useCallback(async (taskId) => {
    if (!user?.id || !tenantId) return;

    try {
      console.log('🔄 [TaskManager] Completing admin task:', taskId);

      const tenantValidation = await validateTenantAccess(user.id, tenantId);
      if (!tenantValidation.isValid) {
        throw new Error(tenantValidation.error);
      }

      const tenantTaskQuery = createTenantQuery(tenantId, TABLES.TASKS);
      const { error } = await tenantTaskQuery
        .update({
          status: 'Completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .overlaps('assigned_teacher_ids', [user.id])
        .execute();

      if (error) {
        console.error('❌ [TaskManager] Error completing admin task:', error);
        throw new Error('Failed to complete task');
      }

      console.log('✅ [TaskManager] Admin task completed:', taskId);
      setAdminTasks(prev => prev.filter(task => task.id !== taskId));
    } catch (err) {
      console.error('❌ [TaskManager] Error in completeAdminTask:', err);
      throw err;
    }
  }, [user?.id, tenantId]);

  // Complete personal task
  const completePersonalTask = useCallback(async (taskId) => {
    if (!user?.id || !tenantId) return;

    try {
      console.log('🔄 [TaskManager] Completing personal task:', taskId);

      const tenantValidation = await validateTenantAccess(user.id, tenantId);
      if (!tenantValidation.isValid) {
        throw new Error(tenantValidation.error);
      }

      const tenantTaskQuery = createTenantQuery(tenantId, TABLES.PERSONAL_TASKS);
      const { error } = await tenantTaskQuery
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .eq('user_id', user.id)
        .execute();

      if (error) {
        console.error('❌ [TaskManager] Error completing personal task:', error);
        throw new Error('Failed to complete task');
      }

      console.log('✅ [TaskManager] Personal task completed:', taskId);
      setPersonalTasks(prev => prev.filter(task => task.id !== taskId));
    } catch (err) {
      console.error('❌ [TaskManager] Error in completePersonalTask:', err);
      throw err;
    }
  }, [user?.id, tenantId]);

  // Get task summary
  const getTaskSummary = useCallback(() => {
    const totalTasks = adminTasks.length + personalTasks.length;
    const highPriorityTasks = [
      ...adminTasks.filter(task => task.priority === 'High'),
      ...personalTasks.filter(task => task.priority === 'high')
    ].length;

    const overdueTasks = [
      ...adminTasks.filter(task => task.due_date && new Date(task.due_date) < new Date()),
      ...personalTasks.filter(task => task.due_date && new Date(task.due_date) < new Date())
    ].length;

    return {
      total: totalTasks,
      admin: adminTasks.length,
      personal: personalTasks.length,
      highPriority: highPriorityTasks,
      overdue: overdueTasks
    };
  }, [adminTasks, personalTasks]);

  // Auto-load tasks when dependencies change
  useEffect(() => {
    if (user?.id && tenantId) {
      loadTasks();
    }
  }, [user?.id, tenantId]);

  return {
    adminTasks,
    personalTasks,
    loading,
    error,
    loadTasks,
    createPersonalTask,
    completeAdminTask,
    completePersonalTask,
    getTaskSummary
  };
};
