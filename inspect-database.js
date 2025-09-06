import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectDatabase() {
  console.log('🔍 Inspecting database state...');
  console.log('='.repeat(50));
  
  try {
    // Check fee_structure table
    console.log('\n📊 Fee Structure Table:');
    const { data: allFeeStructures, error: feeError } = await supabase
      .from('fee_structure')
      .select('*')
      .limit(10);
    
    if (feeError) {
      console.log(`❌ Error: ${feeError.message}`);
    } else {
      console.log(`   Total entries found: ${allFeeStructures?.length || 0}`);
      if (allFeeStructures && allFeeStructures.length > 0) {
        console.log('   Sample entries:');
        allFeeStructures.slice(0, 3).forEach((fee, idx) => {
          console.log(`     ${idx + 1}. ID: ${fee.id}, Class: ${fee.class_id}, Component: ${fee.fee_component}, Amount: ₹${fee.amount}, Student: ${fee.student_id || 'null'}, Tenant: ${fee.tenant_id}`);
        });
        
        // Count by tenant
        const tenantCounts = {};
        allFeeStructures.forEach(fee => {
          const tenant = fee.tenant_id || 'null';
          tenantCounts[tenant] = (tenantCounts[tenant] || 0) + 1;
        });
        console.log('   Entries by tenant:');
        Object.entries(tenantCounts).forEach(([tenant, count]) => {
          console.log(`     - ${tenant}: ${count} entries`);
        });
        
        // Count student-specific vs class-level
        const classLevel = allFeeStructures.filter(fee => fee.student_id === null).length;
        const studentSpecific = allFeeStructures.filter(fee => fee.student_id !== null).length;
        console.log(`   Class-level fees: ${classLevel}`);
        console.log(`   Student-specific fees: ${studentSpecific}`);
      }
    }
    
    // Check students table
    console.log('\n👥 Students Table:');
    const { data: allStudents, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .limit(10);
    
    if (studentsError) {
      console.log(`❌ Error: ${studentsError.message}`);
    } else {
      console.log(`   Total entries found: ${allStudents?.length || 0}`);
      if (allStudents && allStudents.length > 0) {
        console.log('   Sample entries:');
        allStudents.slice(0, 3).forEach((student, idx) => {
          console.log(`     ${idx + 1}. ID: ${student.id}, Name: ${student.name}, Class: ${student.class_id}, Tenant: ${student.tenant_id}`);
        });
        
        // Count by tenant
        const tenantCounts = {};
        allStudents.forEach(student => {
          const tenant = student.tenant_id || 'null';
          tenantCounts[tenant] = (tenantCounts[tenant] || 0) + 1;
        });
        console.log('   Students by tenant:');
        Object.entries(tenantCounts).forEach(([tenant, count]) => {
          console.log(`     - ${tenant}: ${count} students`);
        });
      }
    }
    
    // Check student_discounts table
    console.log('\n🎁 Student Discounts Table:');
    const { data: allDiscounts, error: discountsError } = await supabase
      .from('student_discounts')
      .select('*')
      .limit(10);
    
    if (discountsError) {
      console.log(`❌ Error: ${discountsError.message}`);
    } else {
      console.log(`   Total entries found: ${allDiscounts?.length || 0}`);
      if (allDiscounts && allDiscounts.length > 0) {
        console.log('   Sample entries:');
        allDiscounts.slice(0, 3).forEach((discount, idx) => {
          console.log(`     ${idx + 1}. ID: ${discount.id}, Student: ${discount.student_id}, Value: ₹${discount.discount_value}, Active: ${discount.is_active}, Tenant: ${discount.tenant_id}`);
        });
        
        // Count by tenant
        const tenantCounts = {};
        allDiscounts.forEach(discount => {
          const tenant = discount.tenant_id || 'null';
          tenantCounts[tenant] = (tenantCounts[tenant] || 0) + 1;
        });
        console.log('   Discounts by tenant:');
        Object.entries(tenantCounts).forEach(([tenant, count]) => {
          console.log(`     - ${tenant}: ${count} discounts`);
        });
        
        // Count active vs inactive
        const active = allDiscounts.filter(d => d.is_active === true).length;
        const inactive = allDiscounts.filter(d => d.is_active === false).length;
        console.log(`   Active discounts: ${active}`);
        console.log(`   Inactive discounts: ${inactive}`);
      }
    }
    
    // Check classes table
    console.log('\n🏢 Classes Table:');
    const { data: allClasses, error: classesError } = await supabase
      .from('classes')
      .select('*')
      .limit(10);
    
    if (classesError) {
      console.log(`❌ Error: ${classesError.message}`);
    } else {
      console.log(`   Total entries found: ${allClasses?.length || 0}`);
      if (allClasses && allClasses.length > 0) {
        console.log('   Sample entries:');
        allClasses.slice(0, 3).forEach((cls, idx) => {
          console.log(`     ${idx + 1}. ID: ${cls.id}, Name: ${cls.class_name}, Section: ${cls.section}, Tenant: ${cls.tenant_id}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Database inspection error:', error);
  }
  
  console.log('\n🏁 Inspection complete');
}

// Run inspection
inspectDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Inspection failed:', error);
    process.exit(1);
  });
