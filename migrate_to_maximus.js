// Simple script to migrate existing data to Maximus school
// Make sure to install supabase-js first: npm install @supabase/supabase-js

const { createClient } = require('@supabase/supabase-js');

// TODO: Replace with your actual Supabase credentials
const SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';
const SUPABASE_SERVICE_KEY = 'YOUR_SUPABASE_SERVICE_ROLE_KEY_HERE';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function migrateToMaximus() {
  try {
    console.log('🚀 Starting migration to Maximus school...\n');

    // Step 1: Find or create the Maximus school
    let { data: school, error } = await supabase
      .from('schools')
      .select('*')
      .ilike('name', '%maximus%')
      .single();

    if (error && error.code === 'PGRST116') {
      // School doesn't exist, create it
      console.log('📝 Creating Maximus school...');
      const { data: newSchool, error: createError } = await supabase
        .from('schools')
        .insert({
          name: 'Maximus',
          school_code: 'MAX001',
          type: 'Primary',
          is_active: true,
          address: 'Maximus School Address',
          phone: '1234567890',
          email: 'admin@maximus.edu'
        })
        .select()
        .single();

      if (createError) throw createError;
      school = newSchool;
    } else if (error) {
      throw error;
    }

    console.log(`✅ Found school: ${school.name} (ID: ${school.id})\n`);

    // Step 2: Define tables to update (common tables that likely exist)
    const tables = ['students', 'classes', 'users'];
    
    let totalUpdated = 0;

    // Step 3: Update each table
    for (const tableName of tables) {
      try {
        console.log(`🔄 Processing ${tableName}...`);

        // Get records without school_id
        const { data: records, error: selectError } = await supabase
          .from(tableName)
          .select('id')
          .is('school_id', null);

        if (selectError) {
          console.log(`   ⚠️  Could not access ${tableName}: ${selectError.message}`);
          continue;
        }

        if (!records || records.length === 0) {
          console.log(`   ✅ ${tableName}: No records to update`);
          continue;
        }

        // Update records with school_id
        const { error: updateError } = await supabase
          .from(tableName)
          .update({ school_id: school.id })
          .is('school_id', null);

        if (updateError) {
          console.log(`   ❌ Error updating ${tableName}: ${updateError.message}`);
          continue;
        }

        console.log(`   ✅ ${tableName}: Updated ${records.length} records`);
        totalUpdated += records.length;

      } catch (err) {
        console.log(`   ⚠️  Error with ${tableName}: ${err.message}`);
      }
    }

    console.log(`\n🎉 Migration Summary:`);
    console.log(`   - School: ${school.name}`);
    console.log(`   - School ID: ${school.id}`);
    console.log(`   - Total records updated: ${totalUpdated}`);

    // Step 4: Setup user access (optional)
    console.log(`\n💡 Next steps:`);
    console.log(`   1. Update your user in the 'users' table to have school_id: ${school.id}`);
    console.log(`   2. Add entry to 'school_users' table:`);
    console.log(`      - user_id: your_user_id`);
    console.log(`      - school_id: ${school.id}`);
    console.log(`      - role_in_school: 'Admin'`);
    console.log(`      - is_primary_school: true`);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  }
}

// Check if credentials are set
if (SUPABASE_URL.includes('YOUR_') || SUPABASE_SERVICE_KEY.includes('YOUR_')) {
  console.error('❌ Please update the Supabase credentials in this file first!');
  console.log('   - Update SUPABASE_URL');
  console.log('   - Update SUPABASE_SERVICE_KEY (use service role key)');
  process.exit(1);
}

migrateToMaximus();
