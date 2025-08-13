# Smartwatch Health Coach - Automation Instructions

## Project Overview
This project is a backend application for a smartwatch health coaching system. It integrates with Fitrockr API to fetch user health data, generates personalized coaching messages using OpenAI, and sends notifications to users.

## Automation Feature
The project now includes an automation system that runs daily at midnight to:
1. Fetch all users from Fitrockr API
2. Get their daily health summaries
3. Generate personalized coaching messages based on their health data
4. Send notifications to each user
5. Store the health data in the database

## Setup Instructions

### Prerequisites
- Node.js installed
- npm installed
- Azure SQL Database set up
- Fitrockr API credentials
- OpenAI API key

### Environment Variables
Make sure your `.env` file contains the following variables:
```
# Database Configuration
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_SERVER=your_db_server
DB_DATABASE=your_db_name
DB_PORT=1433

# Fitrockr API
FITROCKR_TENANT=your_fitrockr_tenant
FITROCKR_API_KEY=your_fitrockr_api_key

# OpenAI API
OPENAI_API_KEY=your_openai_api_key

# Internal API for Notifications
INTERNAL_API_URL=your_internal_api_url
INTERNAL_API_TOKEN=your_internal_api_token

# Server Configuration
PORT=3000
```

### Database Setup
Ensure your Azure SQL Database has a table named `health_data` with the following schema:
```sql
CREATE TABLE health_data (
    id INT IDENTITY(1,1) PRIMARY KEY,
    userId VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    steps INT,
    calories INT,
    distance FLOAT,
    activeMinutes INT,
    sleepHours FLOAT,
    heartRate INT,
    createdAt DATETIME DEFAULT GETDATE()
);
```

## Running the Application

### Install Dependencies
```
npm install
```

### Start the API Server
```
npm start
```

### Start the Automation Process
There are several ways to run the automation:

1. **As part of the API server** (add to your .env file):
```
START_AUTOMATION=true
```
Then start the server normally:
```
npm start
```

2. **As a separate process**:
```
npm run automate
```

3. **Using the standalone script** (good for production with PM2):
```
node run-automation.js
```

## Automation Details

### Scheduling
The automation is scheduled to run at midnight (00:00) every day using node-cron.

### Manual Triggering
You can also trigger the automation process manually by running:
```
npm run automate
```

### Production Deployment
For production environments, it's recommended to use a process manager like PM2:

```
# Install PM2 globally
npm install -g pm2

# Start the API server
pm2 start index.js --name "smartwatch-api"

# Start the automation process
pm2 start run-automation.js --name "smartwatch-automation"

# Set both to restart automatically on server reboot
pm2 startup
pm2 save
```

### Logs
Check the console logs for information about the automation process, including:
- Number of users found
- Health data processing status for each user
- Notification status for each user
- Any errors that occur during the process

## API Endpoints

### Fitrockr Data
- GET `/api/fitrockr/users` - Get all users from Fitrockr
- GET `/api/fitrockr/daily-summary/:userId` - Get daily summary for a specific user

### Message Generation
- POST `/api/message/generate` - Generate a personalized coaching message

### Notifications
- POST `/api/notify/send` - Send a notification to a user

## Troubleshooting

### Common Issues
1. **Database Connection Errors**: Check your database credentials and make sure the database is accessible.
2. **API Authentication Errors**: Verify your Fitrockr and OpenAI API keys.
3. **Scheduling Issues**: Make sure your server's time is correctly set.

### Support
For any issues or questions, please contact the system administrator.