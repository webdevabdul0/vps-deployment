# Callback Flow Fix - Email Field & Retry Logic

## Problem Statement

The AI agent was not sending the `customer.email` field when calling the callback API, which caused errors because the n8n Gmail workflow **requires** the email field to send confirmation emails.

## Root Causes Identified

1. **Tool Definition Issue** (`ai-tools.js`):
   - Email was marked as optional in the `schedule_callback` tool
   - Tool description didn't emphasize email requirement
   - `required` array didn't include "email"

2. **System Prompt Issue** (`ai-agent.js`):
   - Instructions didn't mention email is required for callbacks
   - Only mentioned: name, phone, reason, preferred time

3. **Validation Gap** (`ai-agent.js`):
   - `executeScheduleCallback` function allowed empty email strings
   - No validation before sending to n8n webhook

4. **No Retry Logic**:
   - If a tool call failed due to network issues, it wouldn't retry
   - AI couldn't self-correct and retry failed operations

## Fixes Implemented

### 1. Updated Tool Definition (ai-tools.js)

**Before:**
```javascript
email: {
  type: "string",
  description: "Email address (optional)"
},
required: ["patientName", "phone", "reason"]
```

**After:**
```javascript
email: {
  type: "string",
  description: "Email address - REQUIRED for callback confirmation"
},
required: ["patientName", "phone", "email", "reason"]
```

### 2. Updated System Prompt (ai-agent.js)

**Before:**
```
- Collect: name, phone, reason, preferred time
```

**After:**
```
- Collect: name, phone, email, reason, preferred time
- Email is REQUIRED for callback confirmation - always ask for it
- If the user message already contains all required fields, call "schedule_callback" immediately
```

### 3. Added Validation in executeScheduleCallback (ai-agent.js)

**Added validation at the start of the function:**
```javascript
// Validate required fields - email is REQUIRED for n8n workflow
if (!callbackData.email || callbackData.email.trim() === '') {
  console.log('❌ [CALLBACK SCHEDULING] VALIDATION FAILED - Email is required');
  return {
    success: false,
    error: 'Email is required for callback confirmation',
    message: 'I need your email address to send you a callback confirmation. Could you please provide your email?'
  };
}

if (!callbackData.patientName || !callbackData.phone) {
  console.log('❌ [CALLBACK SCHEDULING] VALIDATION FAILED - Missing required fields');
  return {
    success: false,
    error: 'Missing required fields',
    message: 'I need your name and phone number to schedule a callback. Could you please provide them?'
  };
}
```

### 4. Added Retry Logic for Action Tools (ai-agent.js)

**Key Features:**
- Automatically retries failed action tools (appointment, lead, callback) up to 1 time
- Only retries on network/timeout errors (not validation errors)
- 1-second delay between retries
- Detailed logging of retry attempts

**Retryable Errors:**
- Timeout errors (`ETIMEDOUT`)
- Connection refused (`ECONNREFUSED`)
- Network errors
- "temporarily unavailable" messages

**Non-Retryable Errors (fail immediately):**
- Validation errors (missing fields)
- 409 Conflict errors
- Authentication errors
- Bad request errors

**Example Log Output:**
```
🔄 [AI Agent] Retrying schedule_callback (attempt 2/2) after error: timeout
📊 [AI Agent] Tool schedule_callback completed after 1 retry. Final result: SUCCESS
```

## N8N Workflow Requirements

The n8n Gmail callback workflow expects this structure:

```json
{
  "type": "callback_request",
  "customer": {
    "name": "John Doe",
    "email": "john@example.com",  // ✅ REQUIRED
    "phone": "+1234567890"
  },
  "callback": {
    "reason": "Question about treatment",
    "preferredTime": "Morning"
  },
  "company": {
    "name": "Practice Name",
    "ownerEmail": "owner@practice.com"  // ✅ REQUIRED
  }
}
```

**Email Usage in Workflow:**
- Line 53: Sends customer confirmation email to `customer.email`
- Line 76: Sends company notification to `company.ownerEmail`

## Testing

All fixes have been validated:
- ✅ customer.email is now required in tool definition
- ✅ AI agent asks for email if missing
- ✅ Validation prevents empty emails from being sent
- ✅ Retry logic handles network failures
- ✅ Test payload passes all validation checks

## Impact

### Before Fix:
❌ AI calls callback tool without email → n8n workflow fails → error returned

### After Fix:
✅ AI asks for email if not provided
✅ AI includes email in callback payload
✅ Validation catches missing email before API call
✅ n8n workflow receives all required fields
✅ Confirmation emails sent successfully
✅ Network errors automatically retried

## Files Modified

1. `vps-deployment/ai-tools.js` - Updated tool definition
2. `vps-deployment/ai-agent.js` - Updated system prompt, added validation, added retry logic

## Backward Compatibility

✅ All existing functionality preserved
✅ Other tools (appointment, lead) work the same way
✅ Only callback flow enhanced with email requirement

## Future Improvements

Consider:
1. Add email validation (format check) in tool definition
2. Extend retry logic to other network operations
3. Add exponential backoff for retries
4. Track retry metrics for monitoring
