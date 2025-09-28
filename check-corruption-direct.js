import { createClient } from '@supabase/supabase-js';

// Use the same credentials as in check_database_triggers.js
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔍 Checking Fee Structure Corruption using direct queries...\n');

async function checkCorruption() {
    try {
        // Step 1: Find Class 3A
        console.log('Step 1: Finding Class 3A...');
        const { data: classes, error: classError } = await supabase
            .from('classes')
            .select('*')
            .eq('class_name', '3')
            .eq('section', 'A')
            .limit(1);

        if (classError) {
            console.error('❌ Error finding Class 3A:', classError);
            return;
        }

        if (!classes || classes.length === 0) {
            console.log('❌ Class 3A not found');
            return;
        }

        const class3A = classes[0];
        console.log('✅ Found Class 3A:', class3A.id);

        // Step 2: Check fee_structure for corruption
        console.log('\nStep 2: Checking fee_structure for corruption...');
        const { data: feeStructures, error: feeError } = await supabase
            .from('fee_structure')
            .select('*')
            .eq('class_id', class3A.id)
            .order('fee_component, student_id');

        if (feeError) {
            console.error('❌ Error fetching fee structures:', feeError);
            return;
        }

        console.log(`📊 Found ${feeStructures.length} fee_structure records for Class 3A`);

        // Categorize the records
        const classFees = feeStructures.filter(fee => fee.student_id === null);
        const studentFees = feeStructures.filter(fee => fee.student_id !== null);

        console.log(`📊 Analysis:`);
        console.log(`   Class-level fees: ${classFees.length}`);
        console.log(`   Student-specific fees: ${studentFees.length}`);

        let corruptionFound = false;

        // Display class-level fees
        if (classFees.length > 0) {
            console.log('\n📋 Class-level fees:');
            classFees.forEach(fee => {
                console.log(`   - ${fee.fee_component}: ₹${fee.amount}`);
                if (fee.amount === 0 || fee.amount === '0') {
                    console.log('     ❌ CORRUPTION: Amount is 0!');
                    corruptionFound = true;
                }
            });
        }

        // Display student-specific fees (these should not exist)
        if (studentFees.length > 0) {
            console.log('\n🚨 Student-specific fees found (CORRUPTION):');
            studentFees.forEach(fee => {
                console.log(`   - ${fee.fee_component} for student ${fee.student_id}: ₹${fee.amount}`);
            });
            corruptionFound = true;
        }

        // Step 3: Check for Ishwinder
        console.log('\nStep 3: Looking for Ishwinder...');
        const { data: students, error: studentError } = await supabase
            .from('students')
            .select('id, name, admission_no')
            .eq('class_id', class3A.id)
            .ilike('name', '%ishwinder%');

        if (studentError) {
            console.error('❌ Error finding students:', studentError);
        } else {
            const ishwinder = students && students.length > 0 ? students[0] : null;
            if (ishwinder) {
                console.log('✅ Found Ishwinder:', ishwinder);

                // Check Ishwinder's discounts
                const { data: discounts, error: discountError } = await supabase
                    .from('student_discounts')
                    .select('*')
                    .eq('student_id', ishwinder.id)
                    .eq('is_active', true);

                if (!discountError && discounts) {
                    console.log(`📊 Ishwinder has ${discounts.length} active discounts:`);
                    discounts.forEach((discount, index) => {
                        console.log(`   ${index + 1}. ${discount.fee_component || 'ALL'}: ${discount.discount_type} ${discount.discount_value}`);
                    });
                }
            } else {
                console.log('⚠️ Could not find Ishwinder');
            }
        }

        // Step 4: List all students in Class 3A
        console.log('\nStep 4: All students in Class 3A:');
        const { data: allStudents, error: allError } = await supabase
            .from('students')
            .select('id, name, admission_no')
            .eq('class_id', class3A.id)
            .order('name');

        if (allError) {
            console.error('❌ Error fetching all students:', allError);
        } else {
            console.log(`📊 Total students: ${allStudents.length}`);
            allStudents.forEach((student, index) => {
                console.log(`   ${index + 1}. ${student.name} (${student.admission_no})`);
            });
        }

        // Final diagnosis
        console.log('\n=== 📋 DIAGNOSIS SUMMARY ===');
        if (corruptionFound) {
            console.log('❌ CORRUPTION CONFIRMED!');
            console.log('\n🛠️ RECOMMENDED ACTIONS:');
            console.log(`1. Delete student-specific fee_structure entries:`);
            console.log(`   DELETE FROM fee_structure WHERE student_id IS NOT NULL AND class_id = '${class3A.id}';`);
            console.log('2. Restore class-level fees to correct amounts if they are 0');
            console.log('3. Apply the comprehensive fix SQL file through Supabase dashboard');
        } else {
            console.log('✅ No corruption detected');
        }

        return {
            corruptionFound,
            classFees,
            studentFees,
            class3AId: class3A.id
        };

    } catch (error) {
        console.error('💥 Unexpected error:', error);
    }
}

// Run the check
checkCorruption()
    .then((result) => {
        if (result?.corruptionFound) {
            console.log('\n⚠️ NEXT STEPS:');
            console.log('1. Go to your Supabase dashboard SQL editor');
            console.log('2. Run the fix_student_fees_comprehensive_final.sql file');
            console.log('3. Re-run this diagnostic to verify the fix');
        }
        console.log('\n🏁 Diagnosis complete.');
    })
    .catch((error) => {
        console.error('💥 Diagnostic failed:', error);
    });