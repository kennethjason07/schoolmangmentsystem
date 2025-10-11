#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Your Supabase configuration (from src/utils/supabase.js)
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🏫 School Management System - Hostel Tables Creator');
console.log('=' .repeat(60));
console.log(`📡 Connecting to database: ${supabaseUrl}`);

async function checkDatabaseConnection() {
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('id, name')
      .limit(1);
    
    if (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }
    
    console.log('✅ Database connection successful');
    if (data && data.length > 0) {
      console.log(`📋 Found ${data.length} tenant(s) in database`);
      console.log('   Example tenant:', data[0].name);
    }
    return true;
  } catch (error) {
    console.error('💥 Connection error:', error.message);
    return false;
  }
}

async function checkExistingTables() {
  console.log('\n🔍 Checking for existing hostel tables...');
  
  const hostelTables = [
    'hostels', 'blocks', 'rooms', 'beds', 
    'hostel_applications', 'bed_allocations'
  ];
  
  const existingTables = [];
  
  for (const tableName of hostelTables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('id')
        .limit(1);
      
      if (!error) {
        existingTables.push(tableName);
        console.log(`   ✅ ${tableName} - EXISTS`);
      } else if (error.code === '42P01') {
        console.log(`   ❌ ${tableName} - MISSING`);
      } else {
        console.log(`   ⚠️  ${tableName} - ERROR: ${error.message}`);
      }
    } catch (err) {
      console.log(`   ❌ ${tableName} - MISSING`);
    }
  }
  
  return existingTables;
}

const hostelTablesSQL = `
-- ============================================================================
-- HOSTEL MANAGEMENT SYSTEM TABLES
-- Compatible with existing school management system schema
-- ============================================================================

-- 1. HOSTELS TABLE
CREATE TABLE IF NOT EXISTS public.hostels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  contact_phone text,
  hostel_type text DEFAULT 'mixed'::text CHECK (hostel_type = ANY (ARRAY['boys'::text, 'girls'::text, 'mixed'::text])),
  capacity integer DEFAULT 0,
  warden_id uuid,
  description text,
  amenities text[],
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  tenant_id uuid NOT NULL,
  CONSTRAINT hostels_pkey PRIMARY KEY (id),
  CONSTRAINT hostels_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT hostels_warden_id_fkey FOREIGN KEY (warden_id) REFERENCES public.users(id)
);

-- 2. BLOCKS TABLE  
CREATE TABLE IF NOT EXISTS public.blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  hostel_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  total_floors integer DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  tenant_id uuid NOT NULL,
  CONSTRAINT blocks_pkey PRIMARY KEY (id),
  CONSTRAINT blocks_hostel_id_fkey FOREIGN KEY (hostel_id) REFERENCES public.hostels(id) ON DELETE CASCADE,
  CONSTRAINT blocks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- 3. ROOMS TABLE (CRITICAL - Your app is looking for this!)
CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  hostel_id uuid NOT NULL,
  block_id uuid,
  floor integer DEFAULT 1,
  room_number text NOT NULL,
  capacity integer NOT NULL DEFAULT 1,
  room_type text DEFAULT 'standard'::text CHECK (room_type = ANY (ARRAY['standard'::text, 'deluxe'::text, 'premium'::text, 'accessible'::text])),
  amenities text[],
  monthly_fee numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  tenant_id uuid NOT NULL,
  CONSTRAINT rooms_pkey PRIMARY KEY (id),
  CONSTRAINT rooms_hostel_id_fkey FOREIGN KEY (hostel_id) REFERENCES public.hostels(id) ON DELETE CASCADE,
  CONSTRAINT rooms_block_id_fkey FOREIGN KEY (block_id) REFERENCES public.blocks(id),
  CONSTRAINT rooms_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT rooms_unique_number_per_hostel UNIQUE (hostel_id, room_number)
);

-- 4. BEDS TABLE (CRITICAL - Your app is looking for this!)  
CREATE TABLE IF NOT EXISTS public.beds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  bed_label text,
  bed_type text DEFAULT 'normal'::text CHECK (bed_type = ANY (ARRAY['normal'::text, 'lower'::text, 'upper'::text, 'accessible'::text])),
  status text NOT NULL DEFAULT 'available'::text CHECK (status = ANY (ARRAY['available'::text, 'occupied'::text, 'maintenance'::text, 'reserved'::text])),
  created_at timestamp with time zone DEFAULT now(),
  tenant_id uuid NOT NULL,
  CONSTRAINT beds_pkey PRIMARY KEY (id),
  CONSTRAINT beds_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE,
  CONSTRAINT beds_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT beds_unique_label_per_room UNIQUE (room_id, bed_label)
);

-- 5. HOSTEL APPLICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.hostel_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  hostel_id uuid NOT NULL,
  academic_year text NOT NULL DEFAULT (EXTRACT(year FROM CURRENT_DATE))::text,
  preferred_room_type text DEFAULT 'standard'::text,
  preferred_block_id uuid,
  special_requirements text,
  documents jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'submitted'::text CHECK (status = ANY (ARRAY['submitted'::text, 'verified'::text, 'accepted'::text, 'rejected'::text, 'waitlisted'::text, 'cancelled'::text])),
  applied_at timestamp with time zone DEFAULT now(),
  verified_by uuid,
  verified_at timestamp with time zone,
  decision_by uuid,
  decision_at timestamp with time zone,
  remarks text,
  priority_score integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  tenant_id uuid NOT NULL,
  CONSTRAINT hostel_applications_pkey PRIMARY KEY (id),
  CONSTRAINT hostel_applications_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT hostel_applications_hostel_id_fkey FOREIGN KEY (hostel_id) REFERENCES public.hostels(id),
  CONSTRAINT hostel_applications_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id),
  CONSTRAINT hostel_applications_decision_by_fkey FOREIGN KEY (decision_by) REFERENCES public.users(id),
  CONSTRAINT hostel_applications_preferred_block_id_fkey FOREIGN KEY (preferred_block_id) REFERENCES public.blocks(id),
  CONSTRAINT hostel_applications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT hostel_applications_unique_student_year_hostel UNIQUE (student_id, academic_year, hostel_id)
);

-- 6. BED ALLOCATIONS TABLE
CREATE TABLE IF NOT EXISTS public.bed_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  student_id uuid NOT NULL,
  bed_id uuid NOT NULL,
  academic_year text NOT NULL,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'pending_acceptance'::text CHECK (status = ANY (ARRAY['pending_acceptance'::text, 'active'::text, 'checked_in'::text, 'checked_out'::text, 'cancelled'::text, 'transferred'::text])),
  acceptance_deadline timestamp with time zone,
  student_response text CHECK (student_response = ANY (ARRAY['accepted'::text, 'rejected'::text])),
  student_response_at timestamp with time zone,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  tenant_id uuid NOT NULL,
  CONSTRAINT bed_allocations_pkey PRIMARY KEY (id),
  CONSTRAINT bed_allocations_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.hostel_applications(id),
  CONSTRAINT bed_allocations_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT bed_allocations_bed_id_fkey FOREIGN KEY (bed_id) REFERENCES public.beds(id),
  CONSTRAINT bed_allocations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id),
  CONSTRAINT bed_allocations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);
`;

const indexesSQL = `
-- ============================================================================
-- PERFORMANCE INDEXES FOR HOSTEL TABLES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_hostels_tenant_id ON public.hostels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hostels_warden_id ON public.hostels(warden_id);
CREATE INDEX IF NOT EXISTS idx_blocks_hostel_id ON public.blocks(hostel_id);
CREATE INDEX IF NOT EXISTS idx_blocks_tenant_id ON public.blocks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rooms_hostel_id ON public.rooms(hostel_id);
CREATE INDEX IF NOT EXISTS idx_rooms_block_id ON public.rooms(block_id);
CREATE INDEX IF NOT EXISTS idx_rooms_tenant_id ON public.rooms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_beds_room_id ON public.beds(room_id);
CREATE INDEX IF NOT EXISTS idx_beds_status ON public.beds(status);
CREATE INDEX IF NOT EXISTS idx_beds_tenant_id ON public.beds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hostel_applications_student_id ON public.hostel_applications(student_id);
CREATE INDEX IF NOT EXISTS idx_hostel_applications_status ON public.hostel_applications(status);
CREATE INDEX IF NOT EXISTS idx_hostel_applications_hostel_id ON public.hostel_applications(hostel_id);
CREATE INDEX IF NOT EXISTS idx_hostel_applications_tenant_id ON public.hostel_applications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bed_allocations_bed_id ON public.bed_allocations(bed_id);
CREATE INDEX IF NOT EXISTS idx_bed_allocations_student_id ON public.bed_allocations(student_id);
CREATE INDEX IF NOT EXISTS idx_bed_allocations_status ON public.bed_allocations(status);
CREATE INDEX IF NOT EXISTS idx_bed_allocations_tenant_id ON public.bed_allocations(tenant_id);
`;

const rlsSQL = `
-- ============================================================================  
-- ROW LEVEL SECURITY (RLS) POLICIES FOR TENANT ISOLATION
-- ============================================================================

-- Enable RLS on all hostel tables
ALTER TABLE public.hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bed_allocations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tenant isolation (matching your existing pattern)
DO $$
BEGIN
  -- Hostels policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hostels' AND policyname = 'hostels_tenant_isolation') THEN
    CREATE POLICY hostels_tenant_isolation ON public.hostels
    FOR ALL TO authenticated
    USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
  END IF;

  -- Blocks policies  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'blocks' AND policyname = 'blocks_tenant_isolation') THEN
    CREATE POLICY blocks_tenant_isolation ON public.blocks
    FOR ALL TO authenticated
    USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
  END IF;

  -- Rooms policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rooms' AND policyname = 'rooms_tenant_isolation') THEN
    CREATE POLICY rooms_tenant_isolation ON public.rooms
    FOR ALL TO authenticated  
    USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
  END IF;

  -- Beds policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'beds' AND policyname = 'beds_tenant_isolation') THEN
    CREATE POLICY beds_tenant_isolation ON public.beds
    FOR ALL TO authenticated
    USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
  END IF;

  -- Hostel Applications policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hostel_applications' AND policyname = 'hostel_applications_tenant_isolation') THEN
    CREATE POLICY hostel_applications_tenant_isolation ON public.hostel_applications
    FOR ALL TO authenticated
    USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
  END IF;

  -- Bed Allocations policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bed_allocations' AND policyname = 'bed_allocations_tenant_isolation') THEN
    CREATE POLICY bed_allocations_tenant_isolation ON public.bed_allocations
    FOR ALL TO authenticated
    USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
  END IF;

END$$;
`;

async function executeSQL(sqlQuery, description) {
  try {
    console.log(`\n⏳ ${description}...`);
    
    // For PostgreSQL DDL commands, we need to use the raw SQL execution
    // Since Supabase client doesn't have direct SQL execution, we'll try using rpc
    // or we'll provide the SQL for manual execution
    
    console.log('📝 SQL to execute:');
    console.log('─'.repeat(50));
    console.log(sqlQuery);
    console.log('─'.repeat(50));
    
    // Try to execute via rpc if available, otherwise just log for manual execution
    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql: sqlQuery });
      
      if (error) {
        if (error.message.includes('function exec_sql() does not exist')) {
          console.log('ℹ️  Direct SQL execution not available via client.');
          console.log('   Please run the above SQL manually in Supabase SQL Editor.');
          return { success: false, manualRequired: true };
        } else {
          throw error;
        }
      }
      
      console.log(`✅ ${description} completed successfully`);
      return { success: true };
      
    } catch (rpcError) {
      console.log('ℹ️  Direct SQL execution not available via client.');
      console.log('   Please run the above SQL manually in Supabase SQL Editor.');
      return { success: false, manualRequired: true };
    }
    
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    return { success: false, error: error.message };
  }
}

async function createHostelTables() {
  console.log('\n🏗️  Creating hostel tables...');
  
  // Step 1: Create tables
  const tablesResult = await executeSQL(hostelTablesSQL, 'Creating hostel tables');
  
  // Step 2: Create indexes
  if (tablesResult.success) {
    const indexesResult = await executeSQL(indexesSQL, 'Creating performance indexes');
  }
  
  // Step 3: Set up RLS policies  
  if (tablesResult.success) {
    const rlsResult = await executeSQL(rlsSQL, 'Setting up Row Level Security policies');
  }
  
  return tablesResult;
}

async function testHostelTables() {
  console.log('\n🧪 Testing hostel table access...');
  
  try {
    // Test rooms table
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('id, room_number')
      .limit(1);
    
    if (roomsError) {
      console.log('❌ Rooms table test failed:', roomsError.message);
    } else {
      console.log('✅ Rooms table accessible');
    }
    
    // Test beds table
    const { data: beds, error: bedsError } = await supabase
      .from('beds')
      .select('id, bed_label')
      .limit(1);
    
    if (bedsError) {
      console.log('❌ Beds table test failed:', bedsError.message);
    } else {
      console.log('✅ Beds table accessible');
    }
    
    return !roomsError && !bedsError;
    
  } catch (error) {
    console.error('💥 Testing failed:', error.message);
    return false;
  }
}

async function main() {
  try {
    // Step 1: Check database connection
    const connected = await checkDatabaseConnection();
    if (!connected) {
      process.exit(1);
    }
    
    // Step 2: Check existing tables
    const existingTables = await checkExistingTables();
    
    // Step 3: Create missing tables
    if (existingTables.includes('rooms') && existingTables.includes('beds')) {
      console.log('\n✅ Critical hostel tables already exist!');
      console.log('   Your "relation does not exist" error might be due to:');
      console.log('   - Row Level Security policies blocking access');
      console.log('   - Tenant ID not being set correctly');
      console.log('   - Authentication issues');
      
      // Test access
      const testResult = await testHostelTables();
      if (testResult) {
        console.log('\n🎉 All tests passed! Your hostel system should work now.');
      }
    } else {
      console.log('\n🔨 Missing hostel tables detected. Creating them...');
      const createResult = await createHostelTables();
      
      if (createResult.manualRequired) {
        console.log('\n📋 MANUAL ACTION REQUIRED:');
        console.log('   1. Copy the SQL statements shown above');
        console.log('   2. Go to Supabase Dashboard → SQL Editor');
        console.log('   3. Paste and execute the SQL');
        console.log('   4. Run this script again to verify');
      } else if (createResult.success) {
        console.log('\n🎉 Hostel tables created successfully!');
        
        // Test the new tables
        setTimeout(async () => {
          const testResult = await testHostelTables();
          if (testResult) {
            console.log('\n🎯 Setup complete! Your hostel management system should now work.');
          }
        }, 2000);
      }
    }
    
  } catch (error) {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  }
}

// Execute the main function
if (require.main === module) {
  main().then(() => {
    console.log('\n✨ Script completed.');
  }).catch(error => {
    console.error('\n💥 Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = {
  checkDatabaseConnection,
  checkExistingTables,
  createHostelTables,
  testHostelTables
};