# Modern UI System Guide

This guide covers the enhanced UI system implemented for the School Management System, providing modern, consistent, and accessible components.

## 🎨 Overview

The new UI system includes:
- **Enhanced Theme System** - Consistent colors, typography, spacing, and shadows
- **Modern Components** - Button, Card, Input, LoadingState, EmptyState, and enhanced StatCard
- **Role-based Theming** - Different color schemes for Admin, Teacher, Student, and Parent roles
- **Responsive Design** - Components adapt to different screen sizes
- **Accessibility** - Built with accessibility best practices

## 📁 File Structure

```
src/
├── constants/
│   ├── Colors.js (existing - enhanced)
│   └── Theme.js (new - comprehensive theme system)
└── components/
    └── ui/
        ├── index.js (exports all components)
        ├── Button.js
        ├── Card.js
        ├── Input.js
        ├── LoadingState.js
        ├── EmptyState.js
        ├── StatCard.js (enhanced version)
        └── UIDemo.js (demonstration component)
```

## 🎯 Theme System

### Import the Theme
```javascript
import Theme from '../constants/Theme';
import Colors from '../constants/Colors';
```

### Typography
```javascript
// Use predefined text styles
<Text style={Theme.TextStyles.h1}>Main Heading</Text>
<Text style={Theme.TextStyles.body}>Body text</Text>
<Text style={Theme.TextStyles.caption}>Small caption</Text>

// Or access individual properties
fontSize: Theme.Typography.sizes.lg,
fontWeight: Theme.Typography.weights.bold,
```

### Spacing
```javascript
// Consistent spacing values
padding: Theme.Spacing.base, // 16px
margin: Theme.Spacing.lg,    // 20px
gap: Theme.Spacing.md,       // 12px
```

### Colors
```javascript
// Use semantic color names
backgroundColor: Colors.surface,
color: Colors.text,
borderColor: Colors.border,

// Role-based colors (automatically applied based on user type)
backgroundColor: Theme.RoleThemes.admin.primary,
```

## 🔧 Components

### Button Component

```javascript
import { Button } from '../components/ui';

// Basic usage
<Button 
  title="Click Me" 
  onPress={handlePress} 
/>

// With variants
<Button 
  title="Primary" 
  variant="primary" 
  onPress={handlePress} 
/>

<Button 
  title="Outline" 
  variant="outline" 
  onPress={handlePress} 
/>

// With icons and loading
<Button 
  title="Save" 
  icon="checkmark"
  loading={isLoading}
  onPress={handleSave} 
/>

// Gradient button
<Button 
  title="Premium Action" 
  variant="primary"
  gradient
  fullWidth
  onPress={handlePress} 
/>
```

**Props:**
- `title` (string) - Button text
- `onPress` (function) - Press handler
- `variant` - 'primary', 'secondary', 'outline', 'ghost', 'danger', 'success'
- `size` - 'small', 'medium', 'large'
- `disabled` (boolean)
- `loading` (boolean)
- `icon` (string) - Ionicon name
- `iconPosition` - 'left', 'right'
- `fullWidth` (boolean)
- `gradient` (boolean)

### Card Component

```javascript
import { Card } from '../components/ui';

// Basic card
<Card>
  <Text>Card content</Text>
</Card>

// Interactive card
<Card onPress={handleCardPress}>
  <Text>Tappable card</Text>
</Card>

// Different variants
<Card variant="elevated">
  <Text>Elevated card with shadow</Text>
</Card>

<Card variant="outlined">
  <Text>Card with border</Text>
</Card>

<Card variant="gradient" gradientColors={['#FF6B6B', '#4ECDC4']}>
  <Text style={{ color: 'white' }}>Gradient card</Text>
</Card>
```

**Props:**
- `variant` - 'default', 'elevated', 'outlined', 'gradient'
- `padding` - 'none', 'small', 'medium', 'large'
- `margin` - 'none', 'small', 'medium', 'large'
- `onPress` (function) - Makes card interactive
- `gradientColors` (array) - Colors for gradient variant
- `backgroundColor`, `borderColor` - Custom colors

### Input Component

```javascript
import { Input } from '../components/ui';

// Basic input
<Input 
  label="Email"
  value={email}
  onChangeText={setEmail}
  placeholder="Enter your email"
/>

// With validation
<Input 
  label="Password"
  value={password}
  onChangeText={setPassword}
  secureTextEntry
  error={passwordError}
  helperText="Must be at least 8 characters"
/>

// With icons
<Input 
  label="Search"
  leftIcon="search"
  rightIcon="close"
  onRightIconPress={clearSearch}
/>

// Different variants
<Input 
  label="Description"
  variant="filled"
  multiline
  numberOfLines={4}
  maxLength={500}
/>
```

**Props:**
- `label` (string)
- `value` (string)
- `onChangeText` (function)
- `placeholder` (string)
- `error` (string) - Error message
- `success` (boolean) - Success state
- `helperText` (string)
- `leftIcon`, `rightIcon` (string) - Ionicon names
- `secureTextEntry` (boolean)
- `variant` - 'outlined', 'filled', 'underlined'
- `size` - 'small', 'medium', 'large'
- `multiline` (boolean)
- `maxLength` (number)

### LoadingState Component

```javascript
import { LoadingState } from '../components/ui';

// Basic spinner
<LoadingState text="Loading..." />

// Different variants
<LoadingState 
  variant="dots" 
  size="large" 
  color={Colors.primary}
  text="Please wait..." 
/>

// Full screen loading
<LoadingState 
  fullScreen 
  variant="pulse"
  text="Loading data..." 
/>
```

**Props:**
- `variant` - 'spinner', 'skeleton', 'dots', 'pulse'
- `size` - 'small', 'medium', 'large'
- `color` (string)
- `text` (string)
- `fullScreen` (boolean)

### EmptyState Component

```javascript
import { EmptyState, EmptyStatePresets } from '../components/ui';

// Using presets
<EmptyState 
  {...EmptyStatePresets.noStudents}
  onActionPress={handleAddStudent}
/>

// Custom empty state
<EmptyState 
  icon="document-outline"
  title="No Documents"
  description="No documents have been uploaded yet."
  actionText="Upload Document"
  onActionPress={handleUpload}
  variant="compact"
/>
```

**Props:**
- `icon` (string) - Ionicon name
- `title` (string)
- `description` (string)
- `actionText` (string)
- `onActionPress` (function)
- `secondaryActionText` (string)
- `onSecondaryActionPress` (function)
- `variant` - 'default', 'compact', 'minimal'
- `illustration` - Image source for custom illustrations

### Enhanced StatCard Component

```javascript
import { StatCard } from '../components/ui';

// Basic stat card
<StatCard 
  title="Total Students"
  value="1,234"
  icon="people"
  color={Colors.primary}
/>

// With trend and interaction
<StatCard 
  title="Monthly Revenue"
  value="$12,500"
  icon="trending-up"
  color={Colors.success}
  subtitle="Up from last month"
  trend={1}
  change={15.3}
  onPress={handleViewDetails}
/>

// Different variants
<StatCard 
  title="Active Users"
  value="856"
  icon="person"
  variant="gradient"
  size="large"
  animated
/>
```

**Props:**
- `title` (string)
- `value` (string)
- `icon` (string) - Ionicon name
- `color` (string)
- `subtitle` (string)
- `trend` (number) - 1 for up, -1 for down
- `change` (number) - Percentage change
- `onPress` (function)
- `loading` (boolean)
- `variant` - 'default', 'gradient', 'minimal', 'compact'
- `size` - 'small', 'medium', 'large'
- `animated` (boolean)

## 🎨 Role-based Theming

The system automatically applies role-based colors based on the current user type:

```javascript
// Colors automatically change based on userType from AuthContext
const { userType } = useAuth();
const roleTheme = Theme.RoleThemes[userType]; // admin, teacher, student, parent

// Use role colors
backgroundColor: roleTheme.primary,
```

## 📱 Responsive Design

Components automatically adapt to different screen sizes:

```javascript
// Use responsive spacing
paddingHorizontal: Theme.Spacing.base, // Automatically adjusts

// Screen-size specific styles
const styles = StyleSheet.create({
  container: {
    ...Theme.Layout.screen, // Responsive padding
  },
});
```

## 🔍 Usage Examples

### Dashboard with Modern Components

```javascript
import React from 'react';
import { ScrollView } from 'react-native';
import { Card, Button, StatCard, LoadingState } from '../components/ui';
import Theme from '../constants/Theme';

const Dashboard = () => {
  const [loading, setLoading] = useState(false);

  return (
    <ScrollView style={{ backgroundColor: Colors.background }}>
      {loading && <LoadingState fullScreen />}
      
      <Card variant="elevated" margin="medium">
        <Text style={Theme.TextStyles.h3}>Welcome Back!</Text>
        
        <StatCard 
          title="Today's Classes"
          value="5"
          icon="calendar"
          color={Colors.primary}
          onPress={() => navigation.navigate('Classes')}
        />
        
        <Button 
          title="View Schedule"
          variant="primary"
          fullWidth
          icon="calendar-outline"
          onPress={handleViewSchedule}
        />
      </Card>
    </ScrollView>
  );
};
```

### Form with Validation

```javascript
import { Input, Button, Card } from '../components/ui';

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});

  return (
    <Card variant="elevated">
      <Input 
        label="Email"
        value={email}
        onChangeText={setEmail}
        leftIcon="mail"
        error={errors.email}
        keyboardType="email-address"
      />
      
      <Input 
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        error={errors.password}
      />
      
      <Button 
        title="Login"
        onPress={handleLogin}
        fullWidth
        gradient
      />
    </Card>
  );
};
```

## 🚀 Getting Started

1. **Import components:**
   ```javascript
   import { Button, Card, Input } from '../components/ui';
   ```

2. **Use the theme system:**
   ```javascript
   import Theme from '../constants/Theme';
   
   const styles = StyleSheet.create({
     text: {
       ...Theme.TextStyles.body,
       color: Colors.text,
     },
   });
   ```

3. **Test with the demo:**
   ```javascript
   import UIDemo from '../components/ui/UIDemo';
   // Add UIDemo to your navigation to see all components in action
   ```

## 🎯 Best Practices

1. **Consistent Spacing:** Always use `Theme.Spacing` values
2. **Semantic Colors:** Use `Colors.text`, `Colors.primary` instead of hex codes
3. **Responsive Design:** Test components on different screen sizes
4. **Accessibility:** Include meaningful labels and helper text
5. **Loading States:** Always show loading feedback for async operations
6. **Empty States:** Provide helpful empty states with actions
7. **Error Handling:** Use Input error states and validation

## 🔧 Customization

You can extend the theme system by modifying `Theme.js`:

```javascript
// Add custom colors
export const CustomColors = {
  brand: '#FF6B35',
  accent: '#F7931E',
};

// Add custom text styles
export const CustomTextStyles = {
  brandTitle: {
    fontSize: Theme.Typography.sizes['4xl'],
    color: CustomColors.brand,
    fontWeight: Theme.Typography.weights.black,
  },
};
```

This UI system provides a solid foundation for building consistent, modern interfaces throughout the school management application. The components are designed to be flexible, accessible, and maintainable.
