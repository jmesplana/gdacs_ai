import { withRateLimit } from '../../lib/rateLimit';
import { loadPublicSources, loadGeography, loadMines, loadFlowminderCatalogue, loadRelocations } from '../../lib/outbreak/sources';

async function handler(req,res) {
  if(req.method !== 'GET') { res.setHeader('Allow','GET'); return res.status(405).json({error:'Method not allowed'}); }
  const loaders={ indicators:loadPublicSources, boundaries:loadGeography, mines:loadMines, mobility:loadFlowminderCatalogue, relocations:loadRelocations, loadRelocations };
  const kind=req.query.kind || 'indicators';
  if(typeof kind!=='string'||!Object.hasOwn(loaders,kind)) return res.status(400).json({error:'Unsupported source'});
  try {
    const data=await loaders[kind]();
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json(data);
  } catch(e) { return res.status(502).json({error:`Could not load ${kind}: ${e.message}`}); }
}
export default withRateLimit(handler);
