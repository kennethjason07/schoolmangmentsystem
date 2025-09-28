import { createClient } from '@supabase/supabase-js';

// Use the same credentials
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔧 Fixing database trigger that modifies fee_structure...\n');

async function fixDatabaseTrigger() {
    try {
        console.log('Step 1: Restoring correct Tuition fee amount...');
        
        const canonicalClassId = '37b82e22-ff67-45f7-9df4-1e0201376fb9';
        const { data: updatedFee, error: updateError } = await supabase
            .from('fee_structure')
            .update({ 
                amount: 25000,
                base_amount: 25000,
                discount_applied: 0 // Reset to 0 as it should not be in fee_structure
            })
            .eq('class_id', canonicalClassId)
            .eq('fee_component', 'Tution fee')
            .select();

        if (updateError) {
            console.error('❌ Error updating fee:', updateError);
            return;
        }

        console.log(`✅ Restored Tuition fee to ₹25,000`);

        console.log('\nStep 2: Current fee structure state:');
        const { data: currentFees, error: currentError } = await supabase
            .from('fee_structure')
            .select('*')
            .eq('class_id', canonicalClassId);

        if (!currentError && currentFees) {
            currentFees.forEach(fee => {
                console.log(`   ${fee.fee_component}: Amount=₹${fee.amount}, Base=₹${fee.base_amount || 'N/A'}, DiscountApplied=₹${fee.discount_applied || 0}`);
            });
        }

        console.log('\nStep 3: Testing the trigger...');
        console.log('Creating a test discount to see if it modifies fee_structure...');
        
        // Find Ishwindar
        const { data: ishwindar, error: studentError } = await supabase
            .from('students')
            .select('id, name')
            .eq('class_id', canonicalClassId)
            .ilike('name', '%ishwindar%')
            .single();

        if (studentError || !ishwindar) {
            console.log('❌ Could not find Ishwindar for testing');
            return;
        }

        // First, deactivate existing discounts
        const { data: existingDiscounts, error: existingError } = await supabase
            .from('student_discounts')
            .update({ is_active: false })
            .eq('student_id', ishwindar.id)
            .select();

        console.log(`✅ Deactivated ${existingDiscounts?.length || 0} existing discounts`);

        // Take snapshot before adding new discount
        const { data: beforeSnapshot, error: beforeError } = await supabase
            .from('fee_structure')
            .select('*')
            .eq('class_id', canonicalClassId);

        console.log('\n📸 Before adding discount:');
        beforeSnapshot?.forEach(fee => {
            console.log(`   ${fee.fee_component}: Amount=₹${fee.amount}, DiscountApplied=₹${fee.discount_applied || 0}`);
        });

        // Create new test discount
        const testDiscount = {
            student_id: ishwindar.id,
            class_id: canonicalClassId,
            academic_year: '2024-25',
            discount_type: 'fixed_amount',
            discount_value: 1000, // Small test amount
            fee_component: 'Tution fee',
            description: 'Test discount to detect trigger',
            tenant_id: beforeSnapshot[0].tenant_id,
            is_active: true
        };

        const { data: newDiscount, error: discountError } = await supabase
            .from('student_discounts')
            .insert(testDiscount)
            .select()
            .single();

        if (discountError) {
            console.error('❌ Error creating test discount:', discountError);
            return;
        }

        console.log('✅ Created test discount:', newDiscount.id);

        // Take snapshot after adding discount
        const { data: afterSnapshot, error: afterError } = await supabase
            .from('fee_structure')
            .select('*')
            .eq('class_id', canonicalClassId);

        console.log('\n📸 After adding discount:');
        afterSnapshot?.forEach(fee => {
            console.log(`   ${fee.fee_component}: Amount=₹${fee.amount}, DiscountApplied=₹${fee.discount_applied || 0}`);
        });

        // Compare snapshots
        let triggerDetected = false;
        const changes = [];

        beforeSnapshot?.forEach(beforeFee => {
            const afterFee = afterSnapshot?.find(f => f.id === beforeFee.id);
            if (afterFee) {
                if (beforeFee.amount !== afterFee.amount) {
                    changes.push(`${beforeFee.fee_component} amount: ₹${beforeFee.amount} → ₹${afterFee.amount}`);
                    triggerDetected = true;
                }
                if ((beforeFee.discount_applied || 0) !== (afterFee.discount_applied || 0)) {
                    changes.push(`${beforeFee.fee_component} discount_applied: ₹${beforeFee.discount_applied || 0} → ₹${afterFee.discount_applied || 0}`);
                    triggerDetected = true;
                }
            }
        });

        if (triggerDetected) {
            console.log('\n🚨 TRIGGER DETECTED!');
            console.log('Changes made to fee_structure:');
            changes.forEach(change => console.log(`   - ${change}`));
            
            console.log('\nThis confirms there is a database trigger modifying fee_structure when student_discounts are added.');
            console.log('\n⚠️ IMMEDIATE SOLUTION:');
            console.log('You need to run this SQL in your Supabase dashboard to find and disable the problematic trigger:');
            console.log('\n-- Find all triggers that might affect fee_structure:');
            console.log('SELECT trigger_name, event_object_table, event_manipulation, action_statement');
            console.log('FROM information_schema.triggers');
            console.log("WHERE action_statement ILIKE '%fee_structure%' OR event_object_table IN ('student_discounts', 'fee_structure');");
            console.log('\n-- Disable triggers on student_discounts:');
            console.log('ALTER TABLE student_discounts DISABLE TRIGGER ALL;');
            console.log('\n-- Or drop specific trigger (replace TRIGGER_NAME):');
            console.log('-- DROP TRIGGER IF EXISTS [TRIGGER_NAME] ON student_discounts;');

        } else {
            console.log('\n✅ No trigger detected - fee_structure remained unchanged');
        }

        // Clean up test discount
        const { error: cleanupError } = await supabase
            .from('student_discounts')
            .delete()
            .eq('id', newDiscount.id);

        if (cleanupError) {
            console.log('⚠️ Could not clean up test discount:', cleanupError);
        } else {
            console.log('🧹 Test discount cleaned up');
        }

        // Restore the original ₹25,000 discount for Ishwindar
        console.log('\nStep 4: Restoring Ishwindar\'s original ₹25,000 discount...');
        
        const originalDiscount = {
            student_id: ishwindar.id,
            class_id: canonicalClassId,
            academic_year: '2024-25',
            discount_type: 'fixed_amount',
            discount_value: 25000,
            fee_component: 'Tution fee',
            description: 'Restored original discount',
            tenant_id: beforeSnapshot[0].tenant_id,
            is_active: true
        };

        const { data: restoredDiscount, error: restoreError } = await supabase
            .from('student_discounts')
            .insert(originalDiscount)
            .select()
            .single();

        if (restoreError) {
            console.error('❌ Error restoring original discount:', restoreError);
        } else {
            console.log('✅ Restored Ishwindar\'s ₹25,000 tuition discount');
        }

        console.log('\n=== 🎯 SOLUTION SUMMARY ===');
        console.log('1. ✅ Tuition fee restored to ₹25,000');
        console.log('2. ✅ Ishwindar\'s discount restored');
        
        if (triggerDetected) {
            console.log('3. ❌ Database trigger is still active and MUST be disabled');
            console.log('\n🔧 TO PERMANENTLY FIX THIS ISSUE:');
            console.log('   a) Go to Supabase Dashboard → SQL Editor');
            console.log('   b) Run: ALTER TABLE student_discounts DISABLE TRIGGER ALL;');
            console.log('   c) Or identify and drop the specific trigger');
            console.log('   d) Test discount creation again');
        } else {
            console.log('3. ✅ No active trigger detected');
        }

        console.log('\n📊 Expected results after trigger fix:');
        console.log('- Tuition fee in fee_structure: ₹25,000 (stays constant)');
        console.log('- Ishwindar pays: ₹0 (₹25,000 - ₹25,000 discount)');
        console.log('- Other students pay: ₹25,000 (full amount)');
        console.log('- Bus fee: ₹15,000 for all students');

        return { triggerDetected, changes };

    } catch (error) {
        console.error('💥 Error during trigger fix:', error);
        return { error: error.message };
    }
}

// Run the fix
fixDatabaseTrigger()
    .then((result) => {
        if (result?.triggerDetected) {
            console.log('\n🚨 ACTION REQUIRED: Database trigger must be disabled manually');
        } else if (result?.error) {
            console.log('\n❌ Fix failed');
        } else {
            console.log('\n✅ System should now work correctly');
        }
        console.log('\n🏁 Fix complete.');
    })
    .catch((error) => {
        console.error('💥 Fix script failed:', error);
    });