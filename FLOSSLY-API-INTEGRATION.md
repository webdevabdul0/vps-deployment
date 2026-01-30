# Flossly API Integration - Dual Webhook Implementation

## Overview
The widget now calls **BOTH** the n8n webhook (for Google Calendar) **AND** the Flossly API (for appointment creation in Flossly system) when a user books an appointment.

## Flow Diagram

```
User Books Appointment
    ↓
Widget Formats Data
    ↓
    ├─→ n8n Webhook (Google Calendar) [Non-blocking]
    │   └─→ Creates Google Calendar event
    │
    └─→ Flossly API Endpoint [Blocking - shows response to user]
        └─→ Server calls Flossly API:
            ├─→ GET /api/diary/treatments (optional)
            ├─→ POST /api/diary/patientCreate
            └─→ POST /api/diary/appointmentCreate
```

## Implementation Details

### 1. Widget Changes (`widget.js`)

#### New Function: `sendToFlosslyAPI()`
- Sends appointment data to server endpoint: `https://widget.flossly.ai/api/flossly/appointment`
- Handles responses and conflicts (409 errors)
- Shows user-friendly error messages

#### Updated: `completeAppointment()`
- Calls **both** n8n webhook (non-blocking) and Flossly API (blocking)
- n8n webhook runs in background (for Google Calendar)
- Flossly API response is shown to user

### 2. Server Endpoint (`server.js`)

#### New Endpoint: `POST /api/flossly/appointment`
Handles the complete Flossly API appointment creation flow:

1. **Get Access Token**: Retrieves access token from `bot_tokens[botId]` or `bot_configs[botId]`
2. **Get Treatment Duration** (optional): Fetches `defaultDuration` from `/api/diary/treatments`
3. **Create Patient**: Calls `/api/diary/patientCreate` with patient info
4. **Get Dentist ID**: Fetches user profile to get `dentistId` (userId)
5. **Create Appointment**: Calls `/api/diary/appointmentCreate` with appointment details
6. **Handle Conflicts**: Returns 409 status with user-friendly message

#### New Endpoint: `POST /api/bot-token/:botId`
Stores access token with botId (called from Bot Builder when saving bot config):
```json
{
  "accessToken": "bearer_token_here",
  "dentistId": 210  // optional
}
```

## Data Storage

Access tokens are stored in `flossy_data.json`:
```json
{
  "bot_tokens": {
    "bot-uuid-here": {
      "accessToken": "token_here",
      "dentistId": 210,
      "storedAt": "2025-01-20T10:00:00.000Z"
    }
  }
}
```

## Bot Builder Integration

When saving bot config, the Bot Builder should also call:
```javascript
POST https://widget.flossly.ai/api/bot-token/{botId}
{
  "accessToken": userAccessToken,
  "dentistId": userProfile.data.id
}
```

This ensures the access token is available when appointments are created.

## Error Handling

### 409 Conflict (Time Slot Already Booked)
```json
{
  "success": false,
  "conflict": true,
  "statusCode": 409,
  "error": "Dentist already has an appointment at this time",
  "message": "This time slot is already booked. Please select a different time."
}
```

Widget displays:
```
⚠️ This time slot is already booked. Please select a different time.

The selected time (14:30 on Nov 20, 2025) is not available.

Would you like to try another time?
```

### 401 Unauthorized (No Access Token)
```json
{
  "success": false,
  "statusCode": 401,
  "error": "Access token not found for this bot. Please configure the bot with authentication."
}
```

## Testing

### 1. Store Access Token
```bash
curl -X POST https://widget.flossly.ai/api/bot-token/{botId} \
  -H "Content-Type: application/json" \
  -d '{
    "accessToken": "your_token_here",
    "dentistId": 210
  }'
```

### 2. Test Appointment Creation
The widget will automatically call the endpoint when a user books an appointment.

### 3. Verify Both Webhooks
- Check n8n webhook logs for Google Calendar event creation
- Check server logs for Flossly API calls
- Verify appointment appears in Flossly system

## Important Notes

1. **Access Token Storage**: Access tokens must be stored when bot is configured. The Bot Builder should call `/api/bot-token/:botId` endpoint.

2. **Dual Calls**: Both webhooks are called, but only Flossly API response is shown to user. n8n webhook runs in background.

3. **Error Handling**: If Flossly API fails, user sees error. n8n webhook failures are logged but don't affect user experience.

4. **Token Security**: Access tokens are stored in plain text in `flossy_data.json`. Consider encryption for production.

5. **Dentist ID**: If not provided when storing token, endpoint will fetch from user profile. It's recommended to store it with the token for better performance.

## Next Steps

1. **Update Bot Builder**: Add call to `/api/bot-token/:botId` when saving bot config
2. **Test Integration**: Test with real appointments
3. **Monitor Logs**: Check both webhook and Flossly API logs
4. **Handle Edge Cases**: Test with expired tokens, missing data, etc.

