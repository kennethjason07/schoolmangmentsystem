// School Registration Form JavaScript
class SchoolRegistrationForm {
    constructor() {
        this.form = document.getElementById('schoolRegistrationForm');
        this.submitBtn = document.getElementById('submitBtn');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.successMessage = document.getElementById('successMessage');
        
        this.initializeEventListeners();
        this.initializeValidation();
    }

    initializeEventListeners() {
        // Form submission
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Subdomain preview
        const subdomainInput = document.getElementById('subdomain');
        const subdomainPreview = document.getElementById('subdomainPreview');
        
        subdomainInput.addEventListener('input', (e) => {
            const value = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '');
            e.target.value = value;
            subdomainPreview.textContent = value || 'yourschool';
        });

        // Real-time validation
        this.addRealTimeValidation();
    }

    initializeValidation() {
        // Set up validation rules
        this.validationRules = {
            name: {
                required: true,
                minLength: 3,
                maxLength: 100
            },
            subdomain: {
                required: true,
                pattern: /^[a-z0-9]+$/,
                minLength: 3,
                maxLength: 20
            },
            contact_email: {
                required: true,
                pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            },
            contact_phone: {
                required: true,
                pattern: /^[\+]?[\d\s\-\(\)]{10,15}$/
            },
            address: {
                required: true,
                minLength: 10,
                maxLength: 500
            },
            subscription_plan: {
                required: true
            },
            timezone: {
                required: true
            }
        };
    }

    addRealTimeValidation() {
        // Add real-time validation for key fields
        const fieldsToValidate = ['schoolName', 'subdomain', 'contactEmail', 'contactPhone', 'address'];
        
        fieldsToValidate.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('blur', () => this.validateField(field));
                field.addEventListener('input', () => this.clearError(field));
            }
        });
    }

    validateField(field) {
        const fieldName = field.name;
        const value = field.value.trim();
        const rules = this.validationRules[fieldName];
        
        if (!rules) return true;

        // Clear previous errors
        this.clearError(field);

        // Required validation
        if (rules.required && !value) {
            this.showError(field, 'This field is required');
            return false;
        }

        // Pattern validation
        if (rules.pattern && value && !rules.pattern.test(value)) {
            let errorMessage = 'Invalid format';
            if (fieldName === 'contact_email') {
                errorMessage = 'Please enter a valid email address';
            } else if (fieldName === 'contact_phone') {
                errorMessage = 'Please enter a valid phone number';
            } else if (fieldName === 'subdomain') {
                errorMessage = 'Subdomain can only contain lowercase letters and numbers';
            }
            this.showError(field, errorMessage);
            return false;
        }

        // Length validation
        if (rules.minLength && value.length < rules.minLength) {
            this.showError(field, `Minimum ${rules.minLength} characters required`);
            return false;
        }

        if (rules.maxLength && value.length > rules.maxLength) {
            this.showError(field, `Maximum ${rules.maxLength} characters allowed`);
            return false;
        }

        return true;
    }

    showError(field, message) {
        const errorElement = document.getElementById(field.id + 'Error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
        field.style.borderColor = '#e74c3c';
    }

    clearError(field) {
        const errorElement = document.getElementById(field.id + 'Error');
        if (errorElement) {
            errorElement.style.display = 'none';
        }
        field.style.borderColor = '#ddd';
    }

    validateForm() {
        let isValid = true;
        
        // Validate all fields with validation rules
        Object.keys(this.validationRules).forEach(fieldName => {
            const field = document.querySelector(`[name="${fieldName}"]`);
            if (field && !this.validateField(field)) {
                isValid = false;
            }
        });

        return isValid;
    }

    collectFormData() {
        const formData = new FormData(this.form);
        const data = {};

        // Collect basic form data
        for (let [key, value] of formData.entries()) {
            if (key.includes('.')) {
                // Handle nested objects (like features.fees)
                const [parent, child] = key.split('.');
                if (!data[parent]) data[parent] = {};
                data[parent][child] = true; // Checkboxes are only included if checked
            } else {
                data[key] = value;
            }
        }

        // Handle features object - ensure all features are included
        data.features = {
            fees: document.getElementById('featureFees').checked,
            exams: document.getElementById('featureExams').checked,
            messaging: document.getElementById('featureMessaging').checked,
            attendance: document.getElementById('featureAttendance').checked
        };

        // Convert numeric fields
        if (data.max_students) data.max_students = parseInt(data.max_students);
        if (data.max_teachers) data.max_teachers = parseInt(data.max_teachers);
        if (data.max_classes) data.max_classes = parseInt(data.max_classes);
        if (data.academic_year_start_month) data.academic_year_start_month = parseInt(data.academic_year_start_month);

        // Set default status
        data.status = 'active';

        // Add timestamps
        data.created_at = new Date().toISOString();
        data.updated_at = new Date().toISOString();

        return data;
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        // Validate form
        if (!this.validateForm()) {
            this.showFormError('Please fix the errors above');
            return;
        }

        // Show loading state
        this.setLoadingState(true);
        
        try {
            // Collect form data
            const schoolData = this.collectFormData();
            
            // Simulate API call (replace with actual endpoint)
            const result = await this.submitSchoolRegistration(schoolData);
            
            if (result.success) {
                this.showSuccess();
                this.form.reset();
            } else {
                this.showFormError(result.error || 'Registration failed. Please try again.');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showFormError('An unexpected error occurred. Please try again.');
        } finally {
            this.setLoadingState(false);
        }
    }

    async submitSchoolRegistration(schoolData) {
        try {
            console.log('School Registration Data:', schoolData);
            
            // Use the TenantService from supabase-config.js
            const tenantService = new window.TenantService();
            
            // First check if subdomain is available
            const isSubdomainAvailable = await tenantService.checkSubdomainAvailability(schoolData.subdomain);
            if (!isSubdomainAvailable) {
                return { 
                    success: false, 
                    error: 'This subdomain is already taken. Please choose another one.'
                };
            }
            
            // If domain is provided, check its availability
            if (schoolData.domain) {
                const isDomainAvailable = await tenantService.checkDomainAvailability(schoolData.domain);
                if (!isDomainAvailable) {
                    return {
                        success: false,
                        error: 'This domain is already registered. Please use another domain.'
                    };
                }
            }
            
            // Register the tenant
            return await tenantService.registerTenant(schoolData);
        } catch (error) {
            console.error('Error in tenant registration:', error);
            return { 
                success: false, 
                error: 'An unexpected error occurred during registration. Please try again.'
            };
        }
    }

    setLoadingState(loading) {
        this.submitBtn.disabled = loading;
        this.loadingIndicator.style.display = loading ? 'block' : 'none';
        this.submitBtn.textContent = loading ? 'Registering...' : 'Register School';
    }

    showSuccess() {
        this.successMessage.style.display = 'block';
        this.form.style.display = 'none';
        
        // Scroll to success message
        this.successMessage.scrollIntoView({ behavior: 'smooth' });
    }

    showFormError(message) {
        alert(message); // In a real app, use a better error display method
    }

    // Utility methods
    static generateSubdomainFromName(schoolName) {
        return schoolName
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '')
            .substring(0, 20);
    }

    static async validateSubdomainAvailability(subdomain) {
        try {
            // Use the TenantService from supabase-config.js
            const tenantService = new window.TenantService();
            return await tenantService.checkSubdomainAvailability(subdomain);
        } catch (error) {
            console.error('Error checking subdomain availability:', error);
            return false;
        }
    }
}

// Enhanced subdomain validation with availability check
class SubdomainValidator {
    constructor(subdomainInput, errorElement) {
        this.input = subdomainInput;
        this.errorElement = errorElement;
        this.timeoutId = null;
        
        this.input.addEventListener('input', () => this.handleInput());
    }

    handleInput() {
        clearTimeout(this.timeoutId);
        this.timeoutId = setTimeout(() => this.checkAvailability(), 500);
    }

    async checkAvailability() {
        const subdomain = this.input.value.trim();
        
        if (subdomain.length < 3) {
            this.showError('Subdomain must be at least 3 characters');
            return;
        }

        if (!/^[a-z0-9]+$/.test(subdomain)) {
            this.showError('Subdomain can only contain lowercase letters and numbers');
            return;
        }

        try {
            const isAvailable = await SchoolRegistrationForm.validateSubdomainAvailability(subdomain);
            
            if (!isAvailable) {
                this.showError('This subdomain is already taken');
            } else {
                this.showSuccess();
            }
        } catch (error) {
            console.error('Error checking subdomain availability:', error);
        }
    }

    showError(message) {
        this.errorElement.textContent = message;
        this.errorElement.style.display = 'block';
        this.input.style.borderColor = '#e74c3c';
    }

    showSuccess() {
        this.errorElement.style.display = 'none';
        this.input.style.borderColor = '#27ae60';
    }
}

// Auto-suggest subdomain based on school name
function setupSubdomainAutoSuggest() {
    const schoolNameInput = document.getElementById('schoolName');
    const subdomainInput = document.getElementById('subdomain');
    
    schoolNameInput.addEventListener('input', (e) => {
        if (!subdomainInput.value) {
            const suggestedSubdomain = SchoolRegistrationForm.generateSubdomainFromName(e.target.value);
            subdomainInput.value = suggestedSubdomain;
            
            // Trigger subdomain preview update
            const event = new Event('input', { bubbles: true });
            subdomainInput.dispatchEvent(event);
        }
    });
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize main form handler
    const registrationForm = new SchoolRegistrationForm();
    
    // Initialize subdomain validator
    const subdomainInput = document.getElementById('subdomain');
    const subdomainError = document.getElementById('subdomainError');
    const subdomainValidator = new SubdomainValidator(subdomainInput, subdomainError);
    
    // Initialize auto-suggest
    setupSubdomainAutoSuggest();
    
    console.log('School Registration Form initialized');
});

// Export for potential use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SchoolRegistrationForm;
}
