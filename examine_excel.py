#!/usr/bin/env python3
"""
Script to examine Excel file structure and prepare it for database import
"""
import pandas as pd
import sys
import json

def examine_excel_file(filename):
    """
    Examine the structure of an Excel file
    """
    try:
        # Read the Excel file
        print(f"Examining Excel file: {filename}")
        print("="*60)
        
        # Get all sheet names
        excel_file = pd.ExcelFile(filename)
        sheet_names = excel_file.sheet_names
        print(f"Found {len(sheet_names)} sheet(s): {sheet_names}")
        print()
        
        for sheet_name in sheet_names:
            print(f"Sheet: '{sheet_name}'")
            print("-" * 40)
            
            # Read the sheet
            df = pd.read_excel(filename, sheet_name=sheet_name)
            
            # Basic info
            print(f"Rows: {len(df)}")
            print(f"Columns: {len(df.columns)}")
            print()
            
            # Column information
            print("Columns:")
            for i, col in enumerate(df.columns, 1):
                print(f"  {i}. {col} (dtype: {df[col].dtype})")
            print()
            
            # Sample data (first 5 rows)
            print("Sample data (first 5 rows):")
            print(df.head().to_string())
            print()
            
            # Check for null values
            null_counts = df.isnull().sum()
            if null_counts.any():
                print("Null value counts:")
                for col, count in null_counts.items():
                    if count > 0:
                        print(f"  {col}: {count} null values")
                print()
            
            # Generate sample JSON for database insertion
            print("Sample JSON structure for database:")
            if len(df) > 0:
                sample_record = df.iloc[0].to_dict()
                # Convert numpy types to Python types for JSON serialization
                for key, value in sample_record.items():
                    if pd.isna(value):
                        sample_record[key] = None
                    elif hasattr(value, 'item'):  # numpy types
                        sample_record[key] = value.item()
                
                print(json.dumps(sample_record, indent=2, default=str))
            print()
            print("="*60)
            
    except Exception as e:
        print(f"Error reading Excel file: {str(e)}")
        return None

if __name__ == "__main__":
    filename = "STUDENT  LIST 2025 -26 Global.xlsx"
    examine_excel_file(filename)
