/**
 * 🔍 SIMPLE FEE STRUCTURE CORRUPTION CHECK
 * Database-only version without React Native dependencies
 */

// Use Node.js built-in fetch (available in Node 18+) and pg client
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Load environment variables for Supabase connection
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    process.exit(1);
}

console.log('🔍 Starting Simple Fee Structure Corruption Analysis...');

/**
 * Execute a Supabase query
 */
async function executeQuery(query, params = []) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_ROLE_KEY
        },
        body: JSON.stringify({
            query: query,
            params: params
        })
    });

    if (!response.ok) {
        // Fallback to direct table queries if RPC doesn't work
        console.log('⚠️ RPC call failed, trying direct query approach...');
        return null;
    }

    return await response.json();
}

/**
 * Query Supabase table directly
 */
async function queryTable(table, select = '*', filters = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}`;
    
    // Add filters
    Object.entries(filters).forEach(([key, value]) => {
        if (value === null) {
            url += `&${key}=is.null`;
        } else {
            url += `&${key}=eq.${value}`;
        }
    });

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_ROLE_KEY
        }
    });

    if (!response.ok) {
        console.error(`❌ Failed to query ${table}:`, response.statusText);
        return null;
    }

    return await response.json();
}

/**
 * Main diagnostic function
 */
async function diagnoseFeeCorruption() {
    try {
        console.log('\n=== 🔍 ANALYZING FEE STRUCTURE TABLE ===');

        // Step 1: Find Class 3A
        console.log('📋 Finding Class 3A...');
        const classes = await queryTable('classes', '*', { 
            class_name: '3',
            section: 'A'
        });

        if (!classes || classes.length === 0) {
            console.error('❌ Class 3A not found');
            return;
        }

        const class3A = classes[0];
        console.log('✅ Found Class 3A:', class3A.id);

        // Step 2: Check fee_structure for Class 3A
        console.log('\n📊 Analyzing fee_structure records for Class 3A...');
        const feeStructures = await queryTable('fee_structure', '*', {
            class_id: class3A.id
        });

        if (!feeStructures) {
            console.error('❌ Failed to fetch fee structure');
            return;
        }

        console.log(`📊 Found ${feeStructures.length} fee_structure records for Class 3A`);

        // Categorize records
        const classFees = feeStructures.filter(fee => fee.student_id === null);
        const studentFees = feeStructures.filter(fee => fee.student_id !== null);

        console.log(`📊 Analysis Summary:`);
        console.log(`   Class-level fees: ${classFees.length}`);
        console.log(`   Student-specific fees: ${studentFees.length}`);

        // Step 3: Check for corruption
        console.log('\n🔍 Checking for corruption patterns...');
        let corruptionFound = false;

        // Group by fee component
        const feesByComponent = {};
        feeStructures.forEach(fee => {
            if (!feesByComponent[fee.fee_component]) {
                feesByComponent[fee.fee_component] = {
                    class: null,
                    students: []
                };
            }

            if (fee.student_id === null) {
                feesByComponent[fee.fee_component].class = fee;
            } else {
                feesByComponent[fee.fee_component].students.push(fee);
            }
        });

        Object.keys(feesByComponent).forEach(component => {
            const componentData = feesByComponent[component];
            console.log(`\n📋 Component: ${component}`);

            if (componentData.class) {
                console.log(`   Class fee: ₹${componentData.class.amount}`);
                
                // Check if class fee amount is 0
                if (componentData.class.amount === 0 || componentData.class.amount === '0') {
                    console.log('   ❌ CORRUPTION DETECTED: Class fee amount is 0!');
                    corruptionFound = true;
                }
            } else {
                console.log('   ❌ MISSING: No class-level fee found');
                corruptionFound = true;
            }

            if (componentData.students.length > 0) {
                console.log(`   Student-specific fees: ${componentData.students.length}`);
                componentData.students.forEach(studentFee => {
                    console.log(`     Student ${studentFee.student_id}: ₹${studentFee.amount}`);
                });
                
                console.log('   ❌ CORRUPTION DETECTED: Student-specific fee_structure entries found!');
                corruptionFound = true;
            }
        });

        // Step 4: Check for Ishwinder's student record
        console.log('\n🔍 Looking for Ishwinder in Class 3A...');
        const students = await queryTable('students', 'id,name,admission_no', {
            class_id: class3A.id
        });

        if (students) {
            console.log(`📊 Total students in Class 3A: ${students.length}`);
            const ishwinder = students.find(s => s.name.toLowerCase().includes('ishwinder'));
            
            if (ishwinder) {
                console.log('✅ Found Ishwinder:', ishwinder);

                // Check for concessions
                const concessions = await queryTable('student_discounts', '*', {
                    student_id: ishwinder.id,
                    is_active: true
                });

                if (concessions) {
                    console.log(`📊 Ishwinder's active concessions: ${concessions.length}`);
                    concessions.forEach((concession, index) => {
                        console.log(`   ${index + 1}. ${concession.fee_component || 'ALL'}: ${concession.discount_type} ${concession.discount_value}`);
                    });
                }
            } else {
                console.log('⚠️ Could not find Ishwinder in this class');
            }

            // List all students
            console.log('\n👥 All students in Class 3A:');
            students.forEach((student, index) => {
                console.log(`   ${index + 1}. ${student.name} (${student.admission_no})`);
            });
        }

        // Step 5: Final diagnosis
        console.log('\n=== 📋 DIAGNOSIS SUMMARY ===');
        if (corruptionFound) {
            console.log('❌ CORRUPTION CONFIRMED: The fee_structure table has been incorrectly modified');
            console.log('🔧 REQUIRED ACTION: Fix the fee_structure table immediately');
            
            console.log('\n🛠️ RECOMMENDED FIXES:');
            console.log('1. Delete ALL student-specific fee_structure entries (student_id IS NOT NULL)');
            console.log('2. Restore class-level fees to their original amounts');
            console.log('3. Ensure only student_discounts table is used for concessions');
            
            // Generate fix SQL
            console.log(`\n📋 Quick Fix SQL for Class 3A:`);
            console.log(`-- Delete student-specific fee_structure entries`);
            console.log(`DELETE FROM fee_structure WHERE student_id IS NOT NULL AND class_id = '${class3A.id}';`);
            console.log(`\n-- Check remaining class-level fees (update amounts as needed)`);
            console.log(`SELECT * FROM fee_structure WHERE class_id = '${class3A.id}' AND student_id IS NULL;`);
        } else {
            console.log('✅ No corruption detected in fee_structure table');
        }

        return {
            corruptionFound,
            classFeesCount: classFees.length,
            studentFeesCount: studentFees.length,
            class3AId: class3A.id
        };

    } catch (error) {
        console.error('💥 Unexpected error during diagnosis:', error);
    }
}

// Run the diagnosis
diagnoseFeeCorruption().then((result) => {
    console.log('\n🏁 Diagnosis complete.');
    if (result?.corruptionFound) {
        console.log('\n⚠️ NEXT STEPS:');
        console.log('1. Run the comprehensive fix SQL file: fix_student_fees_comprehensive_final.sql');
        console.log('2. Or apply the quick fix SQL shown above');
        console.log('3. Test the discount system after fixing');
    }
});