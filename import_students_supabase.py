#!/usr/bin/env python3
"""
Student Data Import Script for Supabase
Imports student data from Excel file to Supabase with proper tenant_id
"""
import pandas as pd
import os
import sys
import json
from datetime import datetime, date
import logging
from supabase import create_client, Client
import uuid

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configuration - reads from credentials.txt
def load_credentials():
    """Load Supabase credentials from credentials.txt"""
    try:
        with open('credentials.txt', 'r') as f:
            content = f.read()
            
        lines = content.strip().split('\n')
        credentials = {}
        
        for line in lines:
            line = line.strip()
            if line and ':' in line:
                key, value = line.split(':', 1)
                key = key.strip().lower().replace(' ', '_')
                value = value.strip()
                credentials[key] = value
        
        return credentials.get('project_url'), credentials.get('anon_key')
        
    except FileNotFoundError:
        logger.error("credentials.txt file not found!")
        return None, None
    except Exception as e:
        logger.error(f"Error reading credentials: {e}")
        return None, None

# Load credentials from file
SUPABASE_URL, SUPABASE_KEY = load_credentials()

# Constants
TENANT_ID = '9abe534f-1a12-474c-a387-f8795ad3ab5a'
EXCEL_FILE = 'STUDENT  LIST 2025 -26 Global.xlsx'
ACADEMIC_YEAR = '2025-26'

def init_supabase():
    """Initialize Supabase client"""
    try:
        # Use credentials loaded from file
        url = SUPABASE_URL
        key = SUPABASE_KEY
        
        if not url or not key:
            logger.error("Failed to load credentials from credentials.txt")
            logger.error("Please ensure credentials.txt exists with valid Supabase credentials")
            return None
            
        supabase: Client = create_client(url, key)
        logger.info(f"Connected to Supabase successfully: {url}")
        return supabase
    except Exception as e:
        logger.error(f"Supabase connection failed: {e}")
        return None

def clean_excel_data():
    """Clean and prepare Excel data for import"""
    logger.info("Reading Excel file...")
    
    # Read the Excel file - skip first row as it contains headers
    df = pd.read_excel(EXCEL_FILE, sheet_name='Sheet1', skiprows=1)
    
    # Remove empty rows
    df = df.dropna(how='all')
    
    # Define column mapping from Excel to database
    column_mapping = {
        'Unnamed: 0': 'serial_number',  # SN.
        'Class': 'student_name',         # Student Name
        'NURSERY': 'father_name',        # Father Name
        'Unnamed: 3': 'mobile',          # Mobile
        'Unnamed: 4': 'alternate_mobile', # Alternate Number
        'Unnamed: 5': 'gender',          # Gender
        'Unnamed: 6': 'dob',             # Date of Birth
        'Unnamed: 7': 'address',         # Address
        'Unnamed: 8': 'religion',        # Religion
        'Unnamed: 9': 'caste',           # Caste
        'Unnamed: 11': 'blood_group',    # Blood Group
        'Unnamed: 12': 'admission_no',   # Admission Number
        'Unnamed: 13': 'bus_facility'    # Bus Facility
    }
    
    # Rename columns
    df = df.rename(columns=column_mapping)
    
    # Clean and prepare data
    df['id'] = [str(uuid.uuid4()) for _ in range(len(df))]
    df['tenant_id'] = TENANT_ID
    df['academic_year'] = ACADEMIC_YEAR
    df['created_at'] = datetime.now().isoformat()
    
    # Clean gender data - convert to proper format
    df['gender'] = df['gender'].fillna('').str.strip().str.upper()
    df['gender'] = df['gender'].map({'M': 'Male', 'F': 'Female', 'MALE': 'Male', 'FEMALE': 'Female'})
    df['gender'] = df['gender'].fillna('Male')  # Default to Male if not specified
    
    # Clean names
    df['student_name'] = df['student_name'].fillna('').str.strip().str.title()
    df['father_name'] = df['father_name'].fillna('').str.strip().str.title()
    
    # Clean dates - convert to YYYY-MM-DD format for Supabase
    df['dob'] = pd.to_datetime(df['dob'], errors='coerce')
    df['dob'] = df['dob'].dt.strftime('%Y-%m-%d')
    df['dob'] = df['dob'].fillna('2010-01-01')  # Default date if missing
    
    # Clean addresses
    df['address'] = df['address'].fillna('').str.strip()
    
    # Clean religion and caste
    df['religion'] = df['religion'].fillna('').str.strip().str.title()
    df['caste'] = df['caste'].fillna('').str.strip().str.upper()
    
    # Map caste values to allowed values
    caste_mapping = {
        'BC': 'BC', 'SC': 'SC', 'ST': 'ST', 'OC': 'OC', 
        'GENERAL': 'OC', 'OTHER': 'Other', '': 'Other'
    }
    df['caste'] = df['caste'].map(caste_mapping).fillna('Other')
    
    # Clean admission numbers
    df['admission_no'] = df['admission_no'].fillna('').astype(str).str.strip()
    empty_admission = df['admission_no'] == ''
    df.loc[empty_admission, 'admission_no'] = [f"ADM{datetime.now().year}{str(i).zfill(4)}" for i in range(1, empty_admission.sum() + 1)]
    
    # Add mobile numbers to remarks for parent linking later
    df['remarks'] = df.apply(lambda row: f"Mobile: {row['mobile']}, Alt Mobile: {row['alternate_mobile']}, Father: {row['father_name']}" if pd.notna(row['mobile']) else '', axis=1)
    
    # Handle missing required fields
    df['name'] = df['student_name']
    
    # Clean up empty strings and NaN values for Supabase
    string_columns = ['name', 'address', 'religion', 'remarks', 'father_name', 'mobile', 'alternate_mobile']
    for col in string_columns:
        if col in df.columns:
            df[col] = df[col].fillna('').replace('nan', '').replace('NaN', '')
    
    logger.info(f"Processed {len(df)} student records")
    return df

def get_or_create_classes(supabase):
    """Get existing classes or create default ones"""
    try:
        # First, check existing classes for this tenant
        response = supabase.table('classes').select('id,class_name,section').eq('tenant_id', TENANT_ID).execute()
        
        existing_classes = response.data
        
        if existing_classes:
            logger.info(f"Found {len(existing_classes)} existing classes")
            # Return first class ID for assignment
            return existing_classes[0]['id']
        else:
            logger.info("No existing classes found. Creating default class...")
            # Create a default class
            new_class = {
                'id': str(uuid.uuid4()),
                'class_name': 'General',
                'section': 'A',
                'academic_year': ACADEMIC_YEAR,
                'tenant_id': TENANT_ID,
                'created_at': datetime.now().isoformat()
            }
            
            response = supabase.table('classes').insert(new_class).execute()
            
            if response.data:
                logger.info(f"Created default class: {new_class['class_name']}-{new_class['section']}")
                return new_class['id']
            else:
                logger.warning("Could not create class, will proceed without class assignment")
                return None
                
    except Exception as e:
        logger.error(f"Error handling classes: {e}")
        return None

def import_students_batch(supabase, students_batch):
    """Import a batch of students to Supabase"""
    try:
        response = supabase.table('students').insert(students_batch).execute()
        
        if response.data:
            return len(response.data), 0
        else:
            logger.error(f"Batch import failed: {response}")
            return 0, len(students_batch)
            
    except Exception as e:
        logger.error(f"Error importing batch: {e}")
        return 0, len(students_batch)

def import_students_to_supabase(df, supabase):
    """Import student data to Supabase"""
    
    # Get or create a default class
    default_class_id = get_or_create_classes(supabase)
    
    success_count = 0
    error_count = 0
    batch_size = 50  # Supabase handles batches well
    
    # Convert DataFrame to list of dictionaries for Supabase
    students = []
    
    for index, row in df.iterrows():
        try:
            student_data = {
                'id': row['id'],
                'admission_no': str(row['admission_no'])[:100],  # Ensure string and truncate
                'name': str(row['name'])[:100] if pd.notna(row['name']) and row['name'] else 'Unknown',
                'dob': row['dob'],
                'gender': row['gender'],
                'religion': str(row['religion'])[:50] if pd.notna(row['religion']) and row['religion'] else None,
                'caste': row['caste'] if row['caste'] and row['caste'] != 'Other' else None,
                'address': str(row['address'])[:500] if pd.notna(row['address']) and row['address'] else None,
                'academic_year': row['academic_year'],
                'remarks': str(row['remarks'])[:1000] if pd.notna(row['remarks']) and row['remarks'] else None,
                'class_id': default_class_id,
                'tenant_id': row['tenant_id'],
                'created_at': row['created_at']
            }
            
            # Remove None values and empty strings to avoid Supabase issues
            student_data = {k: v for k, v in student_data.items() if v is not None and v != ''}
            students.append(student_data)
            
        except Exception as e:
            logger.error(f"Error preparing student {row.get('name', 'Unknown')} (row {index + 1}): {e}")
            error_count += 1
            continue
    
    # Import in batches
    total_students = len(students)
    for i in range(0, total_students, batch_size):
        batch = students[i:i+batch_size]
        batch_success, batch_errors = import_students_batch(supabase, batch)
        success_count += batch_success
        error_count += batch_errors
        
        logger.info(f"Imported batch {i//batch_size + 1}: {batch_success} successful, {batch_errors} errors")
    
    logger.info(f"Import completed: {success_count} successful, {error_count} errors")
    return success_count, error_count

def verify_import(supabase):
    """Verify the imported data"""
    try:
        # Count imported students
        response = supabase.table('students').select('id', count='exact').eq('tenant_id', TENANT_ID).execute()
        student_count = response.count
        
        # Get sample data
        sample_response = supabase.table('students').select('name,admission_no,gender,dob,address').eq('tenant_id', TENANT_ID).limit(5).execute()
        sample_students = sample_response.data
        
        logger.info(f"Verification: {student_count} students imported for tenant {TENANT_ID}")
        logger.info("Sample imported students:")
        for student in sample_students:
            logger.info(f"  - {student['name']} (Admission: {student['admission_no']}, Gender: {student['gender']}, DOB: {student['dob']})")
        
        return student_count
        
    except Exception as e:
        logger.error(f"Verification error: {e}")
        return 0

def main():
    """Main function to orchestrate the import process"""
    logger.info("Starting student data import to Supabase...")
    logger.info(f"Target tenant ID: {TENANT_ID}")
    logger.info(f"Excel file: {EXCEL_FILE}")
    
    try:
        # Step 1: Connect to Supabase
        logger.info("Step 1: Connecting to Supabase...")
        supabase = init_supabase()
        if not supabase:
            logger.error("Failed to connect to Supabase. Please check your configuration.")
            return False
        
        # Step 2: Clean Excel data
        logger.info("Step 2: Processing Excel data...")
        df = clean_excel_data()
        
        if len(df) == 0:
            logger.error("No data found in Excel file")
            return False
        
        # Step 3: Import to Supabase
        logger.info("Step 3: Importing students to Supabase...")
        success_count, error_count = import_students_to_supabase(df, supabase)
        
        # Step 4: Verify import
        logger.info("Step 4: Verifying import...")
        total_imported = verify_import(supabase)
        
        logger.info("="*60)
        logger.info("IMPORT SUMMARY")
        logger.info(f"Records processed: {len(df)}")
        logger.info(f"Successfully imported: {success_count}")
        logger.info(f"Errors: {error_count}")
        logger.info(f"Total students in database: {total_imported}")
        logger.info(f"Tenant ID: {TENANT_ID}")
        logger.info("="*60)
        
        return True
        
    except Exception as e:
        logger.error(f"Import failed: {e}")
        return False

if __name__ == "__main__":
    # Display configuration information
    print("STUDENT DATA IMPORT FOR SUPABASE")
    print("="*50)
    print(f"Excel file: {EXCEL_FILE}")
    print(f"Target tenant ID: {TENANT_ID}")
    print(f"Academic year: {ACADEMIC_YEAR}")
    print(f"Credentials source: credentials.txt")
    if SUPABASE_URL:
        print(f"Supabase URL: {SUPABASE_URL}")
    print("="*50)
    
    # Check if credentials were loaded successfully
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("\n❌ Credentials Loading Failed!")
        print("Please ensure credentials.txt exists and contains:")
        print("1. project url: your-supabase-project-url")
        print("2. anon key: your-supabase-anon-key")
        print("\nExample format:")
        print("project url: https://xxxxx.supabase.co")
        print("anon key: eyJhbGciOiJIUzI1NiIs...")
        sys.exit(1)
    
    # Ask for confirmation
    confirm = input("\nProceed with import? (y/N): ").strip().lower()
    if confirm not in ['y', 'yes']:
        print("Import cancelled.")
        sys.exit(0)
    
    # Run the import
    success = main()
    
    if success:
        print("\n✅ Student data import completed successfully!")
        print(f"All students have been assigned tenant_id: {TENANT_ID}")
        print("You can now access the student data in your application.")
    else:
        print("\n❌ Student data import failed!")
        print("Please check the logs above for error details.")
        sys.exit(1)
