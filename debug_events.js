const { createClient } = require('@supabase/supabase-js');

// You'll need to replace these with your actual Supabase credentials
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugEvents() {
  try {
    console.log('=== DEBUGGING EVENTS FOR TEACHER ===\n');

    // 1. Check all events in the table
    console.log('1. Checking all events in public.events table:');
    const { data: allEvents, error: allEventsError } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (allEventsError) {
      console.error('Error fetching all events:', allEventsError);
    } else {
      console.log(`Found ${allEvents?.length || 0} total events:`);
      allEvents?.forEach((event, index) => {
        console.log(`  ${index + 1}. ${event.title} - Status: ${event.status}, Date: ${event.event_date}, School-wide: ${event.is_school_wide}`);
      });
    }

    // 2. Check active events only
    console.log('\n2. Checking active events:');
    const { data: activeEvents, error: activeEventsError } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'Active')
      .order('event_date', { ascending: true });

    if (activeEventsError) {
      console.error('Error fetching active events:', activeEventsError);
    } else {
      console.log(`Found ${activeEvents?.length || 0} active events:`);
      activeEvents?.forEach((event, index) => {
        console.log(`  ${index + 1}. ${event.title} - Date: ${event.event_date}, School-wide: ${event.is_school_wide}`);
      });
    }

    // 3. Check upcoming events (today and future)
    console.log('\n3. Checking upcoming events (today and future):');
    const today = new Date().toISOString().split('T')[0];
    console.log(`Today's date: ${today}`);

    const { data: upcomingEvents, error: upcomingError } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'Active')
      .gte('event_date', today)
      .order('event_date', { ascending: true });

    if (upcomingError) {
      console.error('Error fetching upcoming events:', upcomingError);
    } else {
      console.log(`Found ${upcomingEvents?.length || 0} upcoming events:`);
      upcomingEvents?.forEach((event, index) => {
        console.log(`  ${index + 1}. ${event.title} - Date: ${event.event_date}, School-wide: ${event.is_school_wide}, Target Classes: ${JSON.stringify(event.target_classes)}`);
      });
    }

    // 4. Check school-wide events specifically
    console.log('\n4. Checking school-wide upcoming events:');
    const { data: schoolWideEvents, error: schoolWideError } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'Active')
      .gte('event_date', today)
      .eq('is_school_wide', true)
      .order('event_date', { ascending: true });

    if (schoolWideError) {
      console.error('Error fetching school-wide events:', schoolWideError);
    } else {
      console.log(`Found ${schoolWideEvents?.length || 0} school-wide upcoming events:`);
      schoolWideEvents?.forEach((event, index) => {
        console.log(`  ${index + 1}. ${event.title} - Date: ${event.event_date}`);
      });
    }

    // 5. Check teachers table to see if we can find a teacher
    console.log('\n5. Checking teachers table:');
    const { data: teachers, error: teachersError } = await supabase
      .from('teachers')
      .select('*')
      .limit(5);

    if (teachersError) {
      console.error('Error fetching teachers:', teachersError);
    } else {
      console.log(`Found ${teachers?.length || 0} teachers (showing first 5):`);
      teachers?.forEach((teacher, index) => {
        console.log(`  ${index + 1}. ID: ${teacher.id}, Name: ${teacher.name || teacher.full_name}, User ID: ${teacher.user_id}`);
      });

      // 6. If we found teachers, check assignments for the first one
      if (teachers?.length > 0) {
        const firstTeacher = teachers[0];
        console.log(`\n6. Checking assignments for teacher: ${firstTeacher.name || firstTeacher.full_name} (ID: ${firstTeacher.id})`);

        const { data: assignments, error: assignmentsError } = await supabase
          .from('teacher_subjects')
          .select(`
            *,
            subjects(
              name,
              class_id,
              classes(class_name, section)
            )
          `)
          .eq('teacher_id', firstTeacher.id);

        if (assignmentsError) {
          console.error('Error fetching teacher assignments:', assignmentsError);
        } else {
          console.log(`Found ${assignments?.length || 0} subject assignments:`);
          const classIds = [];
          assignments?.forEach((assignment, index) => {
            const className = `${assignment.subjects?.classes?.class_name} - ${assignment.subjects?.classes?.section}`;
            const classId = assignment.subjects?.class_id;
            if (classId && !classIds.includes(classId)) classIds.push(classId);
            console.log(`  ${index + 1}. Subject: ${assignment.subjects?.name}, Class: ${className}, Class ID: ${classId}`);
          });

          console.log(`\nExtracted Class IDs: [${classIds.join(', ')}]`);

          // 7. Test the actual query that the app would use
          console.log('\n7. Testing the actual query that the app uses:');
          let eventsQuery = supabase
            .from('events')
            .select('*')
            .gte('event_date', today)
            .eq('status', 'Active')
            .order('event_date', { ascending: true })
            .limit(10);

          if (classIds.length > 0) {
            eventsQuery = eventsQuery.or(`is_school_wide.eq.true,target_classes.ov.{${classIds.join(',')}}`);
          } else {
            eventsQuery = eventsQuery.eq('is_school_wide', true);
          }

          const { data: teacherEvents, error: teacherEventsError } = await eventsQuery;

          if (teacherEventsError) {
            console.error('Error with teacher events query:', teacherEventsError);
          } else {
            console.log(`Teacher would see ${teacherEvents?.length || 0} events:`);
            teacherEvents?.forEach((event, index) => {
              console.log(`  ${index + 1}. ${event.title} - Date: ${event.event_date}, School-wide: ${event.is_school_wide}`);
            });
          }
        }
      }
    }

  } catch (error) {
    console.error('Debug script error:', error);
  }
}

// Run the debug
debugEvents();

console.log(`
=== INSTRUCTIONS ===
1. Replace YOUR_SUPABASE_URL and YOUR_SUPABASE_ANON_KEY with your actual values
2. Run this script with: node debug_events.js
3. Check the output to understand what's happening with your events data
`);
