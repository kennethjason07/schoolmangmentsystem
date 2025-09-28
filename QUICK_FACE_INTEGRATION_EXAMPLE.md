# Quick Facial Recognition Integration Examples

Here are specific code examples to integrate facial recognition into your existing screens.

## 1. Add to AdminDashboard.js

Add this to your AdminDashboard imports:
```javascript
import FaceEnrollmentModal from '../../components/FacialRecognition/FaceEnrollmentModal';
import FaceRecognitionService from '../../services/FaceRecognitionService';
```

Add this state to AdminDashboard:
```javascript
const [faceEnrollmentModal, setFaceEnrollmentModal] = useState({
  visible: false,
  person: null
});
const [faceStats, setFaceStats] = useState(null);
```

Add this function to load face recognition stats:
```javascript
const loadFaceRecognitionStats = async () => {
  try {
    const tenantId = getCachedTenantId();
    const stats = await FaceRecognitionService.getRecognitionStats(tenantId);
    setFaceStats(stats);
  } catch (error) {
    console.error('Failed to load face recognition stats:', error);
  }
};
```

Add this to your dashboard cards (around line 600-700):
```javascript
// Add this card to your dashboard grid
const renderFaceRecognitionCard = () => (
  <TouchableOpacity 
    style={styles.dashboardCard}
    onPress={() => navigateWithFeatureCheck('Face Recognition', 'FaceRecognitionManagement')}
  >
    <View style={styles.cardHeader}>
      <Ionicons name="scan" size={24} color="#4A90E2" />
      <Text style={styles.cardTitle}>Face Recognition</Text>
    </View>
    {faceStats && (
      <View style={styles.cardContent}>
        <Text style={styles.cardSubtext}>
          Active Templates: {faceStats.active_student_templates + faceStats.active_teacher_templates}
        </Text>
        <Text style={styles.cardSubtext}>
          Success Rate: {
            faceStats.successful_recognitions_30d && faceStats.failed_recognitions_30d
              ? Math.round(
                  (faceStats.successful_recognitions_30d / 
                   (faceStats.successful_recognitions_30d + faceStats.failed_recognitions_30d)) * 100
                )
              : 0
          }%
        </Text>
      </View>
    )}
  </TouchableOpacity>
);

// Add to your dashboard grid
{renderFaceRecognitionCard()}
```

Add to your useEffect (where you load other data):
```javascript
useEffect(() => {
  // ... existing code
  loadFaceRecognitionStats();
}, [tenantId]);
```

## 2. Add to TakeAttendanceOptimized.js

Add these imports to TakeAttendanceOptimized.js:
```javascript
import FaceAttendanceModal from '../../components/FacialRecognition/FaceAttendanceModal';
```

Add this state (around line 50):
```javascript
const [showFaceRecognition, setShowFaceRecognition] = useState(false);
const [useFaceRecognition, setUseFaceRecognition] = useState(false);
```

Add this function to handle face recognition results:
```javascript
const handleStudentRecognized = ({ studentId, confidence, attendance }) => {
  // Update attendance state to reflect the face recognition result
  setAttendanceMark(prev => ({
    ...prev,
    [studentId]: {
      status: 'Present',
      verification: 'facial_recognition',
      confidence: confidence
    }
  }));
  
  // Show success message
  Alert.alert(
    'Student Recognized!',
    `Attendance marked with ${Math.round(confidence * 100)}% confidence.`
  );
};
```

Add face recognition toggle (around line 800, in your header area):
```javascript
<View style={styles.faceRecognitionToggle}>
  <Switch
    value={useFaceRecognition}
    onValueChange={setUseFaceRecognition}
    trackColor={{ false: '#767577', true: '#007AFF' }}
    thumbColor={useFaceRecognition ? '#fff' : '#f4f3f4'}
  />
  <Text style={styles.toggleLabel}>Use Face Recognition</Text>
</View>
```

Add face recognition button (replace manual Present/Absent buttons when enabled):
```javascript
{useFaceRecognition ? (
  <TouchableOpacity
    style={[styles.attendanceButton, styles.faceButton]}
    onPress={() => setShowFaceRecognition(true)}
  >
    <Ionicons name="scan" size={16} color="white" />
    <Text style={styles.buttonText}>Face Check</Text>
  </TouchableOpacity>
) : (
  // Your existing Present/Absent buttons
  <>
    <TouchableOpacity
      style={[styles.attendanceButton, styles.presentButton]}
      onPress={() => markAttendance(student.id, 'Present')}
    >
      <Text style={styles.buttonText}>Present</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.attendanceButton, styles.absentButton]}
      onPress={() => markAttendance(student.id, 'Absent')}
    >
      <Text style={styles.buttonText}>Absent</Text>
    </TouchableOpacity>
  </>
)}
```

Add the modal at the end of your render method:
```javascript
<FaceAttendanceModal
  isVisible={showFaceRecognition}
  onClose={() => setShowFaceRecognition(false)}
  onStudentRecognized={handleStudentRecognized}
  selectedClass={selectedClass}
  selectedDate={selectedDate}
  tenantId={getCachedTenantId()}
/>
```

## 3. Add to AttendanceManagement.js

Add verification method display to your attendance records:

Add this function to render verification method:
```javascript
const renderVerificationMethod = (record) => {
  const method = record.verification_method;
  const confidence = record.recognition_confidence;
  
  switch (method) {
    case 'facial_recognition':
      return (
        <View style={styles.verificationBadge}>
          <Ionicons name="scan" size={14} color="#4CAF50" />
          <Text style={[styles.verificationText, { color: '#4CAF50' }]}>
            Face ({Math.round((confidence || 0) * 100)}%)
          </Text>
        </View>
      );
    case 'manual':
      return (
        <View style={styles.verificationBadge}>
          <Ionicons name="create" size={14} color="#FF9800" />
          <Text style={[styles.verificationText, { color: '#FF9800' }]}>
            Manual
          </Text>
        </View>
      );
    case 'hybrid':
      return (
        <View style={styles.verificationBadge}>
          <Ionicons name="checkmark-done" size={14} color="#2196F3" />
          <Text style={[styles.verificationText, { color: '#2196F3' }]}>
            Verified
          </Text>
        </View>
      );
    default:
      return null;
  }
};
```

Add filter for verification method:
```javascript
const [verificationFilter, setVerificationFilter] = useState('all');

// Add filter buttons
<View style={styles.filterRow}>
  {['all', 'manual', 'facial_recognition', 'hybrid'].map(method => (
    <TouchableOpacity
      key={method}
      onPress={() => setVerificationFilter(method)}
      style={[
        styles.filterButton,
        verificationFilter === method && styles.filterButtonActive
      ]}
    >
      <Text style={[
        styles.filterButtonText,
        verificationFilter === method && styles.filterButtonTextActive
      ]}>
        {method === 'all' ? 'All' : 
         method === 'facial_recognition' ? 'Face' : 
         method === 'manual' ? 'Manual' : 'Hybrid'}
      </Text>
    </TouchableOpacity>
  ))}
</View>
```

## 4. Required Styles

Add these styles to your StyleSheet:

```javascript
faceRecognitionToggle: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 16,
  paddingVertical: 8,
  backgroundColor: '#f8f9fa',
  borderRadius: 8,
  marginVertical: 8,
},
toggleLabel: {
  marginLeft: 8,
  fontSize: 14,
  color: '#333',
},
faceButton: {
  backgroundColor: '#007AFF',
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 6,
},
verificationBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 8,
  paddingVertical: 4,
  backgroundColor: '#f8f9fa',
  borderRadius: 12,
  marginTop: 4,
},
verificationText: {
  fontSize: 12,
  marginLeft: 4,
  fontWeight: '500',
},
filterRow: {
  flexDirection: 'row',
  paddingHorizontal: 16,
  paddingVertical: 8,
},
filterButton: {
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 15,
  backgroundColor: '#f0f0f0',
  marginRight: 8,
},
filterButtonActive: {
  backgroundColor: '#007AFF',
},
filterButtonText: {
  fontSize: 12,
  color: '#666',
},
filterButtonTextActive: {
  color: 'white',
},
dashboardCard: {
  backgroundColor: 'white',
  padding: 16,
  borderRadius: 12,
  marginBottom: 16,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
},
cardHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 8,
},
cardTitle: {
  fontSize: 16,
  fontWeight: '600',
  color: '#1a1a1a',
  marginLeft: 8,
},
cardContent: {
  marginTop: 8,
},
cardSubtext: {
  fontSize: 12,
  color: '#666',
  marginTop: 2,
},
```

## 5. Test the Integration

1. **Start your development server**
2. **Navigate to Teacher → Take Attendance**
3. **Toggle "Use Face Recognition" on**
4. **Tap "Face Check" instead of manual buttons**
5. **Follow the camera flow to test recognition**

## 6. Enrollment Flow (Admin)

Add an "Enroll Face" button to your student/teacher management screens:

```javascript
const openFaceEnrollment = (person) => {
  setFaceEnrollmentModal({
    visible: true,
    person: {
      id: person.id,
      name: person.name,
      type: 'student', // or 'teacher'
      admission_no: person.admission_no,
      class_name: person.class_name
    }
  });
};

// In your student/teacher list item
<TouchableOpacity
  style={styles.enrollButton}
  onPress={() => openFaceEnrollment(item)}
>
  <Ionicons name="scan" size={16} color="#007AFF" />
  <Text>Enroll Face</Text>
</TouchableOpacity>
```

That's it! Your facial recognition system will now work alongside your existing attendance system with fallback to manual entry when recognition fails.