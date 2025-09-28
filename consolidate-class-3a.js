import { createClient } from '@supabase/supabase-js';

// Use the same credentials
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔄 Consolidating duplicate Class 3A...\n');

async function consolidateClass3A() {
    try {
        console.log('Step 1: Finding both Class 3A instances...');
        const { data: classes3A, error: classError } = await supabase
            .from('classes')
            .select('*')
            .eq('class_name', '3')
            .eq('section', 'A');

        if (classError) {
            console.error('❌ Error finding Class 3A:', classError);
            return;
        }

        if (!classes3A || classes3A.length < 2) {
            console.log('❌ Did not find exactly 2 Class 3A instances');
            return;
        }

        console.log(`✅ Found ${classes3A.length} Class 3A instances:`);
        classes3A.forEach((cls, index) => {
            console.log(`   ${index + 1}. ID: ${cls.id}, Created: ${cls.created_at}`);
        });

        // Determine canonical class (the one with fee structures)
        const canonicalClassId = '37b82e22-ff67-45f7-9df4-1e0201376fb9'; // Has fee structures
        const duplicateClassId = '19a8a5d9-9667-4a18-9937-bc460dd5b2df'; // Has no fee structures

        const canonicalClass = classes3A.find(c => c.id === canonicalClassId);
        const duplicateClass = classes3A.find(c => c.id === duplicateClassId);

        if (!canonicalClass || !duplicateClass) {
            console.error('❌ Could not identify canonical and duplicate classes');
            return;
        }

        console.log(`\n📋 Canonical Class 3A: ${canonicalClassId}`);
        console.log(`📋 Duplicate Class 3A: ${duplicateClassId}`);

        // Step 2: Check fee structures for both classes
        console.log('\nStep 2: Checking fee structures...');
        
        const { data: canonicalFees, error: canonicalFeesError } = await supabase
            .from('fee_structure')
            .select('*')
            .eq('class_id', canonicalClassId);

        const { data: duplicateFees, error: duplicateFeesError } = await supabase
            .from('fee_structure')
            .select('*')
            .eq('class_id', duplicateClassId);

        if (canonicalFeesError || duplicateFeesError) {
            console.error('❌ Error checking fee structures');
            return;
        }

        console.log(`   Canonical class fee structures: ${canonicalFees?.length || 0}`);
        console.log(`   Duplicate class fee structures: ${duplicateFees?.length || 0}`);

        // Step 3: Check students in both classes
        console.log('\nStep 3: Checking students...');

        const { data: canonicalStudents, error: canonicalStudentsError } = await supabase
            .from('students')
            .select('*')
            .eq('class_id', canonicalClassId);

        const { data: duplicateStudents, error: duplicateStudentsError } = await supabase
            .from('students')
            .select('*')
            .eq('class_id', duplicateClassId);

        if (canonicalStudentsError || duplicateStudentsError) {
            console.error('❌ Error checking students');
            return;
        }

        console.log(`   Canonical class students: ${canonicalStudents?.length || 0}`);
        canonicalStudents?.forEach((student, index) => {
            console.log(`     ${index + 1}. ${student.name} (${student.admission_no})`);
        });

        console.log(`   Duplicate class students: ${duplicateStudents?.length || 0}`);
        duplicateStudents?.forEach((student, index) => {
            console.log(`     ${index + 1}. ${student.name} (${student.admission_no})`);
        });

        // Step 4: Move students from duplicate class to canonical class
        if (duplicateStudents && duplicateStudents.length > 0) {
            console.log(`\nStep 4: Moving ${duplicateStudents.length} students to canonical class...`);

            const { data: updatedStudents, error: updateError } = await supabase
                .from('students')
                .update({ class_id: canonicalClassId })
                .eq('class_id', duplicateClassId)
                .select();

            if (updateError) {
                console.error('❌ Error moving students:', updateError);
                return;
            }

            console.log(`✅ Successfully moved ${updatedStudents?.length || 0} students to canonical class`);
        } else {
            console.log('✅ No students to move from duplicate class');
        }

        // Step 5: Move any student_discounts associated with the duplicate class
        console.log('\nStep 5: Checking and updating student_discounts...');

        const { data: discountsToUpdate, error: discountCheckError } = await supabase
            .from('student_discounts')
            .select('*')
            .eq('class_id', duplicateClassId);

        if (discountCheckError) {
            console.error('❌ Error checking student_discounts:', discountCheckError);
        } else if (discountsToUpdate && discountsToUpdate.length > 0) {
            console.log(`   Found ${discountsToUpdate.length} discount records pointing to duplicate class`);

            const { data: updatedDiscounts, error: discountUpdateError } = await supabase
                .from('student_discounts')
                .update({ class_id: canonicalClassId })
                .eq('class_id', duplicateClassId)
                .select();

            if (discountUpdateError) {
                console.error('❌ Error updating student_discounts:', discountUpdateError);
            } else {
                console.log(`✅ Updated ${updatedDiscounts?.length || 0} discount records`);
            }
        } else {
            console.log('✅ No student_discounts to update');
        }

        // Step 6: Check if duplicate class is now empty and can be deleted
        console.log('\nStep 6: Checking if duplicate class can be deleted...');

        // Re-check for students after moving
        const { data: remainingStudents, error: remainingError } = await supabase
            .from('students')
            .select('id')
            .eq('class_id', duplicateClassId);

        if (remainingError) {
            console.error('❌ Error checking remaining students:', remainingError);
        } else if (!remainingStudents || remainingStudents.length === 0) {
            console.log('   Duplicate class is now empty, deleting it...');

            const { error: deleteError } = await supabase
                .from('classes')
                .delete()
                .eq('id', duplicateClassId);

            if (deleteError) {
                console.error('❌ Error deleting duplicate class:', deleteError);
            } else {
                console.log('✅ Successfully deleted duplicate class');
            }
        } else {
            console.log(`⚠️ Duplicate class still has ${remainingStudents.length} students, not deleting`);
        }

        // Step 7: Final verification
        console.log('\nStep 7: Final verification...');

        const { data: finalStudents, error: finalError } = await supabase
            .from('students')
            .select('*')
            .eq('class_id', canonicalClassId);

        if (finalError) {
            console.error('❌ Error in final verification:', finalError);
        } else {
            console.log(`✅ Canonical Class 3A now has ${finalStudents?.length || 0} students:`);
            finalStudents?.forEach((student, index) => {
                console.log(`   ${index + 1}. ${student.name} (${student.admission_no})`);
            });
        }

        console.log('\n🎉 Class 3A consolidation completed successfully!');
        console.log(`📋 Canonical Class 3A ID: ${canonicalClassId}`);
        console.log('   - Has fee_structure records');
        console.log('   - Contains all students including Ishwindar');

        return {
            success: true,
            canonicalClassId,
            studentsCount: finalStudents?.length || 0
        };

    } catch (error) {
        console.error('💥 Error during Class 3A consolidation:', error);
        return { success: false, error: error.message };
    }
}

// Run the consolidation
consolidateClass3A()
    .then((result) => {
        if (result?.success) {
            console.log('\n✨ Consolidation completed successfully!');
            console.log(`Now there is only one Class 3A with ${result.studentsCount} students`);
        } else {
            console.log('\n❌ Consolidation failed');
        }
    })
    .catch((error) => {
        console.error('💥 Consolidation script failed:', error);
    });