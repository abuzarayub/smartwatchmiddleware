# Azure Deployment Guide for Smartwatch Health Coach API

## Prerequisites
- Node.js 18 LTS or Node.js 16
- Azure CLI or Azure Portal access

## Deployment Configuration

### 1. Environment Variables for Azure
Create a `.env.production` file with Azure-specific environment variables:

```bash
# Azure will automatically set PORT via process.env.PORT
# Database configuration (use Azure SQL or Azure Database for PostgreSQL)
DB_SERVER=your-azure-sql-server.database.windows.net
DB_DATABASE=your-database-name
DB_USER=your-db-username
DB_PASSWORD=your-db-password
DB_PORT=1433

# API Keys (use Azure Key Vault for production)
OPENAI_API_KEY=your-openai-api-key
FITROCKR_API_KEY=your-fitrockr-api-key
FITROCKR_TENANT=your-tenant-name

# Internal API Configuration
INTERNAL_API_URL=https://your-internal-api.azurewebsites.net/api/v1/notification/send-notification-to-driver
INTERNAL_API_TOKEN=your-internal-api-token

# Authentication Service
AUTH_URL=https://your-auth-service.azurewebsites.net/api/v1/auth/login
AUTH_EMAIL=your-auth-email
AUTH_PASSWORD=your-auth-password

# Disable automation on startup (Azure handles this)
START_AUTOMATION=false
```

### 2. Azure Web App Configuration

#### Using Azure Portal:
1. Go to https://portal.azure.com
2. Create a new Web App:
   - **Name**: smartwatch-coach-api-[unique-id]
   - **Runtime**: Node 18 LTS
   - **Operating System**: Linux
   - **Region**: Choose closest region
   - **Plan**: Basic B1 (recommended) or Free F1

#### Using Azure CLI:
```bash
# Login to Azure
az login

# Create resource group
az group create --name rg-smartwatch-coach --location westeurope

# Create web app
az webapp create --resource-group rg-smartwatch-coach --name smartwatch-coach-api --runtime "NODE|18-lts"

# Configure environment variables
az webapp config appsettings set --resource-group rg-smartwatch-coach --name smartwatch-coach-api --settings "DB_SERVER=your-server.database.windows.net" "DB_DATABASE=your-db" "DB_USER=your-user" "DB_PASSWORD=your-password" "OPENAI_API_KEY=your-key" "FITROCKR_API_KEY=your-key" "START_AUTOMATION=false"
```

### 3. Deployment Steps

#### Method 1: Zip Deploy (Recommended)

1. **Prepare the deployment package**:
   ```bash
   cd f:\New folder\mainwebs\smartwatch v2\automater
   
   # Create deployment package (exclude unnecessary files)
   zip -r ../smartwatch-coach-deployment.zip * -x "*.git*" "node_modules/*" "*.env" "*.gradle*" "app/*" "gradle*" "build.gradle.kts" "gradlew*" "settings.gradle.kts" "local.properties" "*.txt" "*.md"
   
   # Or use PowerShell
   Compress-Archive -Path * -DestinationPath ../smartwatch-coach-deployment.zip
   ```

2. **Deploy via Azure Portal**:
   - Go to your Web App in Azure Portal
   - Navigate to **Deployment Center**
   - Select **Zip Deploy**
   - Upload the `smartwatch-coach-deployment.zip` file

3. **Deploy via Azure CLI**:
   ```bash
   az webapp deployment source config-zip --resource-group rg-smartwatch-coach --name smartwatch-coach-api --src ../smartwatch-coach-deployment.zip
   ```

#### Method 2: Local Git Deploy

1. **Setup local git repository**:
   ```bash
   cd f:\New folder\mainwebs\smartwatch v2\automater
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Configure Azure for local git**:
   ```bash
   az webapp deployment source config-local-git --resource-group rg-smartwatch-coach --name smartwatch-coach-api
   ```

3. **Deploy**:
   ```bash
   git remote add azure https://smartwatch-coach-api.scm.azurewebsites.net:443/smartwatch-coach-api.git
   git push azure main
   ```

### 4. Post-Deployment Verification

#### Health Check
```bash
# Test the deployed API
curl https://smartwatch-coach-api.azurewebsites.net/

# Should return: "Smartwatch Coaching API Running"
```

#### API Endpoints Testing
```bash
# Test schedule endpoint
curl -X POST https://smartwatch-coach-api.azurewebsites.net/api/schedule/schedule \
  -H "Content-Type: application/json" \
  -d '{"type":"now","userId":"test-user","message":"Hello from Azure!"}'

# Test logs endpoint
curl https://smartwatch-coach-api.azurewebsites.net/api/schedule/logs
```

### 5. Monitoring and Logs

#### View Application Logs
```bash
# Stream logs
az webapp log tail --resource-group rg-smartwatch-coach --name smartwatch-coach-api

# Download logs
az webapp log download --resource-group rg-smartwatch-coach --name smartwatch-coach-api
```

#### Azure Portal Logs
1. Go to your Web App
2. Navigate to **Monitoring > Log stream**
3. View real-time application logs

### 6. Security Best Practices

1. **Use Azure Key Vault** for sensitive configuration
2. **Enable HTTPS only** in Azure Web App settings
3. **Configure CORS** appropriately
4. **Set up Application Insights** for monitoring
5. **Use managed identity** for database connections

### 7. Scaling Configuration

#### Manual Scaling
- **Basic B1**: 1.75 GB RAM, 100 total ACU
- **Standard S1**: 1.75 GB RAM, 100 total ACU per instance
- **Premium P1V2**: 3.5 GB RAM, 210 total ACU per instance

#### Auto-scaling
```bash
# Enable auto-scaling
az monitor autoscale create --resource-group rg-smartwatch-coach --resource smartwatch-coach-api --resource-type Microsoft.Web/sites --name autoscale-settings --min-count 1 --max-count 3 --count 1
```

### 8. Troubleshooting

#### Common Issues
1. **Port binding**: Ensure app listens on `process.env.PORT || 3000`
2. **Environment variables**: Check all required variables are set
3. **Database connection**: Verify firewall rules and connection strings
4. **Node modules**: Ensure all dependencies are included

#### Debug Commands
```bash
# Check app settings
az webapp config appsettings list --resource-group rg-smartwatch-coach --name smartwatch-coach-api

# Check deployment logs
az webapp log deployment list --resource-group rg-smartwatch-coach --name smartwatch-coach-api
```

### 9. Quick Deployment Script

Create `deploy-to-azure.ps1`:
```powershell
param(
    [string]$ResourceGroup = "rg-smartwatch-coach",
    [string]$WebAppName = "smartwatch-coach-api",
    [string]$Location = "westeurope"
)

# Create resource group if it doesn't exist
az group create --name $ResourceGroup --location $Location

# Create web app
az webapp create --resource-group $ResourceGroup --name $WebAppName --runtime "NODE|18-lts"

# Deploy from local directory
az webapp up --resource-group $ResourceGroup --name $WebAppName --runtime "NODE|18-lts"

Write-Host "Deployment complete! Access your app at: https://$WebAppName.azurewebsites.net"
```

Run with:
```powershell
.\deploy-to-azure.ps1 -WebAppName "smartwatch-coach-api-unique"
```