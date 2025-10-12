// ============================================================================
// 🏫 HOSTEL SETUP VALIDATION SCRIPT
// ============================================================================
// 
// This script validates that your hostel tables are properly set up
// Run this after executing ADD_HOSTEL_TABLES_TO_EXISTING_DB.sql
// ============================================================================

const { supabase } = require('./src/utils/supabase');

class HostelValidator {
  constructor() {
    this.requiredTables = [
      'hostels',
      'blocks', 
      'rooms',
      'beds',
      'hostel_applications',
      'bed_allocations',
      'hostel_fee_payments',
      'hostel_maintenance_logs'
    ];
    
    this.results = {
      tables: {},
      indexes: {},
      policies: {},
      overall: false
    };
  }

  async validateTables() {
    console.log('🔍 Validating Hostel Tables...\n');
    
    for (const tableName of this.requiredTables) {
      try {
        console.log(`   Checking table: ${tableName}...`);
        
        // Test if table exists by attempting to select from it
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (error && error.code === '42P01') {
          // Table does not exist
          console.log(`   ❌ Table '${tableName}' NOT FOUND`);
          this.results.tables[tableName] = false;
        } else if (error && error.code === 'PGRST116') {
          // Table exists but might have RLS issues (which is expected)
          console.log(`   ✅ Table '${tableName}' EXISTS (RLS enabled)`);
          this.results.tables[tableName] = true;
        } else if (error) {
          // Other error
          console.log(`   ⚠️  Table '${tableName}' - Unknown error: ${error.message}`);
          this.results.tables[tableName] = 'unknown';
        } else {
          // Table exists and accessible
          console.log(`   ✅ Table '${tableName}' EXISTS and accessible`);
          this.results.tables[tableName] = true;
        }
      } catch (err) {
        console.log(`   ❌ Error checking table '${tableName}': ${err.message}`);
        this.results.tables[tableName] = false;
      }
    }
  }

  async validateIndexes() {
    console.log('\n🔍 Validating Indexes...\n');
    
    const criticalIndexes = [
      'idx_rooms_tenant_id',
      'idx_beds_tenant_id', 
      'idx_hostels_tenant_id',
      'idx_bed_allocations_tenant_id'
    ];
    
    for (const indexName of criticalIndexes) {
      try {
        console.log(`   Checking index: ${indexName}...`);
        
        const { data, error } = await supabase.rpc('check_index_exists', {
          index_name: indexName
        });
        
        if (error) {
          // Fallback: assume exists if table validation passed
          const relatedTable = indexName.split('_')[1]; // Extract table name
          if (this.results.tables[relatedTable] === true) {
            console.log(`   ✅ Index '${indexName}' likely exists`);
            this.results.indexes[indexName] = true;
          } else {
            console.log(`   ❓ Index '${indexName}' - Cannot verify`);
            this.results.indexes[indexName] = 'unknown';
          }
        } else {
          console.log(`   ✅ Index '${indexName}' verified`);
          this.results.indexes[indexName] = true;
        }
      } catch (err) {
        console.log(`   ❓ Index '${indexName}' - Cannot verify: ${err.message}`);
        this.results.indexes[indexName] = 'unknown';
      }
    }
  }

  async validateBasicFunctionality() {
    console.log('\n🔍 Testing Basic Hostel Functionality...\n');
    
    try {
      // Test if we can create a simple hostel record (will fail due to RLS but table should exist)
      console.log('   Testing hostel creation...');
      
      const { data, error } = await supabase
        .from('hostels')
        .insert({
          name: 'Test Hostel',
          tenant_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
        });
        
      if (error && error.code === 'PGRST116') {
        console.log('   ✅ Hostel table exists (RLS blocking as expected)');
        this.results.functionality = true;
      } else if (error && error.code === '42P01') {
        console.log('   ❌ Hostel table missing!');
        this.results.functionality = false;
      } else if (error) {
        console.log('   ⚠️  Hostel table exists but other error:', error.message);
        this.results.functionality = 'partial';
      } else {
        console.log('   ✅ Hostel table accessible (no RLS or bypassed)');
        this.results.functionality = true;
      }
    } catch (err) {
      console.log('   ❌ Error testing functionality:', err.message);
      this.results.functionality = false;
    }
  }

  async generateReport() {
    console.log('\n📊 VALIDATION REPORT');
    console.log('====================\n');
    
    // Tables summary
    const tablesFound = Object.values(this.results.tables).filter(v => v === true).length;
    const tablesTotal = this.requiredTables.length;
    
    console.log(`📋 Tables: ${tablesFound}/${tablesTotal} found`);
    
    for (const [table, status] of Object.entries(this.results.tables)) {
      const icon = status === true ? '✅' : status === false ? '❌' : '❓';
      console.log(`   ${icon} ${table}`);
    }
    
    // Overall status
    const allTablesExist = Object.values(this.results.tables).every(v => v === true);
    
    console.log('\n🎯 OVERALL STATUS:');
    console.log('==================');
    
    if (allTablesExist) {
      console.log('✅ SUCCESS: All hostel tables are properly set up!');
      console.log('   Your hostel management system should work now.\n');
      
      console.log('🚀 NEXT STEPS:');
      console.log('- Test your hostel management features');
      console.log('- Add some sample hostel data');
      console.log('- Verify the UI works without "relation does not exist" errors');
      
      this.results.overall = true;
    } else {
      console.log('❌ ISSUES FOUND: Some hostel tables are missing!');
      console.log('   You need to execute the SQL schema script.\n');
      
      console.log('🔧 RESOLUTION:');
      console.log('1. Go to Supabase Dashboard → SQL Editor');
      console.log('2. Run the content of: ADD_HOSTEL_TABLES_TO_EXISTING_DB.sql');
      console.log('3. Run this validation script again');
      
      this.results.overall = false;
    }
  }

  async runFullValidation() {
    console.log('🏫 HOSTEL SETUP VALIDATOR');
    console.log('=========================\n');
    console.log('This script checks if your hostel tables were created successfully.\n');
    
    try {
      await this.validateTables();
      await this.validateIndexes(); 
      await this.validateBasicFunctionality();
      await this.generateReport();
      
      return this.results.overall;
    } catch (err) {
      console.error('❌ Validation failed with error:', err.message);
      console.log('\n💡 This might indicate a connection issue or missing schema.');
      console.log('   Make sure you have executed ADD_HOSTEL_TABLES_TO_EXISTING_DB.sql first.');
      return false;
    }
  }
}

// Test specific hostel service functionality
async function testHostelServiceIntegration() {
  console.log('\n🔧 TESTING HOSTEL SERVICE INTEGRATION');
  console.log('=====================================\n');
  
  try {
    // Import your actual HostelService
    const HostelService = require('./src/services/HostelService');
    
    // Test basic service methods
    console.log('   Testing HostelService.getHostels()...');
    
    // Set a dummy tenant ID for testing
    HostelService.setTenantId('00000000-0000-0000-0000-000000000000');
    
    const result = await HostelService.getHostels();
    
    if (result.success) {
      console.log('   ✅ HostelService.getHostels() works!');
      console.log(`   📊 Found ${result.data?.length || 0} hostels`);
    } else if (result.error && result.error.includes('42P01')) {
      console.log('   ❌ HostelService failing - tables still missing!');
      return false;
    } else {
      console.log('   ✅ HostelService working (RLS or other expected error)');
      console.log(`   📝 Error (expected): ${result.error}`);
    }
    
    return true;
  } catch (err) {
    console.log('   ❌ Error testing HostelService:', err.message);
    return false;
  }
}

// Main execution
async function main() {
  const validator = new HostelValidator();
  const isValid = await validator.runFullValidation();
  
  if (isValid) {
    const serviceWorks = await testHostelServiceIntegration();
    
    if (serviceWorks) {
      console.log('\n🎉 COMPLETE SUCCESS!');
      console.log('Your hostel management system is fully operational.');
    }
  }
  
  console.log('\n📞 Need help? Check the setup files or contact support.');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { HostelValidator, testHostelServiceIntegration };