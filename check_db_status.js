// Quick database status check script
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://fxijhxikxvhyqjcgrfim.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4aWpoeGlreHZoeXFqY2dyZmltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDU5Mjk5NSwiZXhwIjoyMDUwMTY4OTk1fQ.3KX6FPXsKJKVhWXgaABfyIVQs3LZweFfmQA1aJP9Frs';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkConstraints() {
  console.log('🔍 Checking current database constraints...\n');

  try {
    // Check if student_attendance table exists and get columns
    const { data: columns, error: columnError } = await supabase
      .rpc('sql', {
        query: `
          SELECT 
            column_name,
            data_type,
            is_nullable
          FROM information_schema.columns 
          WHERE table_name = 'student_attendance' 
          ORDER BY ordinal_position;
        `
      });

    if (columnError) {
      console.error('❌ Error checking columns:', columnError);
      return;
    }

    console.log('📋 Current table structure:');
    console.table(columns || []);

    // Check current unique constraints
    const { data: constraints, error: constraintError } = await supabase
      .rpc('sql', {
        query: `
          SELECT 
            tc.constraint_name,
            string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name 
            AND tc.table_schema = kcu.table_schema
          WHERE tc.constraint_type = 'UNIQUE' 
            AND tc.table_name = 'student_attendance'
          GROUP BY tc.constraint_name;
        `
      });

    if (constraintError) {
      console.error('❌ Error checking constraints:', constraintError);
      return;
    }

    console.log('\n🔒 Current unique constraints:');
    console.table(constraints || []);

    // Check if tenant_id column exists
    const hasTenantId = columns?.some(col => col.column_name === 'tenant_id');
    console.log(`\n🏢 tenant_id column: ${hasTenantId ? '✅ EXISTS' : '❌ MISSING'}`);

    // Check RLS status
    const { data: rlsStatus, error: rlsError } = await supabase
      .rpc('sql', {
        query: `
          SELECT 
            schemaname,
            tablename,
            rowsecurity as rls_enabled
          FROM pg_tables 
          WHERE tablename = 'student_attendance';
        `
      });

    if (!rlsError && rlsStatus) {
      console.log(`\n🛡️ RLS Status: ${rlsStatus[0]?.rls_enabled ? '✅ ENABLED' : '❌ DISABLED'}`);
    }

    console.log('\n📊 Summary:');
    console.log(`- Table exists: ${columns?.length > 0 ? '✅' : '❌'}`);
    console.log(`- tenant_id column: ${hasTenantId ? '✅' : '❌'}`);
    console.log(`- Unique constraints: ${constraints?.length || 0} found`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkConstraints();
