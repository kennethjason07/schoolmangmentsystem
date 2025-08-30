# VidyaSethu - Feature Icons Mapping

## 🎯 **Official VidyaSethu Feature Icons**

This document maps each VidyaSethu feature to its corresponding Ionicon used in the actual app.

### 📚 **Academic Management**
- **Primary Icon**: `school`
- **Alternative Icons**: `book`, `library`
- **Colors Used**: 
  - Primary: `#4CAF50` (Green)
  - Secondary: `#2196F3` (Blue)
- **Usage**: Student & teacher profiles, classes, subjects, exams, grades

### ✅ **Attendance Tracking**
- **Primary Icon**: `checkmark-circle`
- **Alternative Icons**: `time`, `calendar`, `close-circle` (for absent)
- **Colors Used**:
  - Present: `#4CAF50` (Green)
  - Absent: `#F44336` (Red)
  - Late: `#FF9800` (Orange)
- **Usage**: Daily attendance for students & staff with analytics

### 💰 **Finance & Fees**
- **Primary Icon**: `card`
- **Alternative Icons**: `receipt-outline`, `cash`, `wallet`
- **Colors Used**:
  - Primary: `#2196F3` (Blue)
  - Success: `#4CAF50` (Green)
  - Warning: `#FF9800` (Orange)
- **Usage**: Digital fee collection, expense tracking, reports

### 💬 **Communication**
- **Primary Icon**: `chatbubbles`
- **Alternative Icons**: `send`, `notifications`, `mail`
- **Colors Used**:
  - Primary: `#9C27B0` (Purple)
  - Active: `#F44336` (Red for notifications)
  - Send: `#2196F3` (Blue)
- **Usage**: In-App chat, SMS & WhatsApp notifications

### 📊 **Reports & Analytics**
- **Primary Icon**: `bar-chart`
- **Alternative Icons**: `analytics`, `trending-up`, `document-text`
- **Colors Used**:
  - Primary: `#2196F3` (Blue)
  - Success: `#4CAF50` (Green)
  - Charts: `#FF9800` (Orange)
- **Usage**: Real-time dashboards, report cards, custom reports

### ⚙️ **Administration Tools**
- **Primary Icon**: `people`
- **Alternative Icons**: `person`, `settings`, `cog`
- **Colors Used**:
  - Primary: `#2196F3` (Blue)
  - Management: `#FF9800` (Orange)
- **Usage**: Roles, events, tasks, leave management

### 📱 **Mobile-Friendly**
- **Primary Icon**: `phone-portrait`
- **Alternative Icons**: `desktop`, `tablet-portrait`, `devices`
- **Colors Used**:
  - Primary: `#2196F3` (Blue)
  - Multi-platform: `#4CAF50` (Green)
- **Usage**: Access anytime via app with live updates

## 🎨 **VidyaSethu Brand Colors**

### Primary Palette
- **Blue**: `#2196F3` - Primary actions, headers, main UI
- **Green**: `#4CAF50` - Success states, attendance present, positive actions
- **Orange**: `#FF9800` - Warnings, pending states, highlights
- **Purple**: `#9C27B0` - Special features, notifications, premium
- **Red**: `#F44336` - Errors, absent status, urgent items

### Secondary Palette
- **Light Blue**: `#E3F2FD` - Backgrounds, subtle highlights
- **Light Green**: `#E8F5E8` - Success backgrounds
- **Light Orange**: `#FFF3E0` - Warning backgrounds
- **Light Purple**: `#F3E5F5` - Special backgrounds
- **Light Red**: `#FFEBEE` - Error backgrounds

## 📦 **Icon Sizes Used in App**
- **Small**: 16px, 18px, 20px (buttons, inline elements)
- **Medium**: 22px, 24px (main actions, headers)
- **Large**: 32px, 48px, 64px (dashboard, feature cards)

## 🔗 **Ionicons Library**
- **Library**: @expo/vector-icons (Ionicons)
- **Version**: Latest stable
- **Format**: Vector icons (scalable)
- **Platform**: Cross-platform (iOS, Android, Web)

## 📄 **Usage Examples**

### In React Native Code:
```jsx
import { Ionicons } from '@expo/vector-icons';

// Academic Management
<Ionicons name="school" size={24} color="#4CAF50" />

// Attendance Tracking
<Ionicons name="checkmark-circle" size={22} color="#4CAF50" />

// Finance & Fees
<Ionicons name="card" size={20} color="#2196F3" />

// Communication
<Ionicons name="chatbubbles" size={20} color="#9C27B0" />

// Reports & Analytics
<Ionicons name="bar-chart" size={20} color="#2196F3" />

// Administration Tools
<Ionicons name="people" size={24} color="#2196F3" />

// Mobile-Friendly
<Ionicons name="phone-portrait" size={20} color="#2196F3" />
```

### For Brochures/Web:
Use the exported SVG or PNG versions from the `/exports` folder with the exact same colors and sizing guidelines.

---

**Note**: These icons are directly extracted from the VidyaSethu app codebase to ensure 100% consistency between marketing materials and the actual application interface.
