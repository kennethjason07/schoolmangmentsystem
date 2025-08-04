// Index file for cross-platform chart components
export { default as CrossPlatformBarChart } from './CrossPlatformBarChart';
export { default as CrossPlatformPieChart } from './CrossPlatformPieChart';

// For backward compatibility, also export them individually
import CrossPlatformBarChart from './CrossPlatformBarChart';
import CrossPlatformPieChart from './CrossPlatformPieChart';

export default {
  CrossPlatformBarChart,
  CrossPlatformPieChart,
};
