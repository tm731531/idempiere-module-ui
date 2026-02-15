# iDempiere Aesthetics UI (idempiere-module-ui)

## Project Overview

Vue 3 + TypeScript SPA for aesthetics clinic operations, deployed as an OSGi WAB bundle on iDempiere 12. All document forms are **metadata-driven** — field layouts come from iDempiere's Application Dictionary (AD_Field/AD_Column), not hardcoded HTML.

- **Stack**: Vue 3, Vite 7, TypeScript 5.9, PrimeVue 4 (Unstyled), Pinia 3, Vitest
- **Bundle**: `org.idempiere.ui.aesthetics` (bundle ID 458) → `https://<host>:8443/aesthetics/#/`
- **Backend**: iDempiere REST API (OData-style queries)

## Commands

```bash
# Development
cd webapp && npm run dev          # Vite dev server (port 5173, proxies /api)
cd webapp && npm run test         # Run tests once (vitest run)
cd webapp && npm run test:watch   # Watch mode
cd webapp && npm run type-check   # vue-tsc --noEmit

# Build & Deploy
bash build.sh                     # Build Vue + create OSGi JAR
bash build.sh --deploy            # Build + deploy to Felix Web Console (auto bundle 458 update)
```

## Project Structure

```
webapp/src/
├── api/              # REST API modules (one per domain)
│   ├── client.ts     # Axios instance + 401 interceptor (sessionExpired flag, no auto-logout)
│   ├── metadata.ts   # AD_Field/AD_Column fetching, FK resolution, defaults, sqlWhereToODataFilter
│   ├── lookup.ts     # Dynamic reference ID lookups (cached)
│   ├── order.ts      # C_Order + C_OrderLine (cache-busting with _t param)
│   ├── payment.ts    # C_Payment
│   ├── inout.ts      # M_InOut + M_InOutLine
│   ├── production.ts # M_Production + M_ProductionLine
│   ├── product.ts    # M_Product (listProducts, getProduct, updateProduct)
│   ├── request.ts    # R_Request (consultations)
│   ├── assignment.ts # S_ResourceAssignment (appointments)
│   ├── bpartner.ts   # C_BPartner + AD_User (contacts)
│   ├── resource.ts   # S_Resource (doctors)
│   ├── attachment.ts # AD_Attachment
│   ├── dictionary.ts # AD_Table/Column/Field browser
│   └── utils.ts      # OData escaping, date formatting (toIdempiereDateTime, parseIdempiereDateTime)
├── components/       # Reusable components
│   ├── DynamicForm.vue      # Renders field defs → mandatory/optional sections, fkLabels prop
│   ├── DynamicField.vue     # Single field by AD_Reference_ID type (supports Ref 31 Locator)
│   ├── SearchSelector.vue   # FK picker (dropdown ≤50, search >50, QuickCreate, initialLabel)
│   ├── StatusBadge.vue      # DocStatus colored badge
│   ├── DocActionBar.vue     # Complete/Void/Cancel buttons
│   └── AppHeader.vue        # Navigation + user menu
├── composables/
│   ├── useDocumentForm.ts   # Core: load metadata → init defaults → validate → payload
│   │                        # Returns: fkLabels, mandatoryErrors, isValid, getFormPayload, getUpdatePayload
│   ├── useMetadata.ts       # Metadata caching per tabId
│   ├── useDocAction.ts      # Document workflow (Complete via Process endpoint)
│   ├── useAttachment.ts     # File upload/download
│   └── usePermission.ts     # AD_SysConfig role-based page access
├── stores/
│   └── auth.ts              # Multi-step login, token/context persistence
├── router/
│   └── index.ts             # Hash-based routing, auth guards, permission checks
├── i18n/
│   └── fieldLabels.ts       # Chinese column→label mappings (150+ entries)
└── views/                   # Page components (list + form per domain)
    ├── consultation/        # R_Request
    ├── order/               # C_Order + lines
    ├── treatment/           # M_Production (療程) + lines
    ├── payment/             # C_Payment
    ├── shipment/            # M_InOut + lines
    ├── customer/            # C_BPartner + AD_User contacts
    ├── appointment/         # S_ResourceAssignment + CalendarView
    ├── product/             # M_Product (商品管理)
    └── admin/               # FieldConfig, TableList, ColumnList, ReferenceData
```

## Architecture: Metadata-Driven Forms

All document forms follow this pattern:

```typescript
const {
  visibleFieldDefs, formData, fkLabels, isCreate, readOnly,
  isValid, mandatoryErrors,
  load, getFormPayload, getUpdatePayload, populateFromRecord,
} = useDocumentForm({
  tabId: 186,        // AD_Tab_ID — determines which fields to load
  recordId: computed(() => route.params.id ? Number(route.params.id) : null),
  loadRecord: (id) => getOrder(id),
  excludeColumns: ['DocumentNote', 'Help'],  // optional: hide specific columns
  columnFilters: { C_BPartner_ID: 'IsCustomer eq true' },
})
```

**Flow**: `useDocumentForm` → `fetchFieldDefinitions(tabId)` → AD_Field + AD_Column batch query → resolve FK table names → `DynamicForm` renders fields → `DynamicField` picks widget by `AD_Reference_ID`.

### AD_Tab_ID Mapping

| Module | Table | Tab ID | Line Tab | Window |
|--------|-------|--------|----------|--------|
| Order | C_Order | 186 | 187 | Sales Order |
| Shipment | M_InOut | 257 | 258 | Shipment |
| Production | M_Production | **53344** | — | Production (Single Product) |
| Payment | C_Payment | 330 | — | Payment |
| Consultation | R_Request | 344 | — | Request |
| Appointment | S_ResourceAssignment | 415 | — | Resource Assignment |
| Customer | C_BPartner | 220 | — | Business Partner |
| **Product** | **M_Product** | **180** | — | Product |

> **Note**: Production uses tab 53344 (from "Production (Single Product)" window), NOT tab 319 (classic "Production" window). Tab 53344 has M_Product_ID, ProductionQty, M_Locator_ID fields that tab 319 lacks.

### AD_Reference_ID → Widget Mapping

| Ref ID | Type | Widget |
|--------|------|--------|
| 10 | String | `<input type="text">` |
| 11 | Integer | `<input type="number">` |
| 12 | Amount | `<input type="number" step="0.01">` |
| 14 | Text | `<textarea>` |
| 15 | Date | `<input type="date">` |
| 16 | DateTime | `<input type="datetime-local">` |
| 17 | List | `<select>` (from AD_Ref_List) |
| 18 | Table | `SearchSelector` (table from AD_Ref_Table) |
| 19 | TableDirect | `SearchSelector` (table from column name) |
| 20 | YesNo | `<input type="checkbox">` |
| 29 | Quantity | `<input type="number">` |
| 30 | Search | `SearchSelector` (table from AD_Ref_Table or column name) |
| **31** | **Locator** | `SearchSelector` (table derived from column name, e.g. `M_Locator`) |
| 38 | Memo | `<textarea>` |
| 13 | ID | Hidden |
| 28 | Button | Hidden |

## Critical Patterns

### FK Table Name Resolution (Ref 18/19/30/31)

Many iDempiere columns (C_BPartner_ID, C_Order_ID, M_Product_ID) are Ref 30 (Search) **without** `AD_Reference_Value_ID`. The table name is derived from the column name by stripping `_ID`:

- **Ref 19/31** (TableDirect/Locator): Always derive from column name (`M_Warehouse_ID` → `M_Warehouse`)
- **Ref 18/30** with `AD_Reference_Value_ID`: Resolve via `AD_Ref_Table` → `AD_Table`
- **Ref 18/30** without `AD_Reference_Value_ID`: Fallback to column name derivation

This fallback exists in both `metadata.ts` (during fetch) and `DynamicField.vue` (safety net).

### FK Labels (initialLabel pattern)

When loading an existing record, iDempiere REST returns FK fields as objects: `{"id": 100004, "identifier": "Berlin"}`. The `useDocumentForm.populateFromRecord()` extracts these identifiers into `fkLabels` ref. The chain is:

```
useDocumentForm → fkLabels → DynamicForm (prop) → DynamicField (prop) → SearchSelector (initialLabel prop)
```

This prevents SearchSelector from making an extra API call to resolve the display name, and avoids `#100004` showing for FK fields where the resolve call might fail.

### System Columns (Hidden from Forms)

`useDocumentForm` filters out these columns automatically:

```
Created, CreatedBy, Updated, UpdatedBy, IsActive, AD_Client_ID, AD_Org_ID,
Processed, Processing, Posted, ProcessedOn, IsApproved, IsGenerated,
IsSelfService, IsSelected, IsTransferred, IsInvoiced, IsDelivered,
IsCreditApproved, IsPrinted, SendEMail, DocumentNo, IsCreated
```

### Column Filters & Validation Rules

Two levels of filtering for FK SearchSelector dropdowns:

1. **columnFilters** (view-specific): `{ C_BPartner_ID: 'IsCustomer eq true' }`
2. **AD_Val_Rule** (auto-resolved): `sqlWhereToODataFilter()` converts SQL WHERE to OData `$filter`

`columnFilters` take priority over auto-resolved AD_Val_Rule.

### Save Button Pattern (Draft Edit Mode)

All document forms (Order, Production, Product) should have a "儲存修改" button when in editable state:

```vue
<!-- Save button (draft edit mode) -->
<div v-if="!isCreate && !readOnly" class="form-actions">
  <button type="button" :disabled="saving" @click="handleSave">
    {{ saving ? '儲存中...' : '儲存修改' }}
  </button>
</div>
```

The `handleSave` function uses `getUpdatePayload()` → PUT, then reloads via `populateFromRecord()`.

For documents without DocStatus (e.g. M_Product), `readOnly` stays `false` so the save button always shows.

### Mandatory Validation Display

Show unfilled mandatory fields as a warning banner:

```vue
<div v-if="mandatoryErrors.length > 0" class="mandatory-errors">
  <span>請填寫必填欄位：</span>{{ mandatoryErrors.join('、') }}
</div>
```

### iDempiere REST API Conventions

- List/FK fields return **objects**: `{"id": "DR", "identifier": "Drafted"}` — always extract `.id`
- DateTime format: `yyyy-MM-dd'T'HH:mm:ssZ` — NO milliseconds (use `toIdempiereDateTime()`)
- API returns `Z` suffix but values are actually **local time** — use `parseIdempiereDateTime()`
- DocAction must go through Process endpoint, not field update
- PUT `/auth/tokens` returns a **new token** — old token immediately invalid
- OData filter operators: `eq`, `neq`, `gt`, `ge`, `lt`, `le`, `in`, `contains()`, `startswith()`, `endswith()`
- **`ne` is NOT supported** — must use `neq`; `not` only works with functions
- Boolean filter uses `true`/`false`, not `'Y'`/`'N'`
- `$valrule` + `$context`: `$valrule=133&$context=IsSOTrx:Y` (context booleans use `Y`/`N`)
- Cache-busting: pass `_t: Date.now()` for data that must be fresh (e.g. order lines after add/delete)

### Authentication Flow

Multi-step cascading: `POST tokens` → `GET roles` → `GET orgs` → `GET warehouses` → `PUT tokens`

Token + context + user all persisted to localStorage. If token exists but context is missing on init, force re-login. **Never auto-logout on 401** — use `sessionExpired` flag + UI banner.

### Dynamic Lookups

Never hardcode reference IDs (C_DocType_ID, C_BP_Group_ID, etc.). Use `api/lookup.ts` which caches in-memory and clears on logout.

### SearchSelector Modes

- **Dropdown** (≤50 records): Load all options, render `<select>`
- **Search** (>50 records): Debounced search input with autocomplete
- **resolveCurrentLabel()**: When editing, resolves numeric ID to display name via single GET. Uses `initialLabel` prop first if available (avoids API call).
- **QuickCreate**: Dynamically determined via `checkQuickCreateEligibility()` from AD metadata

### Read-Only vs Editable Field Styling

Disabled fields use distinct styling (not just opacity):
```css
input:disabled, textarea:disabled, select:disabled {
  background: #f1f5f9; color: #64748b; border-color: #e2e8f0;
  cursor: not-allowed; opacity: 1;
}
input[type="checkbox"]:disabled { opacity: 0.5; }
```

## Module-Specific Notes

### Order (C_Order)

- **IsSOTrx toggle**: Create mode has segmented button for 銷售/採購; edit mode shows read-only badge
- **Order totals sync**: After line add/edit/delete, `reloadOrderAndLines()` fetches header and syncs TotalLines/GrandTotal back to `formData` (DynamicForm reads from formData, not order.value)
- **Line edit form**: Includes M_Product_ID selector, matches add form parity
- **Save button**: "儲存修改" in draft mode

### Production / Treatment (M_Production)

- **Tab 53344** (Production Single Product window) — NOT tab 319
- **M_Product_ID filter**: `IsBOM eq true AND IsVerified eq true` — only BOM-verified products can be selected for therapy
- **BOM concept**: Therapy = BOM product (not a physical item, but a composition of consumables/services)
- **PP_Product_BOM**: BOM header linked to M_Product; PP_Product_BOMLine contains components (CO=Component, PH=Phantom, PK=Packing)
- **IsCreated**: System flag, added to SYSTEM_COLUMNS to hide from form
- **MovementDate handling**: DynamicForm datetime-local inputs produce strings, not Date objects. `createProduction()` handles both `Date` and `string` types.
- **Save button**: "儲存修改" in draft mode (PUT update)
- **Callouts**: `CalloutProduction.product` fires server-side when product is selected

### Product (M_Product)

- **Tab 180** (Product window)
- **No DocStatus**: Products are always editable (readOnly stays false)
- **Excluded columns**: DocumentNote, Help, ShelfWidth/Height/Depth, UnitsPerPallet, M_FreightCategory_ID, R_MailText_ID, C_RevenueRecognition_ID, IsOwnBox, IsDropShip, IsKanban, IsPhantom, IsAutoProduce, M_PartType_ID, Classification, VersionNo, SKU, SalesRep_ID, CustomsTariffNumber, LowLevel, M_AttributeSetInstance_ID
- **Core fields**: Value (搜尋鍵), Name, M_Product_Category_ID, C_TaxCategory_ID, C_UOM_ID, ProductType, IsBOM, IsVerified
- **BOM products** (IsBOM=Y, IsVerified=Y): Used as therapy items in Production module
- **List view**: Search + tabs (全部/BOM療程/一般商品)

### Payment (C_Payment)

- **PaymentRule values**: B=Cash, P=On Credit, K=Credit Card, S=Check, D=Direct Debit, T=Direct Deposit, M=Mixed POS

## Testing

```bash
cd webapp && npm run test    # 103 tests across 22 files
```

- **Framework**: Vitest + happy-dom + Vue Test Utils
- **Mocking**: Mock `apiClient` (from `@/api/client`), `useAuthStore`, `useRouter`
- **Async**: Use `flushPromises()` for async operations, `setTimeout` + `$nextTick` for SearchSelector init
- Tests in `__tests__/` directories next to source files

## Deployment

The app is packaged as an OSGi WAB JAR and deployed to iDempiere's Felix container:

1. `bash build.sh --deploy` builds Vue → creates JAR → copies to `plugins/` → auto-updates via Felix Web Console
2. Felix Web Console at `/osgi/system/console/bundles` (login: SuperUser/System)
3. Bundle update uses `action=install` + `uploadid={bundleId}` to keep the same bundle ID (458)

**MANIFEST.MF is sacred** — don't modify without understanding OSGi implications.

### Felix Gotcha

`action=update` only reloads from the **original install location**, ignoring uploaded JAR. Always use `action=install` + `uploadid` for in-place updates.

## TypeScript Notes

- `erasableSyntaxOnly: true` — `public x` in constructor params is NOT allowed; declare field separately
- Path alias: `@/` → `src/`
- Vue files need `<script setup lang="ts">`

## Language

- UI labels are in **Traditional Chinese** (zh-TW)
- Field labels from `i18n/fieldLabels.ts` override English AD_Field.Name
- Code comments and variable names in English

## Iron Rules

1. **Never hardcode iDempiere reference values** — displayField, default value types, table column existence must be queried from AD metadata
2. **Never hardcode IDs** — C_BP_Group_ID, C_DocType_ID, C_UOM_ID etc. must be dynamically queried
3. **FK QuickCreate must be dynamically determined** — use `checkQuickCreateEligibility()`, not hardcoded table lists
4. **JS falsy zero pitfall**: `!0 === true` — always use `=== null` or `=== undefined` checks
