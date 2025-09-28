import { createClient } from '@supabase/supabase-js';

// Use the same credentials as in check_database_triggers.js
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🕵️ Checking for problematic student_discounts that could affect all students...\n');

async function checkProblematicDiscounts() {
    try {
        console.log('Step 1: Checking for discounts with NULL student_id...');
        const { data: nullStudentDiscounts, error: nullError } = await supabase
            .from('student_discounts')
            .select('*')
            .is('student_id', null);

        if (nullError) {
            console.error('❌ Error checking for null student_id discounts:', nullError);
        } else {
            console.log(`📊 Found ${nullStudentDiscounts.length} discounts with NULL student_id`);
            if (nullStudentDiscounts.length > 0) {
                console.log('🚨 PROBLEM FOUND: Discounts with NULL student_id will affect ALL students!');
                nullStudentDiscounts.forEach((discount, index) => {
                    const status = discount.is_active ? '✅ ACTIVE' : '❌ INACTIVE';
                    console.log(`   ${index + 1}. ${discount.fee_component || 'ALL'}: ${discount.discount_type} ₹${discount.discount_value} [${status}]`);
                    console.log(`      Description: ${discount.description || 'N/A'}`);
                    console.log(`      Academic Year: ${discount.academic_year}`);
                    console.log(`      Class ID: ${discount.class_id}`);
                });
            } else {
                console.log('✅ No discounts with NULL student_id found');
            }
        }

        console.log('\nStep 2: Checking for discounts with fee_component = NULL (applies to ALL components)...');
        const { data: nullComponentDiscounts, error: componentError } = await supabase
            .from('student_discounts')
            .select('*')
            .is('fee_component', null)
            .eq('is_active', true);

        if (componentError) {
            console.error('❌ Error checking for null fee_component discounts:', componentError);
        } else {
            console.log(`📊 Found ${nullComponentDiscounts.length} active discounts with NULL fee_component`);
            if (nullComponentDiscounts.length > 0) {
                console.log('⚠️ These discounts apply to ALL fee components for their respective students:');
                nullComponentDiscounts.forEach((discount, index) => {
                    console.log(`   ${index + 1}. Student ${discount.student_id}: ${discount.discount_type} ₹${discount.discount_value}`);
                    console.log(`      Description: ${discount.description || 'N/A'}`);
                    console.log(`      Class ID: ${discount.class_id}`);
                });
            } else {
                console.log('✅ No active discounts with NULL fee_component found');
            }
        }

        console.log('\nStep 3: Checking for unusually high discount values...');
        const { data: highDiscounts, error: highError } = await supabase
            .from('student_discounts')
            .select('*')
            .eq('is_active', true)
            .gte('discount_value', 50000); // Discounts >= ₹50,000

        if (highError) {
            console.error('❌ Error checking for high discount values:', highError);
        } else {
            console.log(`📊 Found ${highDiscounts.length} active discounts with values >= ₹50,000`);
            if (highDiscounts.length > 0) {
                console.log('⚠️ These high-value discounts could cause issues:');
                highDiscounts.forEach((discount, index) => {
                    console.log(`   ${index + 1}. Student ${discount.student_id}: ${discount.fee_component || 'ALL'} - ${discount.discount_type} ₹${discount.discount_value}`);
                    console.log(`      Description: ${discount.description || 'N/A'}`);
                    console.log(`      Class ID: ${discount.class_id}`);
                });
            } else {
                console.log('✅ No unusually high discount values found');
            }
        }

        console.log('\nStep 4: Checking for duplicate discounts for the same student and fee component...');
        const { data: allActiveDiscounts, error: allError } = await supabase
            .from('student_discounts')
            .select('*')
            .eq('is_active', true)
            .order('student_id, fee_component, created_at');

        if (allError) {
            console.error('❌ Error fetching all active discounts:', allError);
        } else {
            // Group by student_id and fee_component to find duplicates
            const groupedDiscounts = {};
            allActiveDiscounts.forEach(discount => {
                const key = `${discount.student_id}_${discount.fee_component || 'ALL'}`;
                if (!groupedDiscounts[key]) {
                    groupedDiscounts[key] = [];
                }
                groupedDiscounts[key].push(discount);
            });

            const duplicates = Object.entries(groupedDiscounts).filter(([key, discounts]) => discounts.length > 1);
            
            console.log(`📊 Found ${duplicates.length} cases of duplicate discounts for same student+component`);
            if (duplicates.length > 0) {
                console.log('⚠️ These duplicate discounts could cause cumulative effects:');
                duplicates.forEach(([key, discounts], index) => {
                    const [studentId, feeComponent] = key.split('_');
                    console.log(`   ${index + 1}. Student ${studentId}, Component ${feeComponent}: ${discounts.length} active discounts`);
                    discounts.forEach((discount, dIndex) => {
                        console.log(`      ${dIndex + 1}. ${discount.discount_type} ₹${discount.discount_value} (Created: ${discount.created_at})`);
                    });
                });
            } else {
                console.log('✅ No duplicate discounts found');
            }
        }

        console.log('\nStep 5: Looking specifically for discounts related to "Ishwindar" or similar names...');
        
        // First find students with names like "Ishwin*"
        const { data: ishStudents, error: ishError } = await supabase
            .from('students')
            .select('id, name, admission_no, class_id')
            .ilike('name', '%ishwin%');

        if (ishError) {
            console.error('❌ Error finding Ishwin* students:', ishError);
        } else if (ishStudents && ishStudents.length > 0) {
            console.log(`✅ Found ${ishStudents.length} students with names containing "ishwin":`);
            
            for (const student of ishStudents) {
                console.log(`   - ${student.name} (${student.admission_no}) in class ${student.class_id}`);
                
                // Check their discounts
                const { data: studentDiscounts, error: discountError } = await supabase
                    .from('student_discounts')
                    .select('*')
                    .eq('student_id', student.id);

                if (!discountError && studentDiscounts) {
                    console.log(`     Has ${studentDiscounts.length} discount records:`);
                    studentDiscounts.forEach((discount, index) => {
                        const status = discount.is_active ? '✅ ACTIVE' : '❌ INACTIVE';
                        console.log(`     ${index + 1}. ${discount.fee_component || 'ALL'}: ${discount.discount_type} ₹${discount.discount_value} [${status}]`);
                        console.log(`        Created: ${discount.created_at}, Updated: ${discount.updated_at}`);
                    });
                }
            }
        } else {
            console.log('❌ No students found with names containing "ishwin"');
        }

        console.log('\n=== 🔍 PROBLEMATIC DISCOUNTS SUMMARY ===');
        let issuesFound = false;

        if (nullStudentDiscounts && nullStudentDiscounts.length > 0) {
            console.log('❌ CRITICAL: Found discounts with NULL student_id - these affect ALL students');
            issuesFound = true;
        }

        if (highDiscounts && highDiscounts.length > 0) {
            console.log('⚠️ WARNING: Found high-value discounts that could cause calculation issues');
            issuesFound = true;
        }

        if (duplicates && duplicates.length > 0) {
            console.log('⚠️ WARNING: Found duplicate discounts that could cause cumulative effects');
            issuesFound = true;
        }

        if (!issuesFound) {
            console.log('✅ No obvious problematic discounts found');
            console.log('The issue might be in the fee calculation logic or class/student association');
        }

        return {
            nullStudentDiscounts: nullStudentDiscounts?.length || 0,
            highDiscounts: highDiscounts?.length || 0,
            duplicates: duplicates?.length || 0,
            ishStudents: ishStudents?.length || 0
        };

    } catch (error) {
        console.error('💥 Unexpected error during problematic discounts check:', error);
    }
}

// Run the check
checkProblematicDiscounts()
    .then((result) => {
        console.log('\n🏁 Problematic discounts check complete.');
        if (result && (result.nullStudentDiscounts > 0 || result.highDiscounts > 0 || result.duplicates > 0)) {
            console.log('\n⚠️ RECOMMENDED ACTIONS:');
            if (result.nullStudentDiscounts > 0) {
                console.log('1. Delete or fix discounts with NULL student_id');
                console.log('   DELETE FROM student_discounts WHERE student_id IS NULL;');
            }
            if (result.duplicates > 0) {
                console.log('2. Review and consolidate duplicate discounts for same student+component');
            }
            if (result.highDiscounts > 0) {
                console.log('3. Review high-value discounts to ensure they are intentional');
            }
        }
    })
    .catch((error) => {
        console.error('💥 Check failed:', error);
    });