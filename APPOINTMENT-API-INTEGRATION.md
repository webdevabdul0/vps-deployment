# Appointment API Integration - Widget Updates

## Overview
The widget has been updated to format appointment data according to the Flossly API requirements and handle time slot conflicts (409 errors) with user-friendly messages.

## Changes Made

### 1. Updated `completeAppointment()` Function
- **Date Formatting**: Converts dates to `YYYY-MM-DD` format required by Flossly API
- **Time Formatting**: Converts times to `HH:mm` 24-hour format (handles AM/PM conversion)
- **Name Splitting**: Splits patient name into `firstName` and `lastName` (first word vs. rest)
- **Treatment Data**: Includes treatment name and duration if available from selected treatment
- **Structured Payload**: Sends data in Flossly API format:
  ```javascript
  {
    type: 'appointment_booking',
    botId: botConfig.botId,
    patient: {
      firstName: string,
      lastName: string,
      email: string,
      mobile: string
    },
    appointment: {
      date: 'YYYY-MM-DD',
      time: 'HH:mm',
      duration: number, // minutes
      treatmentName: string | null,
      notes: string
    },
    formData: object, // Original data for backward compatibility
    userTimezone: string,
    timestamp: string
  }
  ```

### 2. Enhanced Error Handling
- **409 Conflict Detection**: Detects HTTP 409 status codes and conflict error messages
- **User-Friendly Messages**: Shows clear conflict messages similar to Google Calendar:
  ```
  ⚠️ This time slot is already booked. Please select a different time.
  
  The selected time (14:30 on Nov 20, 2025) is not available.
  
  Would you like to try another time?
  ```
- **Alternative Suggestions**: Shows available time slots when conflicts occur

### 3. Updated `sendToWebhook()` Function
- **Status Code Detection**: Includes HTTP status code in response
- **Conflict Flag**: Automatically sets `conflict: true` for 409 errors
- **Error Message Detection**: Checks for "already has an appointment" in error messages

### 4. Updated Suggestion Click Handler
- **Consistent Formatting**: Uses same date/time formatting as main appointment flow
- **Conflict Handling**: Handles 409 errors when re-booking from suggestions
- **Better UX**: Shows formatted date/time in confirmation messages

## Webhook Payload Structure

The widget now sends appointment data in this format:

```json
{
  "type": "appointment_booking",
  "botId": "bot-uuid",
  "patient": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "mobile": "+1234567890"
  },
  "appointment": {
    "date": "2025-11-20",
    "time": "14:30",
    "duration": 45,
    "treatmentName": "Teeth Whitening",
    "notes": "Appointment booked via chatbot"
  },
  "formData": {
    "fullName": "John Doe",
    "contact": "john@example.com",
    "phone": "+1234567890",
    "preferredDate": "2025-11-20",
    "preferredTime": "14:30"
  },
  "userTimezone": "America/New_York",
  "timestamp": "2025-11-20T14:30:00.000Z"
}
```

## Webhook Response Handling

### Success Response
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Appointment created successfully"
}
```

### Conflict Response (409)
```json
{
  "success": false,
  "statusCode": 409,
  "conflict": true,
  "error": "Dentist already has an appointment at this time",
  "suggestions": [...],
  "availableSlots": [...]
}
```

## Next Steps for Webhook Implementation

The webhook handler (server-side) should:

1. **Extract Access Token**: Get the access token associated with the `botId` (from database/storage)
2. **Get Treatment Duration** (Optional): Call `GET /api/diary/treatments` to get `defaultDuration`
3. **Create Patient**: Call `POST /api/diary/patientCreate` with patient data
4. **Create Appointment**: Call `POST /api/diary/appointmentCreate` with appointment data
5. **Handle 409 Errors**: Return conflict response with suggestions if available
6. **Return Success**: Return success response with appointment details

## Example Webhook Handler Flow

```javascript
// 1. Get access token from botId
const accessToken = await getAccessTokenByBotId(botId);

// 2. Get treatment duration (optional)
const treatments = await fetch('/api/diary/treatments', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});
const treatment = treatments.data.find(t => t.name === appointment.treatmentName);
const duration = treatment?.defaultDuration || appointment.duration || 30;

// 3. Create patient
const patientResponse = await fetch('/api/diary/patientCreate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    firstName: patient.firstName,
    lastName: patient.lastName,
    email: patient.email,
    mobile: patient.mobile
  })
});
const patient = await patientResponse.json();
const patientId = patient.data.id;

// 4. Create appointment
const appointmentResponse = await fetch('/api/diary/appointmentCreate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    dentistId: userId, // From profile.data.id
    patientId: patientId,
    date: appointment.date,
    time: appointment.time,
    duration: duration,
    treatmentName: appointment.treatmentName,
    notes: appointment.notes
  })
});

// 5. Handle response
if (appointmentResponse.status === 409) {
  return res.status(409).json({
    success: false,
    conflict: true,
    error: 'Time slot already booked',
    suggestions: [], // Optional: generate alternative times
    availableSlots: [] // Optional: list all available slots
  });
} else if (appointmentResponse.ok) {
  return res.json({
    success: true,
    data: await appointmentResponse.json()
  });
}
```

## Testing

To test the integration:

1. **Test Date/Time Formatting**: Verify dates are in `YYYY-MM-DD` and times in `HH:mm` format
2. **Test Name Splitting**: Verify single names default to `lastName: '-'`
3. **Test Conflict Handling**: Trigger a 409 error and verify user-friendly message appears
4. **Test Treatment Flow**: Verify treatment duration is included when booking from treatment selection

## Notes

- The widget maintains backward compatibility by including `formData` in the payload
- All date/time conversions handle various input formats gracefully
- Conflict messages match the style used for Google Calendar conflicts
- The webhook must handle the actual API calls since the widget runs client-side

