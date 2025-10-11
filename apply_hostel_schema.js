const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase configuration from your project
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkExistingTables() {
  console.log('🔍 Checking existing hostel-related tables...');
  
  try {
    // Try to query each table to see if it exists
    const tables = ['rooms', 'beds', 'hostels', 'blocks', 'hostel_rooms', 'hostel_beds'];
    const existingTables = [];
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('id')
          .limit(1);
        
        if (!error) {
          existingTables.push(table);
          console.log(`✅ Table '${table}' exists`);
        }
      } catch (err) {
        console.log(`❌ Table '${table}' does not exist`);
      }
    }
    
    return existingTables;
  } catch (error) {
    console.error('Error checking tables:', error);
    return [];
  }
}

async function applySchema() {
  console.log('📋 Starting hostel schema application...');
  
  // Check existing tables
  const existingTables = await checkExistingTables();
  
  if (existingTables.includes('hostel_rooms') || existingTables.includes('hostel_beds')) {
    console.log('⚠️  Warning: Found hostel_rooms/hostel_beds tables - your app expects rooms/beds');
    console.log('   This might be why you\'re getting "relation does not exist" errors.');
  }
  
  if (existingTables.includes('rooms') && existingTables.includes('beds')) {
    console.log('✅ The correct tables (rooms, beds) already exist!');
    console.log('   The error might be related to Row Level Security or tenant isolation.');
    console.log('   Let me check if the tables are accessible...');
    
    try {
      // Test if we can query the tables
      const { data: rooms, error: roomError } = await supabase
        .from('rooms')
        .select('id, room_number')
        .limit(5);
        
      const { data: beds, error: bedError } = await supabase
        .from('beds')
        .select('id, bed_label')
        .limit(5);
        
      if (roomError) {
        console.log('❌ Error accessing rooms table:', roomError);
        if (roomError.code === '42501') {
          console.log('   This looks like a Row Level Security (RLS) issue.');
          console.log('   The tables exist but your user doesn\'t have access due to tenant isolation.');
        }
      } else {
        console.log('✅ Successfully accessed rooms table, found', rooms?.length || 0, 'rooms');
      }
      
      if (bedError) {
        console.log('❌ Error accessing beds table:', bedError);
        if (bedError.code === '42501') {
          console.log('   This looks like a Row Level Security (RLS) issue.');
        }
      } else {
        console.log('✅ Successfully accessed beds table, found', beds?.length || 0, 'beds');
      }
    } catch (error) {
      console.error('Error testing table access:', error);
    }
    
    return;
  }
  
  // Read the correct schema file
  const schemaPath = path.join(__dirname, 'database', 'hostel_system_schema.sql');
  
  if (!fs.existsSync(schemaPath)) {
    console.error('❌ Schema file not found:', schemaPath);
    return;
  }
  
  const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
  console.log('📄 Loaded schema file:', schemaPath);
  
  // Split the SQL into individual statements
  const statements = schemaSQL
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('/*'))
    .filter(stmt => !stmt.toLowerCase().includes('comment on'))  // Skip comment statements
    .filter(stmt => !stmt.toLowerCase().includes('select \'hostel management system'));  // Skip success messages
  
  console.log(`📊 Found ${statements.length} SQL statements to execute`);
  
  let successCount = 0;
  let errorCount = 0;
  
  // Execute each statement
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i].trim() + ';';
    
    // Skip empty statements
    if (statement === ';') continue;
    
    try {
      console.log(`\n⏳ Executing statement ${i + 1}/${statements.length}...`);
      
      // For CREATE TABLE and other DDL statements, use rpc to execute raw SQL
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: statement });
      
      if (error) {
        // Check if it's just a "already exists" error, which we can ignore
        if (error.message.includes('already exists') || error.code === '42P07') {
          console.log(`⚠️  Statement ${i + 1}: Object already exists (skipping)`);
          successCount++;
        } else {
          console.error(`❌ Statement ${i + 1} failed:`, error);
          errorCount++;
        }
      } else {
        console.log(`✅ Statement ${i + 1}: Success`);
        successCount++;
      }
      
      // Small delay between statements
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`❌ Statement ${i + 1} error:`, error);
      errorCount++;
    }
  }
  
  console.log(`\n📈 Results: ${successCount} successful, ${errorCount} failed`);
  
  if (errorCount === 0) {
    console.log('🎉 Schema applied successfully!');
  } else {
    console.log('⚠️  Some statements failed. Please check the errors above.');
    console.log('   Note: "already exists" errors are usually safe to ignore.');
  }
  
  // Re-check tables after application
  console.log('\n🔍 Checking tables after schema application...');
  const finalTables = await checkExistingTables();
  
  if (finalTables.includes('rooms') && finalTables.includes('beds')) {
    console.log('✅ Required tables (rooms, beds) are now present!');
  }
}

// Run the script
applySchema().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});