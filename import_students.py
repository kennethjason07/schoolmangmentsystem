#!/usr/bin/env python3
"""
Student Data Import Script
Imports student data from Excel file to PostgreSQL database with proper tenant_id
"""
import pandas as pd
import psycopg2
import uuid
import sys
import json
from datetime import datetime, date
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Database configuration
DB_CONFIG = {
    'host': 'localhost',  # Update with your database host
    'database': 'school_management',  # Update with your database name
    'user': 'your_db_user',  # Update with your database user
    'password': 'your_db_password',  # Update with your database password
    'port': '5432'
}

# Constants
TENANT_ID = '9abe534f-1a12-474c-a387-f8795ad3ab5a'
EXCEL_FILE = 'STUDENT  LIST 2025 -26 Global.xlsx'
ACADEMIC_YEAR = '2025-26'

def connect_database():
    """Connect to PostgreSQL database"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
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
    df['created_at'] = datetime.now()
    
    # Clean gender data - convert to proper format
    df['gender'] = df['gender'].fillna('').str.strip().str.upper()
    df['gender'] = df['gender'].map({'M': 'Male', 'F': 'Female', 'MALE': 'Male', 'FEMALE': 'Female'})
    df['gender'] = df['gender'].fillna('Male')  # Default to Male if not specified
    
    # Clean names
    df['student_name'] = df['student_name'].fillna('').str.strip().str.title()
    df['father_name'] = df['father_name'].fillna('').str.strip().str.title()
    
    # Clean dates
    df['dob'] = pd.to_datetime(df['dob'], errors='coerce')
    
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
    df.loc[df['admission_no'] == '', 'admission_no'] = [f"ADM{datetime.now().year}{str(i).zfill(4)}" for i in range(1, len(df[df['admission_no'] == '']) + 1)]
    
    # Add mobile numbers to remarks for parent linking later
    df['remarks'] = df.apply(lambda row: f"Mobile: {row['mobile']}, Alt Mobile: {row['alternate_mobile']}, Father: {row['father_name']}" if pd.notna(row['mobile']) else '', axis=1)
    
    # Handle missing required fields
    df['name'] = df['student_name']
    df['dob'] = df['dob'].fillna(date(2010, 1, 1))  # Default DOB if missing
    
    logger.info(f"Processed {len(df)} student records")
    return df

def get_or_create_class_mapping(conn):
    """Get existing classes or create default ones"""
    cursor = conn.cursor()
    
    # First, check existing classes for this tenant
    cursor.execute("""
        SELECT id, class_name, section 
        FROM classes 
        WHERE tenant_id = %s
        ORDER BY class_name, section
    """, (TENANT_ID,))
    
    existing_classes = cursor.fetchall()
    
    if existing_classes:
        logger.info(f"Found {len(existing_classes)} existing classes")
        # Create a mapping of class names to IDs
        class_mapping = {}
        for class_id, class_name, section in existing_classes:
            key = f"{class_name}-{section}".upper() if section else class_name.upper()
            class_mapping[key] = class_id
            class_mapping[class_name.upper()] = class_id  # Also map by class name only
        return class_mapping
    else:
        logger.info("No existing classes found. Creating default classes...")
        # Create default classes
        default_classes = [
            ('NURSERY', 'A'), ('LKG', 'A'), ('UKG', 'A'),
            ('1ST', 'A'), ('2ND', 'A'), ('3RD', 'A'), ('4TH', 'A'), ('5TH', 'A'),
            ('6TH', 'A'), ('7TH', 'A'), ('8TH', 'A'), ('9TH', 'A'), ('10TH', 'A')
        ]
        
        class_mapping = {}
        for class_name, section in default_classes:
            class_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO classes (id, class_name, section, academic_year, tenant_id, created_at)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (class_id, class_name, section, ACADEMIC_YEAR, TENANT_ID, datetime.now()))
            
            class_mapping[f"{class_name}-{section}"] = class_id
            class_mapping[class_name] = class_id
        
        conn.commit()
        logger.info(f"Created {len(default_classes)} default classes")
        return class_mapping

def import_students_to_database(df, conn):
    """Import student data to database"""
    cursor = conn.cursor()
    
    # Get class mapping
    class_mapping = get_or_create_class_mapping(conn)
    
    # Prepare SQL statement
    insert_sql = """
        INSERT INTO students (
            id, admission_no, name, dob, gender, religion, caste, 
            address, academic_year, remarks, class_id, 
            tenant_id, created_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
    """
    
    success_count = 0
    error_count = 0
    
    for index, row in df.iterrows():
        try:
            # Determine class_id (use first available class if not determinable)
            class_id = list(class_mapping.values())[0] if class_mapping else None
            
            # Prepare values for insertion
            values = (
                row['id'],
                row['admission_no'],
                row['name'][:100] if pd.notna(row['name']) else 'Unknown',  # Truncate if too long
                row['dob'] if pd.notna(row['dob']) else date(2010, 1, 1),
                row['gender'],
                row['religion'][:50] if pd.notna(row['religion']) else None,
                row['caste'],
                row['address'][:500] if pd.notna(row['address']) else None,  # Truncate address
                row['academic_year'],
                row['remarks'][:1000] if pd.notna(row['remarks']) else None,  # Truncate remarks
                class_id,
                row['tenant_id'],
                row['created_at']
            )
            
            cursor.execute(insert_sql, values)
            success_count += 1
            
            if success_count % 100 == 0:
                logger.info(f"Imported {success_count} students...")
                conn.commit()  # Commit every 100 records
                
        except Exception as e:
            logger.error(f"Error importing student {row.get('name', 'Unknown')} (row {index + 1}): {e}")
            error_count += 1
            continue
    
    # Final commit
    conn.commit()
    cursor.close()
    
    logger.info(f"Import completed: {success_count} successful, {error_count} errors")
    return success_count, error_count

def verify_import(conn):
    """Verify the imported data"""
    cursor = conn.cursor()
    
    # Count imported students
    cursor.execute("SELECT COUNT(*) FROM students WHERE tenant_id = %s", (TENANT_ID,))
    student_count = cursor.fetchone()[0]
    
    # Get sample data
    cursor.execute("""
        SELECT name, admission_no, gender, dob, address 
        FROM students 
        WHERE tenant_id = %s 
        LIMIT 5
    """, (TENANT_ID,))
    sample_students = cursor.fetchall()
    
    logger.info(f"Verification: {student_count} students imported for tenant {TENANT_ID}")
    logger.info("Sample imported students:")
    for student in sample_students:
        logger.info(f"  - {student[0]} (Admission: {student[1]}, Gender: {student[2]}, DOB: {student[3]})")
    
    cursor.close()
    return student_count

def main():
    """Main function to orchestrate the import process"""
    logger.info("Starting student data import...")
    logger.info(f"Target tenant ID: {TENANT_ID}")
    logger.info(f"Excel file: {EXCEL_FILE}")
    
    try:
        # Step 1: Connect to database
        logger.info("Step 1: Connecting to database...")
        conn = connect_database()
        if not conn:
            logger.error("Failed to connect to database. Please check your database configuration.")
            return False
        
        # Step 2: Clean Excel data
        logger.info("Step 2: Processing Excel data...")
        df = clean_excel_data()
        
        if len(df) == 0:
            logger.error("No data found in Excel file")
            return False
        
        # Step 3: Import to database
        logger.info("Step 3: Importing students to database...")
        success_count, error_count = import_students_to_database(df, conn)
        
        # Step 4: Verify import
        logger.info("Step 4: Verifying import...")
        total_imported = verify_import(conn)
        
        # Close connection
        conn.close()
        
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
    print("STUDENT DATA IMPORT CONFIGURATION")
    print("="*50)
    print(f"Excel file: {EXCEL_FILE}")
    print(f"Target tenant ID: {TENANT_ID}")
    print(f"Academic year: {ACADEMIC_YEAR}")
    print(f"Database host: {DB_CONFIG['host']}")
    print(f"Database name: {DB_CONFIG['database']}")
    print("="*50)
    
    # Ask for confirmation
    confirm = input("\nProceed with import? (y/N): ").strip().lower()
    if confirm not in ['y', 'yes']:
        print("Import cancelled.")
        sys.exit(0)
    
    # Ask for database credentials if not set
    if DB_CONFIG['user'] == 'your_db_user':
        print("\nDatabase credentials required:")
        DB_CONFIG['host'] = input(f"Database host [{DB_CONFIG['host']}]: ").strip() or DB_CONFIG['host']
        DB_CONFIG['database'] = input(f"Database name [{DB_CONFIG['database']}]: ").strip() or DB_CONFIG['database']
        DB_CONFIG['user'] = input("Database user: ").strip()
        DB_CONFIG['password'] = input("Database password: ").strip()
        DB_CONFIG['port'] = input(f"Database port [{DB_CONFIG['port']}]: ").strip() or DB_CONFIG['port']
    
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
