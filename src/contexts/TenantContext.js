import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TenantContext = createContext({});

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};

export const TenantProvider = ({ children }) => {
  const [currentTenant, setCurrentTenant] = useState(null);
  const [availableTenants, setAvailableTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load tenant data from storage on app start
  useEffect(() => {
    loadTenantFromStorage();
  }, []);

  // Load tenant information from AsyncStorage
  const loadTenantFromStorage = async () => {
    try {
      setLoading(true);
      const storedTenantId = await AsyncStorage.getItem('currentTenantId');
      
      if (storedTenantId) {
        await loadTenantById(storedTenantId);
      } else {
        // Try to get default tenant for existing users
        await loadDefaultTenant();
      }
    } catch (error) {
      console.error('Error loading tenant from storage:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Load tenant by ID
  const loadTenantById = async (tenantId) => {
    try {
      const { data: tenant, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .eq('status', 'active')
        .single();

      if (error) throw error;

      if (tenant) {
        setCurrentTenant(tenant);
        await AsyncStorage.setItem('currentTenantId', tenant.id);
        
        // Update Supabase client with tenant context
        await updateSupabaseContext(tenant.id);
      }
    } catch (error) {
      console.error('Error loading tenant by ID:', error);
      throw error;
    }
  };

  // Load default tenant (for existing installations)
  const loadDefaultTenant = async () => {
    try {
      const { data: tenant, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('subdomain', 'default')
        .eq('status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (tenant) {
        setCurrentTenant(tenant);
        await AsyncStorage.setItem('currentTenantId', tenant.id);
        await updateSupabaseContext(tenant.id);
      }
    } catch (error) {
      console.error('Error loading default tenant:', error);
      // Don't throw error for default tenant not found
    }
  };

  // Update Supabase context with tenant ID
  const updateSupabaseContext = async (tenantId) => {
    try {
      console.log('🏢 Setting tenant context for:', tenantId);
      
      if (session) {  
        // Update JWT claims with tenant_id (this would typically be done server-side)
        // For now, we'll use a configuration setting
        try {
          await supabase.rpc('set_config', {
            setting_name: 'app.current_tenant_id',
            setting_value: tenantId
          });
        } catch (rpcError) {
          // If the RPC doesn't exist, that's okay for now
          console.log('set_config RPC not available, using client-side tenant context');
        }
      }
    } catch (error) {
      console.error('Error updating Supabase context:', error);
      // Don't throw the error to prevent breaking the app
    }
  };

  // Switch to a different tenant
  const switchTenant = async (tenantId) => {
    try {
      setLoading(true);
      setError(null);
      
      await loadTenantById(tenantId);
      
      // Refresh available tenants list
      await loadAvailableTenants();
      
    } catch (error) {
      console.error('Error switching tenant:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Load available tenants for current user
  const loadAvailableTenants = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Get user's tenant access
      const { data: userRecord, error: userError } = await supabase
        .from('users')
        .select('tenant_id, roles(role_name)')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      let tenantQuery = supabase
        .from('tenants')
        .select('*')
        .eq('status', 'active');

      // If user is not super_admin, limit to their tenant
      if (userRecord?.roles?.role_name !== 'super_admin') {
        tenantQuery = tenantQuery.eq('id', userRecord.tenant_id);
      }

      const { data: tenants, error: tenantsError } = await tenantQuery;
      
      if (tenantsError) throw tenantsError;

      setAvailableTenants(tenants || []);
    } catch (error) {
      console.error('Error loading available tenants:', error);
    }
  };

  // Create new tenant (super admin only)
  const createTenant = async (tenantData) => {
    try {
      setLoading(true);
      setError(null);

      // Validate required fields
      if (!tenantData.name || !tenantData.subdomain) {
        throw new Error('Tenant name and subdomain are required');
      }

      // Check if subdomain is already taken
      const { data: existingTenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('subdomain', tenantData.subdomain.toLowerCase())
        .single();

      if (existingTenant) {
        throw new Error('Subdomain already exists');
      }

      // Create tenant using the database function
      const { data: newTenantId, error: createError } = await supabase
        .rpc('create_tenant', {
          tenant_name: tenantData.name,
          tenant_subdomain: tenantData.subdomain.toLowerCase(),
          contact_email: tenantData.contact_email || null,
          contact_phone: tenantData.contact_phone || null
        });

      if (createError) throw createError;

      // Load the newly created tenant
      await loadTenantById(newTenantId);
      await loadAvailableTenants();

      return newTenantId;
    } catch (error) {
      console.error('Error creating tenant:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Update current tenant
  const updateTenant = async (updates) => {
    try {
      if (!currentTenant) throw new Error('No current tenant selected');

      setLoading(true);
      setError(null);

      const { data: updatedTenant, error } = await supabase
        .from('tenants')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentTenant.id)
        .select()
        .single();

      if (error) throw error;

      setCurrentTenant(updatedTenant);
      return updatedTenant;
    } catch (error) {
      console.error('Error updating tenant:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Get tenant features/permissions
  const getTenantFeatures = () => {
    if (!currentTenant?.features) return {};
    return currentTenant.features;
  };

  // Check if tenant has specific feature
  const hasFeature = (featureName) => {
    const features = getTenantFeatures();
    return features[featureName] === true;
  };

  // Get tenant limits
  const getTenantLimits = () => {
    if (!currentTenant) return {};
    return {
      maxStudents: currentTenant.max_students || 500,
      maxTeachers: currentTenant.max_teachers || 50,
      maxClasses: currentTenant.max_classes || 20,
    };
  };

  // Check if tenant can add more of a resource type
  const canAddMore = async (resourceType) => {
    if (!currentTenant) return false;

    const limits = getTenantLimits();
    
    try {
      let currentCount = 0;
      
      switch (resourceType) {
        case 'students':
          const { count: studentCount } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', currentTenant.id);
          currentCount = studentCount || 0;
          return currentCount < limits.maxStudents;
          
        case 'teachers':
          const { count: teacherCount } = await supabase
            .from('teachers')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', currentTenant.id);
          currentCount = teacherCount || 0;
          return currentCount < limits.maxTeachers;
          
        case 'classes':
          const { count: classCount } = await supabase
            .from('classes')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', currentTenant.id);
          currentCount = classCount || 0;
          return currentCount < limits.maxClasses;
          
        default:
          return true;
      }
    } catch (error) {
      console.error('Error checking resource limits:', error);
      return false;
    }
  };

  // Clear tenant data (on logout)
  const clearTenant = async () => {
    try {
      await AsyncStorage.removeItem('currentTenantId');
      setCurrentTenant(null);
      setAvailableTenants([]);
      setError(null);
    } catch (error) {
      console.error('Error clearing tenant data:', error);
    }
  };

  // Get tenant settings with defaults
  const getTenantSettings = () => {
    if (!currentTenant?.settings) return {};
    return {
      timezone: currentTenant.timezone || 'UTC',
      academicYearStartMonth: currentTenant.academic_year_start_month || 4,
      ...currentTenant.settings
    };
  };

  const value = {
    // Current tenant state
    currentTenant,
    availableTenants,
    loading,
    error,
    
    // Tenant management
    switchTenant,
    createTenant,
    updateTenant,
    loadAvailableTenants,
    clearTenant,
    
    // Feature checks
    getTenantFeatures,
    hasFeature,
    getTenantLimits,
    canAddMore,
    getTenantSettings,
    
    // Helper methods
    isMultiTenant: availableTenants.length > 1,
    tenantId: currentTenant?.id || null,
    tenantName: currentTenant?.name || 'Unknown School',
    tenantSubdomain: currentTenant?.subdomain || null,
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
};

export default TenantContext;
