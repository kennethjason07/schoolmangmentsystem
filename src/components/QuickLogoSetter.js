import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import { useAuth } from '../utils/AuthContext';

const QuickLogoSetter = ({ onLogoSet }) => {
  const { user } = useAuth();
  const [logoUrl, setLogoUrl] = useState('');
  const [loading, setLoading] = useState(false);

  // Sample logo URLs for quick testing
  const sampleLogos = [
    {
      name: 'School Badge',
      url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face'
    },
    {
      name: 'Academy Logo',
      url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face'
    },
    {
      name: 'Education Symbol',
      url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face'
    }
  ];

  const setLogo = async (url) => {
    try {
      setLoading(true);
      const tenantId = user?.tenant_id;

      console.log('🔧 Quick logo setter - URL:', url);
      console.log('🔧 Quick logo setter - Tenant:', tenantId);

      // Update or create school_details record
      const { data: existingData } = await supabase
        .from('school_details')
        .select('id')
        .eq('tenant_id', tenantId)
        .single();

      let result;
      if (existingData) {
        // Update existing
        result = await supabase
          .from('school_details')
          .update({ logo_url: url, updated_at: new Date().toISOString() })
          .eq('tenant_id', tenantId)
          .select()
          .single();
      } else {
        // Create new
        result = await supabase
          .from('school_details')
          .insert({ 
            name: 'My School',
            type: 'School',
            logo_url: url,
            tenant_id: tenantId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
      }

      if (result.error) {
        throw result.error;
      }

      console.log('✅ Logo set successfully:', result.data);
      Alert.alert('Success', 'Logo set successfully! Check your app to see the change.');
      
      if (onLogoSet) {
        onLogoSet(url);
      }

      setLogoUrl('');

    } catch (error) {
      console.error('❌ Failed to set logo:', error);
      Alert.alert('Error', `Failed to set logo: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quick Logo Setter</Text>
      <Text style={styles.subtitle}>Set a logo URL directly for testing</Text>
      
      {/* URL Input */}
      <TextInput
        style={styles.input}
        placeholder="Paste image URL here"
        value={logoUrl}
        onChangeText={setLogoUrl}
        autoCapitalize="none"
        keyboardType="url"
      />
      
      <TouchableOpacity 
        style={[styles.button, styles.primaryButton]}
        onPress={() => setLogo(logoUrl)}
        disabled={loading || !logoUrl.trim()}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="checkmark" size={20} color="#fff" />
            <Text style={styles.buttonText}>Set Logo</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Sample Logos */}
      <Text style={styles.sampleTitle}>Or use these sample logos:</Text>
      {sampleLogos.map((sample, index) => (
        <TouchableOpacity 
          key={index}
          style={[styles.button, styles.sampleButton]}
          onPress={() => setLogo(sample.url)}
          disabled={loading}
        >
          <Ionicons name="image" size={16} color="#2196F3" />
          <Text style={styles.sampleButtonText}>{sample.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    margin: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 15,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 10,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
  },
  sampleButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  sampleButtonText: {
    color: '#2196F3',
    fontWeight: '600',
    marginLeft: 8,
  },
  sampleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 10,
    marginBottom: 10,
  },
});

export default QuickLogoSetter;