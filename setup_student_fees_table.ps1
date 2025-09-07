# PowerShell script to set up the student_fees table
# Make sure you have PostgreSQL client tools installed (psql)

param(
    [string]$DatabaseUrl = $null,
    [string]$DatabaseName = "schoolmanagement",
    [string]$Username = "postgres",
    [string]$Host = "localhost",
    [string]$Port = "5432"
)

Write-Host "Setting up student_fees table..." -ForegroundColor Green

# Check if psql is available
try {
    $psqlVersion = psql --version
    Write-Host "Found PostgreSQL client: $psqlVersion" -ForegroundColor Green
} catch {
    Write-Error "psql command not found. Please install PostgreSQL client tools or add PostgreSQL bin directory to PATH."
    Write-Host "Typical paths to add to PATH:" -ForegroundColor Yellow
    Write-Host "  - C:\Program Files\PostgreSQL\15\bin" -ForegroundColor Cyan
    Write-Host "  - C:\Program Files\PostgreSQL\14\bin" -ForegroundColor Cyan
    Write-Host "  - C:\Program Files\PostgreSQL\13\bin" -ForegroundColor Cyan
    exit 1
}

# Get the directory where this script is located
$ScriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$CreateTableScript = Join-Path $ScriptDirectory "student_fees_table_fixed.sql"

# Check if SQL file exists
if (-not (Test-Path $CreateTableScript)) {
    Write-Error "student_fees_table_fixed.sql not found at: $CreateTableScript"
    exit 1
}

try {
    Write-Host "Creating student_fees table and sequence..." -ForegroundColor Yellow
    
    if ($DatabaseUrl) {
        # Use DATABASE_URL if provided (for Supabase or hosted databases)
        Write-Host "Using database URL connection..." -ForegroundColor Cyan
        psql $DatabaseUrl -f $CreateTableScript
    } else {
        # Use individual connection parameters
        $env:PGPASSWORD = Read-Host "Enter PostgreSQL password" -AsSecureString | ConvertFrom-SecureString -AsPlainText
        psql -h $Host -p $Port -U $Username -d $DatabaseName -f $CreateTableScript
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Student fees table and indexes created successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "The following components were created:" -ForegroundColor Cyan
        Write-Host "  ✓ receipt_number_seq sequence" -ForegroundColor White
        Write-Host "  ✓ public.student_fees table with proper constraints" -ForegroundColor White
        Write-Host "  ✓ Indexes for performance optimization" -ForegroundColor White
        Write-Host "  ✓ Foreign key constraints to students and tenants tables" -ForegroundColor White
        Write-Host "  ✓ Check constraint for payment_mode validation" -ForegroundColor White
    } else {
        Write-Error "❌ Failed to create table. Check the error messages above."
        exit 1
    }
    
} catch {
    Write-Error "Error executing SQL script: $_"
    exit 1
}

Write-Host "`n🎉 Setup completed!" -ForegroundColor Green
Write-Host "Your student_fees table is now ready to store fee payment records." -ForegroundColor Cyan
