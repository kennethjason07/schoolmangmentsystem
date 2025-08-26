const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Supabase configuration - same as in the app
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runMigration() {
  try {
    console.log('Running migration to add max_marks column to exams table...');
    
    // Step 1: Add the column
    console.log('Step 1: Adding max_marks column...');
    const { data: addColumnResult, error: addColumnError } = await supabase.rpc('exec_sql', {
      query: 'ALTER TABLE exams ADD COLUMN max_marks NUMERIC DEFAULT 100 NOT NULL;'
    });
    
    if (addColumnError) {
      if (addColumnError.message.includes('already exists')) {
        console.log('Column already exists, skipping...');
      } else {
        throw addColumnError;
      }
    } else {
      console.log('✓ Column added successfully');
    }
    
    // Step 2: Update existing rows
    console.log('Step 2: Updating existing exams...');
    const { data: updateResult, error: updateError } = await supabase.rpc('exec_sql', {
      query: 'UPDATE exams SET max_marks = 100 WHERE max_marks IS NULL;'
    });
    
    if (updateError) {
      console.log('Update warning:', updateError.message);
    } else {
      console.log('✓ Existing exams updated');
    }
    
    // Step 3: Verify the column exists
    console.log('Step 3: Verifying migration...');
    const { data: verifyResult, error: verifyError } = await supabase
      .from('exams')
      .select('id, name, max_marks')
      .limit(5);
    
    if (verifyError) {
      throw verifyError;
    }
    
    console.log('✓ Migration successful! Sample data:');
    console.log(verifyResult);
    
    console.log('\nMigration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    
    // Try alternative approach - direct SQL execution
    console.log('\nTrying alternative approach...');
    try {
      const { data, error } = await supabase
        .from('exams')
        .select('id')
        .limit(1);
      
      if (!error) {
        console.log('Database connection is working. Let\'s try a different approach...');
        
        // Try using the PostgreSQL REST API directly
        const { data: alterResult, error: alterError } = await supabase
          .rpc('exec_sql', {
            sql: 'ALTER TABLE exams ADD COLUMN IF NOT EXISTS max_marks NUMERIC DEFAULT 100 NOT NULL;'
          });
        
        if (alterError) {
          console.log('RPC approach failed:', alterError.message);
          console.log('\nPlease run this SQL manually in your Supabase dashboard:');
          console.log('ALTER TABLE exams ADD COLUMN max_marks NUMERIC DEFAULT 100 NOT NULL;');
          console.log('UPDATE exams SET max_marks = 100 WHERE max_marks IS NULL;');
        } else {
          console.log('✓ Alternative approach successful!');
        }
      }
    } catch (altError) {
      console.error('Alternative approach also failed:', altError);
      console.log('\nPlease run this SQL manually in your Supabase dashboard:');
      console.log('ALTER TABLE exams ADD COLUMN max_marks NUMERIC DEFAULT 100 NOT NULL;');
      console.log('UPDATE exams SET max_marks = 100 WHERE max_marks IS NULL;');
    }
  }
}

runMigration();
