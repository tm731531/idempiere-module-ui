# Consultation Module - Deployment Checklist

## Pre-Deployment Verification

### Code Quality & Tests

- [ ] All 355 tests passing: `npm run test`
  - Expected output: `355 passed`
  - No test failures or errors

- [ ] TypeScript type checking: `npm run type-check`
  - Expected: No errors or warnings
  - Command: `vue-tsc --noEmit`

- [ ] Code linting: `npm run lint`
  - Expected: No critical errors
  - Warnings acceptable if non-critical

- [ ] Build successful: `npm run build`
  - Expected: `dist/` folder created
  - No build errors or warnings

### Code Cleanliness

- [ ] No `console.log()` statements in production code
  - Search: `grep -r "console.log" src/`
  - Only in test files should be present

- [ ] No `console.warn()` or `console.error()` except in error handlers
  - Legitimate use: error handlers, debug utilities only

- [ ] No commented-out code blocks
  - Dead code should be deleted, not commented

- [ ] No TODO comments without context
  - Every TODO should have explanation of what/why

- [ ] No hardcoded debug values
  - API endpoints should be configurable
  - Status IDs fetched dynamically
  - No mock data in production code

### Documentation

- [ ] README.md complete: `/home/tom/idempiere-module-ui/README.md`
- [ ] Consultation Module guide: `docs/CONSULTATION_MODULE.md`
- [ ] Component documentation: `docs/COMPONENTS.md`
- [ ] Architecture document: `docs/CONSULTATION_ARCHITECTURE.md`
- [ ] API reference: `docs/API_REFERENCE.md`
- [ ] Validation rules: `docs/VALIDATION_RULES.md`
- [ ] Deployment checklist: `DEPLOYMENT_CHECKLIST.md`
- [ ] Release notes: `RELEASE_NOTES.md`

### Browser Compatibility

- [ ] Tested on iOS Safari 14+
- [ ] Tested on Android Chrome 90+
- [ ] Tested on desktop Chrome (latest)
- [ ] Tested on desktop Firefox (latest)
- [ ] Tested on desktop Edge (latest)

### Mobile Testing

- [ ] iPhone screen size (375px width)
  - Forms render correctly
  - QuickActionBar accessible at bottom
  - Modals display properly

- [ ] iPad screen size (768px width)
  - Layout scales appropriately
  - Touch targets adequate (48px+)

- [ ] Android phone (360px-480px)
  - All interactive elements accessible
  - No horizontal scroll needed
  - Safe area respected

- [ ] Keyboard interaction on mobile
  - Date pickers work
  - Time pickers work
  - Modals dismissible

### Performance Verification

- [ ] Page load time < 3 seconds
  - Measure from fresh browser cache clear
  - Test on average network speed (4G)

- [ ] API response time < 1 second
  - Typical for consultation list fetch
  - Dashboard metrics calculation

- [ ] No memory leaks
  - Open form, close form repeatedly
  - Check DevTools memory tab
  - Memory should stabilize

- [ ] Smooth animations
  - Modal transitions smooth (no jank)
  - Activity timeline renders smoothly
  - Responsive interactions immediate

---

## Deployment Steps

### 1. Prepare Build

```bash
cd /home/tom/idempiere-module-ui/webapp

# Install latest dependencies
npm install

# Run full test suite
npm run test

# Verify all tests pass (expect 355 passed)
```

**Expected Result:**
```
 Test Files  39 passed (39)
      Tests  355 passed (355)
```

### 2. Type Check

```bash
npm run type-check
```

**Expected Result:**
```
✓ No TypeScript errors detected
```

### 3. Lint Check

```bash
npm run lint
```

**Expected Result:**
```
✓ No linting errors found
```

### 4. Build JavaScript

```bash
npm run build
```

**Expected Result:**
```
✓ 23 modules transformed
✓ dist/ folder created with:
  - index.html
  - css/ folder
  - js/ folder
```

### 5. Create OSGi Bundle

```bash
cd /home/tom/idempiere-module-ui

# Build and create JAR
bash build.sh

# Expected: org.idempiere.ui.aesthetics_1.0.0.YYYYMMDDHHMM.jar created
```

**Expected Result:**
```
Building OSGi WAB bundle...
✓ JAR created: org.idempiere.ui.aesthetics_1.0.0.202602191000.jar
```

### 6. Deploy to iDempiere

```bash
# Deploy with automatic Felix update
bash build.sh --deploy

# Expected: Bundle uploaded and activated in Felix
```

**Expected Result:**
```
✓ Bundle 458 updated in Felix
✓ Bundle activated
✓ Available at https://host:8443/aesthetics/#/
```

### 7. Verify Deployment

Open browser and navigate to:
```
https://[hostname]:8443/aesthetics/#/
```

**Checklist:**
- [ ] Page loads without errors
- [ ] Navigation works (list → form → dashboard)
- [ ] Create new consultation
- [ ] Add activity to consultation
- [ ] Change status
- [ ] Set tracking date
- [ ] View dashboard
- [ ] Check browser console for errors

---

## Post-Deployment Testing

### Functional Testing

#### Consultation List
- [ ] Page loads with consultation list
- [ ] Can search by customer name
- [ ] Can sort by date
- [ ] Can click row to edit consultation
- [ ] "New" button creates new consultation
- [ ] Mobile view works (card layout)

#### Consultation Form
- [ ] Form fields render correctly
- [ ] Can select customer (FK lookup)
- [ ] Can select consultation type
- [ ] Mandatory field validation works
- [ ] Can fill all optional fields
- [ ] Form submit succeeds
- [ ] Form data persists after reload

#### Activity Timeline
- [ ] Timeline displays existing activities
- [ ] Activities sorted newest first
- [ ] Empty state shows message
- [ ] Invalid JSON handled gracefully

#### Quick Actions
- [ ] Phone button opens modal
- [ ] Message button opens modal
- [ ] Status button opens modal
- [ ] Tracking button opens modal
- [ ] All modals validate input
- [ ] Activities saved to timeline

#### Activity Input Modal
- [ ] Text input accepts up to 500 characters
- [ ] Character counter updates
- [ ] "Add" button saves activity
- [ ] "Cancel" button closes modal
- [ ] Validation prevents empty content
- [ ] Validation prevents >500 characters

#### Status Update Modal
- [ ] Shows available statuses
- [ ] Can select different status
- [ ] Prevents selecting same status
- [ ] Status update saved to record
- [ ] Activity logged for status change

#### Tracking Date Modal
- [ ] Date picker shows calendar
- [ ] Can select date within 0-90 days
- [ ] Rejects past dates
- [ ] Rejects future dates >90 days
- [ ] Time picker shows time input
- [ ] Validates business hours (08:00-19:59)
- [ ] Description field accepts up to 200 chars
- [ ] Saves tracking activity

#### Dashboard
- [ ] Page loads with metrics
- [ ] Shows consultation count
- [ ] Shows conversion rate (%)
- [ ] Shows avg response time (hours)
- [ ] Shows pending count
- [ ] Shows silent consultations (red)
- [ ] Shows lost customers (red)
- [ ] Top customers ranking displays
- [ ] Mobile view responsive

### Error Handling Testing

- [ ] Invalid API token handled correctly
- [ ] 404 errors handled (record not found)
- [ ] 400 errors handled (validation failed)
- [ ] 500 errors handled (server error)
- [ ] Network timeout handled
- [ ] Form validation prevents bad submissions
- [ ] Modal validation prevents bad data

### Mobile Testing (Post-Deploy)

**iPhone:**
- [ ] Open on iPhone (375px or actual iPhone)
- [ ] All interactive elements accessible
- [ ] QuickActionBar visible at bottom
- [ ] Modals display full-screen appropriately
- [ ] Forms stack vertically
- [ ] No horizontal scroll
- [ ] Touch interactions responsive

**Android:**
- [ ] Open on Android phone
- [ ] Same checks as iPhone
- [ ] Native keyboard integrates well
- [ ] Date/time pickers use native controls

**Tablet:**
- [ ] iPad or Android tablet (768px+)
- [ ] Layout adjusts appropriately
- [ ] Buttons not too far apart
- [ ] Modals sized appropriately

### Performance Testing (Post-Deploy)

**Page Load:**
```
1. Open DevTools → Network tab
2. Hard refresh (Ctrl+Shift+R)
3. Wait for page to load
4. Check:
   - Total load time < 3 seconds
   - No requests with 4xx/5xx errors
   - All resources loaded
```

**Dashboard Load:**
```
1. Navigate to dashboard
2. Monitor Network tab
3. Check:
   - API call completed
   - Metrics calculated and displayed
   - No JavaScript errors in console
```

**Form Interaction:**
```
1. Open a consultation form
2. Type in fields
3. Check:
   - No lag when typing
   - Form interactions responsive
   - No memory warnings in DevTools
```

### Cross-Browser Testing (Post-Deploy)

| Browser | Version | Result |
|---------|---------|--------|
| Chrome | Latest | Pass ✓ |
| Firefox | Latest | Pass ✓ |
| Safari | 14+ | Pass ✓ |
| Edge | Latest | Pass ✓ |
| Mobile Safari | iOS 14+ | Pass ✓ |
| Chrome Mobile | Android 90+ | Pass ✓ |

---

## Monitoring & Support (24-48 Hours Post-Deploy)

### Log Monitoring

**Location:** `/opt/idempiere-server/x86_64/log/`

- [ ] Check server logs for errors
- [ ] Watch for `Exception` entries
- [ ] Monitor API error rates
- [ ] Check database error logs

```bash
# Monitor real-time
tail -f /opt/idempiere-server/x86_64/log/system.log | grep ERROR

# Search for past errors
grep "ERROR" /opt/idempiere-server/x86_64/log/system.log | tail -50
```

### User Feedback

- [ ] Collect feedback from test users
- [ ] Monitor for reported issues
- [ ] Check email for error reports
- [ ] Create tickets for any issues found

### Metrics Monitoring

- [ ] API response times normal
- [ ] No spike in server CPU usage
- [ ] No spike in database queries
- [ ] No memory leak in app server

### Error Tracking

Monitor for common errors:
- [ ] 401 Unauthorized (authentication)
- [ ] 404 Not Found (data inconsistency)
- [ ] 500 Server Error (unexpected issues)
- [ ] JavaScript errors in browser console

---

## Rollback Plan

If critical issues found within 24 hours:

### Step 1: Notify Users

```
"We've identified an issue with the consultation module.
We're rolling back to the previous version.
Your data is safe. Service will be restored shortly."
```

### Step 2: Stop Current Bundle

```bash
# In Felix Web Console:
# 1. Go to /osgi/system/console/bundles
# 2. Find bundle 458 (org.idempiere.ui.aesthetics)
# 3. Click "Stop" button
```

### Step 3: Activate Previous Version

```bash
# In Felix Web Console:
# 1. Find previous bundle version (if available)
# 2. Click "Start" button
# OR
# Upload previous JAR:
# - Bundle ID: 458
# - Action: install
# - Bundlefile: [previous JAR]
```

### Step 4: Verify Service Restored

```bash
# Test in browser
https://[hostname]:8443/aesthetics/#/

# Verify functionality
- Consultations load
- Can edit consultation
- Dashboard shows metrics
- No errors in console
```

### Step 5: Root Cause Analysis

Document:
- What went wrong
- When it was discovered
- How it was fixed
- What testing was missed
- Preventive measures for next time

### Step 6: Fix and Re-Test

```bash
# Fix issue
# Re-run all tests
npm run test

# Verify fix doesn't break other things
npm run type-check

# Build and deploy again (after thorough testing)
bash build.sh --deploy
```

---

## Sign-Off

### Development Team

- [ ] Code review completed
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Ready for production

**Developer:** ________________  **Date:** ________

### QA Team

- [ ] Functional testing complete
- [ ] Mobile testing complete
- [ ] Cross-browser testing complete
- [ ] Performance acceptable
- [ ] Ready for production

**QA Lead:** ________________  **Date:** ________

### Operations Team

- [ ] Deployment steps verified
- [ ] Rollback plan understood
- [ ] Monitoring setup complete
- [ ] Support team informed
- [ ] Approved for production

**Ops Lead:** ________________  **Date:** ________

---

## Contact & Escalation

### During Deployment

- **Technical Issues:** [Dev Team Contact]
- **Questions:** [Project Manager Contact]

### Post-Deployment Support

- **Bug Reports:** [Support Ticket System]
- **Critical Issues:** [On-Call Engineer]
- **General Questions:** [Support Email]

---

## Appendix: Helpful Commands

### Testing
```bash
cd webapp
npm run test              # All tests
npm run test:watch       # Watch mode
npm run test src/...     # Specific file
```

### Building
```bash
cd webapp
npm run build            # Build Vue app
npm run type-check       # TypeScript check
npm run lint             # Linting
```

### Deployment
```bash
cd /home/tom/idempiere-module-ui
bash build.sh            # Build only
bash build.sh --deploy   # Build & deploy
```

### Monitoring
```bash
# Check bundle status
curl -u SuperUser:System \
  https://localhost:8443/osgi/system/console/bundles | grep -i aesthetics

# View logs
tail -f /opt/idempiere-server/x86_64/log/system.log
```

---

**Document Version:** 1.0
**Last Updated:** 2026-02-19
**Status:** Production Ready
