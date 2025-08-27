import { supabase, TABLES } from './supabase';

// Sample parent data for the students in Class 3-A
const sampleParents = [
  {
    student_id: '095d4548-1f51-4ca2-acbf-0ef5cb106c65', // Faizan
    name: 'Ahmed Khan',
    phone: '+91 9876543210',
    email: 'ahmed.khan@email.com',
    relation: 'Father'
  },
  {
    student_id: '856c7435-4988-4e08-bdda-6aee4ba8b166', // Kanaka  
    name: 'Rajesh Kumar',
    phone: '+91 9876543211',
    email: 'rajesh.kumar@email.com',
    relation: 'Father'
  },
  {
    student_id: 'ffe76754-617e-4386-bc22-1f0d72289689', // Justus
    name: 'Maria Justus',
    phone: '+91 9876543212',
    email: 'maria.justus@email.com',
    relation: 'Mother'
  },
  {
    student_id: '15ec8f3e-b8b6-4958-ba18-ca2ac21fa0f4', // Juveria
    name: 'Shabana Begum',
    phone: '+91 9876543213',
    email: 'shabana.begum@email.com',
    relation: 'Mother'
  },
  {
    student_id: '17f3ca49-845c-4a09-b735-012496e3f6c2', // Ishwindar
    name: 'Gurpreet Singh',
    phone: '+91 9876543214',
    email: 'gurpreet.singh@email.com',
    relation: 'Father'
  }
];

export const createSampleParents = async () => {
  try {
    console.log('🎯 Creating sample parent data for Class 3-A students...');
    
    // First, check if parents already exist
    const { data: existingParents, error: checkError } = await supabase
      .from(TABLES.PARENTS)
      .select('*');
    
    if (checkError) {
      console.error('❌ Error checking existing parents:', checkError);
      return { success: false, error: checkError };
    }
    
    console.log('📊 Existing parents in database:', existingParents?.length || 0);
    
    // Get student IDs that already have parents
    const existingStudentIds = new Set(existingParents?.map(p => p.student_id) || []);
    
    // Filter out students that already have parents
    const newParents = sampleParents.filter(parent => !existingStudentIds.has(parent.student_id));
    
    if (newParents.length === 0) {
      console.log('✅ All students already have parent records');
      return { success: true, message: 'All students already have parent records', created: 0 };
    }
    
    console.log(`📝 Creating ${newParents.length} new parent records...`);
    
    // Insert new parent records
    const { data: createdParents, error: insertError } = await supabase
      .from(TABLES.PARENTS)
      .insert(newParents)
      .select();
    
    if (insertError) {
      console.error('❌ Error creating parent records:', insertError);
      return { success: false, error: insertError };
    }
    
    console.log('✅ Successfully created parent records:', createdParents?.length || 0);
    
    // Log created parents
    createdParents?.forEach((parent, index) => {
      console.log(`   ${index + 1}. ${parent.name} (${parent.relation}) - ${parent.phone}`);
    });
    
    return { 
      success: true, 
      created: createdParents?.length || 0, 
      data: createdParents 
    };
    
  } catch (error) {
    console.error('❌ Unexpected error creating sample parents:', error);
    return { success: false, error };
  }
};

// Function to verify parent-student relationships
export const verifyParentStudentRelationships = async () => {
  try {
    console.log('🔍 Verifying parent-student relationships...');
    
    const { data: studentsWithParents, error } = await supabase
      .from(TABLES.STUDENTS)
      .select(`
        id,
        name,
        parents!parents_student_id_fkey(
          id,
          name,
          phone,
          email,
          relation
        )
      `)
      .eq('class_id', '37b82e22-ff67-45f7-9df4-1e0201376fb9'); // Class 3-A
    
    if (error) {
      console.error('❌ Error verifying relationships:', error);
      return { success: false, error };
    }
    
    console.log('📊 Verification Results:');
    console.log(`   Total students checked: ${studentsWithParents?.length || 0}`);
    
    const studentsWithParentInfo = studentsWithParents?.filter(s => s.parents?.length > 0) || [];
    const studentsWithoutParents = studentsWithParents?.filter(s => !s.parents || s.parents.length === 0) || [];
    
    console.log(`   Students with parent info: ${studentsWithParentInfo.length}`);
    console.log(`   Students without parent info: ${studentsWithoutParents.length}`);
    
    // Log details
    studentsWithParentInfo.forEach((student, index) => {
      const parent = student.parents[0]; // Get first parent
      console.log(`   ${index + 1}. ${student.name} -> ${parent.name} (${parent.relation}) - ${parent.phone}`);
    });
    
    if (studentsWithoutParents.length > 0) {
      console.log('⚠️ Students without parent info:');
      studentsWithoutParents.forEach((student, index) => {
        console.log(`   ${index + 1}. ${student.name} (ID: ${student.id})`);
      });
    }
    
    return {
      success: true,
      totalStudents: studentsWithParents?.length || 0,
      studentsWithParents: studentsWithParentInfo.length,
      studentsWithoutParents: studentsWithoutParents.length,
      data: studentsWithParents
    };
    
  } catch (error) {
    console.error('❌ Unexpected error verifying relationships:', error);
    return { success: false, error };
  }
};

// Export default function for easy import
export default {
  createSampleParents,
  verifyParentStudentRelationships
};
