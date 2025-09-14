#!/usr/bin/env python3
"""
Test script to verify credentials loading
"""

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
        print("credentials.txt file not found!")
        return None, None
    except Exception as e:
        print(f"Error reading credentials: {e}")
        return None, None

if __name__ == "__main__":
    url, key = load_credentials()
    print("Credentials Test Results:")
    print("=" * 40)
    print(f"Project URL: {url}")
    print(f"Anon Key loaded: {'Yes' if key else 'No'}")
    if key:
        print(f"Key length: {len(key)} characters")
        print(f"Key starts with: {key[:20]}...")
    print("=" * 40)
    
    if url and key:
        print("✅ Credentials loaded successfully!")
        print("Ready to run import_students_supabase.py")
    else:
        print("❌ Failed to load credentials")
