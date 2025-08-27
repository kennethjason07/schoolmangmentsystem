import { supabase, TABLES } from './supabase';

/**
 * Test script to check what notification types are valid in the database
 */
export const testNotificationTypes = async () => {
  console.log('🧪 Testing notification enum values...');
  
  const testTypes = [
    'GRADE_ENTERED',
    'MARKS_ENTERED', 
    'HOMEWORK_UPLOADED',
    'ATTENDANCE_MARKED',
    'ANNOUNCEMENT',
    'EVENT_CREATED'
  ];
  
  for (const type of testTypes) {
    try {
      console.log(`Testing type: ${type}`);
      
      const { data, error } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .insert({
          type: type,
          message: `Test notification for ${type}`,
          delivery_mode: 'InApp',
          delivery_status: 'Pending',
          sent_by: null,
          scheduled_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        console.log(`❌ ${type}: ${error.message}`);
      } else {
        console.log(`✅ ${type}: SUCCESS`);
        // Clean up the test record
        await supabase
          .from(TABLES.NOTIFICATIONS)
          .delete()
          .eq('id', data.id);
      }
      
    } catch (error) {
      console.log(`❌ ${type}: ${error.message}`);
    }
  }
};

// Run the test if this file is executed directly
if (require.main === module) {
  testNotificationTypes();
}
