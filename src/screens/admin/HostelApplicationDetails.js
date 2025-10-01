import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import Header from '../../components/Header';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES } from '../../utils/supabase';

const HostelApplicationDetails = ({ navigation, route }) => {
  const { tenantId } = useAuth();
  const passedApplication = route.params?.application || null;
  const [application, setApplication] = useState(passedApplication);
  const [loading, setLoading] = useState(!passedApplication);
  const [fatherName, setFatherName] = useState(null);
  const [motherName, setMotherName] = useState(null);
  const [parentPhone, setParentPhone] = useState(null);

  useEffect(() => {
    const fetchIfNeeded = async () => {
      if (!application && route.params?.applicationId) {
        // Fallback: fetch by id if only applicationId is provided
        try {
          setLoading(true);
          const { data, error } = await supabase
            .from('hostel_applications')
            .select(`*, student:students(*), hostel:hostels(name, hostel_type)`) 
            .eq('id', route.params.applicationId)
            .limit(1);
          if (error) throw error;
          if (data && data.length > 0) setApplication(data[0]);
        } catch (e) {
          // keep silent but stop loading
        } finally {
          setLoading(false);
        }
      } else if (application) {
        // Already have application
        setLoading(false);
      }
    };
    fetchIfNeeded();
  }, [route.params?.applicationId]);

  useEffect(() => {
    // Fetch parent details for father name if available
    const fetchParents = async () => {
      try {
        if (!application?.student?.id || !tenantId) return;
        const { data: parents, error } = await supabase
          .from(TABLES.PARENTS)
          .select('name, phone, relation')
          .eq('student_id', application.student.id)
          .eq('tenant_id', tenantId);
        if (!error && Array.isArray(parents)) {
          const father = parents.find(p => p.relation === 'Father');
          const mother = parents.find(p => p.relation === 'Mother');
          setFatherName(father?.name || null);
          setMotherName(mother?.name || null);
          setParentPhone(father?.phone || mother?.phone || null);
        }
      } catch {}
    };
    fetchParents();
  }, [application?.student?.id, tenantId]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'submitted': return '#FF9800';
      case 'verified': return '#2196F3';
      case 'accepted': return '#4CAF50';
      case 'rejected': return '#F44336';
      case 'waitlisted': return '#9C27B0';
      default: return '#666';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading application...</Text>
      </View>
    );
  }

  if (!application) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Application not found.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={18} color="#fff" />
          <Text style={styles.retryText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const student = application.student || {};
  const hostel = application.hostel || {};
  const appliedDate = application.applied_at ? new Date(application.applied_at).toLocaleDateString() : 'N/A';

  return (
    <View style={styles.container}>
      <Header title="Application Details" onBackPress={() => navigation.goBack()} showBack={true} />

      <ScrollView style={styles.scrollView}>
        {/* Student section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconContainer, { backgroundColor: '#E3F2FD' }]}>
              <MaterialIcons name="person" size={24} color="#2196F3" />
            </View>
            <View style={styles.headerTextBlock}>
              <Text style={styles.titleText}>{student.name || `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student'}</Text>
              <Text style={styles.subText}>Admission/ID: {student.admission_no || student.student_number || student.id || 'N/A'}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(application.status) }]}>
              <Text style={styles.statusText}>{application.status}</Text>
            </View>
          </View>
          <View style={styles.row}><Text style={styles.label}>Class</Text><Text style={styles.value}>{student.class || student.class_name || 'N/A'}{student.section ? `-${student.section}` : ''}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Father's Name</Text><Text style={styles.value}>{fatherName || 'Not available'}</Text></View>
          {motherName ? <View style={styles.row}><Text style={styles.label}>Mother's Name</Text><Text style={styles.value}>{motherName}</Text></View> : null}
          {parentPhone ? <View style={styles.row}><Text style={styles.label}>Parent Phone</Text><Text style={styles.value}>{parentPhone}</Text></View> : null}
        </View>

        {/* Application section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconContainer, { backgroundColor: '#FFF3E0' }]}>
              <MaterialIcons name="assignment" size={24} color="#FF9800" />
            </View>
            <View style={styles.headerTextBlock}>
              <Text style={styles.titleText}>Application Info</Text>
              <Text style={styles.subText}>Applied on {appliedDate}</Text>
            </View>
          </View>
          <View style={styles.row}><Text style={styles.label}>Preferred Room</Text><Text style={styles.value}>{application.preferred_room_type || 'N/A'}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Remarks</Text><Text style={styles.value}>{application.remarks || '—'}</Text></View>
        </View>

        {/* Hostel section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconContainer, { backgroundColor: '#E8F5E9' }]}>
              <MaterialIcons name="hotel" size={24} color="#4CAF50" />
            </View>
            <View style={styles.headerTextBlock}>
              <Text style={styles.titleText}>Hostel</Text>
              <Text style={styles.subText}>{hostel.name || 'N/A'}</Text>
            </View>
          </View>
          <View style={styles.row}><Text style={styles.label}>Type</Text><Text style={styles.value}>{hostel.hostel_type || 'N/A'}</Text></View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  scrollView: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
  retryBtn: { marginTop: 16, backgroundColor: '#2196F3', flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
  card: { backgroundColor: '#fff', marginHorizontal: 12, marginTop: 12, borderRadius: 12, padding: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconContainer: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  headerTextBlock: { flex: 1 },
  titleText: { fontSize: 18, fontWeight: '700', color: '#333' },
  subText: { fontSize: 12, color: '#666', marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  label: { fontSize: 14, color: '#666' },
  value: { fontSize: 14, color: '#333', fontWeight: '600' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  statusText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});

export default HostelApplicationDetails;
