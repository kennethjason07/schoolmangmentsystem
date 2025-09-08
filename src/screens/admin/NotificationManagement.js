import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput, ScrollView, ActivityIndicator, Modal, Button, Platform, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { useAuth } from '../../utils/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import universalNotificationService from '../../services/UniversalNotificationService';
import Header from '../../components/Header';
import CrossPlatformDatePicker, { DatePickerButton } from '../../components/CrossPlatformDatePicker';
import { formatToLocalTime } from '../../utils/timeUtils';
const roles = ['teacher', 'parent', 'student', 'admin'];
const notificationTypes = ['General', 'Urgent', 'Event', 'Homework', 'Attendance', 'Absentee', 'Exam'];

// Color mapping for notification types
const getNotificationTypeColor = (type) => {
  switch (type?.toLowerCase()) {
    case 'urgent': return '#F44336'; // Red
    case 'event': return '#9C27B0'; // Purple
    case 'homework': return '#2196F3'; // Blue
    case 'attendance': return '#4CAF50'; // Green
    case 'absentee': return '#FF5722'; // Deep Orange
    case 'exam': return '#673AB7'; // Deep Purple
    case 'general': 
    default: return '#607D8B'; // Blue Grey
  }
};

const NotificationManagement = () => {
  const { user } = useAuth(); // Get current admin user
  const { tenantId, currentTenant } = useTenant(); // Get tenant info from context
  const [notifications, setNotifications] = useState([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [modal, setModal] = useState({ visible: false, mode: 'view', notification: null });
  const [createForm, setCreateForm] = useState({ 
    type: notificationTypes[0], 
    message: '', 
    status: 'Pending',
    selectedRoles: [] // Array for multiple role selection
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Helper function to get user's tenant ID
  const getUserTenantId = async () => {
    // First try to use the tenant ID from TenantContext
    if (tenantId) {
      console.log('✅ [NOTIF_MGMT] Using tenant_id from TenantContext:', tenantId);
      return tenantId;
    }
    
    // Fallback: Get from database if TenantContext is not available
    try {
      console.log('🔍 [NOTIF_MGMT] TenantContext not available, fetching from database...');
      
      if (!user?.id) {
        console.error('❌ [NOTIF_MGMT] No user ID available for tenant lookup');
        return null;
      }
      
      const { data: userRecord, error } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error('❌ [NOTIF_MGMT] Error fetching user tenant_id:', error);
        return null;
      }
      
      const dbTenantId = userRecord?.tenant_id;
      console.log('✅ [NOTIF_MGMT] Found tenant_id from database:', dbTenantId);
      return dbTenantId;
      
    } catch (error) {
      console.error('❌ [NOTIF_MGMT] Error in getUserTenantId:', error);
      return null;
    }
  };

  // Load notifications from Supabase
  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('🔔 [NOTIF_MGMT] Starting to load notifications...');
      console.log('🔔 [NOTIF_MGMT] Current user:', user?.email || 'Not logged in');
      
      if (!user?.id) {
        console.log('❌ [NOTIF_MGMT] No user ID available');
        setError('User not authenticated');
        return;
      }

      // Check current session first
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('🔔 [NOTIF_MGMT] Session check:');
      console.log('   - Session exists:', !!session);
      console.log('   - Session user:', session?.user?.email || 'None');
      console.log('   - Session error:', sessionError?.message || 'None');
      
      // JWT DEBUG: Check what's in the JWT token
      console.log('🔍 [JWT_DEBUG] Analyzing JWT token content...');
      let metadataTenantId = null; // Initialize the variable
      
      if (session?.access_token) {
        try {
          // Decode JWT payload (not verifying signature, just reading)
          const token = session.access_token;
          const base64Payload = token.split('.')[1];
          const payload = JSON.parse(atob(base64Payload));
          
          // Extract tenant_id from user_metadata if available
          metadataTenantId = payload.user_metadata?.tenant_id || payload.tenant_id;
          
          console.log('🔍 [JWT_DEBUG] JWT Payload:');
          console.log('   - iss (issuer):', payload.iss);
          console.log('   - sub (subject/user_id):', payload.sub);
          console.log('   - email:', payload.email);
          console.log('   - role:', payload.role);
          console.log('   - tenant_id:', payload.tenant_id || '❌ MISSING!');
          console.log('   - user_metadata:', JSON.stringify(payload.user_metadata || {}, null, 2));
          console.log('   - app_metadata:', JSON.stringify(payload.app_metadata || {}, null, 2));
          
          if (!payload.tenant_id) {
            console.log('❌ [JWT_DEBUG] CRITICAL: No tenant_id in JWT token!');
            console.log('❌ [JWT_DEBUG] This explains why RLS policies block all access');
            console.log('💡 [JWT_DEBUG] Need to update user authentication to include tenant_id in JWT');
          } else {
            console.log('✅ [JWT_DEBUG] tenant_id found in JWT:', payload.tenant_id);
            console.log('🔍 [JWT_DEBUG] Matches expected tenant?', payload.tenant_id === 'b8f8b5f0-1234-4567-8901-123456789000');
          }
          
        } catch (e) {
          console.log('❌ [JWT_DEBUG] Failed to decode JWT:', e.message);
        }
      } else {
        console.log('❌ [JWT_DEBUG] No access token in session');
      }
      
      if (!session) {
        console.log('❌ [NOTIF_MGMT] No active session found');
        setError('No active session');
        return;
      }

      // 🏢 Use tenant_id from TenantContext (already handles fallbacks properly)
      console.log('🏢 [NOTIF_MGMT] Using tenant_id from TenantContext:', {
        tenantId,
        tenantName: currentTenant?.name,
        userId: user?.id,
        userEmail: user?.email
      });
      
      // Additional debug: Check user's database record for tenant_id consistency
      const { data: userRecord, error: userRecordError } = await supabase
        .from('users')
        .select('tenant_id, email, role_id')
        .eq('id', user.id)
        .single();
      
      const dbTenantId = userRecord?.tenant_id;
      console.log('🔍 [NOTIF_MGMT] User database record check:', {
        dbTenantId,
        contextTenantId: tenantId,
        matches: dbTenantId === tenantId,
        error: userRecordError?.message
      });
      
      if (dbTenantId && tenantId && dbTenantId !== tenantId) {
        console.log('⚠️ [NOTIF_MGMT] TENANT MISMATCH DETECTED!');
        console.log('   - Context tenant_id:', tenantId);
        console.log('   - Database tenant_id:', dbTenantId);
        console.log('   - This indicates a data consistency issue!');
      }
      
      if (!tenantId) {
        console.error('❌ [NOTIF_MGMT] No tenant_id found for user');
        setError('Tenant information not found');
        return;
      }
      
      console.log('🔔 [NOTIF_MGMT] Querying notifications table...');
      
      // First, let's check what notifications exist in the database without tenant filtering
      console.log('🔍 [NOTIF_MGMT] Checking all notifications in database...');
      const { data: allNotifications, error: allError } = await supabase
        .from('notifications')
        .select('id, tenant_id, type, message, created_at, sent_by')
        .order('created_at', { ascending: false })
        .limit(20);
      
      console.log('🔍 [NOTIF_MGMT] All notifications check:');
      console.log('   - Total found:', allNotifications?.length || 0);
      console.log('   - Error:', allError?.message || 'None');
      console.log('   - Error code:', allError?.code || 'None');
      console.log('   - Error hint:', allError?.hint || 'None');
      console.log('   - Error details:', allError?.details || 'None');
      
      // If we get 0 notifications, let's check if this is an RLS issue
      if ((!allNotifications || allNotifications.length === 0) && !allError) {
        console.log('🔍 [NOTIF_MGMT] Zero notifications found - checking RLS policies...');
        
        // Try a simple count query to see if RLS is blocking us
        const { data: countData, error: countError } = await supabase
          .from('notifications')
          .select('count', { count: 'exact', head: true });
        
        console.log('🔍 [NOTIF_MGMT] Count query result:');
        console.log('   - Count:', countData || 'ERROR');
        console.log('   - Count error:', countError?.message || 'None');
        console.log('   - Count error code:', countError?.code || 'None');
        
        // Try to check current user's role and permissions
        console.log('🔍 [NOTIF_MGMT] Checking user permissions...');
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, email, role_id, tenant_id')
          .eq('id', user.id)
          .single();
        
        console.log('🔍 [NOTIF_MGMT] User data check:');
        console.log('   - User found:', !!userData);
        console.log('   - User email:', userData?.email || 'None');
        console.log('   - User role_id:', userData?.role_id || 'None');
        console.log('   - User tenant_id:', userData?.tenant_id || 'None');
        console.log('   - User error:', userError?.message || 'None');
        console.log('   - User error code:', userError?.code || 'None');
        
        // Try to check if any tables are accessible
        console.log('🔍 [NOTIF_MGMT] Testing basic table access...');
        const { data: rolesData, error: rolesError } = await supabase
          .from('roles')
          .select('count', { count: 'exact', head: true });
        
        console.log('🔍 [NOTIF_MGMT] Roles table access:');
        console.log('   - Accessible:', !rolesError);
        console.log('   - Error:', rolesError?.message || 'None');
        console.log('   - Error code:', rolesError?.code || 'None');
        
        // Let's also check if we can access the information_schema to see table definitions
        console.log('🔍 [NOTIF_MGMT] Checking database schema info...');
        try {
          const { data: tableInfo, error: tableError } = await supabase.rpc('check_table_exists', { table_name: 'notifications' });
          console.log('🔍 [NOTIF_MGMT] Table check RPC result:');
          console.log('   - Table exists:', tableInfo);
          console.log('   - Error:', tableError?.message || 'None');
        } catch (rpcError) {
          console.log('🔍 [NOTIF_MGMT] RPC not available, trying direct schema query...');
          
          // Fallback: try a simple RLS bypass test by checking a known system table
          const { data: schemaData, error: schemaError } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_name', 'notifications')
            .limit(1);
          
          console.log('🔍 [NOTIF_MGMT] Schema query result:');
          console.log('   - Schema accessible:', !schemaError);
          console.log('   - Schema error:', schemaError?.message || 'None');
          console.log('   - Schema error code:', schemaError?.code || 'None');
          console.log('   - Table found in schema:', schemaData?.length > 0);
        }
        
        // Try querying the exact table name used in TABLES constant
        console.log('🔍 [NOTIF_MGMT] Testing exact table name from TABLES constant...');
        console.log('   - TABLES.NOTIFICATIONS value:', TABLES.NOTIFICATIONS);
        
        const { data: exactTableData, error: exactTableError } = await supabase
          .from(TABLES.NOTIFICATIONS)
          .select('count', { count: 'exact', head: true });
        
        console.log('🔍 [NOTIF_MGMT] Exact table name test:');
        console.log('   - Accessible via TABLES.NOTIFICATIONS:', !exactTableError);
        console.log('   - Error:', exactTableError?.message || 'None');
        console.log('   - Error code:', exactTableError?.code || 'None');
        
        // Also check notification_recipients table
        const { data: recipientsTableData, error: recipientsTableError } = await supabase
          .from('notification_recipients')
          .select('count', { count: 'exact', head: true });
        
        console.log('🔍 [NOTIF_MGMT] Recipients table test:');
        console.log('   - Accessible:', !recipientsTableError);
        console.log('   - Error:', recipientsTableError?.message || 'None');
        console.log('   - Error code:', recipientsTableError?.code || 'None');
      }
      
      if (allNotifications && allNotifications.length > 0) {
        console.log('🔍 [NOTIF_MGMT] ALL notifications found in database:');
        allNotifications.forEach((notif, index) => {
          console.log(`   ${index + 1}. ID: ${notif.id}`);
          console.log(`      Tenant: ${notif.tenant_id}`);
          console.log(`      Type: ${notif.type}`);
          console.log(`      Sent by: ${notif.sent_by}`);
          console.log(`      Message: ${notif.message?.substring(0, 50)}...`);
          console.log(`      Matches our tenant: ${notif.tenant_id === tenantId}`);
          console.log(`      Matches metadata tenant: ${notif.tenant_id === metadataTenantId}`);
        });
        
        // Check if any notifications match either tenant_id
        const metadataMatches = allNotifications.filter(n => n.tenant_id === metadataTenantId).length;
        const dbMatches = allNotifications.filter(n => n.tenant_id === dbTenantId).length;
        console.log('🔍 [NOTIF_MGMT] Tenant matching summary:');
        console.log(`   - Notifications matching metadata tenant (${metadataTenantId}): ${metadataMatches}`);
        console.log(`   - Notifications matching database tenant (${dbTenantId}): ${dbMatches}`);
      } else {
        console.log('🔍 [NOTIF_MGMT] No notifications found in the entire database!');
      }
      
      // TEMPORARY FIX: Try both queries - with and without tenant filtering
      console.log('🔔 [NOTIF_MGMT] Querying with tenant filter...');
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          notification_recipients(
            id,
            recipient_id,
            recipient_type,
            delivery_status,
            sent_at,
            tenant_id
          ),
          users!sent_by(
            id,
            full_name,
            role_id
          )
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      
      console.log('🔔 [NOTIF_MGMT] Tenant-filtered notifications query result:');
      console.log('   - Found with tenant filter:', data?.length || 0);
      console.log('   - Error:', error?.message || 'None');
      
      // STRICT TENANT FILTERING: Only show notifications for current tenant
      const finalNotifications = data || [];
      
      if ((!data || data.length === 0) && !error) {
        console.log('🔍 [NOTIF_MGMT] No notifications found for tenant:', tenantId);
        console.log('✅ [NOTIF_MGMT] This is correct behavior - only showing tenant-specific notifications');
        
        // Optional: Log info about other tenants for debugging (but don't show their data)
        const { data: debugInfo } = await supabase
          .from('notifications')
          .select('tenant_id')
          .limit(5);
        
        if (debugInfo && debugInfo.length > 0) {
          const otherTenants = [...new Set(debugInfo.map(n => n.tenant_id))];
          console.log('🔍 [NOTIF_MGMT] Other tenants found in database:', otherTenants.length);
          console.log('   - Current user tenant:', tenantId);
          console.log('   - Other tenant IDs found:', otherTenants.filter(t => t !== tenantId));
          console.log('ℹ️ [NOTIF_MGMT] Not showing other tenants\' notifications (correct behavior)');
        }
      }
      
      console.log('🔔 [NOTIF_MGMT] Final notifications result:');
      console.log('   - Found:', finalNotifications?.length || 0);
      console.log('   - Tenant filter applied:', 'Yes (strict mode)');
      console.log('   - Tenant ID used:', tenantId);
      
      if (error) {
        console.error('❌ [NOTIF_MGMT] Error loading notifications:', error);
        
        // Check for RLS errors
        if (error.code === '42501') {
          console.log('🔒 [NOTIF_MGMT] RLS blocking notifications access');
          setError('Database permissions issue - please contact support');
          Alert.alert(
            'Database Access Issue',
            'Unable to load notifications due to database permissions. Please contact support.',
            [
              { text: 'OK' },
              { text: 'Retry', onPress: loadNotifications }
            ]
          );
          return;
        }
        
        throw error;
      }
      
      console.log(`✅ [NOTIF_MGMT] Successfully loaded ${finalNotifications?.length || 0} notifications`);
      setNotifications(finalNotifications || []);
    } catch (err) {
      console.error('💥 [NOTIF_MGMT] Error loading notifications:', err);
      setError('Failed to load notifications');
      Alert.alert('Error', `Failed to load notifications: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle pull-to-refresh
  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      console.log('🔄 [NOTIF_MGMT] Pull-to-refresh triggered in Notification Management');
      
      // Clear any existing errors
      setError(null);
      
      // Get tenant_id for filtering
      const tenantId = await getUserTenantId();
      if (!tenantId) {
        console.error('❌ [NOTIF_MGMT] No tenant_id found during refresh');
        setError('Tenant information not found');
        return;
      }
      
      // Load from notifications table with recipients, filtered by tenant_id
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          notification_recipients(
            id,
            recipient_id,
            recipient_type,
            delivery_status,
            sent_at,
            tenant_id
          ),
          users!sent_by(
            id,
            full_name,
            role_id
          )
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ [NOTIF_MGMT] Refresh error:', error);
        
        // Check for RLS errors
        if (error.code === '42501') {
          console.log('🔒 [NOTIF_MGMT] RLS blocking notifications access during refresh');
          setError('Database permissions issue - please contact support');
          return;
        }
        
        setError('Failed to refresh notifications');
        return;
      }
      
      console.log(`✅ [NOTIF_MGMT] Refreshed ${data?.length || 0} notifications`);
      setNotifications(data || []);
      
    } catch (err) {
      console.error('💥 [NOTIF_MGMT] Error refreshing notifications:', err);
      setError('Failed to refresh notifications');
    } finally {
      setRefreshing(false);
    }
  };

  // Filtering logic
  const filteredNotifications = notifications.filter(n => {
    if (typeFilter && n.type !== typeFilter) return false;
    if (search && !n.message?.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  // Actions
  const openViewModal = (notification) => setModal({ visible: true, mode: 'view', notification });
  
  const openEditModal = (notification) => {
    // Format the scheduled_at date and time if available
    if (notification.scheduled_at) {
      const dateObj = new Date(notification.scheduled_at);
      // Format as DD-MM-YYYY
      const dd = String(dateObj.getDate()).padStart(2, '0');
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const yyyy = dateObj.getFullYear();
      setDate(`${dd}-${mm}-${yyyy}`);
      
      // Format as 12-hour time
      let hours = dateObj.getHours();
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 should be 12
      const displayTime = `${hours}:${minutes} ${ampm}`;
      setTime(displayTime);
    } else {
      setDate('');
      setTime('');
    }
    
    // Get selected roles from existing recipients
    const existingRoles = [];
    if (notification.notification_recipients) {
      const recipientTypes = [...new Set(notification.notification_recipients.map(r => r.recipient_type.toLowerCase()))];
      existingRoles.push(...recipientTypes.map(type => type === 'student' ? 'student' : 'parent'));
    }
    
    setCreateForm({
      type: notification.type || notificationTypes[0],
      message: notification.message || '',
      status: notification.delivery_status || 'Pending',
      selectedRoles: existingRoles
    });
    
    setModal({ visible: true, mode: 'edit', notification });
  };
  
  const openCreateModal = () => {
    setDate('');
    setTime('');
    setCreateForm({ 
      type: notificationTypes[0], 
      message: '', 
      status: 'Pending',
      selectedRoles: []
    });
    setModal({ visible: true, mode: 'create', notification: null });
  };
  
  const handleDelete = (notificationId) => {
    Alert.alert('Delete Notification', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive', 
        onPress: async () => {
          try {
            setLoading(true);
            
            // Get tenant_id for RLS compliance
            const tenantId = await getUserTenantId();
            if (!tenantId) {
              console.error('❌ [NOTIF_MGMT] No tenant_id found for deleting notification');
              Alert.alert('Error', 'Tenant information not found');
              return;
            }
            
            // Delete from notifications table (will cascade to notification_recipients)
            const { error } = await supabase
              .from(TABLES.NOTIFICATIONS)
              .delete()
              .eq('id', notificationId)
              .eq('tenant_id', tenantId);
            
            if (error) {
              console.error('❌ [NOTIF_MGMT] Error deleting notification:', error);
              
              // Check for RLS errors
              if (error.code === '42501') {
                console.log('🔒 [NOTIF_MGMT] RLS blocking notification deletion');
                Alert.alert('Database Access Issue', 'Unable to delete notification due to database permissions.');
                return;
              }
              
              throw error;
            }
            
            console.log('✅ [NOTIF_MGMT] Notification deleted successfully');
            loadNotifications(); // Refresh the list
            Alert.alert('Success', 'Notification deleted successfully');
          } catch (err) {
            console.error('💥 [NOTIF_MGMT] Error deleting notification:', err);
            Alert.alert('Error', 'Failed to delete notification');
          } finally {
            setLoading(false);
          }
        } 
      },
    ]);
  };
  
  const handleResend = async (notification) => {
    try {
      setLoading(true);
      
      // Get tenant_id for RLS compliance
      const tenantId = await getUserTenantId();
      if (!tenantId) {
        console.error('❌ [NOTIF_MGMT] No tenant_id found for resending notification');
        Alert.alert('Error', 'Tenant information not found');
        return;
      }
      
      console.log('🔔 [NOTIF_MGMT] Resending notification:', notification.id);
      
      // Update delivery status for all recipients of this notification
      const { error: updateError } = await supabase
        .from('notification_recipients')
        .update({ 
          delivery_status: 'Sent' // Valid values: 'Pending', 'Sent', 'Failed' (capitalized)
        })
        .eq('notification_id', notification.id)
        .eq('tenant_id', tenantId);
      
      if (updateError) {
        console.error('❌ [NOTIF_MGMT] Error updating recipients:', updateError);
        
        // Check for RLS errors
        if (updateError.code === '42501') {
          console.log('🔒 [NOTIF_MGMT] RLS blocking recipient update');
          Alert.alert('Database Access Issue', 'Unable to update recipients due to database permissions.');
          return;
        }
        
        throw updateError;
      }
      
      // Also update the main notification
      const { error: notifUpdateError } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .update({ 
          delivery_status: 'Sent' // Valid values: 'Pending', 'Sent', 'Failed' (capitalized)
        })
        .eq('id', notification.id)
        .eq('tenant_id', tenantId);
      
      if (notifUpdateError) {
        console.error('❌ [NOTIF_MGMT] Error updating main notification:', notifUpdateError);
        
        // Check for RLS errors
        if (notifUpdateError.code === '42501') {
          console.log('🔒 [NOTIF_MGMT] RLS blocking notification update');
          Alert.alert('Database Access Issue', 'Unable to update notification due to database permissions.');
          return;
        }
        
        throw notifUpdateError;
      }
      
      console.log('✅ [NOTIF_MGMT] Notification resent successfully');
      loadNotifications(); // Refresh the list
      Alert.alert('Success', 'Notification resent successfully');
    } catch (err) {
      console.error('💥 [NOTIF_MGMT] Error resending notification:', err);
      Alert.alert('Error', 'Failed to resend notification');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDuplicate = async (notification) => {
    try {
      setLoading(true);
      
      // Get tenant_id for RLS compliance
      const tenantId = await getUserTenantId();
      if (!tenantId) {
        console.error('❌ [NOTIF_MGMT] No tenant_id found for duplicating notification');
        Alert.alert('Error', 'Tenant information not found');
        return;
      }
      
      console.log('🔔 [NOTIF_MGMT] Duplicating notification:', notification.id);
      
      // Create a duplicate notification
      const duplicateNotification = {
        type: notification.type,
        message: notification.message,
        delivery_mode: 'InApp',
        delivery_status: 'Pending', // Valid values: 'Pending', 'Sent', 'Failed' (capitalized)
        sent_by: user?.id || null, // Store current admin user ID
        tenant_id: tenantId // Include tenant_id for RLS compliance
      };
      
      const { data, error } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .insert(duplicateNotification)
        .select();
      
      if (error) {
        console.error('❌ [NOTIF_MGMT] Error duplicating notification:', error);
        
        // Check for RLS errors
        if (error.code === '42501') {
          console.log('🔒 [NOTIF_MGMT] RLS blocking notification duplication');
          Alert.alert('Database Access Issue', 'Unable to duplicate notification due to database permissions.');
          return;
        }
        
        throw error;
      }
      
      console.log('✅ [NOTIF_MGMT] Notification duplicated successfully');
      // Update local state
      setNotifications([...(data || []), ...notifications]);
      Alert.alert('Success', 'Notification duplicated successfully');
    } catch (err) {
      console.error('💥 [NOTIF_MGMT] Error duplicating notification:', err);
      Alert.alert('Error', 'Failed to duplicate notification');
    } finally {
      setLoading(false);
    }
  };
  
  // Create/Edit logic
  const handleSave = async () => {
    if (!createForm.message.trim()) {
      Alert.alert('Error', 'Message is required');
      return;
    }
    
    if (createForm.selectedRoles.length === 0) {
      Alert.alert('Error', 'Please select at least one recipient role');
      return;
    }
    
    try {
      setLoading(true);
      
      let scheduledAt = null;
      if (date && time) {
        try {
          // Convert DD-MM-YYYY and 12-hour time to ISO string
          const [dd, mm, yyyy] = date.split('-');
          let timeFormatted = time;
          
          // Validate date parts
          const dayNum = parseInt(dd, 10);
          const monthNum = parseInt(mm, 10);
          const yearNum = parseInt(yyyy, 10);
          
          if (isNaN(dayNum) || isNaN(monthNum) || isNaN(yearNum) ||
              dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12 || yearNum < 1900) {
            throw new Error('Invalid date format');
          }
          
          // Convert 12-hour time to 24-hour format for ISO string
          if (time.includes('AM') || time.includes('PM')) {
            const [timeStr, ampm] = time.split(' ');
            const [hours12, minutes] = timeStr.split(':');
            let hours24 = parseInt(hours12, 10);
            const minutesNum = parseInt(minutes, 10);
            
            if (isNaN(hours24) || isNaN(minutesNum) || hours24 < 1 || hours24 > 12 || minutesNum < 0 || minutesNum > 59) {
              throw new Error('Invalid time format');
            }
            
            if (ampm === 'PM' && hours24 !== 12) hours24 += 12;
            if (ampm === 'AM' && hours24 === 12) hours24 = 0;
            timeFormatted = `${String(hours24).padStart(2, '0')}:${String(minutesNum).padStart(2, '0')}:00`;
          } else {
            // Handle 24-hour format if provided
            const [hours, minutes] = timeFormatted.split(':');
            const hoursNum = parseInt(hours, 10);
            const minutesNum = parseInt(minutes, 10);
            
            if (isNaN(hoursNum) || isNaN(minutesNum) || hoursNum < 0 || hoursNum > 23 || minutesNum < 0 || minutesNum > 59) {
              throw new Error('Invalid time format');
            }
            
            timeFormatted = `${String(hoursNum).padStart(2, '0')}:${String(minutesNum).padStart(2, '0')}:00`;
          }
          
          // Create date using Date constructor with separate parameters to avoid parsing issues
          const scheduleDate = new Date(yearNum, monthNum - 1, dayNum);
          const [hours, minutes] = timeFormatted.split(':');
          scheduleDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
          
          if (isNaN(scheduleDate.getTime())) {
            throw new Error('Invalid date/time combination');
          }
          
          scheduledAt = scheduleDate.toISOString();
        } catch (error) {
          console.error('Date/time parsing error:', error);
          Alert.alert('Error', 'Invalid date or time format. Please check your input.');
          return;
        }
      }
      
      // Get tenant_id for RLS compliance - use the same logic as loadNotifications
      const metadataTenantId = await getUserTenantId();
      console.log('💾 [NOTIF_CREATE] Metadata tenant ID:', metadataTenantId);
      
      // Get database tenant_id
      const { data: userRecord } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();
      
      const dbTenantId = userRecord?.tenant_id;
      console.log('💾 [NOTIF_CREATE] Database tenant ID:', dbTenantId);
      
      // Use database tenant_id as primary
      const tenantId = dbTenantId || metadataTenantId;
      console.log('💾 [NOTIF_CREATE] Using tenant ID for creation:', tenantId);
      
      if (!tenantId) {
        console.error('❌ [NOTIF_CREATE] No tenant_id found for creating notification');
        Alert.alert('Error', 'Tenant information not found');
        return;
      }

      console.log('💾 [NOTIF_CREATE] Starting notification creation process...');
      console.log('💾 [NOTIF_CREATE] Selected roles:', createForm.selectedRoles);
      
      // Step 1: Create notification record
      const notificationData = {
        type: createForm.type,
        message: createForm.message,
        delivery_mode: 'InApp',
        delivery_status: createForm.status,
        scheduled_at: scheduledAt,
        sent_by: user?.id || null, // Store current admin user ID
        tenant_id: tenantId // Include tenant_id for RLS compliance
      };
      
      console.log('💾 [NOTIF_CREATE] Notification data to insert:', notificationData);
      
      const { data: notificationResult, error: notificationError } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .insert(notificationData)
        .select()
        .single();
      
      console.log('💾 [NOTIF_CREATE] Notification insertion result:');
      console.log('   - Success:', !!notificationResult);
      console.log('   - New notification ID:', notificationResult?.id);
      console.log('   - Error:', notificationError?.message || 'None');
      
      if (notificationError) {
        console.error('❌ [NOTIF_CREATE] Error creating notification:', notificationError);
        throw notificationError;
      }
      
      // Step 2: Get all users to create recipients based on selected roles, filtered by tenant
      console.log('💾 [NOTIF_CREATE] Fetching users for recipient creation...');
      console.log('💾 [NOTIF_CREATE] Looking for users with tenant_id:', tenantId);
      
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, role_id, email, full_name')
        .eq('tenant_id', tenantId);
      
      console.log('💾 [NOTIF_CREATE] Users query result:');
      console.log('   - Total users found:', users?.length || 0);
      console.log('   - Error:', usersError?.message || 'None');
      
      if (usersError) {
        console.error('❌ [NOTIF_CREATE] Error fetching users:', usersError);
        throw usersError;
      }
      
      if (users && users.length > 0) {
        console.log('💾 [NOTIF_CREATE] User breakdown by role:');
        const roleBreakdown = {};
        users.forEach(user => {
          if (!roleBreakdown[user.role_id]) {
            roleBreakdown[user.role_id] = [];
          }
          roleBreakdown[user.role_id].push(`${user.email} (${user.full_name || 'No name'})`);
        });
        
        Object.entries(roleBreakdown).forEach(([roleId, userList]) => {
          console.log(`   - Role ${roleId}: ${userList.length} users`);
          userList.slice(0, 3).forEach(userInfo => console.log(`     * ${userInfo}`));
          if (userList.length > 3) {
            console.log(`     ... and ${userList.length - 3} more`);
          }
        });
      } else {
        console.log('💾 [NOTIF_CREATE] No users found for tenant:', tenantId);
      }
      
      // Map role names to role_ids based on typical school management system structure
      const roleMap = {
        'admin': 1,
        'student': 2,
        'parent': 3,
        'teacher': 4
      };
      
      console.log('💾 [NOTIF_CREATE] Role mapping:', roleMap);
      
      // Get role_ids for selected roles
      const selectedRoleIds = createForm.selectedRoles.map(role => roleMap[role]).filter(Boolean);
      console.log('💾 [NOTIF_CREATE] Selected role IDs:', selectedRoleIds);
      
      // Step 3: Create recipients based on selected roles
      // Note: Database only supports 'Student' and 'Parent' in notification_recipients table
      const supportedRoles = createForm.selectedRoles.filter(role => role === 'student' || role === 'parent');
      const unsupportedRoles = createForm.selectedRoles.filter(role => role === 'teacher' || role === 'admin');
      
      console.log('💾 [NOTIF_CREATE] Role filtering:');
      console.log('   - Supported roles:', supportedRoles);
      console.log('   - Unsupported roles:', unsupportedRoles);
      
      const filteredUsers = users?.filter(user => selectedRoleIds.includes(user.role_id)) || [];
      console.log('💾 [NOTIF_CREATE] Users matching selected roles:', filteredUsers.length);
      
      const recipients = filteredUsers
        .map(user => {
          // Map role_id back to recipient_type (only Student and Parent are valid in notification_recipients)
          let recipientType = null;
          if (user.role_id === 3) recipientType = 'Parent';
          else if (user.role_id === 2) recipientType = 'Student';
          // Teachers (role_id 4) and Admins (role_id 1) are not supported in notification_recipients table
          
          console.log(`💾 [NOTIF_CREATE] Mapping user ${user.email} (role ${user.role_id}) -> ${recipientType}`);
          
          return {
            notification_id: notificationResult.id,
            recipient_id: user.id,
            recipient_type: recipientType,
            delivery_status: 'Pending',
            tenant_id: tenantId // Include tenant_id for RLS compliance
          };
        })
        .filter(recipient => {
          const isValid = recipient.recipient_type === 'Student' || recipient.recipient_type === 'Parent';
          if (!isValid) {
            console.log(`💾 [NOTIF_CREATE] Filtering out recipient with type: ${recipient.recipient_type}`);
          }
          return isValid;
        });
      
      console.log('💾 [NOTIF_CREATE] Final recipients to create:', recipients.length);
      if (recipients.length > 0) {
        console.log('💾 [NOTIF_CREATE] Sample recipients:');
        recipients.slice(0, 3).forEach((r, i) => {
          console.log(`   ${i + 1}. User: ${r.recipient_id}, Type: ${r.recipient_type}, Tenant: ${r.tenant_id}`);
        });
      }
      
      // Step 4: Insert into notification_recipients table
      if (recipients.length > 0) {
        console.log('💾 [NOTIF_CREATE] Inserting recipients into notification_recipients table...');
        const { data: recipientsResult, error: recipientsError } = await supabase
          .from('notification_recipients')
          .insert(recipients)
          .select();
        
        console.log('💾 [NOTIF_CREATE] Recipients insertion result:');
        console.log('   - Success:', !!recipientsResult);
        console.log('   - Recipients created:', recipientsResult?.length || 0);
        console.log('   - Error:', recipientsError?.message || 'None');
        console.log('   - Error code:', recipientsError?.code || 'None');
        
        if (recipientsError) {
          console.error('❌ [NOTIF_CREATE] Error creating recipients:', recipientsError);
          throw recipientsError;
        }
      } else {
        console.log('💾 [NOTIF_CREATE] No valid recipients to create - all selected roles are unsupported');
      }
      
      console.log('💾 [NOTIF_CREATE] Creation process completed successfully!');
      
      // Step 5: Broadcast real-time notification updates to trigger badge refreshes
      if (recipients.length > 0) {
        try {
          console.log('📡 [NOTIF_CREATE] Broadcasting new notification to users...');
          const recipientUserIds = recipients.map(r => r.recipient_id);
          
          // Broadcast to each user individually for instant badge updates
          await universalNotificationService.broadcastNewNotificationToUsers(
            recipientUserIds,
            notificationResult.id,
            createForm.type || 'General'
          );
          
          console.log('✅ [NOTIF_CREATE] Real-time broadcasts sent successfully');
        } catch (broadcastError) {
          console.warn('⚠️ [NOTIF_CREATE] Broadcasting failed (not critical):', broadcastError);
          // Continue even if broadcasting fails - the notifications were created successfully
        }
      }
      
      // Create success message with role breakdown
      let successMessage = `Notification created successfully!\n`;
      if (supportedRoles.length > 0) {
        const studentCount = recipients.filter(r => r.recipient_type === 'Student').length;
        const parentCount = recipients.filter(r => r.recipient_type === 'Parent').length;
        
        const roleCounts = [];
        if (supportedRoles.includes('student') && studentCount > 0) {
          roleCounts.push(`${studentCount} Student${studentCount > 1 ? 's' : ''}`);
        }
        if (supportedRoles.includes('parent') && parentCount > 0) {
          roleCounts.push(`${parentCount} Parent${parentCount > 1 ? 's' : ''}`);
        }
        
        if (roleCounts.length > 0) {
          successMessage += `Sent to: ${roleCounts.join(', ')}\n`;
        }
      }
      
      if (unsupportedRoles.length > 0) {
        successMessage += `Note: ${unsupportedRoles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')} notifications are not yet supported by the system.`;
      }
      
      console.log('💾 [NOTIF_CREATE] Refreshing notifications list...');
      loadNotifications(); // Refresh the list
      Alert.alert('Success', successMessage.trim());
      
      setModal({ visible: false, mode: 'view', notification: null });
      setCreateForm({ 
        type: notificationTypes[0], 
        message: '', 
        status: 'Pending',
        selectedRoles: []
      });
      setDate('');
      setTime('');
    } catch (err) {
      console.error('Error saving notification:', err);
      Alert.alert('Error', `Failed to save notification: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // UI
  return (
    <View style={styles.container}>
      <Header title="Notification Management" showBack={true} />
      
      {/* Filter/Search Bar */}
      <View style={styles.filterBarMain}>
        <View style={styles.searchBarRow}>
          <Ionicons name="search" size={20} color="#888" style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search message..."
            value={search}
            onChangeText={setSearch}
            style={styles.filterInput}
            placeholderTextColor="#888"
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginTop: 8 }}>
          <TouchableOpacity
            style={[styles.filterBtn, (typeFilter.trim().toLowerCase() === '') ? styles.activeFilterBtn : null]}
            onPress={() => setTypeFilter('')}
          >
            <Text style={(typeFilter.trim().toLowerCase() === '') ? styles.activeFilterText : styles.filterBtnText}>All Types</Text>
          </TouchableOpacity>
          {notificationTypes.map(type => (
            <TouchableOpacity
              key={type}
              style={[styles.filterBtn, (typeFilter.trim().toLowerCase() === type.toLowerCase()) ? styles.activeFilterBtn : null]}
              onPress={() => setTypeFilter(type)}
            >
              <Text style={(typeFilter.trim().toLowerCase() === type.toLowerCase()) ? styles.activeFilterText : styles.filterBtnText}>{type}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
      {/* Loading Indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      )}
      
      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadNotifications}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Notifications List */}
      {!loading && !error && (
        <View style={styles.scrollWrapper}>
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={Platform.OS === 'web'}
            keyboardShouldPersistTaps="handled"
            bounces={Platform.OS !== 'web'}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={['#1976d2', '#007bff']} // Android colors
                tintColor="#1976d2" // iOS color
                title="Pull to refresh" // iOS title
                titleColor="#1976d2" // iOS title color
              />
            }
          >
            {filteredNotifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No notifications found</Text>
              </View>
            ) : (
              filteredNotifications.map((item) => (
                <TouchableOpacity 
                  key={item.id}
                  style={[
                    styles.notificationCard,
                    { borderLeftWidth: 4, borderLeftColor: getNotificationTypeColor(item.type) }
                  ]} 
                  onPress={() => openViewModal(item)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[
                      styles.notificationType,
                      { color: getNotificationTypeColor(item.type) }
                    ]}>
                      {(item.type || 'general').toUpperCase()}
                    </Text>
                    <Text style={styles.notificationMsg}>{item.message}</Text>
                    <Text style={styles.notificationMeta}>
                      Recipients: {item.notification_recipients?.length || 0}
                      {item.scheduled_at ? ` | Scheduled: ${formatToLocalTime(item.scheduled_at)}` : ''}
                      {item.sent_at ? ` | Sent: ${formatToLocalTime(item.sent_at)}` : ''}
                    </Text>
                    <Text style={styles.notificationStatus}>
                      Status: {item.delivery_status || 'Pending'}
                      {item.notification_recipients && (
                        ` | Sent: ${item.notification_recipients.filter(r => r.delivery_status === 'Sent').length}/${item.notification_recipients.length}`
                      )}
                    </Text>
                  </View>
                  <View style={styles.iconCol}>
                    <TouchableOpacity onPress={() => openEditModal(item)}>
                      <Ionicons name="pencil" size={20} color="#1976d2" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ marginTop: 8 }}>
                      <Ionicons name="trash" size={20} color="#f44336" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      )}
      {/* Floating Add Button */}
       <TouchableOpacity style={styles.fab} onPress={openCreateModal}>
         <Text style={styles.fabIcon}>+</Text>
       </TouchableOpacity>
      
      {/* Create/Edit/View Modal */}
      <Modal visible={modal.visible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentModern}>
            {modal.mode === 'view' && modal.notification && (
              <>
                <Text style={styles.modalTitle}>Notification Details</Text>
                <Text style={styles.notificationType}>{(modal.notification.type || 'general').toUpperCase()}</Text>
                <Text style={styles.notificationMsg}>{modal.notification.message}</Text>
                <Text style={styles.notificationMeta}>To: {modal.notification.sent_to_role || 'Unknown'}</Text>
                {modal.notification.scheduled_at && (
                  <Text style={styles.notificationMeta}>Scheduled: {formatToLocalTime(modal.notification.scheduled_at)}</Text>
                )}
                {modal.notification.sent_at && (
                  <Text style={styles.notificationMeta}>Sent: {formatToLocalTime(modal.notification.sent_at)}</Text>
                )}
                <Text style={styles.notificationMeta}>Status: {modal.notification.delivery_status || 'Unknown'}</Text>
                <Button title="Close" onPress={() => setModal({ visible: false, mode: 'view', notification: null })} />
              </>
            )}
            {(modal.mode === 'edit' || modal.mode === 'create') && (
              <ScrollView>
                <Text style={styles.modalTitle}>{modal.mode === 'edit' ? 'Edit Notification' : 'Create Notification'}</Text>
                
                <Text style={{ marginTop: 8 }}>Type:</Text>
                <ScrollView horizontal style={{ marginBottom: 8 }}>
                  {notificationTypes.map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.typeBtn, createForm.type === type && styles.activeTypeBtn]}
                      onPress={() => setCreateForm(f => ({ ...f, type }))}
                    >
                      <Text>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                
                <TextInput
                  placeholder="Message"
                  value={createForm.message}
                  onChangeText={text => setCreateForm(f => ({ ...f, message: text }))}
                  style={[styles.input, { height: 100 }]}
                  multiline
                />
                
                <Text style={{ marginTop: 8 }}>Recipient Roles (Multiple Selection):</Text>
                <ScrollView horizontal style={{ marginBottom: 8 }}>
                  {roles.map(role => {
                    const isSelected = createForm.selectedRoles.includes(role);
                    return (
                      <TouchableOpacity
                        key={role}
                        style={[styles.recipientBtn, isSelected && styles.activeRecipientBtn]}
                        onPress={() => {
                          const newRoles = isSelected 
                            ? createForm.selectedRoles.filter(r => r !== role)
                            : [...createForm.selectedRoles, role];
                          setCreateForm(f => ({ ...f, selectedRoles: newRoles }));
                        }}
                      >
                        <Text style={[{ color: isSelected ? '#1976d2' : '#666' }]}>{role}</Text>
                        {isSelected && <Ionicons name="checkmark" size={16} color="#1976d2" style={{ marginLeft: 4 }} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <Text style={{ marginTop: 8, marginBottom: 4 }}>Schedule Notification (Optional):</Text>
                {Platform.OS === 'web' ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <CrossPlatformDatePicker
                        label="Date"
                        value={date ? (() => {
                          const [dd, mm, yyyy] = date.split('-');
                          return new Date(yyyy, mm - 1, dd);
                        })() : null}
                        onChange={(event, selectedDate) => {
                          if (selectedDate) {
                            const dd = String(selectedDate.getDate()).padStart(2, '0');
                            const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                            const yyyy = selectedDate.getFullYear();
                            setDate(`${dd}-${mm}-${yyyy}`);
                          }
                        }}
                        mode="date"
                        placeholder="Select Date"
                        containerStyle={{ marginBottom: 8 }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <CrossPlatformDatePicker
                        label="Time"
                        value={time ? (() => {
                          const [timeStr, ampm] = time.split(' ');
                          const [hours12, minutes] = timeStr.split(':');
                          let hours24 = parseInt(hours12);
                          if (ampm === 'PM' && hours24 !== 12) hours24 += 12;
                          if (ampm === 'AM' && hours24 === 12) hours24 = 0;
                          return new Date(1970, 0, 1, hours24, parseInt(minutes));
                        })() : new Date()}
                        onChange={(event, selectedDate) => {
                          if (selectedDate) {
                            let hours = selectedDate.getHours();
                            const minutes = String(selectedDate.getMinutes()).padStart(2, '0');
                            const ampm = hours >= 12 ? 'PM' : 'AM';
                            hours = hours % 12;
                            hours = hours ? hours : 12;
                            setTime(`${hours}:${minutes} ${ampm}`);
                          }
                        }}
                        mode="time"
                        placeholder="Select Time"
                        containerStyle={{ marginBottom: 8 }}
                      />
                    </View>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <DatePickerButton
                      label="Date"
                      value={date ? (() => {
                        const [dd, mm, yyyy] = date.split('-');
                        return new Date(yyyy, mm - 1, dd);
                      })() : null}
                      onPress={() => setShowDatePicker(true)}
                      placeholder="Date (DD-MM-YYYY)"
                      mode="date"
                      style={{ flex: 1 }}
                      containerStyle={{ flex: 1, marginBottom: 8 }}
                    />
                    <DatePickerButton
                      label="Time"
                      value={time ? (() => {
                        const [timeStr, ampm] = time.split(' ');
                        const [hours12, minutes] = timeStr.split(':');
                        let hours24 = parseInt(hours12);
                        if (ampm === 'PM' && hours24 !== 12) hours24 += 12;
                        if (ampm === 'AM' && hours24 === 12) hours24 = 0;
                        return new Date(1970, 0, 1, hours24, parseInt(minutes));
                      })() : new Date()}
                      onPress={() => setShowTimePicker(true)}
                      placeholder="Time (12hr format)"
                      mode="time"
                      style={{ flex: 1 }}
                      containerStyle={{ flex: 1, marginBottom: 8 }}
                    />
                  </View>
                )}
                {/* Mobile Date/Time Pickers - Only show on mobile platforms */}
                {Platform.OS !== 'web' && showDatePicker && (
                  <CrossPlatformDatePicker
                    value={date ? (
                      // Convert DD-MM-YYYY to Date object
                      date.includes('-') ? 
                        (() => {
                          const [dd, mm, yyyy] = date.split('-');
                          return new Date(yyyy, mm - 1, dd);
                        })()
                      : new Date(date)
                    ) : new Date()}
                    mode="date"
                    display="calendar"
                    onChange={(event, selectedDate) => {
                      setShowDatePicker(false);
                      if (selectedDate) {
                        const dd = String(selectedDate.getDate()).padStart(2, '0');
                        const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                        const yyyy = selectedDate.getFullYear();
                        setDate(`${dd}-${mm}-${yyyy}`);
                      }
                    }}
                  />
                )}
                {Platform.OS !== 'web' && showTimePicker && (
                  <CrossPlatformDatePicker
                    value={time ? (
                      // Convert 12-hour format to Date object for picker
                      time.includes('AM') || time.includes('PM') ? 
                        (() => {
                          const [timeStr, ampm] = time.split(' ');
                          const [hours12, minutes] = timeStr.split(':');
                          let hours24 = parseInt(hours12);
                          if (ampm === 'PM' && hours24 !== 12) hours24 += 12;
                          if (ampm === 'AM' && hours24 === 12) hours24 = 0;
                          return new Date(1970, 0, 1, hours24, parseInt(minutes));
                        })()
                      : new Date(`1970-01-01T${time}:00`)
                    ) : new Date()}
                    mode="time"
                    display="clock"
                    onChange={(event, selectedDate) => {
                      setShowTimePicker(false);
                      if (selectedDate) {
                        let hours = selectedDate.getHours();
                        const minutes = String(selectedDate.getMinutes()).padStart(2, '0');
                        const ampm = hours >= 12 ? 'PM' : 'AM';
                        hours = hours % 12;
                        hours = hours ? hours : 12; // 0 should be 12
                        setTime(`${hours}:${minutes} ${ampm}`);
                      }
                    }}
                  />
                )}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                  <Button title="Cancel" onPress={() => setModal({ visible: false, mode: 'view', notification: null })} />
                  <Button title="Save" onPress={handleSave} />
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 2,
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  // Scroll wrapper styles to fix scrolling issues (matching ManageClasses pattern)
  scrollWrapper: {
    flex: 1,
    ...Platform.select({
      web: {
        height: 'calc(100vh - 200px)',
        maxHeight: 'calc(100vh - 200px)',
        minHeight: 400,
        overflow: 'hidden',
      },
    }),
  },
  scrollContainer: {
    flex: 1,
    marginTop: 8,
    ...Platform.select({
      web: {
        overflowY: 'auto',
      },
    }),
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    ...Platform.select({
      web: {
        paddingBottom: 80,
      },
    }),
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#007bff',
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterInput: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
    marginRight: 8,
    color: '#222',
    backgroundColor: '#fff',
    fontSize: 16,
  },
  filterBtn: {
    padding: 8,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  filterBtnText: {
    color: '#1976d2',
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  activeFilterBtn: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
    color: '#fff',
  },
  activeFilterText: {
    color: '#fff',
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    elevation: 1,
  },
  notificationType: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  notificationMsg: {
    fontSize: 16,
    color: '#333',
    marginVertical: 2,
  },
  notificationMeta: {
    fontSize: 12,
    color: '#888',
  },
  notificationStatus: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 2,
  },
  iconCol: {
    flexDirection: 'column',
    alignItems: 'center',
    marginLeft: 8,
    gap: 4,
  },
  icon: {
    fontSize: 20,
    textAlign: 'center',
    marginVertical: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 8,
    width: '90%',
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
    marginTop: 8,
  },
  typeBtn: {
    padding: 8,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    alignItems: 'center',
  },
  activeTypeBtn: {
    backgroundColor: '#e3f2fd',
    borderColor: '#1976d2',
  },
  recipientBtn: {
    padding: 8,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    alignItems: 'center',
  },
  activeRecipientBtn: {
    backgroundColor: '#e3f2fd',
    borderColor: '#1976d2',
  },
  filterBarMain: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 0,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    backgroundColor: '#007bff',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabIcon: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: -2,
  },
  modalContentModern: {
    backgroundColor: '#fff',
    padding: 28,
    borderRadius: 16,
    width: '92%',
    maxHeight: '92%',
    elevation: 4,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 4,
  },
  actionIcon: {
    marginVertical: 2,
    marginBottom: 2,
  },
});

export default NotificationManagement;
