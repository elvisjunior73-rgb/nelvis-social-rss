import { XMLParser } from 'fast-xml-parser';
const now=new Date();
const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const p=Object.fromEntries(fmt.formatToParts(now).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
const day=`${p.year}-${p.month}-${p.day}`;
if(p.hour!=='06'||p.minute!=='00'){console.log('Not 06:00 Europe/Paris',day,p.hour,p.minute);process.exit(0);}
const url=process.env.AELF_RSS_URL;
if(!url)throw Error('Configure AELF_RSS_URL');
const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
if(!response.ok)throw Error('RSS HTTP '+response.status);
const data=new XMLParser({ignoreAttributes:false}).parse(await response.text());
const raw=data.rss?.channel?.item||data.feed?.entry||[];
const items=Array.isArray(raw)?raw:[raw];
const plain=x=>typeof x==='string'?x:x?.['#text']||'';
const entry=items.find(x=>{const d=Date.parse(plain(x.pubDate||x.published||x.updated));return Number.isFinite(d)&&new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d))===day;});
if(!entry)throw Error('No Gospel dated '+day+'; skip to avoid stale content');
const title=plain(entry.title).replace(/<[^>]*>/g,' ').trim();
const link=plain(entry.link?.['@_href']||entry.link||entry.guid);
if(!title||!/^https?:\/\//.test(link))throw Error('Missing title/link');
const summary=plain(entry.description||entry.summary).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').slice(0,400);
const pages=[
{name:'Miséricorde Divine',id:process.env.FACEBOOK_PAGE_ID_MISERICORDE,token:process.env.FACEBOOK_PAGE_TOKEN_MISERICORDE,prayer:'Seigneur Jésus, ouvre notre cœur à ta miséricorde. Apprends-nous à pardonner, à écouter et à servir aujourd’hui. Amen.'},
{name:'Promesses du Rosaire',id:process.env.FACEBOOK_PAGE_ID_ROSAIRE,token:process.env.FACEBOOK_PAGE_TOKEN_ROSAIRE,prayer:'Seigneur, par l’intercession de la Vierge Marie, aide-nous à accueillir ta Parole et à la vivre aujourd’hui. Amen.'}
];
for(const page of pages){
const message=`ÉVANGILE DU JOUR — ${day}\n\n${title}\n\n${summary}\n\nSource : ${link}\n\nMÉDITATION DU MATIN\nÀ la lumière de cet Évangile, prenons le temps d’écouter Dieu et de choisir aujourd’hui un geste concret de charité.\n\nPRIÈRE DU MATIN\n${page.prayer}`;
if(process.env.PUBLISH_ENABLED!=='true'){console.log('[TEST]',page.name,message);continue;}
if(!page.id||!page.token){console.error('Meta credentials missing for',page.name);process.exitCode=1;continue;}
const res=await fetch('https://graph.facebook.com/v24.0/'+encodeURIComponent(page.id)+'/feed',{method:'POST',body:new URLSearchParams({message,access_token:page.token}),signal:AbortSignal.timeout(20000)});
const result=await res.json();
if(!res.ok||result.error){console.error('Meta error',page.name,result.error||result);process.exitCode=1;}else console.log('Published',page.name,result.id);
}
