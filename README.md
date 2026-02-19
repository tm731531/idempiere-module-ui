# iDempiere Aesthetics UI - CRM Consultation Module

> Complete customer consultation management system for healthcare clinics, built with Vue 3 + TypeScript, deployed as an OSGi bundle on iDempiere 12.

## Quick Links

- **Live Demo:** https://host:8443/aesthetics/#/
- **Main Documentation:** [docs/CONSULTATION_MODULE.md](docs/CONSULTATION_MODULE.md)
- **Component API:** [docs/COMPONENTS.md](docs/COMPONENTS.md)
- **Architecture:** [docs/CONSULTATION_ARCHITECTURE.md](docs/CONSULTATION_ARCHITECTURE.md)
- **API Reference:** [docs/API_REFERENCE.md](docs/API_REFERENCE.md)
- **Validation Rules:** [docs/VALIDATION_RULES.md](docs/VALIDATION_RULES.md)

## Features

### 📋 Consultation Management

- **Activity Timeline**: JSON-based consultation history with timestamps and details
- **Quick Actions**: Phone calls, messages, status updates, and follow-up scheduling
- **Smart Forms**: Metadata-driven forms auto-generated from iDempiere dictionary
- **Responsive Design**: Works on phones, tablets, and desktops
- **Chinese UX**: All labels and messages in Traditional Chinese

### 📊 Executive Dashboard

- **Real-Time Metrics**: Consultations, conversion rate, response time
- **Risk Indicators**: Identifies silent consultations and lost customers
- **Customer Rankings**: Top clients by engagement
- **Status Analytics**: Breakdown by consultation status

### 🔒 Enterprise Ready

- **JWT Authentication**: Secure token-based access
- **Role-Based Access**: Permissions enforced at API level
- **Audit Trail**: Complete history of all consultation changes
- **Error Handling**: User-friendly error messages, automatic recovery

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- iDempiere 12 server running
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Development Setup

```bash
# Clone the repository
cd /home/tom/idempiere-module-ui/webapp

# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Run tests
npm run test

# Type checking
npm run type-check

# Linting
npm run lint
```

### Building & Deploying

```bash
# Build Vue application
npm run build

# Build OSGi JAR bundle (from project root)
bash build.sh

# Build and deploy to iDempiere
bash build.sh --deploy

# Bundle location: /home/tom/idempiere-module-ui/
# Bundle ID: 458
# URL: https://host:8443/aesthetics/#/
```

## Project Structure

```
idempiere-module-ui/
├── webapp/                           # Vue 3 application
│   ├── src/
│   │   ├── views/consultation/      # Consultation pages
│   │   │   ├── RequestListView.vue
│   │   │   ├── RequestFormView.vue
│   │   │   └── ConsultationDashboardView.vue
│   │   ├── components/               # Reusable components
│   │   │   ├── RequestTimeline.vue
│   │   │   ├── QuickActionBar.vue
│   │   │   ├── ActivityInputModal.vue
│   │   │   ├── StatusUpdateModal.vue
│   │   │   ├── TrackingDateModal.vue
│   │   │   └── ConsultationDashboard.vue
│   │   ├── utils/                    # Business logic
│   │   │   ├── requestActivity.ts   # Activity JSON management
│   │   │   ├── dashboardStats.ts    # Metrics calculation
│   │   │   └── validation.ts        # Form validation rules
│   │   ├── api/                      # REST API client
│   │   ├── stores/                   # Pinia state management
│   │   └── router/                   # Vue Router configuration
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── osgi-bundle/                      # OSGi bundle configuration
├── docs/                             # Documentation
│   ├── CONSULTATION_MODULE.md        # Complete module guide
│   ├── COMPONENTS.md                 # Component API reference
│   ├── CONSULTATION_ARCHITECTURE.md  # System architecture
│   ├── API_REFERENCE.md              # REST API endpoints
│   └── VALIDATION_RULES.md           # Validation reference
├── build.sh                          # Build and deploy script
├── DEPLOYMENT_CHECKLIST.md           # Pre/post deployment steps
└── RELEASE_NOTES.md                  # Version history

```

## Core Concepts

### Activity Timeline

Consultations track all interactions in a JSON-based activity timeline stored in `R_Request.Description`:

```json
[
  {
    "timestamp": "2026-02-19T14:30:00Z",
    "type": "活動",
    "actionType": "來電",
    "content": "Customer inquired about services",
    "createdBy": "12345"
  }
]
```

See [Activity Storage](docs/CONSULTATION_ARCHITECTURE.md#activity-timeline-format) for details.

### Metadata-Driven Forms

All form fields are generated from iDempiere's Application Dictionary (AD_Field, AD_Column). No hardcoded fields.

```vue
<DynamicForm
  :fieldDefs="visibleFieldDefs"
  :modelValue="formData"
  @update:modelValue="formData = $event"
/>
```

See [Architecture](docs/CONSULTATION_ARCHITECTURE.md) for details.

### Quick Actions

Sticky bottom bar for rapid operations:

- **📱 Phone**: Log phone call activity
- **💬 Message**: Log message interaction
- **✏️ Status**: Change consultation status
- **📅 Tracking**: Schedule follow-up date/time

## Testing

### Run All Tests

```bash
cd webapp
npm run test                    # Run all tests once
npm run test:watch            # Watch mode for development
npm run test src/path/*.spec.ts # Specific file
```

### Test Coverage

- **39 test files** across the codebase
- **355 tests** with 100% pass rate
- **Components tested:** RequestFormView, RequestTimeline, QuickActionBar, ConsultationDashboard, modals, utilities
- **Utilities tested:** Activity parsing, dashboard stats, validation rules, API error handling

### Writing Tests

Test files are located next to source files in `__tests__/` directories:

```
src/
├── components/
│   ├── RequestTimeline.vue
│   └── __tests__/
│       └── RequestTimeline.spec.ts
```

Example test:

```typescript
import { describe, it, expect } from 'vitest'
import { validateActivityContent } from '@/utils/validation'

describe('Activity Validation', () => {
  it('should reject empty content', () => {
    const result = validateActivityContent('')
    expect(result.isValid).toBe(false)
    expect(result.errors.content).toBe('請輸入活動內容')
  })
})
```

## Documentation

### User Documentation

- [Consultation Module Guide](docs/CONSULTATION_MODULE.md)
  - Overview and features
  - User workflows
  - Troubleshooting
  - Examples and best practices

### Developer Documentation

- [Component API Reference](docs/COMPONENTS.md)
  - All components documented
  - Props, events, usage examples
  - Mobile considerations
  - Error handling patterns

- [Architecture & Design](docs/CONSULTATION_ARCHITECTURE.md)
  - System architecture diagram
  - Data flow throughout the application
  - Component hierarchy
  - State management strategy
  - API layer organization
  - Validation and error handling strategies
  - Performance considerations
  - Security considerations

- [REST API Reference](docs/API_REFERENCE.md)
  - All API endpoints
  - Request/response formats
  - Error codes and meanings
  - Code examples
  - Authentication flow

- [Validation Rules Reference](docs/VALIDATION_RULES.md)
  - All validation rules documented
  - Error messages
  - Implementation details
  - Testing guidance

## API Integration

### Authentication

```typescript
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
await authStore.login('username', 'password')

// Token automatically sent on all API calls
```

### Making API Calls

```typescript
import { apiClient } from '@/api/client'

// Get consultation
const consultation = await apiClient.get('/models/R_Request/100001')

// Update consultation
await apiClient.put('/models/R_Request/100001', {
  R_Status_ID: '已完成',
  Description: '[...]'
})
```

### Error Handling

```typescript
try {
  // API call
} catch (error: any) {
  if (error.response?.status === 401) {
    // Session expired
    authStore.sessionExpired = true
  } else if (error.response?.status === 400) {
    // Validation error
    console.log(error.response.data.error.details)
  }
}
```

See [API Reference](docs/API_REFERENCE.md) for complete endpoint documentation.

## Configuration

### Environment Variables

Create `webapp/.env.local`:

```
VITE_API_BASE_URL=https://localhost:8443/api/v1
VITE_APP_TITLE=Aesthetics UI
VITE_LOG_LEVEL=debug
```

### Build Configuration

`webapp/vite.config.ts`:

```typescript
export default defineConfig({
  plugins: [vue(), typescript()],
  server: {
    proxy: {
      '/api': {
        target: 'https://localhost:8443',
        changeOrigin: true,
        rewrite: (path) => path,
      },
    },
  },
})
```

## Performance

### Bundle Size

- Main bundle: ~200KB (gzipped)
- Runtime memory: ~5MB typical
- First paint: ~1-2 seconds
- API response time: ~200-500ms

### Optimization Techniques

- Lazy component loading
- Computed property caching
- API request debouncing
- Virtual scrolling for long lists
- Image lazy loading

## Security

### Authentication

- JWT tokens with 24-hour expiration
- Tokens stored in localStorage (persistent)
- Token refresh endpoint available
- No auto-logout on token expiration (user control)

### Authorization

- Role-based access control (via iDempiere)
- Row-level security (users see only their data)
- Permission checks on UI (buttons hidden if unauthorized)

### Data Protection

- All data transmitted over HTTPS
- XSS prevention via Vue auto-escaping
- CSRF protection via Authorization header
- Audit trail maintained for all changes

See [Security](docs/CONSULTATION_ARCHITECTURE.md#security-considerations) section for details.

## Troubleshooting

### Common Issues

**Issue: "Please fill in required fields" error**
- Check mandatory fields from AD metadata
- Ensure all required FK fields have selections
- See [Troubleshooting](docs/CONSULTATION_MODULE.md#troubleshooting)

**Issue: Activity timeline shows parse error**
- Verify Description field contains valid JSON
- Check browser console for "Failed to parse activities"
- See [Troubleshooting](docs/CONSULTATION_MODULE.md#troubleshooting)

**Issue: Date picker shows "Date cannot be in the past"**
- Verify device date/time is correct
- Select date today or later
- Remember 0-90 days forward only

**Issue: Dashboard metrics show blank or NaN**
- Check API calls in Network tab
- Verify response data is valid
- Try refreshing page
- See [Troubleshooting](docs/CONSULTATION_MODULE.md#troubleshooting)

For more issues, see [Troubleshooting Guide](docs/CONSULTATION_MODULE.md#troubleshooting).

## Deployment

### Pre-Deployment Checklist

- [ ] All 355 tests passing
- [ ] TypeScript: no errors
- [ ] Build successful
- [ ] No console.log statements
- [ ] No hardcoded debug values
- [ ] Documentation reviewed

### Deployment Steps

1. Build Vue application: `npm run build`
2. Create OSGi JAR: `bash build.sh`
3. Deploy to Felix: `bash build.sh --deploy`
4. Verify bundle 458 updated in Felix console
5. Test on actual devices (mobile, tablet, desktop)

See [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for complete steps.

### Rollback

If issues occur after deployment:

1. Note the issue and reproduction steps
2. Revert bundle in Felix Web Console to previous version
3. Investigate root cause
4. Fix and re-test
5. Re-deploy with fix

## Contributing

### Code Style

- TypeScript strict mode enabled
- Vue 3 `<script setup>` syntax
- CSS in component `<style scoped>` blocks
- Comments for non-obvious logic only
- All Chinese UI labels (zh-TW)

### Before Submitting

1. Run tests: `npm run test`
2. Type check: `npm run type-check`
3. Lint: `npm run lint`
4. Test manually on mobile
5. Update documentation if needed

### Pull Request Process

1. Create feature branch: `git checkout -b feature/name`
2. Make changes
3. Commit with clear message: `git commit -m "feat: description"`
4. Push to remote: `git push origin feature/name`
5. Create pull request with description
6. Ensure CI passes (tests, type check, lint)
7. Squash commits if needed
8. Merge to main

## Release History

### v1.0.0 (2026-02-19)

Initial release with:

- ✅ Activity timeline with JSON storage
- ✅ Quick action bar (phone, message, status, tracking)
- ✅ Consultation dashboard with metrics
- ✅ Full mobile responsiveness
- ✅ 355 tests with 100% pass rate
- ✅ Complete documentation

**Test Coverage:**
- 39 test files
- 355 tests
- 100% pass rate

**Features:**
- Create/edit consultations with metadata-driven forms
- Add activities with real-time validation
- Change status with activity logging
- Schedule follow-ups with date/time validation
- View dashboard with real-time metrics
- Responsive design for all devices

**Deployment:**
- OSGi bundle ID 458
- URL: https://host:8443/aesthetics/#/
- No database migrations required
- Backward compatible with existing data

See [RELEASE_NOTES.md](RELEASE_NOTES.md) for details.

## Support

### Documentation

- [Consultation Module Guide](docs/CONSULTATION_MODULE.md) - Complete user guide
- [Component API](docs/COMPONENTS.md) - Component reference
- [Architecture](docs/CONSULTATION_ARCHITECTURE.md) - Technical architecture
- [API Reference](docs/API_REFERENCE.md) - REST API endpoints
- [Validation Rules](docs/VALIDATION_RULES.md) - All validation rules

### Contact

For issues, feature requests, or questions:

1. Check [Troubleshooting](docs/CONSULTATION_MODULE.md#troubleshooting) section first
2. Review test files for usage examples
3. Check browser console for error messages
4. Contact: [Internal Support Channel]

## License

Copyright © 2026 iDempiere Aesthetics. All rights reserved.

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Vue 3 | 3.4+ |
| Build | Vite | 7.0+ |
| Language | TypeScript | 5.9+ |
| State | Pinia | 2.1+ |
| UI Framework | PrimeVue | 4.0+ |
| HTTP | Axios | 1.6+ |
| Testing | Vitest | 1.0+ |
| Package Manager | npm | 9.0+ |

## Related Projects

- **iDempiere Server**: https://github.com/idempiere/idempiere
- **iDempiere REST API**: Internal module
- **Aesthetics Clinic**: Reference business context

## Acknowledgments

Built with modern Vue 3, TypeScript, and best practices. Designed for healthcare clinic operations with focus on user experience and reliability.

---

**Last Updated:** 2026-02-19
**Status:** Production Ready
**Bundle ID:** 458
**Version:** 1.0.0
