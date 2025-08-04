const { createClient } = require('./src/utils/supabase');
const supabase = createClient(
  'https://dmagnsbdjsnzsddxqrwd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8'
);

async function checkSectionsTable() {
  try {
    const { data, error } = await supabase.from('sections').select('*');
    if (error) {
      console.error('Error querying sections table:', error);
    } else {
      console.log('Sections table data:', data);
    }
  } catch (e) {
    console.error('An unexpected error occurred:', e);
  }
}

checkSectionsTable();