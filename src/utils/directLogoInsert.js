import { supabase } from './supabase';

/**
 * Direct method to insert a logo URL into school_details table
 * Use this as a temporary solution if you have a logo URL ready
 */
export const insertLogoDirectly = async (logoUrl, tenantId) => {
  try {
    console.log('🔧 Direct logo insertion started...');
    console.log('🔧 Logo URL:', logoUrl);
    console.log('🔧 Tenant ID:', tenantId);
    
    // Check if school_details record exists for this tenant
    const { data: existingData, error: checkError } = await supabase
      .from('school_details')
      .select('id')
      .eq('tenant_id', tenantId)
      .single();
      
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Error checking existing data:', checkError);
      throw checkError;
    }
    
    let result;
    if (existingData) {
      // Update existing record
      console.log('📝 Updating existing school_details record...');
      result = await supabase
        .from('school_details')
        .update({ 
          logo_url: logoUrl,
          updated_at: new Date().toISOString()
        })
        .eq('tenant_id', tenantId)
        .select()
        .single();
    } else {
      // Insert new record
      console.log('📝 Creating new school_details record...');
      result = await supabase
        .from('school_details')
        .insert({ 
          name: 'My School',
          type: 'School',
          logo_url: logoUrl,
          tenant_id: tenantId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
    }
    
    if (result.error) {
      console.error('❌ Database operation failed:', result.error);
      throw result.error;
    }
    
    console.log('✅ Logo URL inserted successfully:', result.data);
    return { success: true, data: result.data };
    
  } catch (error) {
    console.error('❌ Direct logo insertion failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Helper function to use with sample logo URLs for testing
 */
export const insertSampleLogo = async (tenantId) => {
  // Sample logo URLs you can use for testing
  const sampleLogos = [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face'
  ];
  
  // Pick a random sample logo
  const randomLogo = sampleLogos[Math.floor(Math.random() * sampleLogos.length)];
  
  console.log('🎲 Using random sample logo:', randomLogo);
  return await insertLogoDirectly(randomLogo, tenantId);
};

/**
 * Helper function to insert logo from a public URL
 */
export const insertLogoFromUrl = async (publicUrl, tenantId) => {
  try {
    // Validate URL
    if (!publicUrl || !publicUrl.startsWith('http')) {
      throw new Error('Invalid URL provided');
    }
    
    // Test if URL is accessible
    const response = await fetch(publicUrl, { method: 'HEAD' });
    if (!response.ok) {
      throw new Error(`URL not accessible: ${response.status}`);
    }
    
    return await insertLogoDirectly(publicUrl, tenantId);
  } catch (error) {
    console.error('❌ URL validation failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Test function you can call from console
 */
export const testLogoInsertion = async () => {
  try {
    // Get current user's tenant
    const { data: userData } = await supabase.auth.getUser();
    const tenantId = userData?.user?.app_metadata?.tenant_id || 
                     userData?.user?.user_metadata?.tenant_id || 
                     'default-tenant';
    
    console.log('🧪 Testing logo insertion for tenant:', tenantId);
    
    // Insert a sample logo
    const result = await insertSampleLogo(tenantId);
    
    if (result.success) {
      console.log('🎉 Test successful! Logo inserted:', result.data);
      alert('Logo test successful! Check your app to see the logo.');
    } else {
      console.error('❌ Test failed:', result.error);
      alert(`Logo test failed: ${result.error}`);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Test function failed:', error);
    alert(`Test failed: ${error.message}`);
    return { success: false, error: error.message };
  }
};