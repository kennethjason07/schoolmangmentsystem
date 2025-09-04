const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://dmagnsbdjsnzsddxqrwd.supabase.co', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8'
);

async function checkMarksData() {
  try {
    const { data, error } = await supabase
      .from('marks')
      .select('*')
      .limit(10);
    
    if (error) throw error;
    
    console.log('Current marks data in database:');
    console.log('=====================================');
    
    if (data.length === 0) {
      console.log('No marks data found in database.');
      return;
    }
    
    data.forEach((mark, i) => {
      const percentage = mark.max_marks > 0 ? (mark.marks_obtained / mark.max_marks) * 100 : 0;
      console.log(`${i+1}. Student: ${mark.student_id}`);
      console.log(`   Marks: ${mark.marks_obtained}/${mark.max_marks} = ${percentage.toFixed(1)}%`);
      console.log(`   Grade: ${mark.grade || 'N/A'}`);
      console.log(`   Subject: ${mark.subject_id}`);
      console.log(`   Exam: ${mark.exam_id}`);
      console.log('');
    });

    // Check for problematic entries
    const problematic = data.filter(mark => {
      const percentage = mark.max_marks > 0 ? (mark.marks_obtained / mark.max_marks) * 100 : 0;
      return percentage > 100 || mark.max_marks < 20; // max_marks should typically be 50, 100, etc.
    });

    if (problematic.length > 0) {
      console.log('🚨 PROBLEMATIC ENTRIES FOUND:');
      console.log('==============================');
      problematic.forEach((mark, i) => {
        const percentage = mark.max_marks > 0 ? (mark.marks_obtained / mark.max_marks) * 100 : 0;
        console.log(`${i+1}. ID: ${mark.id}`);
        console.log(`   Marks: ${mark.marks_obtained}/${mark.max_marks} = ${percentage.toFixed(1)}%`);
        console.log(`   Problem: ${percentage > 100 ? 'Percentage > 100%' : 'Suspicious max_marks value'}`);
        console.log('');
      });
    } else {
      console.log('✅ All marks data looks normal');
    }

    // Calculate overall average
    const totalMarks = data.reduce((sum, mark) => sum + mark.marks_obtained, 0);
    const totalMaxMarks = data.reduce((sum, mark) => sum + mark.max_marks, 0);
    const overallPercentage = totalMaxMarks > 0 ? (totalMarks / totalMaxMarks) * 100 : 0;
    
    console.log(`📊 SUMMARY:`);
    console.log(`   Total records: ${data.length}`);
    console.log(`   Overall percentage: ${overallPercentage.toFixed(1)}%`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkMarksData().then(() => {
  console.log('Check completed.');
  process.exit(0);
});
