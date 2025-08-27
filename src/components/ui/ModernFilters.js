import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  PanGestureHandler,
  State,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Theme from '../../constants/Theme';
import Colors from '../../constants/Colors';

const { width, height } = Dimensions.get('window');

// Floating Action Filter Button
const FloatingFilterButton = ({ onPress, hasActiveFilters = false, filterCount = 0 }) => {
  const scaleValue = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleValue, { toValue: 0.9, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, { toValue: 1, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={[styles.floatingButton, { transform: [{ scale: scaleValue }] }]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.floatingButtonTouchable}
      >
        <LinearGradient
          colors={hasActiveFilters ? ['#667eea', '#764ba2'] : ['#f093fb', '#f5576c']}
          style={styles.floatingButtonGradient}
        >
          <Ionicons 
            name="options" 
            size={24} 
            color={Colors.white} 
          />
          {filterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{filterCount}</Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Quick Filter Chips (Top Bar)
const QuickFilterChips = ({ filters, activeFilters, onFilterToggle, style }) => {
  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={[styles.quickFilters, style]}
      contentContainerStyle={styles.quickFiltersContent}
    >
      {filters.map((filter) => {
        const isActive = activeFilters.includes(filter.key);
        return (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.quickChip,
              isActive && styles.quickChipActive,
            ]}
            onPress={() => onFilterToggle(filter.key)}
          >
            {filter.icon && (
              <Ionicons
                name={filter.icon}
                size={14}
                color={isActive ? Colors.white : Colors.primary}
                style={styles.quickChipIcon}
              />
            )}
            <Text
              style={[
                styles.quickChipText,
                isActive && styles.quickChipTextActive,
              ]}
            >
              {filter.label}
            </Text>
            {filter.count > 0 && (
              <View style={[styles.quickChipBadge, isActive && styles.quickChipBadgeActive]}>
                <Text style={[styles.quickChipBadgeText, isActive && styles.quickChipBadgeTextActive]}>
                  {filter.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

// Advanced Filter Panel (Sliding from bottom)
const FilterPanel = ({ visible, onClose, filters, selectedFilters, onFiltersChange, onClearAll }) => {
  const translateY = useRef(new Animated.Value(height)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 8,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: height,
          useNativeDriver: true,
          tension: 65,
          friction: 8,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const renderFilterSection = (section) => (
    <View key={section.title} style={styles.filterSection}>
      <Text style={styles.filterSectionTitle}>{section.title}</Text>
      <View style={styles.filterOptions}>
        {section.options.map((option) => {
          const isSelected = selectedFilters[section.key] === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.filterOption,
                isSelected && styles.filterOptionSelected,
              ]}
              onPress={() => onFiltersChange(section.key, option.value)}
            >
              {option.icon && (
                <Ionicons
                  name={option.icon}
                  size={18}
                  color={isSelected ? Colors.white : Colors.textSecondary}
                  style={styles.filterOptionIcon}
                />
              )}
              <Text
                style={[
                  styles.filterOptionText,
                  isSelected && styles.filterOptionTextSelected,
                ]}
              >
                {option.label}
              </Text>
              {option.count && (
                <View style={[styles.optionBadge, isSelected && styles.optionBadgeSelected]}>
                  <Text style={[styles.optionBadgeText, isSelected && styles.optionBadgeTextSelected]}>
                    {option.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={styles.modalContainer}>
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            activeOpacity={1}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.panel,
            { transform: [{ translateY }] },
          ]}
        >
          {/* Panel Header */}
          <View style={styles.panelHeader}>
            <View style={styles.panelHandle} />
            <View style={styles.panelHeaderContent}>
              <Text style={styles.panelTitle}>Filter Options</Text>
              <View style={styles.panelHeaderActions}>
                <TouchableOpacity onPress={onClearAll} style={styles.clearButton}>
                  <Text style={styles.clearButtonText}>Clear All</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Filter Content */}
          <ScrollView style={styles.panelContent} showsVerticalScrollIndicator={false}>
            {filters.map(renderFilterSection)}
            
            {/* Apply Button */}
            <TouchableOpacity style={styles.applyButton} onPress={onClose}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.applyButtonGradient}
              >
                <Text style={styles.applyButtonText}>Apply Filters</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

// Smart Search Filter Bar
const SmartSearchBar = ({ onSearch, placeholder = "Search...", filters = [] }) => {
  const [searchText, setSearchText] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const suggestions = searchText.length > 0 ? 
    filters.filter(f => f.label.toLowerCase().includes(searchText.toLowerCase())).slice(0, 3) : [];

  return (
    <View style={styles.searchContainer}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder={placeholder}
          placeholderTextColor={Colors.textLight}
          value={searchText}
          onChangeText={(text) => {
            setSearchText(text);
            setShowSuggestions(text.length > 0);
            onSearch?.(text);
          }}
          onFocus={() => setShowSuggestions(searchText.length > 0)}
        />
        {searchText.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setSearchText('');
              setShowSuggestions(false);
              onSearch?.('');
            }}
          >
            <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestions}>
          {suggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestion}
              onPress={() => {
                setSearchText(suggestion.label);
                setShowSuggestions(false);
                onSearch?.(suggestion.label);
              }}
            >
              <Ionicons name="search" size={16} color={Colors.textLight} />
              <Text style={styles.suggestionText}>{suggestion.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

// Active Filters Display
const ActiveFiltersBar = ({ activeFilters, onRemoveFilter, onClearAll }) => {
  if (activeFilters.length === 0) return null;

  return (
    <View style={styles.activeFiltersContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {activeFilters.map((filter, index) => (
          <View key={index} style={styles.activeFilter}>
            <Text style={styles.activeFilterText}>{filter.label}</Text>
            <TouchableOpacity
              onPress={() => onRemoveFilter(filter)}
              style={styles.removeFilterButton}
            >
              <Ionicons name="close" size={16} color={Colors.white} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
      <TouchableOpacity onPress={onClearAll} style={styles.clearAllButton}>
        <Text style={styles.clearAllText}>Clear All</Text>
      </TouchableOpacity>
    </View>
  );
};

// Main Modern Filter Component
const ModernFilters = ({
  quickFilters = [],
  advancedFilters = [],
  onFiltersChange,
  onSearch,
  searchPlaceholder,
  showFloatingButton = true,
  showQuickFilters = true,
  showSearchBar = true,
  style,
}) => {
  const [showPanel, setShowPanel] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [activeQuickFilters, setActiveQuickFilters] = useState([]);
  const [activeFilters, setActiveFilters] = useState([]);

  const handleQuickFilterToggle = (filterKey) => {
    const newActiveFilters = activeQuickFilters.includes(filterKey)
      ? activeQuickFilters.filter(key => key !== filterKey)
      : [...activeQuickFilters, filterKey];
    
    setActiveQuickFilters(newActiveFilters);
    onFiltersChange?.('quick', newActiveFilters);
  };

  const handleAdvancedFilterChange = (sectionKey, value) => {
    const newFilters = { ...selectedFilters, [sectionKey]: value };
    setSelectedFilters(newFilters);
    onFiltersChange?.('advanced', newFilters);
  };

  const handleClearAll = () => {
    setSelectedFilters({});
    setActiveQuickFilters([]);
    setActiveFilters([]);
    onFiltersChange?.('clear');
  };

  const getActiveFilterCount = () => {
    return activeQuickFilters.length + Object.keys(selectedFilters).length;
  };

  return (
    <View style={[styles.container, style]}>
      {showSearchBar && (
        <SmartSearchBar
          onSearch={onSearch}
          placeholder={searchPlaceholder}
          filters={quickFilters}
        />
      )}

      {showQuickFilters && quickFilters.length > 0 && (
        <QuickFilterChips
          filters={quickFilters}
          activeFilters={activeQuickFilters}
          onFilterToggle={handleQuickFilterToggle}
        />
      )}

      <ActiveFiltersBar
        activeFilters={activeFilters}
        onRemoveFilter={(filter) => {
          // Handle removing specific filter
        }}
        onClearAll={handleClearAll}
      />

      {showFloatingButton && (
        <FloatingFilterButton
          onPress={() => setShowPanel(true)}
          hasActiveFilters={getActiveFilterCount() > 0}
          filterCount={getActiveFilterCount()}
        />
      )}

      <FilterPanel
        visible={showPanel}
        onClose={() => setShowPanel(false)}
        filters={advancedFilters}
        selectedFilters={selectedFilters}
        onFiltersChange={handleAdvancedFilterChange}
        onClearAll={handleClearAll}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },

  // Search Bar
  searchContainer: {
    position: 'relative',
    marginHorizontal: Theme.Spacing.base,
    marginVertical: Theme.Spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Theme.BorderRadius.lg,
    paddingHorizontal: Theme.Spacing.base,
    paddingVertical: Theme.Spacing.md,
    ...Theme.Shadows.sm,
  },
  searchInput: {
    flex: 1,
    marginHorizontal: Theme.Spacing.sm,
    fontSize: Theme.Typography.sizes.base,
    color: Colors.text,
  },
  suggestions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderRadius: Theme.BorderRadius.md,
    marginTop: Theme.Spacing.xs,
    ...Theme.Shadows.md,
    zIndex: 1000,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  suggestionText: {
    marginLeft: Theme.Spacing.sm,
    fontSize: Theme.Typography.sizes.sm,
    color: Colors.text,
  },

  // Quick Filters
  quickFilters: {
    backgroundColor: Colors.background,
    paddingVertical: Theme.Spacing.sm,
  },
  quickFiltersContent: {
    paddingHorizontal: Theme.Spacing.base,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Theme.BorderRadius.full,
    paddingHorizontal: Theme.Spacing.md,
    paddingVertical: Theme.Spacing.sm,
    marginRight: Theme.Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  quickChipIcon: {
    marginRight: Theme.Spacing.xs,
  },
  quickChipText: {
    fontSize: Theme.Typography.sizes.sm,
    fontWeight: Theme.Typography.weights.medium,
    color: Colors.text,
  },
  quickChipTextActive: {
    color: Colors.white,
  },
  quickChipBadge: {
    backgroundColor: Colors.primary,
    borderRadius: Theme.BorderRadius.full,
    minWidth: 16,
    height: 16,
    marginLeft: Theme.Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChipBadgeActive: {
    backgroundColor: Colors.white,
  },
  quickChipBadgeText: {
    fontSize: 10,
    fontWeight: Theme.Typography.weights.bold,
    color: Colors.white,
  },
  quickChipBadgeTextActive: {
    color: Colors.primary,
  },

  // Active Filters
  activeFiltersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.Spacing.base,
    paddingVertical: Theme.Spacing.sm,
    backgroundColor: `${Colors.primary}10`,
  },
  activeFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Theme.BorderRadius.base,
    paddingHorizontal: Theme.Spacing.sm,
    paddingVertical: Theme.Spacing.xs,
    marginRight: Theme.Spacing.xs,
  },
  activeFilterText: {
    fontSize: Theme.Typography.sizes.xs,
    color: Colors.white,
    marginRight: Theme.Spacing.xs,
  },
  removeFilterButton: {
    padding: 2,
  },
  clearAllButton: {
    marginLeft: Theme.Spacing.sm,
  },
  clearAllText: {
    fontSize: Theme.Typography.sizes.sm,
    color: Colors.primary,
    fontWeight: Theme.Typography.weights.medium,
  },

  // Floating Button
  floatingButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 100,
  },
  floatingButtonTouchable: {
    borderRadius: 28,
    ...Theme.Shadows.lg,
  },
  floatingButtonGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: Theme.Typography.weights.bold,
    color: Colors.white,
  },

  // Filter Panel
  modalContainer: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Theme.BorderRadius['2xl'],
    borderTopRightRadius: Theme.BorderRadius['2xl'],
    maxHeight: height * 0.8,
  },
  panelHeader: {
    paddingHorizontal: Theme.Spacing.base,
    paddingTop: Theme.Spacing.md,
    paddingBottom: Theme.Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  panelHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Theme.Spacing.md,
  },
  panelHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  panelTitle: {
    fontSize: Theme.Typography.sizes.xl,
    fontWeight: Theme.Typography.weights.bold,
    color: Colors.text,
  },
  panelHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearButton: {
    marginRight: Theme.Spacing.md,
  },
  clearButtonText: {
    fontSize: Theme.Typography.sizes.sm,
    color: Colors.error,
    fontWeight: Theme.Typography.weights.medium,
  },
  closeButton: {
    padding: Theme.Spacing.xs,
  },
  panelContent: {
    flex: 1,
    paddingHorizontal: Theme.Spacing.base,
  },

  // Filter Sections
  filterSection: {
    marginVertical: Theme.Spacing.base,
  },
  filterSectionTitle: {
    fontSize: Theme.Typography.sizes.lg,
    fontWeight: Theme.Typography.weights.semibold,
    color: Colors.text,
    marginBottom: Theme.Spacing.md,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Theme.BorderRadius.base,
    paddingHorizontal: Theme.Spacing.md,
    paddingVertical: Theme.Spacing.sm,
    marginRight: Theme.Spacing.sm,
    marginBottom: Theme.Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterOptionSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterOptionIcon: {
    marginRight: Theme.Spacing.xs,
  },
  filterOptionText: {
    fontSize: Theme.Typography.sizes.sm,
    color: Colors.text,
    fontWeight: Theme.Typography.weights.medium,
  },
  filterOptionTextSelected: {
    color: Colors.white,
  },
  optionBadge: {
    backgroundColor: Colors.primary,
    borderRadius: Theme.BorderRadius.full,
    minWidth: 16,
    height: 16,
    marginLeft: Theme.Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBadgeSelected: {
    backgroundColor: Colors.white,
  },
  optionBadgeText: {
    fontSize: 10,
    fontWeight: Theme.Typography.weights.bold,
    color: Colors.white,
  },
  optionBadgeTextSelected: {
    color: Colors.primary,
  },

  // Apply Button
  applyButton: {
    marginVertical: Theme.Spacing.lg,
    borderRadius: Theme.BorderRadius.base,
    overflow: 'hidden',
  },
  applyButtonGradient: {
    paddingVertical: Theme.Spacing.base,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: Theme.Typography.sizes.lg,
    fontWeight: Theme.Typography.weights.semibold,
    color: Colors.white,
  },
});

export default ModernFilters;
export { FloatingFilterButton, QuickFilterChips, FilterPanel, SmartSearchBar, ActiveFiltersBar };
