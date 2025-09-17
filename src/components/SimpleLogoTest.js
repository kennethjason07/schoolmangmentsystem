import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import { useAuth } from '../utils/AuthContext';

const SimpleLogoTest = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const testLogos = [
    {
      name: '🎓 School Logo 1',
      url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face',
      color: '#4CAF50'
    },
    {
      name: '📚 Academy Logo',
      url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face',
      color: '#2196F3'
    },
    {
      name: '🏫 Education Logo',
      url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face',
      color: '#FF9800'
    }
  ];

  const setTestLogo = async (logoUrl, logoName) => {
    try {
      setLoading(true);
      const tenantId = user?.tenant_id;

      console.log('🧪 Testing logo:', logoName);
      console.log('🧪 URL:', logoUrl);
      console.log('🧪 Tenant ID:', tenantId);

      if (!tenantId) {
        throw new Error('No tenant ID found');
      }

      // First, check if record exists
      const { data: existing } = await supabase
        .from('school_details')
        .select('id')
        .eq('tenant_id', tenantId)
        .single();

      let result;
      if (existing) {
        // Update existing record
        result = await supabase
          .from('school_details')
          .update({
            logo_url: logoUrl,
            updated_at: new Date().toISOString()
          })
          .eq('tenant_id', tenantId)
          .select();
      } else {
        // Create new record
        result = await supabase
          .from('school_details')
          .insert({
            name: 'Test School',
            type: 'School',
            address: 'Test Address',
            logo_url: logoUrl,
            tenant_id: tenantId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select();
      }

      if (result.error) {
        throw result.error;
      }

      console.log('✅ Logo set successfully!');
      Alert.alert(
        '🎉 Success!', 
        `Logo "${logoName}" has been set successfully!\\n\\nGo back to the admin dashboard or check the receipt to see the logo.`,
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('❌ Failed to set logo:', error);
      Alert.alert(
        'Error', 
        `Failed to set logo: ${error.message}\\n\\nTenant ID: ${user?.tenant_id}\\nUser ID: ${user?.id}`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="flask" size={24} color="#FF5722" />
        <Text style={styles.title}>Logo Test Lab</Text>
      </View>
      
      <Text style={styles.subtitle}>Click any button to instantly test a logo:</Text>
      
      {testLogos.map((logo, index) => (
        <TouchableOpacity
          key={index}
          style={[styles.testButton, { backgroundColor: logo.color }]}
          onPress={() => setTestLogo(logo.url, logo.name)}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.testButtonText}>{logo.name}</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      ))}
      
      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={20} color="#2196F3" />
        <Text style={styles.infoText}>
          These are high-quality test images from Unsplash. 
          After clicking, check your admin dashboard header or try printing a receipt to see the logo!
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 20,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f0f8ff',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginLeft: 10,
  },
});

export default SimpleLogoTest;