import { createClient } from '@supabase/supabase-js';

// Use the same credentials
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔍 Diagnosing fee_structure modifications...\n');

async function diagnoseFeeModification() {
    try {
        const canonicalClassId = '37b82e22-ff67-45f7-9df4-1e0201376fb9';
        
        console.log('Step 1: Current fee_structure state...');
        const { data: currentFees, error: currentError } = await supabase
            .from('fee_structure')
            .select('*')
            .eq('class_id', canonicalClassId)
            .order('fee_component');

        if (currentError) {
            console.error('❌ Error fetching current fees:', currentError);
            return;
        }

        console.log('📊 Current fee_structure for Class 3A:');
        currentFees?.forEach((fee, index) => {
            console.log(`   ${index + 1}. ${fee.fee_component}:`);
            console.log(`      ID: ${fee.id}`);
            console.log(`      Amount: ₹${fee.amount}`);
            console.log(`      Base Amount: ₹${fee.base_amount || 'N/A'}`);
            console.log(`      Discount Applied: ₹${fee.discount_applied || 0}`);
            console.log(`      Student ID: ${fee.student_id || 'NULL (Class-level)'}`);
            console.log(`      Created: ${fee.created_at}`);
            console.log(`      Updated: ${fee.updated_at}`);
            console.log('');
        });

        console.log('Step 2: Checking for database triggers...');
        
        // Check for any functions or triggers by trying to get schema info
        try {
            const { data: functionTest, error: functionError } = await supabase
                .rpc('version');
            
            if (functionError && functionError.code === 'PGRST202') {
                console.log('⚠️ Cannot directly query database functions via Supabase client');
            }
        } catch (e) {
            console.log('⚠️ Cannot access database metadata');
        }

        console.log('\nStep 3: Testing fee_structure modification behavior...');
        
        // Find Ishwindar
        const { data: ishwindar, error: studentError } = await supabase
            .from('students')
            .select('id, name')
            .eq('class_id', canonicalClassId)
            .ilike('name', '%ishwindar%')
            .single();

        if (studentError || !ishwindar) {
            console.log('❌ Could not find Ishwindar');
            return;
        }

        console.log(`✅ Found ${ishwindar.name} (${ishwindar.id})`);

        // Check Ishwindar's current discounts
        const { data: currentDiscounts, error: discountError } = await supabase
            .from('student_discounts')
            .select('*')
            .eq('student_id', ishwindar.id)
            .eq('is_active', true);

        if (discountError) {
            console.error('❌ Error fetching discounts:', discountError);
            return;
        }

        console.log(`📊 Ishwindar's current active discounts: ${currentDiscounts?.length || 0}`);
        currentDiscounts?.forEach((discount, index) => {
            console.log(`   ${index + 1}. ${discount.fee_component}: ${discount.discount_type} ₹${discount.discount_value}`);
            console.log(`      Created: ${discount.created_at}`);
            console.log(`      Updated: ${discount.updated_at}`);
        });

        console.log('\nStep 4: Simulating the problem scenario...');
        console.log('According to your report:');
        console.log('- You set Tuition fee to ₹25,000');
        console.log('- You applied ₹25,000 concession to Ishwindar');
        console.log('- The base fee became ₹5,000 (should remain ₹25,000)');
        console.log('- All students now see ₹20,000 total (₹5,000 tuition + ₹15,000 bus)');
        
        // Check if there's any code that updates fee_structure when discounts are applied
        console.log('\nStep 5: Checking for problematic code patterns...');
        
        // First, let's see what the fee calculation would look like for other students
        const { data: otherStudents, error: otherError } = await supabase
            .from('students')
            .select('id, name')
            .eq('class_id', canonicalClassId)
            .neq('id', ishwindar.id)
            .limit(2);

        if (otherError) {
            console.log('❌ Error fetching other students:', otherError);
        } else {
            console.log('\n📊 Fee calculation for other students (should NOT be affected):');
            
            for (const student of otherStudents || []) {
                console.log(`\n   Student: ${student.name}`);
                
                // Get their discounts
                const { data: studentDiscounts, error: sdError } = await supabase
                    .from('student_discounts')
                    .select('*')
                    .eq('student_id', student.id)
                    .eq('is_active', true);

                if (!sdError) {
                    console.log(`   Active discounts: ${studentDiscounts?.length || 0}`);
                    
                    // Calculate what their fees should be based on current fee_structure
                    let totalFee = 0;
                    currentFees?.forEach(fee => {
                        let studentFee = fee.amount;
                        
                        // Apply any discounts they have
                        const relevantDiscount = studentDiscounts?.find(d => 
                            d.fee_component === fee.fee_component || !d.fee_component || d.fee_component === 'ALL'
                        );
                        
                        if (relevantDiscount) {
                            const discountAmount = relevantDiscount.discount_type === 'percentage'
                                ? (fee.amount * relevantDiscount.discount_value / 100)
                                : relevantDiscount.discount_value;
                            studentFee = Math.max(0, fee.amount - discountAmount);
                        }
                        
                        totalFee += studentFee;
                        console.log(`   ${fee.fee_component}: ₹${fee.amount} → ₹${studentFee}`);
                    });
                    
                    console.log(`   TOTAL: ₹${totalFee}`);
                }
            }
        }

        console.log('\n=== 🎯 DIAGNOSIS RESULTS ===');
        
        const tutionFee = currentFees?.find(f => f.fee_component === 'Tution fee');
        const busFee = currentFees?.find(f => f.fee_component === 'Bus Fee');
        
        if (tutionFee && tutionFee.amount < 25000) {
            console.log('🚨 PROBLEM CONFIRMED: Tuition fee amount is incorrect!');
            console.log(`   Current Tuition fee: ₹${tutionFee.amount} (should be ₹25,000)`);
            console.log(`   This means something IS modifying the fee_structure table`);
        }
        
        if (busFee) {
            console.log(`📋 Bus fee: ₹${busFee.amount} (appears correct)`);
        }

        console.log('\n🔍 POSSIBLE CAUSES:');
        console.log('1. Database trigger on student_discounts table that modifies fee_structure');
        console.log('2. Application code that incorrectly updates fee_structure when applying discounts');
        console.log('3. UI bug that sends wrong data when creating discounts');
        console.log('4. RLS policy that interferes with fee calculations');

        console.log('\n⚡ IMMEDIATE FIX:');
        console.log(`To restore correct fees, run:`);
        console.log(`UPDATE fee_structure SET amount = 25000, base_amount = 25000 WHERE id = '${tutionFee?.id}';`);

        return {
            tutionFee,
            busFee,
            isCorrupted: tutionFee && tutionFee.amount < 25000
        };

    } catch (error) {
        console.error('💥 Error during diagnosis:', error);
        return { error: error.message };
    }
}

// Run the diagnosis
diagnoseFeeModification()
    .then((result) => {
        if (result?.isCorrupted) {
            console.log('\n🚨 CORRUPTION CONFIRMED!');
            console.log('Something is modifying the fee_structure table when it should not be.');
        } else if (result?.tutionFee) {
            console.log('\n✅ Fee structure appears correct');
        }
        console.log('\n🏁 Diagnosis complete.');
    })
    .catch((error) => {
        console.error('💥 Diagnosis failed:', error);
    });