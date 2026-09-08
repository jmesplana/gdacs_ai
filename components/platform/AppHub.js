import { Component, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, ArrowUpRight, Download, Trash2, X, Syringe } from 'lucide-react';
import { APP_REGISTRY } from '../../lib/platform/appRegistry';
import { getInstalledApps, setInstalledApps } from '../../lib/platform/appStore';
import { geographyKey } from '../../lib/planning/geography';
import styles from './Planning.module.css';

const ImmunizationPlanner = dynamic(() => import('../apps/immunization/ImmunizationPlanner'), {
  ssr: false, loading: () => <p role="status">Loading immunization planner...</p>
});

class AppBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <p role="alert">The planning app could not open. Return to Apps and try again.</p> : this.props.children;
  }
}

export default function AppHub({ districts, facilities, onClose }) {
  const dialog = useRef(null);
  const workspaceId = useMemo(() => geographyKey(districts), [districts]);
  const [installed, setInstalled] = useState([]);
  const [active, setActive] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const leaveGuard = useRef(null);
  const requestLeave = (action) => {
    if (!leaveGuard.current || leaveGuard.current()) action();
  };
  useEffect(() => {
    dialog.current.showModal();
    return () => dialog.current?.close();
  }, []);
  useEffect(() => {
    let mounted = true;
    setReady(false);
    getInstalledApps(workspaceId).then((ids) => { if (mounted) { setInstalled(ids); setReady(true); } })
      .catch((err) => { if (mounted) setError(`Browser storage unavailable: ${err.message}`); });
    return () => { mounted = false; };
  }, [workspaceId]);
  async function toggleApp(id) {
    setError('');
    const next = installed.includes(id) ? installed.filter((value) => value !== id) : [...installed, id];
    try { await setInstalledApps(workspaceId, next); setInstalled(next); }
    catch (err) { setError(`App settings were not saved: ${err.message}`); }
  }
  return <dialog ref={dialog} className={styles.dialog} onCancel={(event) => { event.preventDefault(); requestLeave(onClose); }}>
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          {active && <button title="Back to Apps" aria-label="Back to Apps" onClick={() => requestLeave(() => setActive(null))}><ArrowLeft size={18} /></button>}
          <h1>{active ? 'Immunization planning' : 'Workspace apps'}</h1>
          <span className={styles.muted}>{districts.length} admin areas</span>
        </div>
        <button aria-label="Close apps" title="Close apps" onClick={() => requestLeave(onClose)}><X size={20} /></button>
      </header>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {!active ? <div className={styles.catalog}>
        {!districts.length && <p role="status">No administrative boundaries loaded. Add boundaries in the map workspace first.</p>}
        {APP_REGISTRY.map((app) => <article key={app.id} className={styles.appCard}>
          <Syringe size={28} color="#087f6a" />
          <h2>{app.name}</h2>
          <p className={styles.muted}>Version {app.version} · {installed.includes(app.id) ? 'Enabled in this workspace' : 'Not installed'}</p>
          <div className={styles.actions}>
            <button disabled={!ready || !districts.length} onClick={() => toggleApp(app.id)}>{installed.includes(app.id) ? <Trash2 size={16} /> : <Download size={16} />}{installed.includes(app.id) ? 'Disable app' : 'Install app'}</button>
            {installed.includes(app.id) && <button className={styles.primary} onClick={() => setActive(app.id)}>Open <ArrowUpRight size={16} /></button>}
          </div>
          {installed.includes(app.id) && <p className={styles.muted}>Saved plans are retained when this app is disabled.</p>}
        </article>)}
      </div> : <AppBoundary key={active}>
        <ImmunizationPlanner workspaceId={workspaceId} districts={districts} facilities={facilities} leaveGuard={leaveGuard} />
      </AppBoundary>}
    </div>
  </dialog>;
}
