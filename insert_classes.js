
const { supabase } = require('./src/utils/supabase');

const classesData = [
  { class_name: 'Class 1', section: 'A', academic_year: '2024-2025' },
  { class_name: 'Class 1', section: 'B', academic_year: '2024-2025' },
  { class_name: 'Class 2', section: 'A', academic_year: '2024-2025' },
  { class_name: 'Class 3', section: 'A', academic_year: '2024-2025' },
  { class_name: 'Class 4', section: 'A', academic_year: '2024-2025' },
  { class_name: 'Class 5', section: 'A', academic_year: '2024-2025' },
  { class_name: 'Class 6', section: 'A', academic_year: '2024-2025' },
  { class_name: 'Class 7', section: 'A', academic_year: '2024-2025' },
  { class_name: 'Class 8', section: 'A', academic_year: '2024-2025' },
  { class_name: 'Class 9', section: 'A', academic_year: '2024-2025' },
  { class_name: 'Class 10', section: 'A', academic_year: '2024-2025' },
];

const insertClasses = async () => {
  try {
    const { data, error } = await supabase.from('classes').insert(classesData);
    if (error) {
      throw error;
    }
    console.log('Classes inserted successfully:', data);
  } catch (error) {
    console.error('Error inserting classes:', error);
  }
};

insertClasses();
