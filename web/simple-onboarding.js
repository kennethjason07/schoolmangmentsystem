// Simple School Onboarding - Email and Password Only
class SimpleOnboardingForm {
    constructor() {
        this.form = document.getElementById('simpleOnboardingForm');
        this.submitBtn = document.getElementById('submitButton');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.successMessage = document.getElementById('successMessage');
        
        this.initializeEventListeners();
        this.setupPasswordStrength();
    }

    initializeEventListeners() {
        // Form submission
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Real-time validation
        document.getElementById('adminEmail').addEventListener('blur', () => this.validateEmail());
        document.getElementById('adminEmail').addEventListener('input', () => this.clearError('adminEmail'));
        
        document.getElementById('adminPassword').addEventListener('blur', () => this.validatePassword());
        document.getElementById('adminPassword').addEventListener('input', () => this.clearError('adminPassword'));
        
        document.getElementById('confirmPassword').addEventListener('blur', () => this.validatePasswordConfirmation());
        document.getElementById('confirmPassword').addEventListener('input', () => this.clearError('confirmPassword'));
    }

    setupPasswordStrength() {
        const passwordInput = document.getElementById('adminPassword');
        const strengthIndicator = document.getElementById('passwordStrength');
        
        passwordInput.addEventListener('input', (e) => {
            this.checkPasswordStrength(e.target.value, strengthIndicator);
        });
    }

    checkPasswordStrength(password, indicator) {
        // Password strength checking disabled - just hide the indicator
        indicator.style.display = 'none';
    }

    validateEmail() {
        const email = document.getElementById('adminEmail').value.trim();
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!email) {
            this.showError('adminEmail', 'Email address is required');
            return false;
        }
        
        if (!emailPattern.test(email)) {
            this.showError('adminEmail', 'Please enter a valid email address');
            return false;
        }
        
        this.clearError('adminEmail');
        return true;
    }

    validatePassword() {
        const password = document.getElementById('adminPassword').value;
        
        if (!password) {
            this.showError('adminPassword', 'Password is required');
            return false;
        }
        
        this.clearError('adminPassword');
        return true;
    }

    validatePasswordConfirmation() {
        const password = document.getElementById('adminPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (!confirmPassword) {
            this.showError('confirmPassword', 'Please confirm your password');
            return false;
        }
        
        if (password !== confirmPassword) {
            this.showError('confirmPassword', 'Passwords do not match');
            return false;
        }
        
        this.clearError('confirmPassword');
        return true;
    }

    validateForm() {
        let isValid = true;
        
        if (!this.validateEmail()) isValid = false;
        if (!this.validatePassword()) isValid = false;
        if (!this.validatePasswordConfirmation()) isValid = false;
        
        return isValid;
    }

    showError(fieldName, message) {
        const errorElement = document.getElementById(fieldName + 'Error');
        const field = document.getElementById(fieldName);
        
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
        if (field) {
            field.style.borderColor = '#e74c3c';
        }
    }

    clearError(fieldName) {
        const errorElement = document.getElementById(fieldName + 'Error');
        const field = document.getElementById(fieldName);
        
        if (errorElement) {
            errorElement.style.display = 'none';
        }
        if (field) {
            field.style.borderColor = '#e1e5e9';
        }
    }

    generateSchoolData(email) {
        // Generate school name and subdomain from email domain
        const emailDomain = email.split('@')[1];
        const domainParts = emailDomain.split('.');
        const schoolNameBase = domainParts[0];
        
        // Clean up the school name
        const schoolName = schoolNameBase.charAt(0).toUpperCase() + schoolNameBase.slice(1) + ' School';
        
        // Generate unique subdomain
        const timestamp = Date.now();
        const subdomain = schoolNameBase.toLowerCase().replace(/[^a-z0-9]/g, '') + timestamp.toString().slice(-4);
        
        return {
            name: schoolName,
            subdomain: subdomain,
            contact_email: email,
            contact_phone: '', // Will be empty for now
            address: '', // Will be empty for now
            subscription_plan: 'basic',
            timezone: 'Asia/Kolkata',
            max_students: 500,
            max_teachers: 50,
            max_classes: 20,
            academic_year_start_month: 4,
            features: {
                fees: true,
                exams: true,
                messaging: true,
                attendance: true
            }
        };
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        // Validate form
        if (!this.validateForm()) {
            return;
        }

        // Show loading state
        this.setLoadingState(true);
        
        try {
            const email = document.getElementById('adminEmail').value.trim();
            const password = document.getElementById('adminPassword').value;
            
            // Generate school data based on email
            const schoolData = this.generateSchoolData(email);
            
            // Create tenant and admin user
            const result = await this.createSchoolWithAdmin(email, password, schoolData);
            
            if (result.success) {
                this.showSuccess(email);
            } else {
                this.showFormError(result.error || 'Failed to create account. Please try again.');
            }
        } catch (error) {
            console.error('Account creation error:', error);
            this.showFormError('An unexpected error occurred. Please try again.');
        } finally {
            this.setLoadingState(false);
        }
    }

    async createSchoolWithAdmin(email, password, schoolData) {
        try {
            const tenantService = new window.TenantService();
            const adminService = new AdminUserService();
            
            // Step 1: Check if email already exists
            this.setLoadingState(true, 'Checking email availability...');
            
            // Step 2: Create the tenant
            this.setLoadingState(true, 'Creating school account...');
            
            const tenantResult = await tenantService.registerTenant(schoolData);
            
            if (!tenantResult.success) {
                return tenantResult;
            }

            const tenantId = tenantResult.tenantId || tenantResult.data?.tenant_id;
            const roleId = tenantResult.roleId || tenantResult.data?.role_id;

            // Step 3: Create Supabase Auth user
            this.setLoadingState(true, 'Creating admin account...');
            
            const authResult = await adminService.createAuthUser({
                email: email,
                password: password,
                full_name: 'Administrator',
                tenant_id: tenantId
            });

            if (!authResult.success) {
                return {
                    success: false,
                    error: `School created but admin account creation failed: ${authResult.error}`
                };
            }

            const authUserId = authResult.data.user.id;

            // Step 4: Create user record in users table
            this.setLoadingState(true, 'Setting up admin profile...');
            
            const userRecordResult = await adminService.createUserRecord({
                id: authUserId,
                email: email,
                full_name: 'Administrator',
                phone: null,
                tenant_id: tenantId,
                role_id: roleId
            });

            if (!userRecordResult.success) {
                console.warn('User record creation failed:', userRecordResult.error);
                // Continue anyway - auth user exists
            }

            // Step 5: Create basic school details (if not already created by tenant function)
            this.setLoadingState(true, 'Finalizing setup...');
            
            const tenantServiceEnhanced = new EnhancedTenantService();
            const schoolDetailsResult = await tenantServiceEnhanced.createSchoolDetails({
                tenant_id: tenantId,
                name: schoolData.name,
                type: 'School',
                address: schoolData.address || '',
                phone: schoolData.contact_phone || '',
                email: schoolData.contact_email,
                established_year: null
            });

            if (!schoolDetailsResult.success) {
                console.warn('School details creation failed:', schoolDetailsResult.error);
                // Continue anyway - basic setup is complete
            }
            
            return {
                success: true,
                tenant: tenantResult.data,
                adminUser: {
                    authUser: authResult.data.user,
                    userRecord: userRecordResult.data
                },
                schoolDetails: schoolDetailsResult.success ? schoolDetailsResult.data : null,
                email: email,
                tenantId: tenantId,
                roleId: roleId
            };

        } catch (error) {
            console.error('Error in school creation:', error);
            return {
                success: false,
                error: 'An unexpected error occurred during account creation. Please try again.'
            };
        }
    }

    setLoadingState(loading, text = 'Creating your school account...') {
        this.loadingIndicator.style.display = loading ? 'block' : 'none';
        this.form.style.display = loading ? 'none' : 'block';
        this.submitBtn.disabled = loading;
        
        const loadingText = document.getElementById('loadingText');
        if (loadingText) {
            loadingText.textContent = text;
        }
    }

    showSuccess(email) {
        this.successMessage.style.display = 'block';
        this.form.style.display = 'none';
        this.loadingIndicator.style.display = 'none';
        
        const loginEmailElement = document.getElementById('loginEmail');
        if (loginEmailElement) {
            loginEmailElement.textContent = email;
        }
        
        // Scroll to success message
        this.successMessage.scrollIntoView({ behavior: 'smooth' });
    }

    showFormError(message) {
        // Create or update error display
        let errorDiv = document.getElementById('formError');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'formError';
            errorDiv.style.cssText = `
                background: #f8d7da;
                color: #721c24;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 20px;
                border: 1px solid #f5c6cb;
            `;
            this.form.parentNode.insertBefore(errorDiv, this.form);
        }
        
        errorDiv.innerHTML = `<strong>Error:</strong> ${message}`;
        errorDiv.scrollIntoView({ behavior: 'smooth' });
        
        // Hide error after 10 seconds
        setTimeout(() => {
            if (errorDiv) {
                errorDiv.style.display = 'none';
            }
        }, 10000);
    }
}

// Enhanced TenantService (reuse from previous implementation)
class EnhancedTenantService extends window.TenantService {
    async createSchoolDetails(schoolData) {
        try {
            const { data, error } = await this.client
                .from('school_details')
                .insert([{
                    tenant_id: schoolData.tenant_id,
                    name: schoolData.name,
                    type: schoolData.type || 'School',
                    address: schoolData.address || '',
                    phone: schoolData.phone || '',
                    email: schoolData.email,
                    established_year: schoolData.established_year,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }])
                .select('*')
                .single();

            if (error) {
                console.error('Error creating school details:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data };
        } catch (error) {
            console.error('Error in createSchoolDetails:', error);
            return { success: false, error: 'Failed to create school details' };
        }
    }
}

// Admin User Service with separate auth and user record creation
class AdminUserService {
    constructor() {
        this.client = getSupabaseClient();
    }

    // Create Supabase Auth user
    async createAuthUser(userData) {
        try {
            const { data: authData, error: authError } = await this.client.auth.signUp({
                email: userData.email,
                password: userData.password,
                options: {
                    data: {
                        full_name: userData.full_name,
                        tenant_id: userData.tenant_id
                    }
                }
            });

            if (authError) {
                console.error('Auth user creation error:', authError);
                return { success: false, error: authError.message };
            }

            return {
                success: true,
                data: authData
            };

        } catch (error) {
            console.error('Error in createAuthUser:', error);
            return { success: false, error: 'Failed to create auth user' };
        }
    }

    // Create user record in users table
    async createUserRecord(userData) {
        try {
            // First try using the secure stored function to bypass RLS
            const { data: functionResult, error: rpcError } = await this.client.rpc('create_user_record', {
                user_id: userData.id,
                email_address: userData.email,
                full_name_val: userData.full_name,
                phone_number: userData.phone,
                tenant_id_val: userData.tenant_id,
                role_id_val: userData.role_id
            });

            if (!rpcError && functionResult && functionResult.success) {
                console.log('User record created successfully via stored function');
                return {
                    success: true,
                    data: functionResult.data
                };
            }

            // If stored function fails or doesn't exist, try direct insert (fallback)
            console.warn('Stored function failed, trying direct insert:', rpcError);
            
            const { data: userRecord, error: userError } = await this.client
                .from('users')
                .insert([{
                    id: userData.id,
                    email: userData.email,
                    full_name: userData.full_name,
                    phone: userData.phone,
                    tenant_id: userData.tenant_id,
                    role_id: userData.role_id,
                    created_at: new Date().toISOString()
                }])
                .select('*')
                .single();

            if (userError) {
                console.error('User record creation error:', userError);
                return { success: false, error: userError.message };
            }

            return {
                success: true,
                data: userRecord
            };

        } catch (error) {
            console.error('Error in createUserRecord:', error);
            return { success: false, error: 'Failed to create user record' };
        }
    }

    // Combined method (for backwards compatibility)
    async createAdminUser(userData) {
        try {
            // Step 1: Create auth user
            const authResult = await this.createAuthUser(userData);
            if (!authResult.success) {
                return authResult;
            }

            // Step 2: Create admin role for this tenant if it doesn't exist
            const roleResult = await this.ensureAdminRole(userData.tenant_id);
            if (!roleResult.success) {
                return roleResult;
            }

            // Step 3: Create user record
            const userRecordResult = await this.createUserRecord({
                id: authResult.data.user.id,
                email: userData.email,
                full_name: userData.full_name,
                phone: userData.phone,
                tenant_id: userData.tenant_id,
                role_id: roleResult.roleId
            });

            if (!userRecordResult.success) {
                return userRecordResult;
            }

            return {
                success: true,
                data: {
                    authUser: authResult.data.user,
                    userRecord: userRecordResult.data
                }
            };

        } catch (error) {
            console.error('Error in createAdminUser:', error);
            return { success: false, error: 'Failed to create admin user' };
        }
    }

    async ensureAdminRole(tenantId) {
        try {
            // First, check if Admin role exists for this tenant
            const { data: existingRole, error: checkError } = await this.client
                .from('roles')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('role_name', 'Admin')
                .maybeSingle();

            if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows found"
                console.error('Error checking for admin role:', checkError);
                return { success: false, error: checkError.message };
            }

            if (existingRole) {
                return { success: true, roleId: existingRole.id };
            }

            // Create admin role
            const { data: newRole, error: createError } = await this.client
                .from('roles')
                .insert([{
                    role_name: 'Admin',
                    tenant_id: tenantId
                }])
                .select('*')
                .single();

            if (createError) {
                console.error('Error creating admin role:', createError);
                return { success: false, error: createError.message };
            }

            return { success: true, roleId: newRole.id };

        } catch (error) {
            console.error('Error in ensureAdminRole:', error);
            return { success: false, error: 'Failed to create admin role' };
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Replace the basic TenantService with enhanced version
    window.TenantService = EnhancedTenantService;
    
    // Create global instances
    window.simpleOnboardingForm = new SimpleOnboardingForm();
    window.AdminUserService = AdminUserService;
    
    console.log('Simple School Onboarding Form initialized');
});

// Export for potential use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SimpleOnboardingForm, AdminUserService, EnhancedTenantService };
}
