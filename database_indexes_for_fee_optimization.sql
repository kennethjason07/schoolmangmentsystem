-- Database Indexes for Fee Management Performance Optimization
-- Run these commands in your PostgreSQL database to improve query performance

-- 1. Fee Structure Indexes
CREATE INDEX IF NOT EXISTS idx_fee_structure_tenant_class 
ON public.fee_structure (tenant_id, class_id) 
WHERE class_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fee_structure_tenant_student 
ON public.fee_structure (tenant_id, student_id) 
WHERE student_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fee_structure_academic_year 
ON public.fee_structure (tenant_id, academic_year);

CREATE INDEX IF NOT EXISTS idx_fee_structure_component 
ON public.fee_structure (tenant_id, fee_component, academic_year);

-- 2. Student Fees (Payments) Indexes
CREATE INDEX IF NOT EXISTS idx_student_fees_tenant_student 
ON public.student_fees (tenant_id, student_id);

CREATE INDEX IF NOT EXISTS idx_student_fees_payment_date 
ON public.student_fees (tenant_id, payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_student_fees_component_year 
ON public.student_fees (tenant_id, fee_component, academic_year);

CREATE INDEX IF NOT EXISTS idx_student_fees_amount_paid 
ON public.student_fees (tenant_id, amount_paid) 
WHERE amount_paid > 0;

-- 3. Students Indexes
CREATE INDEX IF NOT EXISTS idx_students_tenant_class 
ON public.students (tenant_id, class_id) 
WHERE class_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_students_academic_year 
ON public.students (tenant_id, academic_year);

-- 4. Classes Indexes
CREATE INDEX IF NOT EXISTS idx_classes_tenant_year 
ON public.classes (tenant_id, academic_year);

-- 5. Student Discounts Indexes
CREATE INDEX IF NOT EXISTS idx_student_discounts_tenant_student 
ON public.student_discounts (tenant_id, student_id) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_student_discounts_tenant_class_year 
ON public.student_discounts (tenant_id, class_id, academic_year) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_student_discounts_component 
ON public.student_discounts (tenant_id, fee_component, academic_year) 
WHERE is_active = true;

-- 6. Composite Indexes for Complex Queries
CREATE INDEX IF NOT EXISTS idx_fee_structure_class_component_year 
ON public.fee_structure (tenant_id, class_id, fee_component, academic_year) 
WHERE class_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_student_fees_student_component_year 
ON public.student_fees (tenant_id, student_id, fee_component, academic_year);

-- 7. Covering Indexes for Frequent Queries
CREATE INDEX IF NOT EXISTS idx_student_fees_covering 
ON public.student_fees (tenant_id, student_id) 
INCLUDE (amount_paid, payment_date, fee_component);

CREATE INDEX IF NOT EXISTS idx_fee_structure_covering 
ON public.fee_structure (tenant_id, class_id) 
INCLUDE (fee_component, amount, base_amount, due_date) 
WHERE class_id IS NOT NULL;

-- Performance Monitoring Queries
-- Use these to monitor index usage and query performance

-- Check index usage statistics
SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch 
FROM pg_stat_user_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('fee_structure', 'student_fees', 'students', 'classes', 'student_discounts')
ORDER BY tablename, idx_tup_read DESC;

-- Find missing indexes (slow queries)
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements 
WHERE query LIKE '%fee_structure%' OR query LIKE '%student_fees%'
ORDER BY mean_time DESC
LIMIT 10;

-- Table sizes and index efficiency
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as "Total Size",
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as "Table Size",
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as "Indexes Size"
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('fee_structure', 'student_fees', 'students', 'classes', 'student_discounts')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
