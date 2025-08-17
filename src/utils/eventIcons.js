// Event icon mapping utility
// This eliminates the need to store icon names in the database

/**
 * Maps event types to appropriate Ionicons names
 * @param {string} eventType - The type of event
 * @param {string} title - The event title (for additional context)
 * @returns {string} - The appropriate Ionicons name
 */
export const getEventIcon = (eventType = 'Event', title = '') => {
  // Normalize the event type to lowercase for consistent matching
  const type = eventType.toLowerCase();
  const titleLower = title.toLowerCase();

  // Smart icon mapping based on event type and title keywords
  if (type.includes('exam') || titleLower.includes('exam') || titleLower.includes('test')) {
    return 'document-text';
  }
  
  if (type.includes('meeting') || titleLower.includes('meeting')) {
    return 'people';
  }
  
  if (type.includes('holiday') || titleLower.includes('holiday') || titleLower.includes('vacation')) {
    return 'sunny';
  }
  
  if (type.includes('sports') || titleLower.includes('sports') || titleLower.includes('game') || titleLower.includes('match')) {
    return 'football';
  }
  
  if (type.includes('competition') || titleLower.includes('competition') || titleLower.includes('contest')) {
    return 'trophy';
  }
  
  if (type.includes('birthday') || titleLower.includes('birthday')) {
    return 'gift';
  }
  
  if (type.includes('announcement') || titleLower.includes('announcement')) {
    return 'megaphone';
  }
  
  if (type.includes('workshop') || titleLower.includes('workshop') || titleLower.includes('training')) {
    return 'school';
  }
  
  if (type.includes('cultural') || titleLower.includes('cultural') || titleLower.includes('festival')) {
    return 'musical-notes';
  }
  
  if (type.includes('assembly') || titleLower.includes('assembly')) {
    return 'podium';
  }
  
  if (type.includes('parent') || titleLower.includes('parent') || titleLower.includes('ptm')) {
    return 'people-circle';
  }
  
  if (type.includes('admission') || titleLower.includes('admission') || titleLower.includes('enrollment')) {
    return 'person-add';
  }
  
  if (type.includes('graduation') || titleLower.includes('graduation') || titleLower.includes('convocation')) {
    return 'school-outline';
  }
  
  if (type.includes('field trip') || titleLower.includes('trip') || titleLower.includes('excursion')) {
    return 'bus';
  }
  
  if (type.includes('science') || titleLower.includes('science') || titleLower.includes('lab')) {
    return 'flask';
  }
  
  // Default icon for general events
  return 'calendar';
};

/**
 * Maps event types to appropriate colors
 * @param {string} eventType - The type of event
 * @param {string} title - The event title (for additional context)
 * @returns {string} - The appropriate color hex code
 */
export const getEventColor = (eventType = 'Event', title = '') => {
  const type = eventType.toLowerCase();
  const titleLower = title.toLowerCase();

  // Color mapping based on event type
  if (type.includes('exam') || titleLower.includes('exam') || titleLower.includes('test')) {
    return '#f44336'; // Red - Important/Urgent
  }
  
  if (type.includes('meeting') || titleLower.includes('meeting')) {
    return '#2196F3'; // Blue - Professional
  }
  
  if (type.includes('holiday') || titleLower.includes('holiday')) {
    return '#4CAF50'; // Green - Positive
  }
  
  if (type.includes('sports') || titleLower.includes('sports')) {
    return '#FF9800'; // Orange - Energetic
  }
  
  if (type.includes('competition') || titleLower.includes('competition')) {
    return '#FFD700'; // Gold - Achievement
  }
  
  if (type.includes('birthday') || titleLower.includes('birthday')) {
    return '#E91E63'; // Pink - Celebration
  }
  
  if (type.includes('cultural') || titleLower.includes('cultural') || titleLower.includes('festival')) {
    return '#9C27B0'; // Purple - Creative
  }
  
  if (type.includes('workshop') || titleLower.includes('workshop') || titleLower.includes('training')) {
    return '#607D8B'; // Blue Grey - Learning
  }
  
  // Default color
  return '#FF9800'; // Orange - Standard
};

/**
 * Get complete event display properties
 * @param {string} eventType - The type of event
 * @param {string} title - The event title
 * @returns {object} - Object containing icon and color
 */
export const getEventDisplayProps = (eventType = 'Event', title = '') => {
  return {
    icon: getEventIcon(eventType, title),
    color: getEventColor(eventType, title)
  };
};

/**
 * Available event types with their default icons and colors
 * Useful for dropdowns or selection lists
 */
export const EVENT_TYPES = [
  { type: 'Event', icon: 'calendar', color: '#FF9800' },
  { type: 'Exam', icon: 'document-text', color: '#f44336' },
  { type: 'Meeting', icon: 'people', color: '#2196F3' },
  { type: 'Holiday', icon: 'sunny', color: '#4CAF50' },
  { type: 'Sports', icon: 'football', color: '#FF9800' },
  { type: 'Competition', icon: 'trophy', color: '#FFD700' },
  { type: 'Workshop', icon: 'school', color: '#607D8B' },
  { type: 'Cultural', icon: 'musical-notes', color: '#9C27B0' },
  { type: 'Assembly', icon: 'podium', color: '#2196F3' },
  { type: 'Parent Meeting', icon: 'people-circle', color: '#2196F3' },
];
