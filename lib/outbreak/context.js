import {locatePoint} from './insights.js';
export function hazardContext(disasters,index,asOf) {
  const events=[],seen=new Set();let excluded=0;
  for(const d of disasters){
    const time=Date.parse(d.pubDate),key=JSON.stringify([d.eventType,d.eventId,d.episodeId]);
    if(!d.eventId||!Number.isFinite(time)||time>Date.parse(asOf)+86400000-1||time<Date.parse(asOf)-27*86400000){excluded++;continue;}
    if(seen.has(key))continue;seen.add(key);
    const match=locatePoint(index,d.longitude,d.latitude);
    if(!match.location){excluded++;continue;}
    events.push({id:key,location:match.location,title:String(d.title||d.eventType||'GDACS alert'),date:new Date(time).toISOString().slice(0,10),latitude:Number(d.latitude),longitude:Number(d.longitude),source:/^https:\/\/(www\.)?gdacs\.org\//.test(d.reportPageUrl||d.link||'')?(d.reportPageUrl||d.link):null});
  }
  return {events,excluded};
}
