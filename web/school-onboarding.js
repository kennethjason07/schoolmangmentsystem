// School Onboarding Form JavaScript with Admin User Creation
class SchoolOnboardingForm {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 4;
        this.form = document.getElementById('schoolOnboardingForm');
        this.submitBtn = document.getElementById('submitBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.prevBtn = document.getElementById('prevBtn');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.successMessage = document.getElementById('successMessage');
        this.formData = {};
        
        this.initializeEventListeners();
        this.initializeValidation();
        this.setupPasswordStrength();
    }

    initializeEventListeners() {
        // Form submission
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Subdomain preview and validation
        const subdomainInput = document.getElementById('subdomain');
        const subdomainPreview = document.getElementById('subdomainPreview');
        
        subdomainInput.addEventListener('input', (e) => {
            const value = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '');
            e.target.value = value;
            subdomainPreview.textContent = value || 'myschool';
            this.validateSubdomain(value);
        });

        // Auto-suggest subdomain from school name
        const schoolNameInput = document.getElementById('schoolName');
        schoolNameInput.addEventListener('input', (e) => {
            if (!subdomainInput.value) {
                const suggested = this.generateSubdomainFromName(e.target.value);
                subdomainInput.value = suggested;
                subdomainPreview.textContent = suggested || 'myschool';
            }
        });

        // Real-time validation for key fields
        this.addRealTimeValidation();
        
        // Password confirmation validation
        document.getElementById('confirmPassword').addEventListener('input', () => {
            this.validatePasswordConfirmation();
        });
    }

    initializeValidation() {
        this.validationRules = {
            schoolName: {
                required: true,
                minLength: 3,
                maxLength: 100
            },
            subdomain: {
                required: true,
                pattern: /^[a-z0-9\-]+$/,
                minLength: 3,
                maxLength: 20
            },
            address: {
                required: true,
                minLength: 10,
                maxLength: 500
            },
            contactPhone: {
                required: true,
                pattern: /^[\+]?[\d\s\-\(\)]{10,15}$/
            },
            contactEmail: {
                required: true,
                pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            },
            adminFullName: {
                required: true,
                minLength: 3,
                maxLength: 100
            },
            adminEmail: {
                required: true,
                pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            },
            adminPassword: {
                required: true,
                minLength: 8
            }
        };
    }

    setupPasswordStrength() {
        const passwordInput = document.getElementById('adminPassword');
        const strengthIndicator = document.getElementById('passwordStrength');
        
        passwordInput.addEventListener('input', (e) => {
            this.checkPasswordStrength(e.target.value, strengthIndicator);
        });
    }

    checkPasswordStrength(password, indicator) {
        if (password.length === 0) {
            indicator.style.display = 'none';
            return;
        }

        let strength = 0;
        const checks = [
            /.{8,}/, // At least 8 characters
            /[a-z]/, // Lowercase
            /[A-Z]/, // Uppercase
            /[0-9]/, // Numbers
            /[^A-Za-z0-9]/ // Special characters
        ];

        checks.forEach(check => {
            if (check.test(password)) strength++;
        });

        indicator.style.display = 'block';
        
        if (strength <= 2) {
            indicator.className = 'password-strength weak';
            indicator.textContent = 'Weak - Use at least 8 characters with uppercase, lowercase, numbers, and symbols';
        } else if (strength <= 3) {
            indicator.className = 'password-strength medium';
            indicator.textContent = 'Medium - Add more character types for better security';
        } else {
            indicator.className = 'password-strength strong';
            indicator.textContent = 'Strong - Your password is secure';
        }
    }

    generateSubdomainFromName(schoolName) {
        return schoolName
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '')
            .substring(0, 15);
    }

    async validateSubdomain(subdomain) {
        const feedback = document.getElementById('subdomainFeedback');
        
        if (subdomain.length < 3) {
            feedback.className = 'validation-feedback invalid';
            feedback.textContent = 'Subdomain must be at least 3 characters';
            return false;
        }

        if (!/^[a-z0-9]+$/.test(subdomain)) {
            feedback.className = 'validation-feedback invalid';
            feedback.textContent = 'Subdomain can only contain lowercase letters and numbers';
            return false;
        }

        try {
            const tenantService = new window.TenantService();
            const isAvailable = await tenantService.checkSubdomainAvailability(subdomain);
            
            if (!isAvailable) {
                feedback.className = 'validation-feedback invalid';
                feedback.textContent = 'This subdomain is already taken';
                return false;
            } else {
                feedback.className = 'validation-feedback valid';
                feedback.textContent = 'Subdomain is available';
                return true;
            }
        } catch (error) {
            console.error('Error checking subdomain:', error);
            feedback.className = 'validation-feedback invalid';
            feedback.textContent = 'Error checking availability';
            return false;
        }
    }

    validatePasswordConfirmation() {
        const password = document.getElementById('adminPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const errorElement = document.getElementById('confirmPasswordError');
        
        if (confirmPassword && password !== confirmPassword) {
            this.showError('confirmPassword', 'Passwords do not match');
            return false;
        } else {
            this.clearError('confirmPassword');
            return true;
        }
    }

    addRealTimeValidation() {
        const fieldsToValidate = [
            'schoolName', 'address', 'contactPhone', 'contactEmail',
            'adminFullName', 'adminEmail', 'adminPassword'
        ];
        
        fieldsToValidate.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('blur', () => this.validateField(field));
                field.addEventListener('input', () => this.clearError(fieldId));
            }
        });
    }

    validateField(field) {
        const fieldName = field.name || field.id;
        const value = (field.value || '').trim();
        const rules = this.validationRules[fieldName];
        
        if (!rules) return true;

        // Clear previous errors
        this.clearError(fieldName);

        // Required validation
        if (rules.required && !value) {
            this.showError(fieldName, 'This field is required');
            return false;
        }

        // Pattern validation
        if (rules.pattern && value && !rules.pattern.test(value)) {
            let errorMessage = 'Invalid format';
            if (fieldName.includes('Email')) {
                errorMessage = 'Please enter a valid email address';
            } else if (fieldName === 'contactPhone') {
                errorMessage = 'Please enter a valid phone number';
            } else if (fieldName === 'subdomain') {
                errorMessage = 'Subdomain can only contain lowercase letters and numbers';
            }
            this.showError(fieldName, errorMessage);
            return false;
        }

        // Length validation
        if (rules.minLength && value.length < rules.minLength) {
            this.showError(fieldName, `Minimum ${rules.minLength} characters required`);
            return false;
        }

        if (rules.maxLength && value.length > rules.maxLength) {
            this.showError(fieldName, `Maximum ${rules.maxLength} characters allowed`);
            return false;
        }

        return true;
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

    validateCurrentStep() {
        const stepFields = {
            1: ['schoolName', 'subdomain', 'address', 'contactPhone', 'contactEmail'],
            2: ['adminFullName', 'adminEmail', 'adminPassword'],
            3: [],
            4: []
        };

        const fieldsToValidate = stepFields[this.currentStep] || [];
        let isValid = true;

        fieldsToValidate.forEach(fieldName => {
            const field = document.getElementById(fieldName);
            if (field && !this.validateField(field)) {
                isValid = false;
            }
        });

        // Additional validation for step 2
        if (this.currentStep === 2) {
            if (!this.validatePasswordConfirmation()) {
                isValid = false;
            }
        }

        return isValid;
    }

    collectFormData() {
        const data = {
            // School information
            schoolInfo: {
                name: document.getElementById('schoolName')?.value || '',
                type: document.getElementById('schoolType')?.value || 'School',
                subdomain: document.getElementById('subdomain')?.value || '',
                address: document.getElementById('address')?.value || '',
                contact_phone: document.getElementById('contactPhone')?.value || '',
                contact_email: document.getElementById('contactEmail')?.value || '',
                established_year: document.getElementById('establishedYear')?.value || null
            },
            // Admin user information
            adminUser: {
                full_name: document.getElementById('adminFullName')?.value || '',
                email: document.getElementById('adminEmail')?.value || '',
                phone: document.getElementById('adminPhone')?.value || null,
                position: document.getElementById('adminPosition')?.value || 'Administrator',
                password: document.getElementById('adminPassword')?.value || ''
            },
            // Settings
            settings: {
                max_students: parseInt(document.getElementById('maxStudents')?.value) || 500,
                max_teachers: parseInt(document.getElementById('maxTeachers')?.value) || 50,
                max_classes: parseInt(document.getElementById('maxClasses')?.value) || 20,
                timezone: document.getElementById('timezone')?.value || 'Asia/Kolkata',
                academic_year_start_month: parseInt(document.getElementById('academicStartMonth')?.value) || 4,
                subscription_plan: document.getElementById('subscriptionPlan')?.value || 'standard',
                features: {
                    fees: document.getElementById('featureFees')?.checked || false,
                    exams: document.getElementById('featureExams')?.checked || false,
                    messaging: document.getElementById('featureMessaging')?.checked || false,
                    attendance: document.getElementById('featureAttendance')?.checked || false
                }
            }
        };

        return data;
    }

    generateSummary(data) {
        const summaryContent = document.getElementById('summaryContent');
        
        summaryContent.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 20px;">
                <div>
                    <h3 style="color: #1976d2; margin-bottom: 15px;">🏫 School Information</h3>
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
                        <p><strong>Name:</strong> ${data.schoolInfo.name}</p>
                        <p><strong>Type:</strong> ${data.schoolInfo.type}</p>
                        <p><strong>Subdomain:</strong> ${data.schoolInfo.subdomain}.schoolms.com</p>
                        <p><strong>Address:</strong> ${data.schoolInfo.address}</p>
                        <p><strong>Phone:</strong> ${data.schoolInfo.contact_phone}</p>
                        <p><strong>Email:</strong> ${data.schoolInfo.contact_email}</p>
                        ${data.schoolInfo.established_year ? `<p><strong>Established:</strong> ${data.schoolInfo.established_year}</p>` : ''}
                    </div>
                </div>
                
                <div>
                    <h3 style="color: #1976d2; margin-bottom: 15px;">👤 Administrator</h3>
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
                        <p><strong>Name:</strong> ${data.adminUser.full_name}</p>
                        <p><strong>Email:</strong> ${data.adminUser.email}</p>
                        <p><strong>Position:</strong> ${data.adminUser.position}</p>
                        ${data.adminUser.phone ? `<p><strong>Phone:</strong> ${data.adminUser.phone}</p>` : ''}
                        <p><strong>Password:</strong> ••••••••</p>
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 30px;">
                <h3 style="color: #1976d2; margin-bottom: 15px;">⚙️ Settings & Features</h3>
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <div>
                            <p><strong>Max Students:</strong> ${data.settings.max_students}</p>
                            <p><strong>Max Teachers:</strong> ${data.settings.max_teachers}</p>
                            <p><strong>Max Classes:</strong> ${data.settings.max_classes}</p>
                            <p><strong>Timezone:</strong> ${data.settings.timezone}</p>
                        </div>
                        <div>
                            <p><strong>Academic Year Start:</strong> Month ${data.settings.academic_year_start_month}</p>
                            <p><strong>Subscription:</strong> ${data.settings.subscription_plan.charAt(0).toUpperCase() + data.settings.subscription_plan.slice(1)}</p>
                            <div style="margin-top: 10px;">
                                <strong>Features:</strong>
                                <ul style="margin: 5px 0 0 20px;">
                                    ${data.settings.features.fees ? '<li>Fee Management</li>' : ''}
                                    ${data.settings.features.exams ? '<li>Exam Management</li>' : ''}
                                    ${data.settings.features.messaging ? '<li>Messaging System</li>' : ''}
                                    ${data.settings.features.attendance ? '<li>Attendance Tracking</li>' : ''}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        // Collect all form data
        const formData = this.collectFormData();
        this.formData = formData;

        // Show loading state
        this.setLoadingState(true, 'Creating your school and admin account...');
        
        try {
            // Create the school and admin user
            const result = await this.createSchoolWithAdmin(formData);
            
            if (result.success) {
                this.showSuccess(result);
            } else {
                this.showFormError(result.error || 'Failed to create school. Please try again.');
            }
        } catch (error) {
            console.error('School creation error:', error);
            this.showFormError('An unexpected error occurred. Please try again.');
        } finally {
            this.setLoadingState(false);
        }
    }

    async createSchoolWithAdmin(data) {
        try {
            const tenantService = new window.TenantService();
            const adminService = new window.AdminUserService();
            
            // Step 1: Check subdomain availability (again)
            const isSubdomainAvailable = await tenantService.checkSubdomainAvailability(data.schoolInfo.subdomain);
            if (!isSubdomainAvailable) {
                return {
                    success: false,
                    error: 'This subdomain is no longer available. Please choose another one.'
                };
            }

            // Step 2: Create the tenant
            this.setLoadingState(true, 'Creating school account...');
            
            const tenantData = {
                name: data.schoolInfo.name,
                subdomain: data.schoolInfo.subdomain,
                contact_email: data.schoolInfo.contact_email,
                contact_phone: data.schoolInfo.contact_phone,
                address: data.schoolInfo.address,
                subscription_plan: data.settings.subscription_plan,
                timezone: data.settings.timezone,
                max_students: data.settings.max_students,
                max_teachers: data.settings.max_teachers,
                max_classes: data.settings.max_classes,
                academic_year_start_month: data.settings.academic_year_start_month,
                features: data.settings.features,
                status: 'active'
            };

            const tenantResult = await tenantService.registerTenant(tenantData);
            
            if (!tenantResult.success) {
                return tenantResult;
            }

            const tenantId = tenantResult.tenantId;

            // Step 3: Create admin user account
            this.setLoadingState(true, 'Creating admin user account...');
            
            const adminUserResult = await adminService.createAdminUser({
                email: data.adminUser.email,
                password: data.adminUser.password,
                full_name: data.adminUser.full_name,
                phone: data.adminUser.phone,
                tenant_id: tenantId
            });

            if (!adminUserResult.success) {
                // If admin creation fails, we should ideally rollback the tenant creation
                // For now, we'll return the error
                return {
                    success: false,
                    error: `School created but admin user creation failed: ${adminUserResult.error}`
                };
            }

            // Step 4: Create school details record
            this.setLoadingState(true, 'Finalizing school setup...');
            
            const schoolDetailsResult = await tenantService.createSchoolDetails({
                tenant_id: tenantId,
                name: data.schoolInfo.name,
                type: data.schoolInfo.type,
                address: data.schoolInfo.address,
                phone: data.schoolInfo.contact_phone,
                email: data.schoolInfo.contact_email,
                established_year: data.schoolInfo.established_year
            });

            return {
                success: true,
                tenant: tenantResult.data,
                adminUser: adminUserResult.data,
                schoolDetails: schoolDetailsResult.data,
                loginUrl: `https://${data.schoolInfo.subdomain}.schoolms.com`,
                adminEmail: data.adminUser.email
            };

        } catch (error) {
            console.error('Error in school creation:', error);
            return {
                success: false,
                error: 'An unexpected error occurred during school creation. Please try again.'
            };
        }
    }

    setLoadingState(loading, text = 'Setting up your school...') {
        this.loadingIndicator.style.display = loading ? 'block' : 'none';
        this.form.style.display = loading ? 'none' : 'block';
        
        const loadingText = document.getElementById('loadingText');
        if (loadingText) {
            loadingText.textContent = text;
        }
    }

    showSuccess(result) {
        this.successMessage.style.display = 'block';
        this.form.style.display = 'none';
        this.loadingIndicator.style.display = 'none';
        
        // Update success message with actual details
        const loginUrlElement = document.getElementById('loginUrl');
        const adminEmailElement = document.getElementById('adminEmail');
        
        if (loginUrlElement) {
            loginUrlElement.textContent = result.loginUrl;
        }
        if (adminEmailElement) {
            adminEmailElement.textContent = result.adminEmail;
        }
        
        // Scroll to success message
        this.successMessage.scrollIntoView({ behavior: 'smooth' });
    }

    showFormError(message) {
        alert(`Error: ${message}`); // In production, use a better error display
        console.error('Form error:', message);
    }
}

// Enhanced TenantService with school details creation
class EnhancedTenantService extends window.TenantService {
    async createSchoolDetails(schoolData) {
        try {
            const { data, error } = await this.client
                .from('school_details')
                .insert([{
                    tenant_id: schoolData.tenant_id,
                    name: schoolData.name,
                    type: schoolData.type || 'School',
                    address: schoolData.address,
                    phone: schoolData.phone,
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

// Admin User Service for creating admin accounts
class AdminUserService {
    constructor() {
        this.client = getSupabaseClient();
    }

    async createAdminUser(userData) {
        try {
            // Step 1: Create auth user
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

            // Step 2: Create admin role for this tenant if it doesn't exist
            const roleResult = await this.ensureAdminRole(userData.tenant_id);
            if (!roleResult.success) {
                return roleResult;
            }

            // Step 3: Create user record with admin role
            const { data: userRecord, error: userError } = await this.client
                .from('users')
                .insert([{
                    id: authData.user.id,
                    email: userData.email,
                    full_name: userData.full_name,
                    phone: userData.phone,
                    tenant_id: userData.tenant_id,
                    role_id: roleResult.roleId,
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
                data: {
                    authUser: authData.user,
                    userRecord: userRecord
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

// Step navigation functions
function changeStep(direction) {
    const form = window.onboardingForm;
    
    if (direction === 1) {
        // Moving forward - validate current step
        if (!form.validateCurrentStep()) {
            return; // Don't proceed if validation fails
        }
    }

    const newStep = form.currentStep + direction;
    
    if (newStep >= 1 && newStep <= form.totalSteps) {
        // Hide current step
        document.getElementById(`step${form.currentStep}`).classList.remove('active');
        document.getElementById(`step${form.currentStep}Indicator`).classList.remove('active');
        if (direction === 1) {
            document.getElementById(`step${form.currentStep}Indicator`).classList.add('completed');
        }
        
        // Show new step
        form.currentStep = newStep;
        document.getElementById(`step${form.currentStep}`).classList.add('active');
        document.getElementById(`step${form.currentStep}Indicator`).classList.add('active');
        
        // Update navigation buttons
        updateNavigationButtons();
        
        // If moving to step 4, generate summary
        if (form.currentStep === 4) {
            const formData = form.collectFormData();
            form.generateSummary(formData);
        }
    }
}

function updateNavigationButtons() {
    const form = window.onboardingForm;
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const submitBtn = document.getElementById('submitBtn');
    
    // Show/hide previous button
    prevBtn.style.display = form.currentStep === 1 ? 'none' : 'inline-block';
    
    // Show next or submit button based on current step
    if (form.currentStep === form.totalSteps) {
        nextBtn.style.display = 'none';
        submitBtn.style.display = 'inline-block';
    } else {
        nextBtn.style.display = 'inline-block';
        submitBtn.style.display = 'none';
    }
}

// Feature toggle function
function toggleFeature(feature, element) {
    const checkbox = element.querySelector('input[type="checkbox"]');
    checkbox.checked = !checkbox.checked;
    
    if (checkbox.checked) {
        element.classList.add('selected');
    } else {
        element.classList.remove('selected');
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Replace the basic TenantService with enhanced version
    window.TenantService = EnhancedTenantService;
    
    // Create global instances
    window.onboardingForm = new SchoolOnboardingForm();
    window.AdminUserService = AdminUserService;
    
    console.log('School Onboarding Form initialized');
});

// Export for potential use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SchoolOnboardingForm, AdminUserService, EnhancedTenantService };
}
