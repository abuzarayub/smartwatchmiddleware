# PowerShell script to create Azure deployment package
param(
    [string]$OutputPath = "../smartwatch-coach-deployment.zip",
    [switch]$IncludeNodeModules = $false
)

Write-Host "Creating Azure deployment package..." -ForegroundColor Green

# Get current directory
$currentDir = Get-Location
Write-Host "Working directory: $currentDir" -ForegroundColor Yellow

# Files to exclude from deployment
$excludePatterns = @(
    "*.git*",
    "*.env*",
    "node_modules/*",
    "*.gradle*",
    "gradle*",
    "build.gradle.kts",
    "settings.gradle.kts",
    "gradlew*",
    "local.properties",
    "app/*",
    "*.txt",
    "*.md",
    "*.ps1",
    "*.zip",
    ".deployment"
)

# Create temporary directory for clean package
$tempDir = Join-Path $currentDir "..\temp-deployment"
if (Test-Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir | Out-Null

# Copy essential files
Write-Host "Copying essential files..." -ForegroundColor Yellow

# Copy all files except excluded ones
Get-ChildItem -Path $currentDir -File | Where-Object {
    $file = $_
    -not ($excludePatterns | Where-Object { $file.Name -like $_ })
} | Copy-Item -Destination $tempDir

# Copy directories (excluding node_modules and app)
Get-ChildItem -Path $currentDir -Directory | Where-Object {
    $dir = $_
    -not ($excludePatterns | Where-Object { $dir.Name -like $_ })
} | Copy-Item -Destination $tempDir -Recurse

# Copy node_modules if requested
if ($IncludeNodeModules) {
    Write-Host "Including node_modules..." -ForegroundColor Yellow
    if (Test-Path "node_modules") {
        Copy-Item -Path "node_modules" -Destination $tempDir -Recurse
    }
}

# Create zip file
Write-Host "Creating deployment package..." -ForegroundColor Yellow
$zipPath = Join-Path $currentDir $OutputPath
if (Test-Path $zipPath) {
    Remove-Item -Path $zipPath -Force
}

Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath

# Clean up temporary directory
Remove-Item -Path $tempDir -Recurse -Force

Write-Host "Deployment package created: $zipPath" -ForegroundColor Green
Write-Host "Package size: $([math]::Round((Get-Item $zipPath).Length / 1MB, 2)) MB" -ForegroundColor Cyan

# Verify package contents
Write-Host "Verifying package contents..." -ForegroundColor Yellow
$zipContent = Get-ChildItem -Path $tempDir -Recurse -File | Select-Object Name, Length
$zipContent | Format-Table -AutoSize

Write-Host "Deployment package ready for Azure deployment!" -ForegroundColor Green
Write-Host "Use Azure Portal or Azure CLI to deploy this package." -ForegroundColor Cyan