// Simplified upload function that should work reliably
// Replace the handleUploadPhoto function in ProfileScreen.js with this

const handleUploadPhoto = async (uri) => {
  try {
    if (!authUser) {
      Alert.alert('Error', 'No authenticated user found');
      return;
    }

    console.log('Starting simple photo upload for user:', authUser.id);
    console.log('Image URI:', uri);

    // Create a simple file name
    const timestamp = Date.now();
    const fileName = `${authUser.id}_${timestamp}.jpg`;
    
    console.log('Generated filename:', fileName);
    
    // Use the Supabase client's upload method - simplest approach
    // First, convert the URI to a file format that works with Supabase
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const fileBlob = new Blob([arrayBuffer], { type: 'image/jpeg' });
    
    console.log('File prepared for upload, size:', fileBlob.size);
    
    // Upload using Supabase client
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('profiles')
      .upload(fileName, fileBlob, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error details:', uploadError);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    console.log('Upload successful:', uploadData);

    // Construct the public URL manually
    const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/profiles/${fileName}`;

    console.log('Generated public URL:', publicUrl);

    // Update the user's profile in the database
    const { data: updateData, error: updateError } = await supabase
      .from('users')
      .update({
        profile_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', authUser.id)
      .select();

    if (updateError) {
      console.error('Database update error:', updateError);
      throw new Error(`Database update failed: ${updateError.message}`);
    }

    console.log('Database update successful:', updateData);
    Alert.alert('Success', 'Photo updated successfully');
    loadUserData();
  } catch (error) {
    console.error('Error uploading photo:', error);
    Alert.alert('Error', `Failed to upload photo: ${error.message || error}`);
  }
};
