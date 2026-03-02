# Multi-Operation Type Refactoring

## Overview
This refactoring transforms the GDACS Facilities AI application from a malaria-campaign-specific tool into a **universal humanitarian operations planning platform** supporting multiple intervention types.

## Completed Work

### 1. Operation Type Configuration System (`config/operationTypes.js`)
Created a comprehensive configuration system defining **7 operation types**:

- **Malaria Control** - ITN/LLIN distribution, IRS spray campaigns, ACT/RDT distribution
- **Immunization** - Mass and routine vaccination campaigns (Polio, Measles, COVID-19, etc.)
- **WASH** - Water supply, sanitation facilities, hygiene promotion
- **Nutrition** - Malnutrition screening, therapeutic feeding, RUTF distribution
- **Medical Supply Distribution** - Emergency health kits, trauma supplies, essential medicines
- **Emergency Shelter** - Temporary shelter, NFI distribution, site planning
- **General Humanitarian** - Multi-sector or custom operations

Each operation type includes:
- **Specific risk factors** with weighted importance
- **Disaster-specific impacts** and severity levels
- **Supply requirements** and adjustment multipliers
- **Assessment methodologies** (AMP cLQAS, LQAS, SPHERE, SMART, MIRA, etc.)
- **Coverage targets** (80-95% depending on operation)
- **Digital tools** recommendations
- **Mitigation priorities** per disaster type

### 2. Operation Type Selector Component (`components/OperationTypeSelector.js`)
Created a reusable UI component with two modes:

**Compact Mode:**
- Dropdown selector for space-constrained areas
- Shows operation icon, name, and description

**Full Mode:**
- Visual card-based selector with icons
- Detailed view showing:
  - Assessment methodology
  - Coverage targets
  - Key supplies
  - Risk factors with weights
- Expandable details panel

### 3. Universal Operation Viability API (`pages/api/operation-viability.js`)
Created a new API endpoint that:
- Accepts `operationType` parameter
- Loads operation-specific configuration
- Calculates viability scores with operation-specific adjustments
- Applies disaster impacts based on operation type
- Generates operation-specific AI recommendations
- Returns operation-aware mitigation strategies
- Includes supply adjustment calculations

**Key Features:**
- Dynamic risk assessment based on operation type
- Operation-specific disaster severity mappings
- Contextual AI prompts mentioning operation-specific guidelines
- Automatic supply multiplier calculations (e.g., 2.5x jerrycans for WASH during floods)
- Backward compatible with existing code

### 4. State Management Update (`pages/index.js`)
Added operation type state:
```javascript
const [operationType, setOperationType] = useState('malaria_control');
```

## Integration Tasks Remaining

### High Priority

#### 1. Add Operation Selector to Main UI
**Location:** `pages/index.js` or as a floating control
**Implementation:**
```javascript
import OperationTypeSelector from '../components/OperationTypeSelector';

// In the main layout (recommend in hamburger menu or top bar):
<OperationTypeSelector
  selectedType={operationType}
  onTypeChange={setOperationType}
  compact={true} // or false for full selector
/>
```

#### 2. Update API Calls to Include Operation Type
**Files to Update:**
- `components/MapComponent/components/drawers/FacilityDrawer.js`
- `components/MapComponent/components/overlays/CampaignDashboard.js`
- Any component calling `/api/campaign-viability`

**Example Update:**
```javascript
// OLD:
const response = await fetch('/api/campaign-viability', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ facility, impacts, disasters, acledData, acledEnabled })
});

// NEW:
const response = await fetch('/api/operation-viability', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    facility,
    impacts,
    disasters,
    acledData,
    acledEnabled,
    operationType // Add this parameter
  })
});
```

#### 3. Update FacilityDrawer
**File:** `components/MapComponent/components/drawers/FacilityDrawer.js:516`

Replace hardcoded "campaign" terminology:
```javascript
// Current (line 516+):
"Assess Campaign Viability"

// New (dynamic based on operation type):
import { getOperationType } from '../../../config/operationTypes';
const opConfig = getOperationType(operationType);
`Assess ${opConfig.name} Viability`
```

#### 4. Update CampaignDashboard Component Name & Logic
**File:** `components/MapComponent/components/overlays/CampaignDashboard.js`

Rename to `OperationDashboard` and update:
- Component name
- Title text to be dynamic
- Metrics labels to reflect operation type
- Dashboard calculations to use operation-specific criteria

```javascript
// Example:
<h2>
  {opConfig.icon} {opConfig.name} Readiness Dashboard
</h2>
<div>
  Target Coverage: {(opConfig.coverageTarget * 100)}%
</div>
```

#### 5. Update Export/Brief Generation
**Files:**
- `pages/api/export-brief.js`
- `pages/api/sitrep.js`

Add operation type context to generated reports:
```javascript
Operation Type: ${opConfig.name}
Assessment Method: ${opConfig.assessmentMethod}
Coverage Target: ${(opConfig.coverageTarget * 100)}%
```

### Medium Priority

#### 6. Update Landing/Hero Page (If Created)
Include operation type selector prominently:
- Hero section mentions "Multi-Operation Humanitarian Planning"
- Feature list highlights all 7 operation types
- Quick operation type selector before "Launch Map"

#### 7. Persist Operation Type Selection
**Location:** `pages/index.js` (localStorage)
```javascript
useEffect(() => {
  localStorage.setItem('gdacs_operation_type', operationType);
}, [operationType]);

// On mount:
const cachedOpType = localStorage.getItem('gdacs_operation_type');
if (cachedOpType) {
  setOperationType(cachedOpType);
}
```

#### 8. Update Terminology Throughout App
Global find and replace:
- "Campaign" → "Operation" (where generic)
- "Campaign Viability" → "Operation Viability"
- "Malaria Campaign" → Keep specific where referring to malaria

#### 9. Add Operation-Specific Visualizations
**CampaignDashboard/OperationDashboard:**
- Show operation-specific supply needs
- Display operation-specific risk factor weights
- Color-code by operation category

#### 10. Update README and Documentation
- Mention multi-operation capability
- List all 7 supported operation types
- Update screenshots to show operation selector
- Add operation type selection to quick start guide

### Low Priority

#### 11. Create Operation Templates
**New Feature:** Pre-configured facility/disaster scenarios for each operation type
- Example data sets for testing
- Sample assessments for training

#### 12. Operation Type Analytics
Track which operation types are most used:
```javascript
// Log to analytics when operation type changes
useEffect(() => {
  // Send to analytics service
  trackEvent('operation_type_selected', { type: operationType });
}, [operationType]);
```

#### 13. Multi-Operation Comparison Mode
Allow users to assess the same facility for multiple operation types simultaneously:
- Side-by-side comparison
- Identify which operations are viable
- Optimize resource allocation

## Testing Plan

### Unit Tests Needed
1. `operationTypes.js` helper functions
2. `calculateOperationSpecificScore()` logic
3. API response validation for each operation type

### Integration Tests
1. End-to-end flow for each operation type
2. Verify AI prompts generate appropriate responses
3. Test supply adjustment calculations
4. Validate risk factor weighting

### User Acceptance Testing
1. Test with real humanitarian practitioners
2. Validate operation-specific recommendations
3. Ensure terminology is appropriate for each sector
4. Verify coverage targets align with standards

## Migration Strategy

### Phase 1: Backward Compatible (Current State)
- New API endpoint `/api/operation-viability` created
- Old endpoint `/api/campaign-viability` still works
- Default operation type = 'malaria_control'
- No UI changes required immediately

### Phase 2: UI Integration (Next Step)
- Add operation selector to hamburger menu
- Update API calls to include operation type
- Update terminology in key components
- Test with each operation type

### Phase 3: Full Rollout
- Update all references to use new terminology
- Deprecate old `/api/campaign-viability` endpoint
- Update documentation and training materials
- Launch with marketing highlighting new capabilities

## Benefits of Multi-Operation Support

1. **Increased Utility** - One tool for multiple humanitarian sectors
2. **Better Resource Allocation** - Compare viability across operation types
3. **Sector-Specific Expertise** - Each operation uses appropriate assessment methodology
4. **Realistic Risk Assessment** - Different disasters impact different operations differently
5. **Accurate Supply Planning** - Operation-specific supply multipliers
6. **Professional Standards** - Follows sector-specific guidelines (AMP, SPHERE, SMART, etc.)
7. **Broader User Base** - Appeals to WASH, nutrition, shelter, health practitioners

## Operation Type Quick Reference

| Operation | Icon | Assessment Method | Coverage Target | Critical Risk Factor |
|-----------|------|-------------------|-----------------|---------------------|
| Malaria Control | 🦟 | AMP cLQAS | 80% | Standing water / breeding sites |
| Immunization | 💉 | LQAS | 90% | Cold chain integrity |
| WASH | 💧 | SPHERE Standards | 95% | Water contamination |
| Nutrition | 🥣 | SMART Survey | 85% | Food security |
| Medical Supply | 🏥 | Rapid Health Assessment | 90% | Road access & logistics |
| Shelter | ⛺ | SPHERE Shelter Standards | 95% | Population displacement |
| General | 🌍 | MIRA | 80% | Access & security |

## Next Steps

1. **Immediate:** Add operation selector to hamburger menu (compact mode)
2. **This Sprint:** Update API calls in FacilityDrawer and CampaignDashboard
3. **Next Sprint:** Rename components, update terminology, add persistence
4. **Future:** Landing page, multi-operation comparison, templates

## Questions to Consider

1. Should operation type be global (one per session) or per-facility?
2. Do we want a "multi-operation" mode comparing all types?
3. Should we add custom operation type creation?
4. How should we handle backward compatibility for existing users?

---
**Status:** Core refactoring complete, ready for UI integration
**Last Updated:** 2025-03-02
