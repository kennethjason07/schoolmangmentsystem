import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../utils/supabase';

const ResetPasswordScreen = ({ navigation }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionValid, setSessionValid] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('Could not get session for password recovery:', error);
          setSessionValid(false);
          return;
        }
        setSessionValid(!!session);
      } catch (e) {
        setSessionValid(false);
      }
    };
    checkSession();
  }, []);

  const handleUpdatePassword = async () => {
    if (!password || password.length < 8) {
      Alert.alert('Invalid password', 'Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      Alert.alert(
        'Success',
        'Your password has been updated. Please sign in with your new password.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } catch (e) {
      console.error('Failed to update password:', e);
      Alert.alert('Error', e?.message || 'Failed to update password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set a new password</Text>
      {!sessionValid && (
        <Text style={styles.info}>
          We couldn't verify a recovery session. Please open the password reset link from your email again on this device.
        </Text>
      )}

      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed" size={20} color="#666" />
        <TextInput
          placeholder="New password"
          secureTextEntry
          style={styles.input}
          autoCapitalize="none"
          value={password}
          onChangeText={setPassword}
        />
      </View>
      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed" size={20} color="#666" />
        <TextInput
          placeholder="Confirm new password"
          secureTextEntry
          style={styles.input}
          autoCapitalize="none"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
      </View>

      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleUpdatePassword}
        disabled={isLoading || !sessionValid}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Update Password</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()} disabled={isLoading}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#f6f8fb' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16, color: '#111827', textAlign: 'center' },
  info: { color: '#374151', marginBottom: 16, textAlign: 'center' },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12
  },
  input: { flex: 1, marginLeft: 10, fontSize: 16, color: '#111827' },
  button: { backgroundColor: '#1976d2', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  backLink: { marginTop: 14, alignItems: 'center' },
  backText: { color: '#1976d2' }
});

export default ResetPasswordScreen;
