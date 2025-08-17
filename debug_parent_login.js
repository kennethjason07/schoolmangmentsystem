const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.log('Please add:');
  console.log('SUPABASE_URL=your_supabase_url');
  console.log('SUPABASE_ANON_KEY=your_anon_key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugParentLogin() {
  console.log('🔍 Debugging Parent Login Issues...\n');

  try {
    // 1. Check if required tables exist
    console.log('📋 Checking Database Structure...');
    
    const tables = ['users', 'parents', 'students', 'parent_student_relationships', 'roles'];
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`❌ Table '${table}' - Error: ${error.message}`);
        } else {
          console.log(`✅ Table '${table}' - Exists`);
        }
      } catch (err) {
        console.log(`❌ Table '${table}' - Not accessible: ${err.message}`);
      }
    }

    // 2. Check roles table
    console.log('\n👥 Checking Roles...');
    const { data: roles, error: rolesError } = await supabase
      .from('roles')
      .select('*');
    
    if (rolesError) {
      console.log(`❌ Error fetching roles: ${rolesError.message}`);
    } else {
      console.log(`✅ Found ${roles.length} roles:`, roles.map(r => r.role_name));
    }

    // 3. Check parent users
    console.log('\n👨‍👩‍👧‍👦 Checking Parent Users...');
    const { data: parentUsers, error: parentUsersError } = await supabase
      .from('users')
      .select(`
        id, 
        email, 
        role_id,
        roles(role_name)
      `)
      .eq('roles.role_name', 'parent');
    
    if (parentUsersError) {
      console.log(`❌ Error fetching parent users: ${parentUsersError.message}`);
    } else {
      console.log(`✅ Found ${parentUsers.length} parent users:`);
      parentUsers.forEach(user => {
        console.log(`   - ${user.email} (Role: ${user.roles?.role_name || 'Unknown'})`);
      });
    }

    // 4. Check parent records
    console.log('\n📝 Checking Parent Records...');
    const { data: parentRecords, error: parentRecordsError } = await supabase
      .from('parents')
      .select('*');
    
    if (parentRecordsError) {
      console.log(`❌ Error fetching parent records: ${parentRecordsError.message}`);
    } else {
      console.log(`✅ Found ${parentRecords.length} parent records:`);
      parentRecords.forEach(parent => {
        console.log(`   - ${parent.name} (${parent.email})`);
      });
    }

    // 5. Check parent-student relationships
    console.log('\n🔗 Checking Parent-Student Relationships...');
    const { data: relationships, error: relationshipsError } = await supabase
      .from('parent_student_relationships')
      .select(`
        id,
        parent_id,
        student_id,
        relationship_type,
        is_primary_contact
      `);
    
    if (relationshipsError) {
      console.log(`❌ Error fetching relationships: ${relationshipsError.message}`);
    } else {
      console.log(`✅ Found ${relationships.length} parent-student relationships:`);
      relationships.forEach(rel => {
        console.log(`   - Parent ID: ${rel.parent_id}, Student ID: ${rel.student_id}, Type: ${rel.relationship_type}`);
      });
    }

    // 6. Test a specific parent login flow
    console.log('\n🧪 Testing Parent Login Flow...');
    if (parentUsers.length > 0) {
      const testParent = parentUsers[0];
      console.log(`Testing with parent: ${testParent.email}`);
      
      // Check if parent has a profile
      const { data: parentProfile, error: profileError } = await supabase
        .from('parents')
        .select('*')
        .eq('email', testParent.email)
        .maybeSingle();
      
      if (profileError) {
        console.log(`❌ Error fetching parent profile: ${profileError.message}`);
      } else if (!parentProfile) {
        console.log(`❌ No parent profile found for ${testParent.email}`);
      } else {
        console.log(`✅ Parent profile found: ${parentProfile.name}`);
        
        // Check if parent has linked students
        const { data: linkedStudents, error: linkedError } = await supabase
          .from('parent_student_relationships')
          .select(`
            id,
            relationship_type,
            students(id, name, admission_no)
          `)
          .eq('parent_id', parentProfile.id);
        
        if (linkedError) {
          console.log(`❌ Error fetching linked students: ${linkedError.message}`);
        } else {
          console.log(`✅ Found ${linkedStudents.length} linked students:`);
          linkedStudents.forEach(rel => {
            console.log(`   - ${rel.students?.name || 'Unknown'} (${rel.relationship_type})`);
          });
        }
      }
    }

    console.log('\n🔍 Debug Complete!');
    
  } catch (error) {
    console.error('💥 Debug script error:', error);
  }
}

// Run the debug function
debugParentLogin();
