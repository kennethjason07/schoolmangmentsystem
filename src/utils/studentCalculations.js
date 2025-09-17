/**
 * 📊 STUDENT CALCULATION UTILITIES
 * 
 * Standardized calculation methods to ensure consistency across all screens:
 * - ManageStudents (Admin)
 * - StudentDashboard (Student) 
 * - AdminDashboard
 * - StudentProfile
 * - Class management screens
 */

import { supabase, TABLES } from './supabase';

/**
 * 🎯 ATTENDANCE CALCULATION METHODS
 */

export const AttendanceCalculator = {
  /**
   * Calculate attendance percentage for a student
   * @param {string} studentId - Student ID
   * @param {string} tenantId - Tenant ID for filtering
   * @param {Object} options - Calculation options
   * @param {string} options.period - 'current_month' | 'last_3_months' | 'academic_year'
   * @param {Date} options.startDate - Custom start date (optional)
   * @param {Date} options.endDate - Custom end date (optional)
   * @returns {Promise<Object>} Attendance data and percentage
   */
  async calculateAttendancePercentage(studentId, tenantId, options = {}) {
    try {
      const { period = 'last_3_months', startDate, endDate } = options;
      
      // Determine date range based on period
      let dateFilter = {};
      const currentDate = new Date();
      
      switch (period) {
        case 'current_month':
          const year = currentDate.getFullYear();
          const month = currentDate.getMonth() + 1;
          const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
          const monthEnd = new Date(year, month, 0);
          dateFilter = {
            gte: monthStart,
            lte: monthEnd.toISOString().split('T')[0]
          };
          break;
          
        case 'last_3_months':
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
          dateFilter = {
            gte: threeMonthsAgo.toISOString().split('T')[0]
          };
          break;
          
        case 'academic_year':
          // Assume academic year starts in April
          const academicYearStart = currentDate.getMonth() >= 3 
            ? new Date(currentDate.getFullYear(), 3, 1) // April 1st current year
            : new Date(currentDate.getFullYear() - 1, 3, 1); // April 1st previous year
          dateFilter = {
            gte: academicYearStart.toISOString().split('T')[0]
          };
          break;
          
        case 'custom':
          if (startDate) {
            dateFilter.gte = startDate.toISOString().split('T')[0];
          }
          if (endDate) {
            dateFilter.lte = endDate.toISOString().split('T')[0];
          }
          break;
      }
      
      // Build query
      let query = supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .select('student_id, status, date')
        .eq('tenant_id', tenantId)
        .eq('student_id', studentId)
        .order('date', { ascending: false });
      
      // Apply date filters
      if (dateFilter.gte) {
        query = query.gte('date', dateFilter.gte);
      }
      if (dateFilter.lte) {
        query = query.lte('date', dateFilter.lte);
      }
      
      const { data: attendanceData, error } = await query;
      
      if (error) {
        console.error('❌ AttendanceCalculator: Database error:', error);
        return {
          success: false,
          error: error.message,
          totalRecords: 0,
          presentCount: 0,
          absentCount: 0,
          percentage: 0,
          period,
          data: []
        };
      }
      
      // Calculate statistics
      const totalRecords = attendanceData?.length || 0;
      const presentCount = attendanceData?.filter(record => record.status === 'Present').length || 0;
      const absentCount = totalRecords - presentCount;
      const percentage = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;
      
      console.log(`📊 AttendanceCalculator: Period=${period}, Total=${totalRecords}, Present=${presentCount}, %=${percentage}`);
      
      return {
        success: true,
        totalRecords,
        presentCount,
        absentCount,
        percentage,
        period,
        dateRange: dateFilter,
        data: attendanceData || []
      };
      
    } catch (error) {
      console.error('❌ AttendanceCalculator: Unexpected error:', error);
      return {
        success: false,
        error: error.message,
        totalRecords: 0,
        presentCount: 0,
        absentCount: 0,
        percentage: 0,
        period: options.period || 'last_3_months',
        data: []
      };
    }
  },

  /**
   * Get standardized attendance display text
   * @param {Object} attendanceResult - Result from calculateAttendancePercentage
   * @returns {Object} Display texts for different contexts
   */
  getAttendanceDisplayText(attendanceResult) {
    const { percentage, presentCount, totalRecords, period } = attendanceResult;
    
    const periodText = {
      'current_month': 'this month',
      'last_3_months': 'last 3 months', 
      'academic_year': 'this academic year',
      'custom': 'selected period'
    };
    
    return {
      percentage: `${percentage}%`,
      subtitle: `${presentCount}/${totalRecords} days present`,
      description: `${percentage}% attendance ${periodText[period] || ''}`,
      status: percentage >= 75 ? 'good' : percentage >= 60 ? 'average' : 'poor',
      color: percentage >= 75 ? '#4CAF50' : percentage >= 60 ? '#FF9800' : '#F44336'
    };
  }
};

/**
 * 📚 ACADEMIC PERFORMANCE CALCULATION METHODS
 */

export const AcademicCalculator = {
  /**
   * Calculate academic performance for a student
   * @param {string} studentId - Student ID  
   * @param {string} tenantId - Tenant ID for filtering
   * @param {Object} options - Calculation options
   * @param {string} options.returnType - 'percentage' | 'average_marks' | 'both'
   * @param {number} options.limit - Limit number of marks to consider
   * @returns {Promise<Object>} Academic performance data
   */
  async calculateAcademicPerformance(studentId, tenantId, options = {}) {
    try {
      const { returnType = 'percentage', limit = 50 } = options;
      
      // Get marks data
      let query = supabase
        .from(TABLES.MARKS)
        .select(`
          id,
          marks_obtained,
          max_marks,
          subject_id,
          exam_id,
          created_at,
          subjects(name),
          exams(name, start_date)
        `)
        .eq('tenant_id', tenantId)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
      
      if (limit > 0) {
        query = query.limit(limit);
      }
      
      const { data: marksData, error } = await query;
      
      if (error) {
        console.error('❌ AcademicCalculator: Database error:', error);
        return {
          success: false,
          error: error.message,
          percentage: 0,
          averageMarks: 0,
          totalSubjects: 0,
          validMarks: 0,
          data: []
        };
      }
      
      // Filter and validate marks
      const validMarks = (marksData || []).filter(mark => {
        const marksObtained = Number(mark.marks_obtained);
        const maxMarks = Number(mark.max_marks);
        const isValid = !isNaN(marksObtained) && !isNaN(maxMarks) && maxMarks > 0 && marksObtained >= 0;
        
        if (!isValid) {
          console.log('❌ AcademicCalculator: Invalid mark record:', {
            id: mark.id,
            marks_obtained: mark.marks_obtained,
            max_marks: mark.max_marks,
            subject: mark.subjects?.name
          });
        }
        
        return isValid;
      });
      
      if (validMarks.length === 0) {
        return {
          success: true,
          percentage: 0,
          averageMarks: 0,
          totalSubjects: 0,
          validMarks: 0,
          hasMarks: false,
          data: [],
          displayText: 'No marks available'
        };
      }
      
      // Calculate percentage-based average (standard method)
      const percentages = validMarks.map(mark => {
        const marksObtained = Number(mark.marks_obtained);
        const maxMarks = Number(mark.max_marks);
        return (marksObtained / maxMarks) * 100;
      });
      
      const averagePercentage = percentages.reduce((sum, perc) => sum + perc, 0) / percentages.length;
      
      // Calculate marks-based average (alternative method)  
      const totalMarksObtained = validMarks.reduce((sum, mark) => sum + Number(mark.marks_obtained), 0);
      const totalMaxMarks = validMarks.reduce((sum, mark) => sum + Number(mark.max_marks), 0);
      const totalPercentage = totalMaxMarks > 0 ? (totalMarksObtained / totalMaxMarks) * 100 : 0;
      
      // Calculate simple average of marks (non-percentage)
      const averageMarksValue = totalMarksObtained / validMarks.length;
      
      const uniqueSubjects = [...new Set(validMarks.map(mark => mark.subject_id))].length;
      
      console.log(`📚 AcademicCalculator: Valid marks=${validMarks.length}, Avg%=${averagePercentage.toFixed(1)}, AvgMarks=${averageMarksValue.toFixed(1)}`);
      
      const result = {
        success: true,
        percentage: Math.round(averagePercentage),
        averageMarks: Math.round(averageMarksValue),
        totalPercentage: Math.round(totalPercentage), // Alternative calculation
        totalSubjects: uniqueSubjects,
        validMarks: validMarks.length,
        hasMarks: true,
        data: validMarks
      };
      
      // Add display text based on return type
      if (returnType === 'percentage') {
        result.displayText = `${result.percentage}%`;
        result.primary = result.percentage;
      } else if (returnType === 'average_marks') {
        result.displayText = `${result.averageMarks}`;
        result.primary = result.averageMarks;
      } else {
        result.displayText = `${result.percentage}% (${result.averageMarks} avg)`;
        result.primary = result.percentage;
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ AcademicCalculator: Unexpected error:', error);
      return {
        success: false,
        error: error.message,
        percentage: 0,
        averageMarks: 0,
        totalSubjects: 0,
        validMarks: 0,
        hasMarks: false,
        data: [],
        displayText: 'Error calculating marks'
      };
    }
  },

  /**
   * Get standardized academic performance display
   * @param {Object} academicResult - Result from calculateAcademicPerformance
   * @returns {Object} Display data for different contexts
   */
  getAcademicDisplayData(academicResult) {
    const { percentage, averageMarks, totalSubjects, validMarks, hasMarks } = academicResult;
    
    if (!hasMarks) {
      return {
        value: 'No marks',
        subtitle: 'No marks recorded',
        color: '#999',
        status: 'no_data'
      };
    }
    
    // Determine performance level based on percentage
    let status, color;
    if (percentage >= 90) {
      status = 'excellent';
      color = '#4CAF50';
    } else if (percentage >= 75) {
      status = 'good';
      color = '#8BC34A';
    } else if (percentage >= 60) {
      status = 'average';
      color = '#FF9800';
    } else if (percentage >= 40) {
      status = 'below_average';
      color = '#FF5722';
    } else {
      status = 'poor';
      color = '#F44336';
    }
    
    return {
      percentage: `${percentage}%`,
      averageMarks: `${averageMarks}`,
      subtitle: `${validMarks} marks across ${totalSubjects} subjects`,
      color,
      status,
      // Different display formats for different screens
      adminView: `${averageMarks}`, // Admin sees average marks
      studentView: `${percentage}%`, // Student sees percentage  
      dashboardView: `${percentage}%`
    };
  }
};

/**
 * 💰 FEE STATUS CALCULATION METHODS
 */

export const FeeCalculator = {
  /**
   * Calculate comprehensive fee status for a student
   * @param {string} studentId - Student ID
   * @param {string} tenantId - Tenant ID for filtering  
   * @param {Object} options - Calculation options
   * @param {boolean} options.useView - Use student_fee_summary view if available
   * @returns {Promise<Object>} Fee status and details
   */
  async calculateFeeStatus(studentId, tenantId, options = {}) {
    try {
      const { useView = true } = options;
      
      // Try to use the student_fee_summary view first (most accurate)
      if (useView) {
        try {
          const { data: feeData, error: feeError } = await supabase
            .from('student_fee_summary')
            .select('*')
            .eq('student_id', studentId)
            .single();
          
          if (!feeError && feeData) {
            const totalDue = Number(feeData.total_final_fees) || 0;
            const totalPaid = Number(feeData.total_paid) || 0;
            const outstanding = Number(feeData.total_outstanding) || 0;
            
            return {
              success: true,
              source: 'student_fee_summary_view',
              totalDue,
              totalPaid,
              outstanding,
              status: outstanding > 0 ? 'pending' : totalDue > 0 ? 'paid' : 'no_fees',
              overallStatus: feeData.overall_status,
              hasDiscounts: feeData.has_any_discounts,
              components: feeData.fee_components || [],
              calculatedAt: feeData.calculated_at,
              displayText: this.getFeeDisplayText({ totalDue, totalPaid, outstanding })
            };
          }
        } catch (viewError) {
          console.log('📊 FeeCalculator: View not available, falling back to direct calculation');
        }
      }
      
      // Fallback to direct calculation from student_fees table
      const { data: feesData, error: feesError } = await supabase
        .from(TABLES.STUDENT_FEES)
        .select('student_id, amount_paid, fee_amount, academic_year, status')
        .eq('tenant_id', tenantId)
        .eq('student_id', studentId);
      
      if (feesError) {
        console.error('❌ FeeCalculator: Database error:', feesError);
        return {
          success: false,
          error: feesError.message,
          totalDue: 0,
          totalPaid: 0,
          outstanding: 0,
          status: 'error',
          displayText: 'Error loading fees'
        };
      }
      
      if (!feesData || feesData.length === 0) {
        return {
          success: true,
          source: 'student_fees_table',
          totalDue: 0,
          totalPaid: 0,
          outstanding: 0,
          status: 'no_fees',
          displayText: 'No fees assigned'
        };
      }
      
      // Calculate totals from individual fee records
      let totalPaid = 0;
      let totalDue = 0;
      
      feesData.forEach(fee => {
        totalPaid += Number(fee.amount_paid) || 0;
        totalDue += Number(fee.fee_amount) || 0;
      });
      
      const outstanding = Math.max(0, totalDue - totalPaid);
      const status = outstanding > 0 ? 'pending' : totalDue > 0 ? 'paid' : 'no_fees';
      
      console.log(`💰 FeeCalculator: Direct calc - Due=${totalDue}, Paid=${totalPaid}, Outstanding=${outstanding}`);
      
      return {
        success: true,
        source: 'student_fees_table',
        totalDue,
        totalPaid,
        outstanding,
        status,
        components: feesData,
        displayText: this.getFeeDisplayText({ totalDue, totalPaid, outstanding })
      };
      
    } catch (error) {
      console.error('❌ FeeCalculator: Unexpected error:', error);
      return {
        success: false,
        error: error.message,
        totalDue: 0,
        totalPaid: 0,
        outstanding: 0,
        status: 'error',
        displayText: 'Error calculating fees'
      };
    }
  },

  /**
   * Get standardized fee display text and colors
   * @param {Object} feeData - Fee calculation result
   * @returns {Object} Display information for different contexts
   */
  getFeeDisplayText(feeData) {
    const { totalDue, totalPaid, outstanding, status } = feeData;
    
    if (status === 'no_fees' || totalDue === 0) {
      return {
        value: 'No fees',
        subtitle: 'No fees assigned',
        color: '#4CAF50',
        status: 'no_fees',
        simple: 'No fees'
      };
    }
    
    if (status === 'paid' || outstanding === 0) {
      return {
        value: 'Paid',
        subtitle: `All fees paid (₹${totalPaid.toLocaleString()})`,
        color: '#4CAF50', 
        status: 'paid',
        simple: 'Paid'
      };
    }
    
    if (status === 'pending' || outstanding > 0) {
      return {
        value: `₹${outstanding.toLocaleString()}`,
        subtitle: `Outstanding amount`,
        color: '#F44336',
        status: 'pending',
        simple: 'Unpaid',
        detailed: `₹${outstanding.toLocaleString()} pending`
      };
    }
    
    return {
      value: 'Unknown',
      subtitle: 'Fee status unclear',
      color: '#999',
      status: 'unknown',
      simple: 'Unknown'
    };
  }
};

/**
 * 🔄 BULK STUDENT CALCULATIONS
 * For use in screens that display multiple students (e.g., ManageStudents, ClassDetails)
 */

export const BulkStudentCalculator = {
  /**
   * Calculate standardized data for multiple students
   * @param {Array} students - Array of student objects with id
   * @param {string} tenantId - Tenant ID for filtering
   * @param {Object} options - Calculation options
   * @returns {Promise<Array>} Students with calculated data
   */
  async calculateBulkStudentData(students, tenantId, options = {}) {
    try {
      const {
        attendancePeriod = 'last_3_months',
        academicReturnType = 'percentage',
        includeFees = true
      } = options;
      
      console.log(`🔄 BulkStudentCalculator: Processing ${students.length} students...`);
      
      const enhancedStudents = await Promise.all(
        students.map(async (student) => {
          try {
            // Calculate attendance
            const attendanceResult = await AttendanceCalculator.calculateAttendancePercentage(
              student.id, 
              tenantId, 
              { period: attendancePeriod }
            );
            
            // Calculate academic performance
            const academicResult = await AcademicCalculator.calculateAcademicPerformance(
              student.id,
              tenantId,
              { returnType: academicReturnType, limit: 20 }
            );
            
            // Calculate fee status if needed
            let feeResult = null;
            if (includeFees) {
              feeResult = await FeeCalculator.calculateFeeStatus(
                student.id,
                tenantId
              );
            }
            
            // Get display data
            const attendanceDisplay = AttendanceCalculator.getAttendanceDisplayText(attendanceResult);
            const academicDisplay = AcademicCalculator.getAcademicDisplayData(academicResult);
            const feeDisplay = feeResult ? FeeCalculator.getFeeDisplayText(feeResult) : null;
            
            return {
              ...student,
              // Standardized attendance data
              attendancePercentage: attendanceResult.percentage,
              attendancePresent: attendanceResult.presentCount,
              attendanceTotal: attendanceResult.totalRecords,
              attendanceStatus: attendanceDisplay.status,
              attendanceColor: attendanceDisplay.color,
              
              // Standardized academic data
              academicPercentage: academicResult.percentage,
              academicAverage: academicResult.averageMarks,
              academicSubjects: academicResult.totalSubjects,
              hasMarks: academicResult.hasMarks,
              academicStatus: academicDisplay.status,
              academicColor: academicDisplay.color,
              
              // Standardized fee data
              ...(feeResult && {
                feesStatus: feeDisplay.simple,
                feesTotalDue: feeResult.totalDue,
                feesTotalPaid: feeResult.totalPaid,
                feesOutstanding: feeResult.outstanding,
                feesColor: feeDisplay.color,
                feesStatusColor: feeDisplay.color
              }),
              
              // Calculation metadata
              calculatedAt: new Date().toISOString(),
              calculationSource: 'BulkStudentCalculator'
            };
            
          } catch (studentError) {
            console.error(`❌ Error calculating data for student ${student.id}:`, studentError);
            return {
              ...student,
              attendancePercentage: 0,
              academicPercentage: 0,
              feesStatus: 'Error',
              calculationError: studentError.message
            };
          }
        })
      );
      
      console.log(`✅ BulkStudentCalculator: Completed processing ${enhancedStudents.length} students`);
      return enhancedStudents;
      
    } catch (error) {
      console.error('❌ BulkStudentCalculator: Bulk calculation error:', error);
      throw error;
    }
  }
};

/**
 * 📱 SCREEN-SPECIFIC CALCULATION HELPERS
 * Pre-configured calculation methods for specific screens
 */

export const ScreenCalculators = {
  // For ManageStudents screen (Admin view)
  async getManageStudentsData(students, tenantId) {
    return BulkStudentCalculator.calculateBulkStudentData(students, tenantId, {
      attendancePeriod: 'last_3_months', // 3 months for admin overview
      academicReturnType: 'both', // Both percentage and average marks
      includeFees: true
    });
  },
  
  // For StudentDashboard (Student view)
  async getStudentDashboardData(studentId, tenantId) {
    const [attendance, academic, fees] = await Promise.all([
      AttendanceCalculator.calculateAttendancePercentage(studentId, tenantId, { period: 'current_month' }),
      AcademicCalculator.calculateAcademicPerformance(studentId, tenantId, { returnType: 'percentage' }),
      FeeCalculator.calculateFeeStatus(studentId, tenantId, { useView: true })
    ]);
    
    return {
      attendance,
      academic, 
      fees,
      displayData: {
        attendance: AttendanceCalculator.getAttendanceDisplayText(attendance),
        academic: AcademicCalculator.getAcademicDisplayData(academic),
        fees: FeeCalculator.getFeeDisplayText(fees)
      }
    };
  },
  
  // For AdminDashboard overview
  async getAdminDashboardData(students, tenantId) {
    return BulkStudentCalculator.calculateBulkStudentData(students, tenantId, {
      attendancePeriod: 'current_month', // Current month for dashboard
      academicReturnType: 'percentage',
      includeFees: true
    });
  }
};

export default {
  AttendanceCalculator,
  AcademicCalculator, 
  FeeCalculator,
  BulkStudentCalculator,
  ScreenCalculators
};
