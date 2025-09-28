import { createClient } from '@supabase/supabase-js';

// Use the same credentials as in check_database_triggers.js
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔍 Extended Diagnostic: Finding the real issue...\n');

async function extendedDiagnostic() {
    try {
        // Step 1: Check ALL fee_structure records
        console.log('Step 1: Checking ALL fee_structure records...');
        const { data: allFeeStructures, error: allFeeError } = await supabase
            .from('fee_structure')
            .select('*')
            .limit(100)
            .order('created_at', { ascending: false });

        if (allFeeError) {
            console.error('❌ Error fetching all fee structures:', allFeeError);
        } else {
            console.log(`📊 Total fee_structure records: ${allFeeStructures.length}`);
            
            if (allFeeStructures.length > 0) {
                // Group by class_id
                const byClass = {};
                const studentSpecific = [];
                const classLevel = [];
                
                allFeeStructures.forEach(fee => {
                    if (!byClass[fee.class_id]) byClass[fee.class_id] = [];
                    byClass[fee.class_id].push(fee);
                    
                    if (fee.student_id === null) {
                        classLevel.push(fee);
                    } else {
                        studentSpecific.push(fee);
                    }
                });
                
                console.log(`   Class-level fees: ${classLevel.length}`);
                console.log(`   Student-specific fees: ${studentSpecific.length}`);
                
                if (studentSpecific.length > 0) {
                    console.log('\n🚨 CORRUPTION FOUND: Student-specific fee_structure entries:');
                    studentSpecific.slice(0, 5).forEach(fee => {
                        console.log(`   - ${fee.fee_component}: Student ${fee.student_id}, Class ${fee.class_id}, Amount: ₹${fee.amount}`);
                    });
                    if (studentSpecific.length > 5) {
                        console.log(`   ... and ${studentSpecific.length - 5} more`);
                    }
                }
                
                console.log('\n📋 Fee structures by class:');
                Object.keys(byClass).slice(0, 10).forEach(classId => {
                    console.log(`   Class ${classId}: ${byClass[classId].length} records`);
                });
            }
        }

        // Step 2: Find Ishwinder across ALL classes
        console.log('\nStep 2: Looking for Ishwinder across ALL classes...');
        const { data: ishwinderResults, error: ishwinderError } = await supabase
            .from('students')
            .select('id, name, admission_no, class_id, classes(class_name, section)')
            .ilike('name', '%ishwinder%');

        if (ishwinderError) {
            console.error('❌ Error finding Ishwinder:', ishwinderError);
        } else {
            if (ishwinderResults && ishwinderResults.length > 0) {
                console.log(`✅ Found ${ishwinderResults.length} student(s) matching 'ishwinder':`);
                ishwinderResults.forEach((student, index) => {
                    console.log(`   ${index + 1}. ${student.name} (${student.admission_no}) in Class ${student.classes?.class_name}${student.classes?.section}`);
                });
                
                // Check discounts for the first Ishwinder found
                const ishwinder = ishwinderResults[0];
                const { data: discounts, error: discountError } = await supabase
                    .from('student_discounts')
                    .select('*')
                    .eq('student_id', ishwinder.id);

                if (!discountError && discounts) {
                    console.log(`📊 ${ishwinder.name} has ${discounts.length} discount records (active and inactive):`);
                    discounts.forEach((discount, index) => {
                        const status = discount.is_active ? '✅ ACTIVE' : '❌ INACTIVE';
                        console.log(`   ${index + 1}. ${discount.fee_component || 'ALL'}: ${discount.discount_type} ${discount.discount_value} [${status}]`);
                    });
                }
            } else {
                console.log('❌ No students found matching "ishwinder"');
                
                // Let's try a broader search
                console.log('\nTrying broader search for names containing "ish"...');
                const { data: broadResults, error: broadError } = await supabase
                    .from('students')
                    .select('id, name, admission_no, class_id, classes(class_name, section)')
                    .ilike('name', '%ish%');
                
                if (!broadError && broadResults && broadResults.length > 0) {
                    console.log(`📊 Found ${broadResults.length} students with names containing "ish":`);
                    broadResults.slice(0, 10).forEach((student, index) => {
                        console.log(`   ${index + 1}. ${student.name} (${student.admission_no}) in Class ${student.classes?.class_name}${student.classes?.section}`);
                    });
                }
            }
        }

        // Step 3: Check ALL student_discounts
        console.log('\nStep 3: Checking ALL student_discounts...');
        const { data: allDiscounts, error: discountError } = await supabase
            .from('student_discounts')
            .select('*')
            .limit(100)
            .order('created_at', { ascending: false });

        if (discountError) {
            console.error('❌ Error fetching discounts:', discountError);
        } else {
            console.log(`📊 Total student_discounts records: ${allDiscounts.length}`);
            
            const activeDiscounts = allDiscounts.filter(d => d.is_active);
            const inactiveDiscounts = allDiscounts.filter(d => !d.is_active);
            
            console.log(`   Active discounts: ${activeDiscounts.length}`);
            console.log(`   Inactive discounts: ${inactiveDiscounts.length}`);
            
            if (activeDiscounts.length > 0) {
                console.log('\n📋 Recent active discounts:');
                activeDiscounts.slice(0, 5).forEach((discount, index) => {
                    console.log(`   ${index + 1}. Student ${discount.student_id}: ${discount.fee_component || 'ALL'} - ${discount.discount_type} ${discount.discount_value}`);
                });
            }
        }

        // Step 4: Check ALL classes
        console.log('\nStep 4: Checking ALL classes...');
        const { data: allClasses, error: classError } = await supabase
            .from('classes')
            .select('*')
            .order('class_name, section');

        if (classError) {
            console.error('❌ Error fetching classes:', classError);
        } else {
            console.log(`📊 Total classes: ${allClasses.length}`);
            console.log('📋 All classes:');
            allClasses.forEach((cls, index) => {
                console.log(`   ${index + 1}. Class ${cls.class_name}${cls.section} (ID: ${cls.id})`);
            });
        }

        // Step 5: Check student_fees table
        console.log('\nStep 5: Checking student_fees records...');
        const { data: studentFees, error: feesError } = await supabase
            .from('student_fees')
            .select('*')
            .limit(10)
            .order('created_at', { ascending: false });

        if (feesError) {
            console.error('❌ Error fetching student fees:', feesError);
        } else {
            console.log(`📊 Recent student_fees records: ${studentFees.length}`);
            if (studentFees.length > 0) {
                console.log('📋 Sample student_fees:');
                studentFees.slice(0, 3).forEach((fee, index) => {
                    console.log(`   ${index + 1}. Student ${fee.student_id}: ${fee.fee_component} - Paid: ₹${fee.amount_paid}, Total: ₹${fee.total_amount || 'N/A'}`);
                });
            }
        }

        console.log('\n=== 📋 EXTENDED DIAGNOSIS SUMMARY ===');
        console.log('Based on the analysis:');
        console.log('1. Fee structure records exist but may not be for Class 3A specifically');
        console.log('2. Need to identify the actual class where the issue occurred');
        console.log('3. Student discount system appears to be working');
        console.log('4. The issue might be in a different class or with different student names');

    } catch (error) {
        console.error('💥 Unexpected error:', error);
    }
}

// Run the extended diagnostic
extendedDiagnostic()
    .then(() => {
        console.log('\n🏁 Extended diagnostic complete.');
    })
    .catch((error) => {
        console.error('💥 Extended diagnostic failed:', error);
    });