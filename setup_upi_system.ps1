# PowerShell script to set up the complete UPI payment system
# This script creates all necessary database components

param(
    [string]$DatabaseUrl = $null,
    [string]$DatabaseName = "schoolmanagement",
    [string]$Username = "postgres",
    [string]$Host = "localhost",
    [string]$Port = "5432"
)

Write-Host "Setting up UPI Payment System..." -ForegroundColor Green
Write-Host "This will create:" -ForegroundColor Cyan
Write-Host "  ✓ student_fees table with proper structure" -ForegroundColor White
Write-Host "  ✓ upi_transactions table for UPI tracking" -ForegroundColor White
Write-Host "  ✓ receipt_number_seq sequence" -ForegroundColor White
Write-Host "  ✓ Performance indexes" -ForegroundColor White
Write-Host "  ✓ RLS policies for tenant isolation" -ForegroundColor White
Write-Host "  ✓ Helper functions for UPI references" -ForegroundColor White
Write-Host ""

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
$SetupScript = Join-Path $ScriptDirectory "setup_upi_payment_system.sql"

# Check if SQL file exists
if (-not (Test-Path $SetupScript)) {
    Write-Error "setup_upi_payment_system.sql not found at: $SetupScript"
    exit 1
}

try {
    Write-Host "Executing UPI payment system setup..." -ForegroundColor Yellow
    Write-Host "This may take a few moments..." -ForegroundColor Gray
    
    if ($DatabaseUrl) {
        # Use DATABASE_URL if provided (for Supabase or hosted databases)
        Write-Host "Using database URL connection..." -ForegroundColor Cyan
        psql $DatabaseUrl -f $SetupScript
    } else {
        # Use individual connection parameters
        $env:PGPASSWORD = Read-Host "Enter PostgreSQL password" -AsSecureString | ConvertFrom-SecureString -AsPlainText
        psql -h $Host -p $Port -U $Username -d $DatabaseName -f $SetupScript
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "🎉 UPI Payment System setup completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "What was created:" -ForegroundColor Cyan
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
        Write-Host "  📋 Tables:" -ForegroundColor Yellow
        Write-Host "     • student_fees (with proper constraints)" -ForegroundColor White
        Write-Host "     • upi_transactions (with relationships)" -ForegroundColor White
        Write-Host ""
        Write-Host "  🔢 Sequences:" -ForegroundColor Yellow
        Write-Host "     • receipt_number_seq (starting from 1000)" -ForegroundColor White
        Write-Host ""
        Write-Host "  🚀 Performance Indexes:" -ForegroundColor Yellow
        Write-Host "     • student_fees: receipt_number, tenant_id, student_id" -ForegroundColor White
        Write-Host "     • upi_transactions: student_id, status, tenant_id, ref" -ForegroundColor White
        Write-Host ""
        Write-Host "  🔒 Security:" -ForegroundColor Yellow
        Write-Host "     • Row Level Security (RLS) enabled" -ForegroundColor White
        Write-Host "     • Tenant isolation policies configured" -ForegroundColor White
        Write-Host ""
        Write-Host "  🛠️ Helper Functions:" -ForegroundColor Yellow
        Write-Host "     • generate_upi_transaction_ref()" -ForegroundColor White
        Write-Host "     • safe_set_tenant_id()" -ForegroundColor White
        Write-Host "     • update_upi_transactions_updated_at()" -ForegroundColor White
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Next Steps:" -ForegroundColor Green
        Write-Host "  1. Your UPI payment system is now ready to use" -ForegroundColor White
        Write-Host "  2. The PGRST116 errors should be resolved" -ForegroundColor White
        Write-Host "  3. Payments can now be created, verified, and saved properly" -ForegroundColor White
        Write-Host "  4. Test the payment flow in your application" -ForegroundColor White
        Write-Host ""
        Write-Host "📝 Note: If you're using Supabase, make sure your RLS policies" -ForegroundColor Yellow
        Write-Host "   allow the operations your application needs to perform." -ForegroundColor Yellow
        
    } else {
        Write-Error "❌ Failed to setup UPI payment system. Check the error messages above."
        Write-Host ""
        Write-Host "Common issues:" -ForegroundColor Yellow
        Write-Host "  • Database connection failed" -ForegroundColor Gray
        Write-Host "  • Missing permissions to create tables/sequences" -ForegroundColor Gray
        Write-Host "  • Foreign key constraints reference non-existent tables" -ForegroundColor Gray
        Write-Host "  • Database already has conflicting table structures" -ForegroundColor Gray
        exit 1
    }
    
} catch {
    Write-Error "Error executing setup script: $_"
    exit 1
}

Write-Host "`n🔧 Troubleshooting Tips:" -ForegroundColor Magenta
Write-Host "If you still encounter PGRST116 errors:" -ForegroundColor White
Write-Host "  1. Check that your Supabase project has the tables created" -ForegroundColor Gray
Write-Host "  2. Verify RLS policies allow your operations" -ForegroundColor Gray
Write-Host "  3. Ensure the tenant_id values are correct" -ForegroundColor Gray
Write-Host "  4. Try disabling RLS temporarily for testing" -ForegroundColor Gray
