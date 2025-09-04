// Fix Marks Data Script
// This script fixes the incorrect max_marks values in the marks table

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8'; // anon key from app
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixMarksData() {
  try {
    console.log('🔧 Starting to fix marks data...');
    
    // First, let's check the current marks data
    const { data: currentMarks, error: fetchError } = await supabase
      .from('marks')
      .select(`
        *,
        subjects(name),
        exams(name)
      `)
      .eq('student_id', 'ffe76754-617e-4386-bc22-1f0d72289689'); // Justus's student ID
    
    if (fetchError) {
      console.error('❌ Error fetching marks:', fetchError);
      return;
    }
    
    console.log(`📊 Found ${currentMarks.length} marks records:`);
    if (currentMarks.length === 0) {
      console.log('❗ No marks found for student ID: ffe76754-617e-4386-bc22-1f0d72289689');
      console.log('Let me try to find all marks for all students...');
      
      const { data: allMarks, error: allMarksError } = await supabase
        .from('marks')
        .select(`
          *,
          subjects(name),
          exams(name)
        `)
        .limit(10);
        
      if (allMarksError) {
        console.error('❌ Error fetching all marks:', allMarksError);
        return;
      }
      
      console.log(`Found ${allMarks.length} total marks in database:`);
      allMarks.forEach((mark, index) => {
        console.log(`  ${index + 1}. Student: ${mark.student_id}, Subject: ${mark.subjects?.name || 'Unknown'}, Marks: ${mark.marks_obtained}/${mark.max_marks} = ${((mark.marks_obtained/mark.max_marks)*100).toFixed(1)}%`);
      });
      return;
    }
    
    currentMarks.forEach((mark, index) => {
      console.log(`  ${index + 1}. ${mark.subjects?.name || 'Subject'}: ${mark.marks_obtained}/${mark.max_marks} = ${((mark.marks_obtained/mark.max_marks)*100).toFixed(1)}%`);
    });
    
    // Find marks that have logical issues (marks_obtained > max_marks is impossible, or unrealistic percentages)
    const problematicMarks = currentMarks.filter(mark => {
      const percentage = (mark.marks_obtained / mark.max_marks) * 100;
      return percentage > 100; // More than 100% is impossible
    });
    
    if (problematicMarks.length === 0) {
      console.log('✅ No problematic marks found. Data looks consistent.');
      return;
    }
    
    console.log(`🚨 Found ${problematicMarks.length} problematic marks:`);
    problematicMarks.forEach(mark => {
      const percentage = (mark.marks_obtained / mark.max_marks) * 100;
      console.log(`  - ID: ${mark.id}, Marks: ${mark.marks_obtained}/${mark.max_marks} = ${percentage.toFixed(1)}% (IMPOSSIBLE!)`);
    });
    
    // Fix the problematic marks by updating max_marks to 100 
    // (assuming these are out of 100, which is standard)
    console.log('🔨 Fixing problematic marks...');
    
    for (const mark of problematicMarks) {
      const { error: updateError } = await supabase
        .from('marks')
        .update({ max_marks: 100 })
        .eq('id', mark.id);
      
      if (updateError) {
        console.error(`❌ Error updating mark ${mark.id}:`, updateError);
      } else {
        const newPercentage = (mark.marks_obtained / 100) * 100;
        console.log(`✅ Updated mark ${mark.id}: ${mark.marks_obtained}/100 = ${newPercentage.toFixed(1)}%`);
      }
    }
    
    // Verify the fixes
    const { data: fixedMarks, error: verifyError } = await supabase
      .from('marks')
      .select('*')
      .eq('student_id', 'ffe76754-617e-4386-bc22-1f0d72289689');
    
    if (verifyError) {
      console.error('❌ Error verifying fixes:', verifyError);
      return;
    }
    
    console.log('✅ After fixes - marks data:');
    let totalPercentage = 0;
    let validMarks = 0;
    
    fixedMarks.forEach(mark => {
      const percentage = (mark.marks_obtained / mark.max_marks) * 100;
      console.log(`  - Subject: ${mark.marks_obtained}/${mark.max_marks} = ${percentage.toFixed(1)}%`);
      totalPercentage += percentage;
      validMarks++;
    });
    
    const averagePercentage = validMarks > 0 ? (totalPercentage / validMarks).toFixed(1) : 0;
    console.log(`📈 New average percentage: ${averagePercentage}%`);
    
    console.log('🎉 Data fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the fix
fixMarksData().then(() => {
  console.log('Script completed.');
  process.exit(0);
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});
