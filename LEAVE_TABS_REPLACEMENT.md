# Leave Management Filter Tabs - Compact Replacement

## 🎯 Problem
Your current filter tabs in LeaveManagement.js are **~60px tall** and taking up too much screen space.

## ✅ Solution
Replace them with **CompactTabs** that are only **~40px tall** (33% space reduction).

## 📝 Step-by-Step Replacement

### 1. Add Import
Add this import at the top of your LeaveManagement.js file:

```javascript
import { CompactTabs } from '../../components/ui';
```

### 2. Replace the Filter Tabs Section

**Find this code (lines 368-387):**
```javascript
{/* Filter Tabs */}
<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
  {statusFilters.map((status) => (
    <TouchableOpacity
      key={status}
      style={[
        styles.filterTab,
        selectedStatus === status && styles.activeFilterTab
      ]}
      onPress={() => setSelectedStatus(status)}
    >
      <Text style={[
        styles.filterTabText,
        selectedStatus === status && styles.activeFilterTabText
      ]}>
        {status}
      </Text>
    </TouchableOpacity>
  ))}
</ScrollView>
```

**Replace it with:**
```javascript
{/* Compact Filter Tabs */}
<CompactTabs
  tabs={statusFilters.map(status => {
    // Add badge counts for pending items
    let badge = undefined;
    if (status === 'Pending') {
      badge = filteredApplications.filter(app => app.status === 'Pending').length;
      badge = badge > 0 ? badge : undefined; // Hide badge if 0
    }
    
    return {
      label: status,
      value: status,
      badge: badge,
    };
  })}
  activeTab={selectedStatus}
  onTabChange={setSelectedStatus}
  variant="default"
  scrollable={true}
  showBorder={true}
  style={{
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  }}
/>
```

### 3. Remove Old Styles

**Find and DELETE these style definitions (lines 802-838):**
```javascript
filterContainer: {
  backgroundColor: '#FFFFFF',
  paddingVertical: 12,
  paddingHorizontal: 15,
  borderBottomWidth: 1,
  borderBottomColor: '#E2E8F0',
  elevation: 2,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 3,
},
filterTab: {
  paddingHorizontal: 18,
  paddingVertical: 10,
  marginRight: 12,
  borderRadius: 25,
  backgroundColor: '#F1F5F9',
  borderWidth: 1,
  borderColor: '#E2E8F0',
},
activeFilterTab: {
  backgroundColor: '#3B82F6',
  borderColor: '#3B82F6',
  elevation: 3,
  shadowColor: '#3B82F6',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
},
filterTabText: {
  fontSize: 14,
  color: '#666',
},
activeFilterTabText: {
  color: '#FFFFFF',
},
```

## 🎨 Alternative Styles

### Option 1: Pills Style (Most Compact - 28px height)
```javascript
<CompactTabs
  tabs={statusFilters.map(status => ({
    label: status,
    value: status,
    badge: status === 'Pending' ? pendingCount : undefined,
  }))}
  activeTab={selectedStatus}
  onTabChange={setSelectedStatus}
  variant="pills"  // <-- Pills variant
  scrollable={true}
  showBorder={false}
  style={{
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
  }}
/>
```

### Option 2: Minimal Style (36px height with underlines)
```javascript
<CompactTabs
  tabs={statusFilters.map(status => ({
    label: status,
    value: status,
    badge: status === 'Pending' ? pendingCount : undefined,
  }))}
  activeTab={selectedStatus}
  onTabChange={setSelectedStatus}
  variant="minimal"  // <-- Minimal variant
  scrollable={true}
  showBorder={true}
  style={{
    backgroundColor: '#FFFFFF',
  }}
/>
```

## 📊 Before vs After Comparison

| Aspect | Before (Bulky) | After (Compact) | Improvement |
|--------|----------------|-----------------|-------------|
| **Height** | ~60px | ~40px | **33% reduction** |
| **Padding** | 12px vertical | 4px vertical | **67% reduction** |
| **Tab Height** | 20px + 10px padding | 32px total | **More efficient** |
| **Visual** | Heavy, lots of whitespace | Clean, modern | **Better UX** |
| **Badges** | None | Dynamic counts | **More informative** |

## 🚀 Benefits

✅ **Space Efficient**: 33% less height usage  
✅ **Modern Design**: Clean, chip-based appearance  
✅ **Badge Support**: Shows pending count automatically  
✅ **Better Touch**: Improved touch targets and feedback  
✅ **Consistent**: Matches your new UI theme system  
✅ **Responsive**: Works great on all screen sizes  

## 🔧 Optional Enhancements

### Add Dynamic Badge Counts
```javascript
// Calculate counts for badges
const getStatusCount = (status) => {
  if (status === 'All') return undefined;
  return leaveApplications.filter(app => app.status === status).length || undefined;
};

// Use in tabs
tabs={statusFilters.map(status => ({
  label: status,
  value: status,
  badge: getStatusCount(status),
}))}
```

### Add Icons to Tabs
```javascript
const statusIcons = {
  All: 'list',
  Pending: 'time',
  Approved: 'checkmark-circle',
  Rejected: 'close-circle',
};

tabs={statusFilters.map(status => ({
  label: status,
  value: status,
  icon: statusIcons[status],
  badge: getStatusCount(status),
}))}
```

## 💡 Pro Tips

1. **Test all variants** - Try `default`, `pills`, and `minimal` to see which fits your app best
2. **Consider badges** - They provide useful information about pending items
3. **Consistent styling** - Use the same variant across similar screens
4. **Accessibility** - The new tabs have better touch targets and screen reader support

---

This replacement will make your Leave Management screen much more space-efficient while maintaining all functionality and improving the user experience!
