import { supabase, TABLES } from '../../utils/supabase';

// Helper function to get teacher's user ID
export const getTeacherUserId = async (teacherId) => {
  try {
    console.log('🔍 Looking for user ID for teacher:', teacherId);

    // Method 1: Try linked_teacher_id (most reliable method)
    const { data: teacherUser, error: userError } = await supabase
      .from(TABLES.USERS)
      .select('id, email, full_name, role_id')
      .eq('linked_teacher_id', teacherId)
      .single();

    if (teacherUser && !userError) {
      console.log('✅ Found teacher user via linked_teacher_id:', teacherUser);
      return teacherUser.id;
    }

    console.log('❌ Teacher user not found via linked_teacher_id, error:', userError);

    // Method 2: Get teacher data and try to find a matching user by name
    const { data: teacherData, error: teacherError } = await supabase
      .from(TABLES.TEACHERS)
      .select('name')
      .eq('id', teacherId)
      .single();

    if (teacherError || !teacherData?.name) {
      console.log('❌ Could not get teacher data:', teacherError);
      throw new Error(`Teacher with ID ${teacherId} not found in teachers table`);
    }

    console.log('📝 Found teacher name:', teacherData.name);

    // Try to find user by matching full name
    const { data: userByName, error: nameError } = await supabase
      .from(TABLES.USERS)
      .select('id, email, full_name, linked_teacher_id')
      .ilike('full_name', `%${teacherData.name}%`)
      .limit(5); // Get multiple potential matches

    console.log('🔎 Name search results:', userByName, 'Error:', nameError);

    if (!nameError && userByName && userByName.length > 0) {
      // Try to find the best match
      const exactMatch = userByName.find(u => 
        u.full_name?.toLowerCase() === teacherData.name.toLowerCase()
      );
      
      if (exactMatch) {
        console.log('✅ Found exact name match:', exactMatch);
        return exactMatch.id;
      }

      // If no exact match, use the first result
      const firstMatch = userByName[0];
      console.log('⚠️ Using first partial match:', firstMatch);
      return firstMatch.id;
    }

    // Method 3: Check if the teacherId itself exists in users table (direct check)
    const { data: directUser, error: directError } = await supabase
      .from(TABLES.USERS)
      .select('id, email, full_name')
      .eq('id', teacherId)
      .single();

    if (!directError && directUser) {
      console.log('✅ Teacher ID exists directly in users table:', directUser);
      return directUser.id;
    }

    console.log('❌ Direct user lookup failed:', directError);

    // Method 4: Last resort - show available users for debugging
    console.log('🚨 No user found for teacher. Showing available teacher users for debugging:');
    const { data: allTeacherUsers } = await supabase
      .from(TABLES.USERS)
      .select('id, email, full_name, linked_teacher_id')
      .not('linked_teacher_id', 'is', null)
      .limit(10);
    
    console.log('Available teacher users:', allTeacherUsers);

    // Throw error instead of returning teacher ID as fallback
    throw new Error(`No user account found for teacher "${teacherData.name}" (ID: ${teacherId}). This teacher needs a user account to receive messages. Please contact the administrator to create a user account for this teacher.`);

  } catch (error) {
    console.log('💥 Error getting teacher user ID:', error);
    throw error; // Don't swallow the error, let it bubble up
  }
};