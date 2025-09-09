# Tenant-Filtered Notification System - Usage Guide

## Overview

This guide shows how to use the tenant-filtered notification system that ensures users can **ONLY** see notifications from their organization (tenant). The system automatically gets the current tenant_id and filters all notification queries accordingly.

## 🔐 Core Principle

**Every notification query is automatically filtered by the current user's tenant_id**

- ✅ Users see ONLY notifications from their organization
- ❌ No cross-tenant data leakage
- 🔍 Automatic tenant detection via email lookup
- 🛡️ Multiple validation layers for security

## 🛠️ Available Tools

### 1. Tenant Notification Filter Utility (`tenantNotificationFilter.js`)

Core utility functions for tenant-based filtering:

```javascript
import { 
  getCurrentTenantId,
  getTenantFilteredNotifications,
  getUserTenantFilteredNotifications,
  getTenantFilteredUnreadCount,
  markTenantNotificationAsRead,
  validateNotificationTenantAccess
} from '../utils/tenantNotificationFilter';
```

### 2. React Hook (`useTenantNotifications.js`)

Easy-to-use React hook for components:

```javascript
import { useTenantNotifications, useAdminTenantNotifications } from '../hooks/useTenantNotifications';
```

### 3. Updated Notification Manager

Enhanced notification manager with tenant validation:

```javascript
import { NotificationUIUtils } from '../utils/notificationManager';
```

## 📱 Usage Examples

### For User-Facing Components

```javascript
import React from 'react';
import { useTenantNotifications } from '../hooks/useTenantNotifications';
import { useAuth } from '../utils/AuthContext';

const UserNotifications = () => {
  const { user } = useAuth();
  const {
    notifications,
    unreadCount,
    loading,
    error,
    tenantInfo,
    markAsRead,
    refresh
  } = useTenantNotifications(user?.id, {
    unreadOnly: false,
    limit: 20,
    autoRefresh: true
  });

  if (loading) return <div>Loading notifications...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Notifications for {tenantInfo?.tenantName}</h2>
      <p>Unread: {unreadCount}</p>
      
      {notifications.map(notification => (
        <div key={notification.id} onClick={() => markAsRead(notification.id)}>
          <h3>{notification.type}</h3>
          <p>{notification.message}</p>
          <small>{notification.created_at}</small>
        </div>
      ))}
      
      <button onClick={refresh}>Refresh</button>
    </div>
  );
};
```

### For Admin Dashboard

```javascript
import React from 'react';
import { useAdminTenantNotifications } from '../hooks/useTenantNotifications';

const AdminNotificationDashboard = () => {
  const {
    notifications,
    loading,
    error,
    tenantInfo,
    totalNotifications,
    pendingNotifications,
    sentNotifications,
    failedNotifications,
    refresh
  } = useAdminTenantNotifications({
    limit: 100,
    autoRefresh: true
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Notification Dashboard - {tenantInfo?.tenantName}</h1>
      
      <div className="stats">
        <div>Total: {totalNotifications}</div>
        <div>Pending: {pendingNotifications}</div>
        <div>Sent: {sentNotifications}</div>
        <div>Failed: {failedNotifications}</div>
      </div>

      <div className="notifications">
        {notifications.map(notification => (
          <div key={notification.id}>
            <h3>{notification.type}</h3>
            <p>{notification.message}</p>
            <span>{notification.delivery_status}</span>
            <small>{notification.created_at}</small>
          </div>
        ))}
      </div>
      
      <button onClick={refresh}>Refresh</button>
    </div>
  );
};
```

### Direct Utility Usage

```javascript
import { 
  getCurrentTenantId,
  getTenantFilteredNotifications,
  validateNotificationTenantAccess 
} from '../utils/tenantNotificationFilter';

// Get current tenant information
const handleGetTenant = async () => {
  const result = await getCurrentTenantId();
  if (result.tenantId) {
    console.log(`Current tenant: ${result.tenantName} (${result.tenantId})`);
  } else {
    console.error('No tenant found:', result.error);
  }
};

// Load notifications with filtering
const handleLoadNotifications = async () => {
  const result = await getTenantFilteredNotifications({
    type: 'GRADE_ENTERED',
    limit: 10
  });
  
  if (result.error) {
    console.error('Error:', result.error);
  } else {
    console.log(`Loaded ${result.data.length} notifications for ${result.tenantName}`);
  }
};

// Validate notification access
const handleValidateAccess = async (notificationId) => {
  const validation = await validateNotificationTenantAccess(notificationId);
  if (validation.isValid) {
    console.log('Access granted to notification');
  } else {
    console.error('Access denied:', validation.error);
  }
};
```

## 🔒 Security Features

### 1. Automatic Tenant Detection

```javascript
// The system automatically gets tenant_id from:
// 1. Email-based tenant lookup (primary method)
// 2. Direct user record lookup (fallback)
// 3. Cached tenant context

const tenantResult = await getCurrentTenantId();
// Returns: { tenantId, tenantName, userRecord, error }
```

### 2. Query-Level Filtering

Every notification query includes tenant filtering:

```javascript
// All queries automatically include:
.eq('tenant_id', currentTenantId)

// Double filtering for recipient queries:
.eq('tenant_id', tenantId)
.eq('notifications.tenant_id', tenantId)
```

### 3. Validation Before Operations

```javascript
// Before any notification operation:
const validation = await validateNotificationTenantAccess(notificationId);
if (!validation.isValid) {
  throw new Error('Access denied');
}
```

### 4. Error Handling

```javascript
// Comprehensive error handling for:
// - No tenant context
// - Invalid tenant access
// - RLS permission issues
// - Database connectivity

if (result.error) {
  if (result.error.includes('tenant')) {
    // Handle tenant-specific errors
  } else if (result.error.includes('permission')) {
    // Handle permission errors
  }
}
```

## 📊 Logging and Monitoring

The system provides comprehensive logging:

```javascript
// Console logs include:
console.log('🔍 [TENANT_FILTER] Getting current tenant ID...');
console.log('✅ [TENANT_FILTER] Found tenant via email: SchoolName (tenant-id)');
console.log('🔒 [TENANT_FILTER] Filtering notifications for tenant: SchoolName');
console.log('✅ [TENANT_FILTER] Successfully loaded 15 notifications');
console.log('⚠️ [TENANT_FILTER] Filtered out notification from wrong tenant');
```

## 🎯 Best Practices

### 1. Always Use Tenant-Aware Functions

```javascript
// ✅ Good - Uses tenant filtering
const notifications = await getTenantFilteredNotifications();

// ❌ Bad - No tenant filtering  
const notifications = await supabase.from('notifications').select('*');
```

### 2. Handle Loading States

```javascript
const { notifications, loading, error } = useTenantNotifications(userId);

if (loading) return <Loading />;
if (error) return <Error message={error} />;
if (!notifications.length) return <NoNotifications />;
```

### 3. Validate Before Sensitive Operations

```javascript
// Before deleting/updating notifications
const validation = await validateNotificationTenantAccess(notificationId);
if (!validation.isValid) {
  Alert.alert('Access Denied', 'You can only modify notifications from your organization.');
  return;
}
```

### 4. Use Appropriate Hooks

```javascript
// For user-facing components
const userNotifications = useTenantNotifications(userId);

// For admin dashboard  
const adminNotifications = useAdminTenantNotifications();
```

## 🔧 Configuration

### Hook Options

```javascript
const options = {
  autoRefresh: true,           // Auto-refresh notifications
  refreshInterval: 30000,      // Refresh every 30 seconds
  unreadOnly: false,          // Show all or unread only
  limit: 50                   // Maximum notifications to load
};

const notifications = useTenantNotifications(userId, options);
```

### Utility Options

```javascript
const options = {
  type: 'GRADE_ENTERED',      // Filter by notification type
  status: 'Sent',             // Filter by delivery status
  limit: 100                  // Maximum results
};

const result = await getTenantFilteredNotifications(options);
```

## 🚨 Error Scenarios

The system handles these error scenarios gracefully:

1. **No Authentication**: User not logged in
2. **No Tenant Assignment**: User exists but no tenant_id
3. **Invalid Tenant**: Tenant_id exists but tenant is inactive
4. **RLS Permission Issues**: Database security blocking access
5. **Network Errors**: Connection issues

## ✅ Verification

To verify the system is working correctly:

1. **Check Console Logs**: Look for tenant filtering messages
2. **Test Cross-Tenant Access**: Try accessing another tenant's notifications (should fail)
3. **Monitor Query Patterns**: All queries should include `tenant_id` filters
4. **Validate Data Isolation**: Users should only see their organization's data

## 🎉 Benefits Achieved

- **🔒 Complete Data Isolation**: Users see only their tenant's notifications
- **📧 Email-Based Assignment**: Automatic tenant detection via email
- **🚀 High Performance**: Cached tenant validation and optimized queries
- **🛡️ Multiple Security Layers**: Validation at query, component, and hook levels
- **📱 Easy Integration**: Simple hooks for React components
- **🔧 Comprehensive Logging**: Full traceability of tenant operations
- **⚡ Auto-Refresh**: Real-time notification updates with tenant filtering

## 🔄 Migration from Old System

If you have existing notification code, update it as follows:

```javascript
// OLD: Direct database queries
const notifications = await supabase.from('notifications').select('*');

// NEW: Tenant-filtered queries  
const result = await getTenantFilteredNotifications();
const notifications = result.data;

// OLD: Manual tenant checking
const { data } = await supabase.from('notifications')
  .select('*')
  .eq('tenant_id', someTenantId);

// NEW: Automatic tenant detection and filtering
const { notifications } = useTenantNotifications(userId);
```

This system ensures that users can **ONLY** see notifications from their organization, providing complete data isolation and security in a multi-tenant environment.
