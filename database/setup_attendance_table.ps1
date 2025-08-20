# PowerShell script to set up the student_attendance table
# Make sure you have PostgreSQL client tools installed (psql)

param(
    [string]$DatabaseUrl = $null,
    [string]$DatabaseName = "schoolmanagement",
    [string]$Username = "postgres",
    [string]$Host = "localhost",
    [string]$Port = "5432"
)

Write-Host "Setting up student_attendance table..." -ForegroundColor Green

# Check if psql is available
try {
    $psqlVersion = psql --version
    Write-Host "Found PostgreSQL client: $psqlVersion" -ForegroundColor Green
} catch {
    Write-Error "psql command not found. Please install PostgreSQL client tools."
    exit 1
}

# Get the directory where this script is located
$ScriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$CreateTableScript = Join-Path $ScriptDirectory "create_student_attendance.sql"
$SampleDataScript = Join-Path $ScriptDirectory "insert_sample_attendance_data.sql"

# Check if SQL files exist
if (-not (Test-Path $CreateTableScript)) {
    Write-Error "create_student_attendance.sql not found at: $CreateTableScript"
    exit 1
}

if (-not (Test-Path $SampleDataScript)) {
    Write-Error "insert_sample_attendance_data.sql not found at: $SampleDataScript"
    exit 1
}

try {
    Write-Host "Creating student_attendance table..." -ForegroundColor Yellow
    
    if ($DatabaseUrl) {
        # Use DATABASE_URL if provided (for Supabase or hosted databases)
        psql $DatabaseUrl -f $CreateTableScript
    } else {
        # Use individual connection parameters
        $env:PGPASSWORD = Read-Host "Enter PostgreSQL password" -AsSecureString | ConvertFrom-SecureString -AsPlainText
        psql -h $Host -p $Port -U $Username -d $DatabaseName -f $CreateTableScript
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Table created successfully!" -ForegroundColor Green
        
        $insertSample = Read-Host "Do you want to insert sample attendance data? (y/N)"
        if ($insertSample -match "^[Yy]") {
            Write-Host "Inserting sample data..." -ForegroundColor Yellow
            
            if ($DatabaseUrl) {
                psql $DatabaseUrl -f $SampleDataScript
            } else {
                psql -h $Host -p $Port -U $Username -d $DatabaseName -f $SampleDataScript
            }
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Sample data inserted successfully!" -ForegroundColor Green
            } else {
                Write-Warning "⚠️  Sample data insertion completed with warnings. Check the output above."
            }
        }
    } else {
        Write-Error "❌ Failed to create table. Check the error messages above."
        exit 1
    }
    
} catch {
    Write-Error "Error executing SQL scripts: $_"
    exit 1
}

Write-Host "`n🎉 Setup completed!" -ForegroundColor Green
Write-Host "Your AttendanceSummary.js component should now be able to fetch real attendance data." -ForegroundColor Cyan
