import { useEffect, useState } from 'react';

export default function ExamplePlanner({ storage }) {
  const [plans, setPlans] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let mounted = true;
    storage.listPlans().then((rows) => { if (mounted) setPlans(rows); })
      .catch((err) => { if (mounted) setError(err.message); });
    return () => { mounted = false; };
  }, [storage]);
  async function create(event) {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      await storage.savePlan({ id: crypto.randomUUID(), schemaVersion: 1, metadata: { name: name.trim() } });
      setName('');
      setPlans(await storage.listPlans());
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <section style={{ padding: 24, overflow: 'auto' }}>
    <h2>Saved plans</h2>
    {error && <p role="alert">{error}</p>}
    <form onSubmit={create}>
      <label>Plan name <input value={name} onChange={(event) => setName(event.target.value)} required /></label>
      <button disabled={busy || !name.trim()} type="submit">{busy ? 'Saving...' : 'Create plan'}</button>
    </form>
    <ul>{plans.map((plan) => <li key={plan.id}>{plan.name}</li>)}</ul>
  </section>;
}
