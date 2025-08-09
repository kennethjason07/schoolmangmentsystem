const { createClient } = require('@supabase/supabase-js');

// Replace these with your actual Supabase credentials
const SUPABASE_URL = 'your-supabase-url';
const SUPABASE_ANON_KEY = 'your-supabase-anon-key';
const SUPABASE_SERVICE_KEY = 'your-supabase-service-role-key'; // Use service role key for admin operations

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function migrateDataToMaximusSchool() {
  try {
    console.log('🔄 Starting data migration to Maximus school...');

    // Step 1: Find or create Maximus school
    let { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('*')
      .ilike('name', '%maximus%')
      .single();

    if (schoolError && schoolError.code !== 'PGRST116') {
      throw schoolError;
    }

    if (!school) {
      console.log('📝 Creating Maximus school...');
      const { data: newSchool, error: createError } = await supabase
        .from('schools')
        .insert({
          name: 'Maximus',
          school_code: 'MAX001',
          type: 'Primary',
          is_active: true,
          address: 'School Address',
          phone: '1234567890',
          email: 'admin@maximus.school'
        })
        .select()
        .single();

      if (createError) throw createError;
      school = newSchool;
    }

    console.log(`✅ Using school: ${school.name} (ID: ${school.id})`);

    // Step 2: Tables to update with school_id
    const tablesToUpdate = [
      'students',
      'classes',
      'subjects',
      'teachers',
      'users', // for teachers, parents, etc.
      'student_attendance',
      'teacher_attendance',
      'marks',
      'assignments',
      'fee_records',
      'announcements',
      'events',
      'library_books',
      'library_transactions'
    ];

    let totalUpdated = 0;

    // Step 3: Update each table
    for (const tableName of tablesToUpdate) {
      console.log(`\n🔄 Updating ${tableName}...`);
      
      try {
        // First, check if the table exists and has a school_id column
        const { data: columns, error: columnError } = await supabase
          .rpc('get_table_columns', { table_name: tableName });

        if (columnError) {
          console.log(`⚠️  Skipping ${tableName} - table might not exist or accessible`);
          continue;
        }

        // Check if records without school_id exist
        const { data: recordsToUpdate, error: selectError } = await supabase
          .from(tableName)
          .select('id')
          .is('school_id', null);

        if (selectError) {
          console.log(`⚠️  Error checking ${tableName}: ${selectError.message}`);
          continue;
        }

        if (!recordsToUpdate || recordsToUpdate.length === 0) {
          console.log(`✅ ${tableName} - No records to update`);
          continue;
        }

        // Update records with school_id
        const { data: updatedRecords, error: updateError } = await supabase
          .from(tableName)
          .update({ school_id: school.id })
          .is('school_id', null)
          .select('id');

        if (updateError) {
          console.log(`❌ Error updating ${tableName}: ${updateError.message}`);
          continue;
        }

        const count = updatedRecords?.length || 0;
        console.log(`✅ ${tableName} - Updated ${count} records`);
        totalUpdated += count;

      } catch (error) {
        console.log(`⚠️  Error processing ${tableName}: ${error.message}`);
        continue;
      }
    }

    console.log(`\n🎉 Migration completed! Total records updated: ${totalUpdated}`);
    
    // Step 4: Create admin user for Maximus school if needed
    console.log('\n🔄 Setting up school admin access...');
    
    // You'll need to replace 'your-user-email@example.com' with actual user email
    const adminEmail = 'admin@maximus.school'; // Change this to your admin email
    
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', adminEmail)
      .single();

    if (user) {
      // Create school-user relationship
      const { error: schoolUserError } = await supabase
        .from('school_users')
        .upsert({
          user_id: user.id,
          school_id: school.id,
          role_in_school: 'Admin',
          is_primary_school: true
        });

      if (!schoolUserError) {
        console.log(`✅ Admin access granted to ${adminEmail}`);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - School: ${school.name} (ID: ${school.id})`);
    console.log(`   - Total records updated: ${totalUpdated}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Helper function to create get_table_columns RPC if needed
async function createHelperFunction() {
  const rpcFunction = `
    CREATE OR REPLACE FUNCTION get_table_columns(table_name TEXT)
    RETURNS TABLE(column_name TEXT, data_type TEXT)
    LANGUAGE SQL
    AS $$
      SELECT column_name::TEXT, data_type::TEXT
      FROM information_schema.columns 
      WHERE table_name = $1;
    $$;
  `;

  try {
    await supabase.rpc('exec', { query: rpcFunction });
    console.log('✅ Helper function created');
  } catch (error) {
    console.log('ℹ️  Helper function creation skipped (might already exist)');
  }
}

// Run migration
async function main() {
  console.log('🚀 Starting Maximus School Data Migration');
  console.log('=====================================\n');
  
  await createHelperFunction();
  await migrateDataToMaximusSchool();
  
  console.log('\n=====================================');
  console.log('🏁 Migration process completed!');
  process.exit(0);
}

main().catch(console.error);
