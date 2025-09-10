const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createSimpleHomework() {
  console.log('📝 CREATING SIMPLE HOMEWORK...\n');

  try {
    // Get parent info
    const { data: parentUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'Arshadpatel1431@gmail.com')
      .single();

    // Get student info
    const { data: studentData } = await supabase
      .from('students')
      .select('*, classes(*)')
      .eq('id', parentUser.linked_parent_of)
      .single();

    // Check subjects table
    const { data: subjects } = await supabase
      .from('subjects')
      .select('*')
      .eq('tenant_id', parentUser.tenant_id)
      .limit(3);

    console.log('Available subjects:', subjects?.length || 0);
    if (subjects && subjects.length > 0) {
      console.log('Subjects:', subjects.map(s => s.subject_name || s.name));
    }

    // Create homework with a valid subject_id
    if (subjects && subjects.length > 0) {
      const homework = {
        title: 'Math Homework - Addition and Subtraction',
        description: 'Complete worksheet pages 25-27. Show all work clearly.',
        subject_id: subjects[0].id,
        class_id: studentData.class_id,
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        tenant_id: parentUser.tenant_id,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('assignments')
        .insert(homework);

      if (error) {
        console.log('❌ Failed to create homework:', error.message);
      } else {
        console.log('✅ Created homework successfully!');
      }
    } else {
      console.log('❌ No subjects found - cannot create homework');
    }

    return true;

  } catch (error) {
    console.error('❌ Script failed:', error.message);
    return false;
  }
}

if (require.main === module) {
  createSimpleHomework().then(() => {
    console.log('\n🏁 Done');
    process.exit(0);
  });
}
