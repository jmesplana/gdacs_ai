# App Hub Architecture Proposal

## Overview

Transform Aidstack Disasters into a **modular platform** where specialized workflows (microplanning, supply chain, vaccination campaigns) exist as installable apps on top of a stable core.

**Goal**: Different teams get different tools without bloating the base application.

- Emergency ops team: Core disaster monitoring + relevant apps
- Malaria team: Core + Campaign Microplanning app
- WASH team: Core + WASH Assessment app (future)

---

## Why App Hub Architecture?

### 1. Separation of Concerns
- **Core app remains focused**: Disaster monitoring, facility mapping, AI analysis
- **Specialized workflows** become opt-in modules
- Users only see features relevant to their work

### 2. Scalability
- Different humanitarian sectors have wildly different needs (health vs. shelter vs. WASH)
- Plugin architecture serves multiple verticals without core bloat
- Faster load times (users only load installed apps)

### 3. Future-Proofing
- New specialized tools (vaccination campaigns, nutrition surveys, WASH assessments) become discrete apps
- Potential for third-party app development
- Aligns with modern SaaS patterns (Slack apps, Figma plugins, Salesforce AppExchange)

---

## Architecture Overview

```
pages/app.js (Core Platform)
    ↓
    ├── Base Features (Always Available)
    │   ├── Map with disaster/facility/conflict layers
    │   ├── AI Chat
    │   ├── Recommendations
    │   ├── Outbreak Risk Analysis
    │   ├── Situation Reports
    │   └── Campaign Viability Assessments
    ↓
    └── App Hub
        ├── Installed Apps
        │   ├── 📊 Microplanning App
        │   ├── 📦 Supply Chain Tracker (future)
        │   ├── 💉 Vaccination Campaign Manager (future)
        │   └── 🚰 WASH Assessment Tool (future)
        └── Available Apps (Browse & Install)
```

---

## Implementation Scope: **Medium Change** (~1.5-2 weeks)

### Phase 1: Core Infrastructure (2-3 days)

#### 1. App Registry System
**File**: `config/appRegistry.js`

```javascript
export const APPS = {
  'microplanning': {
    id: 'microplanning',
    name: 'Campaign Microplanning',
    description: 'ITN/OCV campaign resource planning with auto-calculated budgets',
    longDescription: 'Bottom-up microplanning for mass campaigns. Calculate personnel, vehicles, supplies. Optimize distribution points. Generate budgets.',
    icon: '📊',
    version: '1.0.0',
    author: 'Aidstack',
    category: 'Health Campaigns',

    // What component to render
    drawerComponent: 'MicroplanningDrawer',

    // What base data this app needs
    requiredData: ['facilities', 'population', 'districts'],

    // Permissions (future: for multi-user scenarios)
    permissions: ['read:facilities', 'write:campaigns', 'export:reports'],

    // Feature flags
    features: [
      'ITN campaign planning',
      'OCV campaign planning',
      'Vaccination campaigns',
      'Distribution point optimization',
      'Resource & budget export'
    ],
  },

  'supply-chain': {
    id: 'supply-chain',
    name: 'Supply Chain Tracker',
    description: 'Track shipments, warehouses, and supply disruptions',
    icon: '📦',
    version: '0.9.0',
    author: 'Aidstack',
    category: 'Logistics',
    drawerComponent: 'SupplyChainDrawer',
    requiredData: ['facilities'],
    permissions: ['read:facilities', 'write:shipments'],
    features: [
      'Warehouse inventory tracking',
      'Shipment route optimization',
      'Disruption alerts',
      'Last-mile delivery planning'
    ],
    // Coming soon
    status: 'coming_soon',
  },

  // Additional apps...
};

export const APP_CATEGORIES = [
  { id: 'health', name: 'Health Campaigns', icon: '🏥' },
  { id: 'logistics', name: 'Logistics', icon: '📦' },
  { id: 'security', name: 'Security', icon: '🛡️' },
  { id: 'assessment', name: 'Assessments', icon: '📋' },
];
```

#### 2. App State Management
**File**: `pages/app.js` (add to existing state)

```javascript
// App Hub state
const [installedApps, setInstalledApps] = useState(['microplanning']); // User's installed apps
const [activeApp, setActiveApp] = useState(null); // Currently open app drawer
const [showAppHub, setShowAppHub] = useState(false); // App hub modal visibility

// Install/uninstall handlers
const installApp = (appId) => {
  if (!installedApps.includes(appId)) {
    setInstalledApps([...installedApps, appId]);
    // Optionally persist to localStorage or backend
    localStorage.setItem('installedApps', JSON.stringify([...installedApps, appId]));
  }
};

const uninstallApp = (appId) => {
  setInstalledApps(installedApps.filter(id => id !== appId));
  if (activeApp === appId) setActiveApp(null);
  localStorage.setItem('installedApps', JSON.stringify(installedApps.filter(id => id !== appId)));
};
```

#### 3. App Hub UI Component
**File**: `components/AppHub.js` (new)

```javascript
import React from 'react';
import { APPS, APP_CATEGORIES } from '../config/appRegistry';

export default function AppHub({ installedApps, onInstall, onUninstall, onLaunch, onClose }) {
  const [selectedCategory, setSelectedCategory] = React.useState('all');

  const filteredApps = Object.values(APPS).filter(app => {
    if (selectedCategory === 'all') return true;
    return app.category.toLowerCase().includes(selectedCategory);
  });

  return (
    <div style={{ /* Modal overlay styles */ }}>
      <div style={{ /* Modal content */ }}>
        <header>
          <h2>App Hub</h2>
          <p>Extend your platform with specialized tools</p>
        </header>

        {/* Category filters */}
        <div style={{ /* Category tabs */ }}>
          <button onClick={() => setSelectedCategory('all')}>All Apps</button>
          {APP_CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}>
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>

        {/* App grid */}
        <div style={{ /* Grid layout */ }}>
          {filteredApps.map(app => {
            const isInstalled = installedApps.includes(app.id);
            const isComingSoon = app.status === 'coming_soon';

            return (
              <div key={app.id} style={{ /* App card */ }}>
                <div style={{ fontSize: '48px' }}>{app.icon}</div>
                <h3>{app.name}</h3>
                <p>{app.description}</p>

                <div style={{ /* Feature list */ }}>
                  {app.features.map(feature => (
                    <span key={feature}>✓ {feature}</span>
                  ))}
                </div>

                <div style={{ /* Actions */ }}>
                  {isComingSoon ? (
                    <button disabled>Coming Soon</button>
                  ) : isInstalled ? (
                    <>
                      <button onClick={() => onLaunch(app.id)}>Launch</button>
                      <button onClick={() => onUninstall(app.id)}>Uninstall</button>
                    </>
                  ) : (
                    <button onClick={() => onInstall(app.id)}>Install</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

#### 4. App Launcher in Main UI
**File**: `pages/app.js` or `components/MapComponent/components/overlays/FloatingActionButtons.js`

Add "Apps" button to main UI (near chat/filters):

```javascript
{/* App Hub button */}
<button
  onClick={() => setShowAppHub(true)}
  style={{ /* FAB style */ }}
  title="App Hub"
>
  🧩 Apps
</button>

{/* Show installed apps as quick launch */}
<div style={{ /* Quick launch bar */ }}>
  {installedApps.map(appId => {
    const app = APPS[appId];
    return (
      <button
        key={appId}
        onClick={() => setActiveApp(appId)}
        title={app.name}
      >
        {app.icon}
      </button>
    );
  })}
</div>
```

#### 5. Dynamic App Drawer Rendering
**File**: `pages/app.js` (render section)

```javascript
{/* Existing drawers */}
<ChatDrawer ... />
<FilterDrawer ... />

{/* Dynamic App Drawer */}
{activeApp && APPS[activeApp] && (
  <AppDrawer
    app={APPS[activeApp]}
    context={{
      // Base platform data available to apps
      facilities,
      disasters,
      acledData,
      districtData,
      worldPopData,
      map, // Leaflet map instance
    }}
    actions={{
      // Functions apps can call
      addNotification: (msg, type) => { /* ... */ },
      exportReport: (data, filename) => { /* ... */ },
      triggerAIAnalysis: (params) => fetch('/api/analysis', ...).then(...),
      drawOnMap: (geojson) => { /* ... */ },
    }}
    onClose={() => setActiveApp(null)}
  />
)}
```

#### 6. App Drawer Wrapper Component
**File**: `components/AppDrawer.js` (new)

```javascript
import React from 'react';
import dynamic from 'next/dynamic';

// Lazy load app components
const DRAWER_COMPONENTS = {
  MicroplanningDrawer: dynamic(() => import('./apps/MicroplanningDrawer'), { ssr: false }),
  SupplyChainDrawer: dynamic(() => import('./apps/SupplyChainDrawer'), { ssr: false }),
  // Future apps...
};

export default function AppDrawer({ app, context, actions, onClose }) {
  const DrawerComponent = DRAWER_COMPONENTS[app.drawerComponent];

  if (!DrawerComponent) {
    return (
      <div style={{ /* Error state */ }}>
        <p>App component not found: {app.drawerComponent}</p>
        <button onClick={onClose}>Close</button>
      </div>
    );
  }

  // Error boundary wrapper
  return (
    <ErrorBoundary onError={() => { /* Log to Sentry, show error UI */ }}>
      <DrawerComponent
        app={app}
        context={context}
        actions={actions}
        onClose={onClose}
      />
    </ErrorBoundary>
  );
}
```

---

### Phase 2: First App - Campaign Microplanning (4-5 days)

#### File Structure
```
components/
  apps/
    MicroplanningDrawer.js         # Main drawer UI
    microplanning/
      CampaignCalculator.js        # Personnel/vehicle/supply calculations
      DistributionPointOptimizer.js # DP placement optimization
      ResourceExporter.js          # Excel/PDF export
      templates/
        ITNCampaign.js             # ITN-specific calculations
        OCVCampaign.js             # OCV-specific calculations
        VaccinationCampaign.js     # Vaccination-specific calculations
```

#### Example: MicroplanningDrawer.js
```javascript
export default function MicroplanningDrawer({ app, context, actions, onClose }) {
  const [campaignType, setCampaignType] = useState('ITN'); // ITN, OCV, Vaccination
  const [selectedDistricts, setSelectedDistricts] = useState([]);
  const [calculatedResources, setCalculatedResources] = useState(null);

  const calculateResources = () => {
    // Use context.facilities, context.districtData, context.worldPopData
    const totalPopulation = selectedDistricts.reduce((sum, dist) => sum + dist.population, 0);

    // ITN-specific calculations (from IFR_AMP_Toolkit)
    const resources = {
      personnel: Math.ceil(totalPopulation / (80 * 5)), // 80 HH/person/day, 5 days
      supervisors: Math.ceil((totalPopulation / (80 * 5)) / 10), // 1:10 ratio
      vehicles: Math.ceil(selectedDistricts.length / 3), // 3 districts per vehicle
      budget: calculateBudget(totalPopulation),
    };

    setCalculatedResources(resources);
  };

  return (
    <div style={{ /* Drawer styles */ }}>
      <header>
        <h2>{app.icon} {app.name}</h2>
        <button onClick={onClose}>×</button>
      </header>

      {/* Campaign type selector */}
      <CampaignTypeSelector value={campaignType} onChange={setCampaignType} />

      {/* District selector (use context.districtData) */}
      <DistrictSelector
        districts={context.districtData}
        selected={selectedDistricts}
        onChange={setSelectedDistricts}
      />

      {/* Calculate button */}
      <button onClick={calculateResources}>Calculate Resources</button>

      {/* Results */}
      {calculatedResources && (
        <ResourceSummary
          resources={calculatedResources}
          onExport={() => actions.exportReport(calculatedResources, 'microplan.xlsx')}
        />
      )}

      {/* Distribution point optimizer */}
      <DistributionPointOptimizer
        facilities={context.facilities}
        districts={selectedDistricts}
        onAddToMap={(geojson) => actions.drawOnMap(geojson)}
      />
    </div>
  );
}
```

---

### Phase 3: Polish & Production Readiness (1-2 days)

#### 1. App Permissions System (future-proofing for multi-user)
```javascript
// lib/appPermissions.js
export const checkAppPermission = (app, permission, userRole) => {
  // For now, all users have all permissions
  // Future: role-based access control
  return true;
};
```

#### 2. Version Compatibility Checks
```javascript
// In appRegistry.js
export const APPS = {
  'microplanning': {
    // ...
    minPlatformVersion: '1.0.0', // Minimum base app version required
    dependencies: [], // Other apps this app depends on
  },
};
```

#### 3. Error Boundaries for App Crashes
```javascript
// components/AppErrorBoundary.js
class AppErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App crashed:', error, errorInfo);
    // Log to Sentry/monitoring service
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ /* Error UI */ }}>
          <h3>This app encountered an error</h3>
          <button onClick={() => this.setState({ hasError: false })}>Reload App</button>
          <button onClick={this.props.onClose}>Close</button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

#### 4. Persistence
```javascript
// Store installed apps in localStorage + optionally backend
useEffect(() => {
  const stored = localStorage.getItem('installedApps');
  if (stored) {
    setInstalledApps(JSON.parse(stored));
  }
}, []);
```

---

## What Doesn't Change

✅ Existing codebase remains 100% functional
✅ Current features (chat, recommendations, outbreak risk) stay as core features
✅ No refactoring of existing components needed
✅ API routes remain unchanged
✅ Zero breaking changes for current users

---

## Trade-offs

### Pros
- **Modularity**: Isolated features are easier to maintain and test
- **User Experience**: Teams only see tools relevant to their work
- **Scalability**: Serve multiple humanitarian sectors without bloat
- **Future-proof**: Clear path for third-party app development

### Cons
- **Complexity**: Slightly more complex architecture (worth it long-term)
- **Initial Overhead**: Need to define app API/contract
- **Documentation**: Apps need clear documentation for context/actions API

---

## Recommended Next Steps

### Immediate (Week 1)
1. ✅ Create app registry config (`config/appRegistry.js`)
2. ✅ Build App Hub UI component
3. ✅ Add app state management to `pages/app.js`
4. ✅ Implement dynamic app drawer loading

### Short-term (Week 2)
5. ✅ Build Campaign Microplanning app as first proof-of-concept
6. ✅ Test app installation/uninstallation flow
7. ✅ Validate context/actions API is sufficient

### Medium-term (Month 1-2)
8. Build 2-3 more apps to validate architecture:
   - Supply Chain Tracker
   - Vaccination Campaign Manager
   - WASH Assessment Tool
9. Add app analytics (usage tracking)
10. Consider app marketplace/discovery features

### Long-term (Quarter 1-2)
11. Open API for third-party app development
12. App versioning and update system
13. App review/approval process (if allowing third-party apps)

---

## Implementation Checklist

### Core Infrastructure
- [ ] `config/appRegistry.js` - App definitions and metadata
- [ ] `components/AppHub.js` - App discovery and installation UI
- [ ] `components/AppDrawer.js` - Dynamic app drawer wrapper
- [ ] `lib/appContext.js` - Context API for apps to access platform data
- [ ] `pages/app.js` - Add app state and app hub trigger

### First App: Microplanning
- [ ] `components/apps/MicroplanningDrawer.js` - Main drawer
- [ ] `components/apps/microplanning/CampaignCalculator.js` - Resource calculations
- [ ] `components/apps/microplanning/DistributionPointOptimizer.js` - DP placement
- [ ] `components/apps/microplanning/ResourceExporter.js` - Excel/PDF export
- [ ] `components/apps/microplanning/templates/ITNCampaign.js` - ITN template
- [ ] `components/apps/microplanning/templates/OCVCampaign.js` - OCV template

### Polish
- [ ] Error boundaries for app crashes
- [ ] localStorage persistence for installed apps
- [ ] App permissions system (placeholder for future)
- [ ] Version compatibility checks
- [ ] Documentation: How to build an app

---

## Questions to Resolve

1. **App Storage**: Should installed apps be stored locally (localStorage) or synced to backend?
   - **Recommendation**: Start with localStorage, add backend sync when multi-device support is needed

2. **App Updates**: How should apps notify users of updates?
   - **Recommendation**: Show badge on app icon, allow manual update initially

3. **Core vs. App**: Which existing features should remain core vs. become apps?
   - **Recommendation**: Keep core:
     - Chat, Recommendations, Outbreak Risk, Situation Reports, Campaign Viability
   - Move to apps:
     - Microplanning, Supply Chain Tracker, Vaccination Manager

4. **Third-party Apps**: Allow external developers to build apps?
   - **Recommendation**: Not initially. Validate architecture with internal apps first.

---

## Success Metrics

- **Adoption**: % of users who install at least one app
- **Usage**: Active users per app per week
- **Development Velocity**: Time to build new apps (should decrease as patterns solidify)
- **Core Performance**: Base app load time remains unchanged
- **User Satisfaction**: NPS/feedback on app hub feature

---

## Conclusion

The app hub architecture is the right long-term approach for a platform serving multiple humanitarian sectors. It balances:

- **Flexibility**: Easy to add new specialized tools
- **Simplicity**: Core app stays focused and fast
- **User Experience**: Teams only see relevant features

**Estimated Effort**: ~1.5-2 weeks for MVP (core infrastructure + first app)

**Risk**: Low. Existing functionality unaffected, can iterate on app architecture as needed.

---

## References

- **Microplanning Source**: IFR_AMP_Toolkit.pdf
- **Platform Inspiration**: Slack Apps, Figma Plugins, VSCode Extensions, Salesforce AppExchange
- **Current Codebase**: See `CLAUDE.md` for full technical context
