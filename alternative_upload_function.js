// Alternative upload function for ProfileScreen.js
// Replace the handleUploadPhoto function with this version if still having issues

const handleUploadPhoto = async (uri) => {
  try {
    if (!authUser) {
      Alert.alert('Error', 'No authenticated user found');
      return;
    }

    console.log('Starting photo upload for user:', authUser.id);
    console.log('Image URI:', uri);

    // Create a simpler file name without folder structure initially
    const timestamp = Date.now();
    const fileName = `${authUser.id}_${timestamp}.jpg`;
    
    console.log('Generated filename:', fileName);
    
    // Convert URI to blob for upload
    const response = await fetch(uri);
    const blob = await response.blob();
    
    console.log('Blob created, size:', blob.size);
    
    // Upload to Supabase storage with detailed error logging
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('profiles')
      .upload(fileName, blob, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/jpeg'
      });

    if (uploadError) {
      console.error('Upload error details:', uploadError);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    console.log('Upload successful:', uploadData);

    // Manual URL construction (most reliable method)
    const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/profiles/${fileName}`;

    console.log('Generated public URL:', publicUrl);

    // Update profile with new photo URL
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
