const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://nfbzfcexjllhdjkrdyjp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mYnpmY2V4amxsaGRqa3JkeWpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUxOTgzNzUsImV4cCI6MjA1MDc3NDM3NX0.i4tYc1y8E6BLbPb5gMgAU9PrXLbdZqNOCDH-PQzjl_g'
);

async function debugParents() {
  try {
    console.log('=== CHECKING PARENT DATA ===');
    
    // Get all parent records
    const { data: parents, error } = await supabase
      .from('parents')
      .select('student_id, name, relation, phone, email')
      .order('student_id');
    
    if (error) {
      console.error('Error fetching parents:', error);
      return;
    }
    
    console.log('Total parent records:', parents.length);
    console.log('\n--- ALL PARENT RECORDS ---');
    parents.forEach((parent, index) => {
      console.log(`${index + 1}. Student ID: ${parent.student_id}`);
      console.log(`   Name: "${parent.name}"`);
      console.log(`   Relation: "${parent.relation}"`);
      console.log(`   Phone: ${parent.phone || 'N/A'}`);
      console.log(`   Email: ${parent.email || 'N/A'}`);
      console.log('   ---');
    });
    
    // Group by student
    const parentsByStudent = {};
    parents.forEach(parent => {
      if (!parentsByStudent[parent.student_id]) {
        parentsByStudent[parent.student_id] = [];
      }
      parentsByStudent[parent.student_id].push(parent);
    });
    
    console.log('\n--- PARENTS GROUPED BY STUDENT ---');
    Object.keys(parentsByStudent).forEach(studentId => {
      console.log(`Student ID ${studentId}:`);
      const studentParents = parentsByStudent[studentId];
      
      const father = studentParents.find(p => p.relation && p.relation.toLowerCase() === 'father');
      const mother = studentParents.find(p => p.relation && p.relation.toLowerCase() === 'mother');
      const guardian = studentParents.find(p => p.relation && p.relation.toLowerCase() === 'guardian');
      
      console.log(`  Father: ${father ? `"${father.name}"` : 'NONE'}`);
      console.log(`  Mother: ${mother ? `"${mother.name}"` : 'NONE'}`);
      console.log(`  Guardian: ${guardian ? `"${guardian.name}"` : 'NONE'}`);
      
      // Check for case-sensitive issues
      const relations = studentParents.map(p => `"${p.relation}"`).join(', ');
      console.log(`  Raw relations: [${relations}]`);
      console.log('  ---');
    });
    
  } catch (err) {
    console.error('Debug error:', err);
  }
}

debugParents();
