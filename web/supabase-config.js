// Supabase Configuration for School Registration Form
// This file contains the Supabase client setup for the web registration form

// Supabase credentials (from credentials.txt)
const SUPABASE_URL = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';


// Initialize Supabase client
let supabaseClient = null;

// Initialize Supabase when the script loads
function initializeSupabase() {
    if (typeof window.supabase !== 'undefined') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client initialized successfully');
        return true;
    } else {
        console.error('Supabase library not loaded. Please include the Supabase JS SDK.');
        return false;
    }
}

// Get the Supabase client instance
function getSupabaseClient() {
    if (!supabaseClient) {
        if (!initializeSupabase()) {
            throw new Error('Supabase client not available');
        }
    }
    return supabaseClient;
}


// Database operations for tenant management
class TenantService {
    constructor() {
        this.client = getSupabaseClient();
    }

    // Check if subdomain is available
    async checkSubdomainAvailability(subdomain) {
        try {
            const { data, error } = await this.client
                .from('tenants')
                .select('subdomain')
                .eq('subdomain', subdomain)
                .maybeSingle();

            if (error) {
                console.error('Error checking subdomain:', error);
                return false;
            }

            // If data is null, subdomain is available
            return data === null;
        } catch (error) {
            console.error('Error in subdomain check:', error);
            return false;
        }
    }

    // Fallback method: Direct insert (requires RLS to be disabled)
    async registerTenantFallback(tenantData) {
        try {
            console.log('Using fallback tenant creation method...');
            
            // Prepare data for insertion
            const insertData = {
                name: tenantData.name,
                subdomain: tenantData.subdomain,
                domain: tenantData.domain || null,
                contact_email: tenantData.contact_email,
                contact_phone: tenantData.contact_phone,
                address: tenantData.address,
                subscription_plan: tenantData.subscription_plan,
                timezone: tenantData.timezone,
                max_students: tenantData.max_students,
                max_teachers: tenantData.max_teachers,
                max_classes: tenantData.max_classes,
                academic_year_start_month: tenantData.academic_year_start_month,
                features: tenantData.features,
                logo_url: tenantData.logo_url || null,
                status: 'active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            // Insert the new tenant directly
            const { data, error } = await this.client
                .from('tenants')
                .insert([insertData])
                .select('*')
                .single();

            if (error) {
                if (error.code === '42501') {
                    return {
                        success: false,
                        error: 'Row Level Security is blocking tenant creation. Please run the SQL function setup or temporarily disable RLS.',
                        details: error,
                        setupRequired: true
                    };
                }
                return { 
                    success: false, 
                    error: error.message || 'Failed to register school',
                    details: error
                };
            }

            console.log('Tenant registered successfully with fallback method:', data);
            return { 
                success: true, 
                data,
                tenantId: data.id
            };
            
        } catch (error) {
            console.error('Unexpected error in tenant registration fallback:', error);
            return { 
                success: false, 
                error: 'An unexpected error occurred during registration'
            };
        }
    }

    // Check if subdomain is available
    async checkDomainAvailability(domain) {
        if (!domain) return true; // Domain is optional

        try {
            const { data, error } = await this.client
                .from('tenants')
                .select('domain')
                .eq('domain', domain)
                .maybeSingle();

            if (error) {
                console.error('Error checking domain:', error);
                return false;
            }

            return data === null;
        } catch (error) {
            console.error('Error in domain check:', error);
            return false;
        }
    }

    // Register a new tenant (school)
    async registerTenant(tenantData) {
        try {
            // Try secure stored function first (with RLS enabled)
            const { data, error } = await this.client.rpc('create_tenant_with_admin', {
                tenant_name: tenantData.name,
                subdomain: tenantData.subdomain,
                contact_email: tenantData.contact_email,
                contact_phone: tenantData.contact_phone || '',
                address_text: tenantData.address || '',
                subscription_plan: tenantData.subscription_plan || 'basic',
                timezone_val: tenantData.timezone || 'Asia/Kolkata',
                max_students: tenantData.max_students || 500,
                max_teachers: tenantData.max_teachers || 50,
                max_classes: tenantData.max_classes || 20,
                academic_year_start_month: tenantData.academic_year_start_month || 4,
                features_json: tenantData.features || {
                    fees: true,
                    exams: true, 
                    messaging: true,
                    attendance: true
                },
                admin_email: tenantData.contact_email,
                admin_password: 'temp_password', // Will be replaced by actual user creation
                admin_full_name: 'Administrator'
            });

            if (error) {
                console.error('Error registering tenant:', error);
                
                // If function doesn't exist, try fallback method
                if (error.code === 'PGRST202') {
                    console.warn('Stored function not found, trying fallback method...');
                    return await this.registerTenantFallback(tenantData);
                }
                
                return { 
                    success: false, 
                    error: error.message || 'Failed to register school',
                    details: error
                };
            }

            if (!data || !data.success) {
                console.error('Tenant creation failed:', data);
                return {
                    success: false,
                    error: data?.error || 'Failed to register school',
                    details: data
                };
            }

            console.log('Tenant registered successfully:', data);
            
            // Get the created tenant data
            const { data: tenantRecord, error: fetchError } = await this.client
                .from('tenants')
                .select('*')
                .eq('id', data.tenant_id)
                .single();

            if (fetchError) {
                console.warn('Could not fetch tenant record:', fetchError);
            }

            return { 
                success: true, 
                data: tenantRecord || { id: data.tenant_id },
                tenantId: data.tenant_id,
                roleId: data.role_id
            };
        } catch (error) {
            console.error('Unexpected error in tenant registration:', error);
            return { 
                success: false, 
                error: 'An unexpected error occurred during registration'
            };
        }
    }

    // Get tenant by subdomain
    async getTenantBySubdomain(subdomain) {
        try {
            const { data, error } = await this.client
                .from('tenants')
                .select('*')
                .eq('subdomain', subdomain)
                .single();

            if (error) {
                console.error('Error fetching tenant:', error);
                return { success: false, error };
            }

            return { success: true, data };
        } catch (error) {
            console.error('Error in getTenantBySubdomain:', error);
            return { success: false, error };
        }
    }

    // Update tenant information
    async updateTenant(tenantId, updates) {
        try {
            const updateData = {
                ...updates,
                updated_at: new Date().toISOString()
            };

            const { data, error } = await this.client
                .from('tenants')
                .update(updateData)
                .eq('id', tenantId)
                .select('*')
                .single();

            if (error) {
                console.error('Error updating tenant:', error);
                return { success: false, error };
            }

            return { success: true, data };
        } catch (error) {
            console.error('Error in updateTenant:', error);
            return { success: false, error };
        }
    }
}

// Create global instance
window.TenantService = TenantService;

// Initialize Supabase when this script loads
document.addEventListener('DOMContentLoaded', () => {
    initializeSupabase();
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TenantService, initializeSupabase, getSupabaseClient };
}
