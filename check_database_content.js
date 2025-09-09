const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bkmlzkswqjxqznmbvgje.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrbWx6a3N3cWp4cXpubWJ2Z2plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ0NDUyMTQsImV4cCI6MjA1MDAyMTIxNH0.EVXcpEw0n3EESX2YJE_Rg9UzqhXBSEDRrM_zdJcvKBY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseContent() {
    console.log('🔍 Checking database content and structure...\n');

    // Check what tables exist
    console.log('📋 Checking available tables...');
    const { data: tables, error: tablesError } = await supabase.rpc('get_tables');
    if (tablesError) {
        console.log('❌ Error getting tables:', tablesError.message);
    } else {
        console.log('Found tables:', tables);
    }

    // Check basic table counts
    const tablesToCheck = [
        'homeworks', 
        'assignments',
        'classes', 
        'students', 
        'parents',
        'users',
        'tenants'
    ];

    for (const table of tablesToCheck) {
        console.log(`\n📊 Checking ${table} table...`);
        
        try {
            const { data, error, count } = await supabase
                .from(table)
                .select('*', { count: 'exact' })
                .limit(5);
            
            if (error) {
                console.log(`❌ Error accessing ${table}:`, error.message);
            } else {
                console.log(`   Count: ${count || 0}`);
                if (data && data.length > 0) {
                    console.log(`   Sample data:`, JSON.stringify(data[0], null, 2));
                }
            }
        } catch (err) {
            console.log(`❌ Failed to check ${table}:`, err.message);
        }
    }

    // Check if there are any homework-related records
    console.log('\n🔍 Searching for any homework-related data...');
    
    // Try different possible table names
    const possibleHomeworkTables = ['homework', 'homeworks', 'assignments', 'student_homeworks', 'class_homeworks'];
    
    for (const tableName of possibleHomeworkTables) {
        try {
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .limit(1);
            
            if (!error && data) {
                console.log(`✅ Found table: ${tableName} with data:`, data.length > 0 ? 'YES' : 'NO');
            }
        } catch (err) {
            // Table doesn't exist, continue
        }
    }

    console.log('\n🏁 Database content check completed');
}

checkDatabaseContent().catch(console.error);
