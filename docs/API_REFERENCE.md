# Consultation Module - API Reference

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Consultation Endpoints](#consultation-endpoints)
4. [Reference Data Endpoints](#reference-data-endpoints)
5. [Metadata Endpoints](#metadata-endpoints)
6. [Attachment Endpoints](#attachment-endpoints)
7. [Error Handling](#error-handling)
8. [Code Examples](#code-examples)

---

## Overview

The Consultation Module uses the iDempiere REST API (OData-style) to communicate with the server. All endpoints require JWT authentication.

**Base URL:**
```
https://[host]:8443/api/v1
```

**Content Type:**
```
application/json
```

**Authentication:**
```
Authorization: Bearer {token}
```

---

## Authentication

### Get JWT Token

**Endpoint:**
```
POST /auth/tokens
```

**Request Body:**
```json
{
  "username": "username",
  "password": "password",
  "roleId": "1000000",
  "organizationId": "1000000",
  "warehouseId": "1000000",
  "language": "en_US"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 86400,
  "user": {
    "id": 100,
    "name": "Admin User"
  }
}
```

### Token Usage

All API calls must include token in Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Refresh

**Endpoint:**
```
PUT /auth/tokens
```

**Request Body:**
```json
{
  "token": "[current_token]"
}
```

**Response:**
```json
{
  "token": "[new_token]",
  "expiresIn": 86400
}
```

**Note:** New token returned; old token immediately invalid. Update stored token.

---

## Consultation Endpoints

### List Consultations

**Endpoint:**
```
GET /models/R_Request
```

**Query Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `$filter` | String | OData filter expression | `C_BPartner_ID/id eq 100004` |
| `$orderby` | String | Sort by field | `Created desc` |
| `$top` | Integer | Limit results | `50` |
| `$skip` | Integer | Offset | `0` |
| `$select` | String | Fields to return | `R_Request_ID,DocumentNo,C_BPartner_ID` |

**Example Requests:**

```bash
# Get last 50 consultations, newest first
GET /models/R_Request?$orderby=Created%20desc&$top=50

# Get consultations for specific customer
GET /models/R_Request?$filter=C_BPartner_ID/id%20eq%20100004

# Get completed consultations in January 2026
GET /models/R_Request?$filter=R_Status_ID/id%20eq%20%27%E5%B7%B2%E5%AE%8C%E6%88%90%27%20and%20Created%20ge%202026-01-01T00:00:00Z

# Get pending consultations (not completed)
GET /models/R_Request?$filter=R_Status_ID/id%20neq%20%27%E5%B7%B2%E5%AE%8C%E6%88%90%27
```

**Response:**

```json
{
  "@odata.context": "https://host:8443/api/v1/$metadata#R_Request",
  "value": [
    {
      "@odata.id": "...",
      "R_Request_ID": 100001,
      "DocumentNo": "RQ-001",
      "C_BPartner_ID": {
        "id": 100004,
        "identifier": "John Smith"
      },
      "R_RequestType_ID": {
        "id": 50001,
        "identifier": "Sales Inquiry"
      },
      "R_Status_ID": {
        "id": "等待回應",
        "identifier": "Waiting for Response"
      },
      "R_Category_ID": {
        "id": 10001,
        "identifier": "Product Inquiry"
      },
      "Priority": "High",
      "Description": "[{\"timestamp\":\"2026-02-19T14:30:00Z\",\"type\":\"活動\",\"actionType\":\"來電\",\"content\":\"客戶詢問產品資訊\",\"createdBy\":\"12345\"}]",
      "Confidential": false,
      "DateStart": "2026-02-19T08:00:00Z",
      "DateNextAction": "2026-02-26T15:00:00Z",
      "DocumentStatus": "Completed",
      "IsActive": true,
      "Created": "2026-02-19T08:00:00Z",
      "CreatedBy": {
        "id": 100,
        "identifier": "Admin"
      },
      "Updated": "2026-02-19T14:30:00Z",
      "UpdatedBy": {
        "id": 100,
        "identifier": "Admin"
      }
    }
  ]
}
```

**Status Codes:**
- `200 OK`: Success
- `400 Bad Request`: Invalid filter syntax
- `401 Unauthorized`: Token invalid/expired
- `403 Forbidden`: No permission to read

---

### Get Single Consultation

**Endpoint:**
```
GET /models/R_Request/{id}
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | Integer | Yes | Consultation ID (R_Request_ID) |

**Example Request:**

```bash
GET /models/R_Request/100001
```

**Response:**

```json
{
  "@odata.context": "...",
  "R_Request_ID": 100001,
  "DocumentNo": "RQ-001",
  "C_BPartner_ID": { ... },
  "R_Status_ID": { ... },
  "Description": "[{...}]",
  "Created": "2026-02-19T08:00:00Z",
  "Updated": "2026-02-19T14:30:00Z"
}
```

**Status Codes:**
- `200 OK`: Success
- `404 Not Found`: Consultation ID doesn't exist
- `401 Unauthorized`: Token invalid/expired

---

### Create Consultation

**Endpoint:**
```
POST /models/R_Request
```

**Request Body:**

```json
{
  "R_RequestType_ID": 50001,
  "C_BPartner_ID": 100004,
  "R_Status_ID": "待處理",
  "Priority": "High",
  "R_Category_ID": 10001,
  "DateStart": "2026-02-19T08:00:00Z",
  "Description": "[]"
}
```

**Required Fields (Mandatory):**
- `R_RequestType_ID`: Type of consultation
- `C_BPartner_ID`: Customer ID
- `R_Status_ID`: Initial status
- Any other fields marked mandatory in AD_Column

**Optional Fields:**
- `Priority`: Priority level (default from system)
- `R_Category_ID`: Category
- `Description`: Activity JSON (can start empty)
- `DateStart`: Created date (default: now)
- `DateNextAction`: Next action date
- `Confidential`: Boolean flag

**Example Request:**

```bash
POST /models/R_Request
Content-Type: application/json
Authorization: Bearer {token}

{
  "R_RequestType_ID": 50001,
  "C_BPartner_ID": 100004,
  "R_Status_ID": "待處理",
  "Priority": "High",
  "Description": "[]"
}
```

**Response:**

```json
{
  "@odata.id": "...",
  "R_Request_ID": 100002,
  "DocumentNo": "RQ-002",
  "R_RequestType_ID": { "id": 50001, "identifier": "Sales Inquiry" },
  "C_BPartner_ID": { "id": 100004, "identifier": "John Smith" },
  "R_Status_ID": { "id": "待處理", "identifier": "To be processed" },
  "Priority": "High",
  "Description": "[]",
  "Created": "2026-02-19T10:00:00Z",
  "CreatedBy": { "id": 100, "identifier": "Admin" }
}
```

**Status Codes:**
- `201 Created`: Success
- `400 Bad Request`: Mandatory field missing or invalid
- `401 Unauthorized`: Token invalid/expired
- `403 Forbidden`: No permission to create

---

### Update Consultation

**Endpoint:**
```
PUT /models/R_Request/{id}
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | Integer | Yes | Consultation ID |

**Request Body:**

```json
{
  "R_Status_ID": "已完成",
  "Priority": "Medium",
  "Description": "[{\"timestamp\":\"2026-02-19T14:30:00Z\",...}]",
  "DateNextAction": "2026-02-26T15:00:00Z"
}
```

**Fields (any combination):**
- `R_Status_ID`: Change status
- `Priority`: Change priority
- `Description`: Update activity JSON
- `DateNextAction`: Update tracking date
- `Confidential`: Update flag
- Any other editable field

**Example Request:**

```bash
PUT /models/R_Request/100001
Content-Type: application/json
Authorization: Bearer {token}

{
  "R_Status_ID": "已完成",
  "Description": "[{\"timestamp\":\"2026-02-19T15:00:00Z\",\"type\":\"狀態改變\",\"actionType\":\"完成\",\"content\":\"諮詢已完成\",\"createdBy\":\"100\"}]"
}
```

**Response:**

```json
{
  "R_Request_ID": 100001,
  "R_Status_ID": { "id": "已完成", "identifier": "Completed" },
  "Description": "[{...}]",
  "Updated": "2026-02-19T15:00:00Z",
  "UpdatedBy": { "id": 100, "identifier": "Admin" }
}
```

**Status Codes:**
- `200 OK`: Success
- `400 Bad Request`: Invalid field value
- `404 Not Found`: Consultation doesn't exist
- `409 Conflict`: Concurrency issue (someone else modified)
- `401 Unauthorized`: Token invalid/expired

---

## Reference Data Endpoints

### List Statuses

**Endpoint:**
```
GET /models/R_Status
```

**Example Request:**

```bash
GET /models/R_Status?$orderby=Name
```

**Response:**

```json
{
  "@odata.context": "...",
  "value": [
    {
      "R_Status_ID": "待處理",
      "Name": "待處理",
      "Value": "待處理"
    },
    {
      "R_Status_ID": "等待回應",
      "Name": "等待回應",
      "Value": "等待回應"
    },
    {
      "R_Status_ID": "已完成",
      "Name": "已完成",
      "Value": "已完成"
    }
  ]
}
```

---

### List Consultation Types

**Endpoint:**
```
GET /models/R_RequestType
```

**Example Request:**

```bash
GET /models/R_RequestType?$orderby=Name
```

**Response:**

```json
{
  "@odata.context": "...",
  "value": [
    {
      "R_RequestType_ID": 50001,
      "Name": "Sales Inquiry"
    },
    {
      "R_RequestType_ID": 50002,
      "Name": "Support Request"
    }
  ]
}
```

---

### List Customers

**Endpoint:**
```
GET /models/C_BPartner
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `$filter` | String | `IsCustomer eq true` (show only customers) |
| `$search` | String | Search by name |
| `$top` | Integer | Limit results |

**Example Request:**

```bash
GET /models/C_BPartner?$filter=IsCustomer%20eq%20true&$orderby=Name&$top=50
```

**Response:**

```json
{
  "@odata.context": "...",
  "value": [
    {
      "C_BPartner_ID": 100004,
      "Name": "John Smith",
      "TaxID": "123456789"
    }
  ]
}
```

---

## Metadata Endpoints

### List Fields (Form Layout)

**Endpoint:**
```
GET /swagger/api/AD_Field
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `$filter` | String | `AD_Tab_ID eq 344` (for consultation form) |

**Example Request:**

```bash
GET /swagger/api/AD_Field?$filter=AD_Tab_ID%20eq%20344&$orderby=SeqNo
```

**Response:**

```json
{
  "value": [
    {
      "AD_Field_ID": 2001,
      "AD_Tab_ID": 344,
      "AD_Column_ID": 2020,
      "Name": "Request Type",
      "Description": "",
      "SeqNo": 10,
      "IsMandatory": true,
      "IsReadOnly": false,
      "Column": {
        "AD_Column_ID": 2020,
        "Name": "R_RequestType_ID",
        "AD_Reference_ID": 30,
        "ColumnSQL": "R_RequestType_ID",
        "IsMandatory": true
      }
    }
  ]
}
```

---

## Attachment Endpoints

### List Attachments

**Endpoint:**
```
GET /models/AD_Attachment
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `$filter` | String | `AD_Table_ID eq 50010 and Record_ID eq {id}` |

**Example Request:**

```bash
GET /models/AD_Attachment?$filter=AD_Table_ID%20eq%2050010%20and%20Record_ID%20eq%20100001
```

**Response:**

```json
{
  "@odata.context": "...",
  "value": [
    {
      "AD_Attachment_ID": 1001,
      "FileName": "consultation_notes.pdf",
      "FileSize": 245678,
      "MimeType": "application/pdf"
    }
  ]
}
```

### Upload Attachment

**Endpoint:**
```
POST /models/AD_Attachment
```

**Request (multipart/form-data):**

```
Content-Type: multipart/form-data

file: [binary file content]
AD_Table_ID: 50010
Record_ID: 100001
FileName: photo.jpg
Description: Consultation photo
```

**Response:**

```json
{
  "AD_Attachment_ID": 1002,
  "FileName": "photo.jpg",
  "FileSize": 1024567
}
```

---

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more validation errors occurred",
    "details": {
      "C_BPartner_ID": "Customer is required",
      "R_RequestType_ID": "Request type is required"
    }
  }
}
```

### Common Error Codes

| Code | HTTP | Meaning | Solution |
|------|------|---------|----------|
| `VALIDATION_ERROR` | 400 | Field validation failed | Check `details` for which fields have errors |
| `AUTHENTICATION_FAILED` | 401 | Token invalid or expired | Get new token via POST /auth/tokens |
| `PERMISSION_DENIED` | 403 | No permission for operation | Check user role/permissions |
| `RESOURCE_NOT_FOUND` | 404 | Record doesn't exist | Verify the ID is correct |
| `CONFLICT` | 409 | Someone else modified record | Reload and try again |
| `SERVER_ERROR` | 500 | Unexpected server error | Retry or contact support |

### Error Handling Best Practices

```typescript
try {
  const response = await apiClient.post('/models/R_Request', data)
  // Success
  console.log('Created:', response.data)
} catch (error: any) {
  if (error.response?.status === 401) {
    // Token expired
    authStore.sessionExpired = true
    router.push('/login')
  } else if (error.response?.status === 400) {
    // Validation error - show field-specific messages
    const errors = error.response.data.error.details
    Object.assign(formErrors, errors)
  } else if (error.response?.status === 500) {
    // Server error
    showError('Server error occurred. Please try again.')
  } else {
    // Other error
    showError(error.message)
  }
}
```

---

## Code Examples

### Example 1: Load Consultation

```typescript
import { apiClient } from '@/api/client'

async function loadConsultation(id: number) {
  try {
    const response = await apiClient.get(`/models/R_Request/${id}`)
    const consultation = response.data
    console.log('Loaded:', consultation)
    return consultation
  } catch (error) {
    console.error('Failed to load consultation:', error)
    throw error
  }
}
```

### Example 2: Save Activity

```typescript
import { parseActivities, stringifyActivities, addActivity } from '@/utils/requestActivity'

async function saveActivity(consultationId: number, content: string) {
  try {
    // Get current consultation
    const response = await apiClient.get(`/models/R_Request/${consultationId}`)
    const consultation = response.data

    // Add activity to JSON
    const newDescription = addActivity(
      consultation.Description || '[]',
      {
        type: '活動',
        actionType: '來電',
        content: content,
        createdBy: authStore.user?.id || '0'
      }
    )

    // Update consultation
    await apiClient.put(`/models/R_Request/${consultationId}`, {
      Description: newDescription
    })

    console.log('Activity saved')
  } catch (error) {
    console.error('Failed to save activity:', error)
    throw error
  }
}
```

### Example 3: Change Status

```typescript
async function changeStatus(consultationId: number, newStatusId: string) {
  try {
    // Get current consultation
    const response = await apiClient.get(`/models/R_Request/${consultationId}`)
    const consultation = response.data

    // Add status change activity
    const newDescription = addActivity(
      consultation.Description || '[]',
      {
        type: '狀態改變',
        actionType: '改變狀態',
        content: `改為: ${newStatusId}`,
        createdBy: authStore.user?.id || '0'
      }
    )

    // Update consultation
    await apiClient.put(`/models/R_Request/${consultationId}`, {
      R_Status_ID: newStatusId,
      Description: newDescription
    })

    console.log('Status updated')
  } catch (error) {
    console.error('Failed to change status:', error)
    throw error
  }
}
```

### Example 4: Get Dashboard Data

```typescript
async function loadDashboardData() {
  try {
    const response = await apiClient.get('/models/R_Request', {
      params: {
        $orderby: 'Created desc'
      }
    })
    const consultations = response.data.value
    return consultations
  } catch (error) {
    console.error('Failed to load dashboard data:', error)
    throw error
  }
}
```

---

## Rate Limiting

- **Calls per minute:** 1000 (soft limit)
- **Calls per hour:** 10000 (hard limit)
- **Response header:** `X-RateLimit-Remaining` (calls left)

---

## API Versioning

Current API version: **v1**

URL format: `/api/v1/...`

Breaking changes will increment to `/api/v2`, etc.

---

## Timezone Handling

**API DateTime Format:**
```
2026-02-19T14:30:00Z
```

**Important:** The `Z` suffix indicates the value is in **local time**, not UTC.

**Parsing:**
```typescript
// Use helper function for correct timezone handling
import { parseIdempiereDateTime } from '@/api/utils'

const date = parseIdempiereDateTime('2026-02-19T14:30:00Z')
// Returns correct Date object considering local timezone
```

**Formatting:**
```typescript
// Convert Date to iDempiere format
import { toIdempiereDateTime } from '@/api/utils'

const isoString = toIdempiereDateTime(new Date())
// Returns: '2026-02-19T14:30:00Z'
```

---

## Testing API Calls

```bash
# List consultations
curl -H "Authorization: Bearer {token}" \
  "https://host:8443/api/v1/models/R_Request"

# Get single consultation
curl -H "Authorization: Bearer {token}" \
  "https://host:8443/api/v1/models/R_Request/100001"

# Create consultation
curl -X POST \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"R_RequestType_ID":50001,"C_BPartner_ID":100004}' \
  "https://host:8443/api/v1/models/R_Request"

# Update consultation
curl -X PUT \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"R_Status_ID":"已完成"}' \
  "https://host:8443/api/v1/models/R_Request/100001"
```

