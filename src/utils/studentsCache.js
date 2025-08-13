// studentsCache.js - Optimized caching and batch operations for student data
import { supabase, TABLES } from './supabase';

class StudentsCache {
  constructor() {
    this.cache = {
      students: new Map(),
      classes: new Map(),
      attendance: new Map(),
      lastFetch: null,
      isLoading: false
    };
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    this.PAGE_SIZE = 50; // Load students in batches of 50
  }

  // Check if cache is still valid
  isCacheValid() {
    if (!this.cache.lastFetch) return false;
    return (Date.now() - this.cache.lastFetch) < this.CACHE_DURATION;
  }

  // Load students with optimized batch operations
  async loadStudentsOptimized(page = 0, filters = {}) {
    try {
      // Return cached data if valid and no filters changed
      if (this.isCacheValid() && page === 0 && Object.keys(filters).length === 0) {
        return Array.from(this.cache.students.values());
      }

      this.cache.isLoading = true;
      
      // Build query with pagination
      let query = supabase
        .from(TABLES.STUDENTS)
        .select(`
          *,
          classes:class_id (
            id,
            class_name,
            section
          ),
          users:parent_id (
            id,
            full_name,
            phone
          )
        `)
        .order('created_at', { ascending: false });

      // Apply filters if provided
      if (filters.class_id && filters.class_id !== 'All') {
        query = query.eq('class_id', filters.class_id);
      }
      if (filters.gender && filters.gender !== 'All') {
        query = query.eq('gender', filters.gender);
      }
      if (filters.academic_year && filters.academic_year !== 'All') {
        query = query.eq('academic_year', filters.academic_year);
      }

      // Add pagination
      const from = page * this.PAGE_SIZE;
      const to = from + this.PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data: studentsData, error, count } = await query;

      if (error) throw error;

      if (!studentsData || studentsData.length === 0) {
        return { students: [], totalCount: 0, hasMore: false };
      }

      // Get attendance data in batch
      const studentIds = studentsData.map(s => s.id);
      const attendanceData = await this.loadAttendanceBatch(studentIds);

      // Process students with attendance
      const processedStudents = studentsData.map(student => {
        const classInfo = student.classes || { class_name: 'N/A', section: 'N/A' };
        const parentInfo = student.users || { full_name: 'N/A', phone: 'N/A' };
        const attendance = attendanceData.get(student.id) || { total: 0, present: 0 };
        
        const attendancePercentage = attendance.total > 0 
          ? Math.round((attendance.present / attendance.total) * 100) 
          : 0;

        const processedStudent = {
          ...student,
          attendancePercentage,
          className: classInfo.class_name,
          section: classInfo.section,
          parentName: parentInfo.full_name,
          parentPhone: parentInfo.phone
        };

        // Cache individual student
        this.cache.students.set(student.id, processedStudent);
        
        return processedStudent;
      });

      // Update cache metadata
      if (page === 0) {
        this.cache.lastFetch = Date.now();
      }

      this.cache.isLoading = false;
      
      return {
        students: processedStudents,
        totalCount: count,
        hasMore: studentsData.length === this.PAGE_SIZE
      };

    } catch (error) {
      this.cache.isLoading = false;
      console.error('Error loading students:', error);
      throw error;
    }
  }

  // Load attendance data in batch for better performance
  async loadAttendanceBatch(studentIds) {
    if (studentIds.length === 0) return new Map();

    try {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString().split('T')[0];
      
      const { data: allAttendanceData } = await supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .select('student_id, status')
        .in('student_id', studentIds)
        .gte('date', startOfMonth);

      // Create lookup map for O(1) access
      const attendanceLookup = new Map();
      (allAttendanceData || []).forEach(record => {
        if (!attendanceLookup.has(record.student_id)) {
          attendanceLookup.set(record.student_id, { total: 0, present: 0 });
        }
        const current = attendanceLookup.get(record.student_id);
        current.total++;
        if (record.status === 'Present') {
          current.present++;
        }
      });

      return attendanceLookup;
    } catch (error) {
      console.error('Error loading attendance batch:', error);
      return new Map();
    }
  }

  // Search students with debouncing
  async searchStudents(searchTerm, filters = {}) {
    if (!searchTerm || searchTerm.length < 2) {
      return this.loadStudentsOptimized(0, filters);
    }

    try {
      let query = supabase
        .from(TABLES.STUDENTS)
        .select(`
          *,
          classes:class_id (
            id,
            class_name,
            section
          ),
          users:parent_id (
            id,
            full_name,
            phone
          )
        `)
        .or(`name.ilike.%${searchTerm}%,admission_no.ilike.%${searchTerm}%`)
        .order('created_at', { ascending: false })
        .limit(20); // Limit search results

      // Apply filters
      if (filters.class_id && filters.class_id !== 'All') {
        query = query.eq('class_id', filters.class_id);
      }
      if (filters.gender && filters.gender !== 'All') {
        query = query.eq('gender', filters.gender);
      }

      const { data: studentsData, error } = await query;
      if (error) throw error;

      if (!studentsData || studentsData.length === 0) {
        return { students: [], totalCount: 0, hasMore: false };
      }

      const studentIds = studentsData.map(s => s.id);
      const attendanceData = await this.loadAttendanceBatch(studentIds);

      const processedStudents = studentsData.map(student => {
        const classInfo = student.classes || { class_name: 'N/A', section: 'N/A' };
        const parentInfo = student.users || { full_name: 'N/A', phone: 'N/A' };
        const attendance = attendanceData.get(student.id) || { total: 0, present: 0 };
        
        const attendancePercentage = attendance.total > 0 
          ? Math.round((attendance.present / attendance.total) * 100) 
          : 0;

        return {
          ...student,
          attendancePercentage,
          className: classInfo.class_name,
          section: classInfo.section,
          parentName: parentInfo.full_name,
          parentPhone: parentInfo.phone
        };
      });

      return {
        students: processedStudents,
        totalCount: studentsData.length,
        hasMore: false
      };

    } catch (error) {
      console.error('Error searching students:', error);
      throw error;
    }
  }

  // Load classes with caching
  async loadClasses() {
    if (this.cache.classes.size > 0 && this.isCacheValid()) {
      return Array.from(this.cache.classes.values());
    }

    try {
      const { data: classData, error } = await supabase
        .from(TABLES.CLASSES)
        .select('*')
        .order('class_name');

      if (error) throw error;
      
      // Cache classes
      this.cache.classes.clear();
      (classData || []).forEach(cls => {
        this.cache.classes.set(cls.id, cls);
      });

      return classData || [];
    } catch (error) {
      console.error('Error loading classes:', error);
      throw error;
    }
  }

  // Get cached student by ID
  getCachedStudent(studentId) {
    return this.cache.students.get(studentId);
  }

  // Update cached student
  updateCachedStudent(studentId, updatedData) {
    if (this.cache.students.has(studentId)) {
      const existing = this.cache.students.get(studentId);
      this.cache.students.set(studentId, { ...existing, ...updatedData });
    }
  }

  // Remove student from cache
  removeCachedStudent(studentId) {
    this.cache.students.delete(studentId);
  }

  // Clear entire cache
  clearCache() {
    this.cache.students.clear();
    this.cache.classes.clear();
    this.cache.attendance.clear();
    this.cache.lastFetch = null;
  }

  // Get cache statistics
  getCacheStats() {
    return {
      studentsCount: this.cache.students.size,
      classesCount: this.cache.classes.size,
      lastFetch: this.cache.lastFetch,
      isValid: this.isCacheValid(),
      isLoading: this.cache.isLoading
    };
  }
}

// Create singleton instance
const studentsCache = new StudentsCache();
export default studentsCache;

// Export utility functions
export const StudentUtils = {
  // Debounced search function
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Calculate statistics efficiently
  calculateStats(students) {
    if (!students || students.length === 0) {
      return {
        totalStudents: 0,
        maleStudents: 0,
        femaleStudents: 0,
        averageAttendance: 0,
        totalClasses: 0
      };
    }

    const totalStudents = students.length;
    let maleCount = 0;
    let femaleCount = 0;
    let totalAttendance = 0;
    const classIds = new Set();

    students.forEach(student => {
      if (student.gender === 'Male') maleCount++;
      if (student.gender === 'Female') femaleCount++;
      totalAttendance += student.attendancePercentage || 0;
      if (student.class_id) classIds.add(student.class_id);
    });

    return {
      totalStudents,
      maleStudents: maleCount,
      femaleStudents: femaleCount,
      averageAttendance: totalStudents > 0 ? Math.round(totalAttendance / totalStudents) : 0,
      totalClasses: classIds.size
    };
  },

  // Format date efficiently
  formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN');
    } catch (error) {
      return 'N/A';
    }
  }
};
