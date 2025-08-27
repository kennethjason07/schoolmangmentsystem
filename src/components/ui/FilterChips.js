import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Theme from '../../constants/Theme';
import Colors from '../../constants/Colors';

const FilterChip = ({ 
  label, 
  value, 
  isActive = false, 
  onPress, 
  icon,
  variant = 'default', // default, outline, compact
  showDropdown = false,
}) => {
  const getChipStyles = () => {
    if (isActive) {
      return {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
        textColor: Colors.white,
      };
    }

    switch (variant) {
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderColor: Colors.border,
          textColor: Colors.text,
        };
      case 'compact':
        return {
          backgroundColor: Colors.lightGray,
          borderColor: 'transparent',
          textColor: Colors.textSecondary,
        };
      default:
        return {
          backgroundColor: Colors.surface,
          borderColor: Colors.border,
          textColor: Colors.text,
        };
    }
  };

  const chipStyles = getChipStyles();

  return (
    <TouchableOpacity
      style={[
        styles.chip,
        variant === 'compact' && styles.chipCompact,
        {
          backgroundColor: chipStyles.backgroundColor,
          borderColor: chipStyles.borderColor,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={variant === 'compact' ? 14 : 16}
          color={chipStyles.textColor}
          style={styles.chipIcon}
        />
      )}
      
      <Text
        style={[
          styles.chipText,
          variant === 'compact' && styles.chipTextCompact,
          { color: chipStyles.textColor },
        ]}
        numberOfLines={1}
      >
        {value || label}
      </Text>
      
      {showDropdown && (
        <Ionicons
          name="chevron-down"
          size={variant === 'compact' ? 12 : 14}
          color={chipStyles.textColor}
          style={styles.dropdownIcon}
        />
      )}
    </TouchableOpacity>
  );
};

const FilterDropdown = ({
  visible,
  onClose,
  title,
  options,
  selectedValue,
  onSelect,
  searchable = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = searchable
    ? options.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  const renderOption = ({ item }) => {
    const isSelected = item.value === selectedValue;
    
    return (
      <TouchableOpacity
        style={[styles.option, isSelected && styles.optionSelected]}
        onPress={() => {
          onSelect(item);
          onClose();
        }}
      >
        <Text
          style={[
            styles.optionText,
            isSelected && styles.optionTextSelected,
          ]}
        >
          {item.label}
        </Text>
        {isSelected && (
          <Ionicons name="checkmark" size={16} color={Colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {searchable && (
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={16} color={Colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search options..."
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholderTextColor={Colors.textLight}
              />
            </View>
          )}

          <FlatList
            data={filteredOptions}
            keyExtractor={(item) => item.value.toString()}
            renderItem={renderOption}
            style={styles.optionsList}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const FilterBar = ({ 
  filters = [], 
  onFilterChange,
  variant = 'default', // default, compact
  scrollable = true,
  style,
}) => {
  const [activeDropdown, setActiveDropdown] = useState(null);

  const handleFilterPress = (filter) => {
    if (filter.options) {
      setActiveDropdown(filter);
    } else if (filter.onPress) {
      filter.onPress();
    }
  };

  const handleOptionSelect = (filter, option) => {
    onFilterChange?.(filter.key, option.value, option);
    setActiveDropdown(null);
  };

  const renderFilter = (filter, index) => (
    <FilterChip
      key={filter.key || index}
      label={filter.label}
      value={filter.displayValue || filter.value}
      isActive={filter.isActive}
      onPress={() => handleFilterPress(filter)}
      icon={filter.icon}
      variant={variant}
      showDropdown={!!filter.options}
    />
  );

  const containerStyle = [
    styles.filterBar,
    variant === 'compact' && styles.filterBarCompact,
    style,
  ];

  if (scrollable) {
    return (
      <View style={containerStyle}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {filters.map(renderFilter)}
        </ScrollView>

        {activeDropdown && (
          <FilterDropdown
            visible={true}
            onClose={() => setActiveDropdown(null)}
            title={activeDropdown.label}
            options={activeDropdown.options}
            selectedValue={activeDropdown.value}
            onSelect={(option) => handleOptionSelect(activeDropdown, option)}
            searchable={activeDropdown.searchable}
          />
        )}
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <View style={styles.filtersWrap}>
        {filters.map(renderFilter)}
      </View>

      {activeDropdown && (
        <FilterDropdown
          visible={true}
          onClose={() => setActiveDropdown(null)}
          title={activeDropdown.label}
          options={activeDropdown.options}
          selectedValue={activeDropdown.value}
          onSelect={(option) => handleOptionSelect(activeDropdown, option)}
          searchable={activeDropdown.searchable}
        />
      )}
    </View>
  );
};

const FilterSection = ({
  title,
  filters,
  onFilterChange,
  variant = 'default',
  collapsible = false,
  defaultCollapsed = false,
  style,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <View style={[styles.filterSection, style]}>
      {title && (
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={collapsible ? () => setIsCollapsed(!isCollapsed) : undefined}
          disabled={!collapsible}
        >
          <Text style={styles.sectionTitle}>{title}</Text>
          {collapsible && (
            <Ionicons
              name={isCollapsed ? 'chevron-down' : 'chevron-up'}
              size={16}
              color={Colors.textSecondary}
            />
          )}
        </TouchableOpacity>
      )}

      {(!collapsible || !isCollapsed) && (
        <FilterBar
          filters={filters}
          onFilterChange={onFilterChange}
          variant={variant}
          scrollable={variant !== 'compact'}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Filter Chip Styles
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.Spacing.md,
    paddingVertical: Theme.Spacing.sm,
    marginRight: Theme.Spacing.sm,
    marginBottom: Theme.Spacing.xs,
    borderRadius: Theme.BorderRadius.full,
    borderWidth: 1,
    minHeight: 36,
  },
  chipCompact: {
    paddingHorizontal: Theme.Spacing.sm,
    paddingVertical: Theme.Spacing.xs,
    minHeight: 28,
    borderRadius: Theme.BorderRadius.md,
    borderWidth: 0,
  },
  chipIcon: {
    marginRight: Theme.Spacing.xs,
  },
  chipText: {
    fontSize: Theme.Typography.sizes.sm,
    fontWeight: Theme.Typography.weights.medium,
    maxWidth: 120,
  },
  chipTextCompact: {
    fontSize: Theme.Typography.sizes.xs,
    maxWidth: 100,
  },
  dropdownIcon: {
    marginLeft: Theme.Spacing.xs,
  },

  // Filter Bar Styles
  filterBar: {
    paddingVertical: Theme.Spacing.xs,
  },
  filterBarCompact: {
    paddingVertical: Theme.Spacing.xs / 2,
  },
  scrollContent: {
    paddingHorizontal: Theme.Spacing.base,
  },
  filtersWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Theme.Spacing.base,
  },

  // Filter Section Styles
  filterSection: {
    backgroundColor: Colors.surface,
    marginBottom: Theme.Spacing.sm,
    borderRadius: Theme.BorderRadius.md,
    ...Theme.Shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Theme.Spacing.base,
    paddingVertical: Theme.Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionTitle: {
    fontSize: Theme.Typography.sizes.base,
    fontWeight: Theme.Typography.weights.semibold,
    color: Colors.text,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: Theme.BorderRadius.lg,
    maxHeight: '70%',
    width: '85%',
    maxWidth: 400,
    ...Theme.Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Theme.Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: Theme.Typography.sizes.lg,
    fontWeight: Theme.Typography.weights.semibold,
    color: Colors.text,
  },
  closeButton: {
    padding: Theme.Spacing.xs,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.Spacing.base,
    paddingVertical: Theme.Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: Theme.Spacing.sm,
    fontSize: Theme.Typography.sizes.base,
    color: Colors.text,
  },
  optionsList: {
    maxHeight: 300,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Theme.Spacing.base,
    paddingVertical: Theme.Spacing.md,
  },
  optionSelected: {
    backgroundColor: `${Colors.primary}10`,
  },
  optionText: {
    fontSize: Theme.Typography.sizes.base,
    color: Colors.text,
    flex: 1,
  },
  optionTextSelected: {
    color: Colors.primary,
    fontWeight: Theme.Typography.weights.medium,
  },
});

export { FilterChip, FilterBar, FilterSection, FilterDropdown };
export default FilterBar;
