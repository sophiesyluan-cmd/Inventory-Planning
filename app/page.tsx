'use client';
import React, { useMemo, useState } from "react";
import Section from "@/components/Section";
import DataTable from "@/components/DataTable";

function parseDate(d: any): Date | null { if (d===undefined || d===null || d==='') return null; const t=new Date(d); return isNaN(t.getTime())? null: new Date(t.getFullYear(), t.getMonth(), t.getDate()); }
function ceilToPack(qty:number, pack?:number){ if(!qty) return 0; if(pack && pack>0) return Math.ceil(qty/pack)*pack; return Math.round(qty); }
function applyMoqAndPack(qty:number, moq?:number, pack?:number){ const base=Math.max(qty||0, moq||0); return ceilToPack(base, pack); }
function buildBomIndex(bom:any[]){ const idx:Record<string, any[]> = {}; for(const r of bom){ const key = `${(r.ParentSKU||'').trim()}|${(r.ParentRev||'').trim()}`; (idx[key] ||= []).push(r);} return idx; }
function explodeRequirements(parentSKU:string,parentRev:string,qty:number,reqDate:Date|null,bomIdx:Record<string, any[]>,toolingIdx:Record<string, any>,visited=new Set<string>(),path:string[]=[]){
  const out:any[]=[]; const key = `${(parentSKU||'').trim()}|${(parentRev||'').trim()}`; const children = bomIdx[key] || []; if(!children.length) return out;
  visited.add(key);
  for(const b of children){
    const comp = (b.ComponentSKU||'').trim(); const compRev=(b.CompRev||'').trim();
    const qtyPer = Number(b.QtyPer||0); const scrap = Number(b['Scrap%']||0);
    const totalRequired = qty*qtyPer*(1+scrap/100);
    const toolId = (b.RequiresToolID||'').trim(); let toolOk=true, toolWait:Date|null=null;
    if(toolId){ const ti = toolingIdx[toolId]; if(ti){ toolOk=!!ti.available; toolWait=ti.available_from; } else { toolOk=false; } }
    out.push({ ReqDate:reqDate, ParentSKU:parentSKU, ParentRev:parentRev, ComponentSKU:comp, CompRev:compRev, TotalRequired:totalRequired, RequiresToolID:toolId||null, ToolAvailable:toolOk, ToolAvailableFrom:toolWait, Path:[...path,parentSKU].join(' > ') });
    const childKey = `${comp}|${compRev}`;
    if((bomIdx[childKey]||[]).length && !visited.has(childKey)){
      out.push(...explodeRequirements(comp, compRev, totalRequired, reqDate, bomIdx, toolingIdx, new Set(Array.from(visited)), [...path, parentSKU]));
    }
  }
  return out;
}

function EditableJSON({title, value, onChange}:{title:string; value:any; onChange:(v:any)=>void}){
  const [text, setText] = useState(()=> JSON.stringify(value, null, 2));
  const [err, setErr] = useState<string|undefined>();
  return (
    <Section title={`Edit ${title}`}>
      <div className="mb-2 text-xs text-gray-500">Paste or edit JSON. Press <b>Apply</b> to update and re-run.</div>
      <textarea value={text} onChange={(e)=>setText(e.target.value)} className="w-full h-72 font-mono text-xs p-3 border rounded-xl bg-gray-50" />
      <div className="mt-2 flex items-center gap-3">
        <button className="px-3 py-1.5 rounded-lg bg-black text-white" onClick={()=>{ try{ const v=JSON.parse(text); onChange(v); setErr(undefined);} catch(e:any){ setErr(e.message);} }}>Apply</button>
        {err && <span className="text-red-600 text-xs">{err}</span>}
      </div>
    </Section>
  );
}

export default function Page(){
  // Seed mock data
  const [ItemMaster, setItemMaster] = useState<any[]>([
    { SKU:'AL-PLATE-10MM', Rev:'A', UoM:'pcs', LeadTimeDays:28, MOQ:200, StdPack:50, ContainerCBM:0.004, Supplier:'Alpha Metals' },
    { SKU:'BOLT-M8x20', Rev:'', UoM:'pcs', LeadTimeDays:10, MOQ:500, StdPack:100, ContainerCBM:0.0002, Supplier:'BoltCo' },
    { SKU:'FRAME-SUBASSY', Rev:'B', UoM:'ea', LeadTimeDays:14, MOQ:5, StdPack:1, ContainerCBM:0.2, Supplier:'FrameWorks' }
  ]);
  const [Tooling, setTooling] = useState<any[]>([
    { ToolID:'FIX-100', ToolType:'Fixture', SKU_Covered:'FRAME-SUBASSY', Rev_From:'A', Rev_To:'C', Status:'Available', Location:'Kitchener', AvailableFrom:'2025-08-01' }
  ]);
  const [BOM, setBOM] = useState<any[]>([
    { ParentSKU:'Z-PROD', ParentRev:'A', Operation:'Weld', Line:1, ComponentSKU:'FRAME-SUBASSY', CompRev:'B', QtyPer:1, 'Scrap%':0, RequiresToolID:'FIX-100' },
    { ParentSKU:'FRAME-SUBASSY', ParentRev:'B', Operation:'Fabricate', Line:1, ComponentSKU:'AL-PLATE-10MM', CompRev:'A', QtyPer:4, 'Scrap%':2 },
    { ParentSKU:'FRAME-SUBASSY', ParentRev:'B', Operation:'Assembly', Line:2, ComponentSKU:'BOLT-M8x20', CompRev:'', QtyPer:16, 'Scrap%':0 }
  ]);
  const [Inventory, setInventory] = useState<any[]>([
    { SKU:'AL-PLATE-10MM', Rev:'A', OnHandQty:300, ReservedQty:50, QC_HoldQty:0 },
    { SKU:'BOLT-M8x20', Rev:'', OnHandQty:100, ReservedQty:0, QC_HoldQty:0 },
    { SKU:'FRAME-SUBASSY', Rev:'B', OnHandQty:0, ReservedQty:0, QC_HoldQty:0 }
  ]);
  const [InTransit, setInTransit] = useState<any[]>([
    { PO:'PO1001', SKU:'AL-PLATE-10MM', Rev:'A', Qty:800, ETA_Warehouse:'2025-08-20', Carrier:'MSC', Container:'MSCU123' },
    { PO:'PO1002', SKU:'BOLT-M8x20', Rev:'', Qty:1000, ETA_Warehouse:'2025-08-13', Carrier:'ONE', Container:'ONE456' }
  ]);
  const [Demand, setDemand] = useState<any[]>([
    { Order:'SO-9001', ParentSKU:'Z-PROD', ParentRev:'A', OrderQty:50, ReqDate:'2025-08-25', Priority:1 }
  ]);
  const [Subs, setSubs] = useState<any[]>([
    { SKU:'BOLT-M8x20', SubSKU:'BOLT-M8x25', EquivalencyFactor:1 }
  ]);

  const [tab, setTab] = useState<'Run'|'Demand'|'BOM'|'Inventory'|'InTransit'|'ItemMaster'|'Tooling'>('Run');
  const pack = { ItemMaster, Tooling, BOM, Inventory, InTransit, Demand, Subs };

  const result = useMemo(()=>{
    const bomIdx:Record<string, any[]> = {}; for(const r of BOM){ const key = `${(r.ParentSKU||'').trim()}|${(r.ParentRev||'').trim()}`; (bomIdx[key] ||= []).push(r); }
    const toolingIdx:Record<string, any> = {}; for(const t of Tooling){ const id=(t.ToolID||'').trim(); const status=String(t.Status||'').toLowerCase(); toolingIdx[id] = { available: status.includes('available'), available_from: parseDate(t.AvailableFrom) }; }
    const invUsable = Inventory.map(v=>({ SKU:String(v.SKU||'').trim(), Rev:String(v.Rev||'').trim(), Usable: Math.max(Number(v.OnHandQty||0)-Number(v.ReservedQty||0)-Number(v.QC_HoldQty||0),0) }));
    const it = InTransit.map(r=>({...r, ETA_Warehouse: parseDate(r.ETA_Warehouse), Qty:Number(r.Qty||0), SKU:String(r.SKU||'').trim(), Rev:String(r.Rev||'').trim()}));
    const subsIdx:Record<string, any[]> = {}; for(const s of Subs){ const key=String(s.SKU||'').trim(); (subsIdx[key] ||= []).push({ SubSKU:String(s.SubSKU||'').trim(), Factor:Number(s.EquivalencyFactor||1) }); }
    const imIdx:Record<string, any> = {}; for(const m of ItemMaster){ imIdx[`${String(m.SKU||'').trim()}|${String(m.Rev||'').trim()}`]=m; }

    function explodeRequirements(parentSKU:string,parentRev:string,qty:number,reqDate:Date|null,visited=new Set<string>(),path:string[]=[]){
      const out:any[]=[]; const key = `${(parentSKU||'').trim()}|${(parentRev||'').trim()}`; const children = bomIdx[key] || []; if(!children.length) return out;
      visited.add(key);
      for(const b of children){
        const comp=(b.ComponentSKU||'').trim(); const compRev=(b.CompRev||'').trim();
        const qtyPer=Number(b.QtyPer||0); const scrap=Number(b['Scrap%']||0);
        const totalRequired = qty*qtyPer*(1+scrap/100);
        const toolId=(b.RequiresToolID||'').trim(); let toolOk=true, toolWait:Date|null=null;
        if(toolId){ const ti=toolingIdx[toolId]; if(ti){ toolOk=!!ti.available; toolWait=ti.available_from; } else { toolOk=false; } }
        out.push({ ReqDate:reqDate, ParentSKU:parentSKU, ParentRev:parentRev, ComponentSKU:comp, CompRev:compRev, TotalRequired:totalRequired, RequiresToolID:toolId||null, ToolAvailable:toolOk, ToolAvailableFrom:toolWait, Path:[...path,parentSKU].join(' > ') });
        const childKey = `${comp}|${compRev}`;
        if((bomIdx[childKey]||[]).length && !visited.has(childKey)){
          out.push(...explodeRequirements(comp, compRev, totalRequired, reqDate, new Set(Array.from(visited)), [...path, parentSKU]));
        }
      }
      return out;
    }

    const reqRows:any[]=[];
    for(const d of Demand){
      const parent=String(d.ParentSKU||'').trim(); const prev=String(d.ParentRev||'').trim(); const q=Number(d.OrderQty||0); const rd=parseDate(d.ReqDate);
      if(!parent || !(q>0)) continue;
      reqRows.push(...explodeRequirements(parent, prev, q, rd));
    }

    const byKey:Record<string, any> = {};
    for(const r of reqRows){
      const k = `${r.ComponentSKU}|${r.CompRev}|${r.ReqDate? r.ReqDate.toISOString():'null'}`;
      if(!byKey[k]) byKey[k] = { ComponentSKU:r.ComponentSKU, CompRev:r.CompRev, ReqDate:r.ReqDate, TotalRequired:0 };
      byKey[k].TotalRequired += r.TotalRequired;
    }
    const rows = Object.values(byKey) as any[];

    function availabilityByDate(sku:string, rev:string, need:Date|null){
      const onhand = invUsable.filter(v=>v.SKU===sku && (!rev || v.Rev===rev)).reduce((a,b)=>a+b.Usable,0);
      let inTransit = 0;
      if(need){ inTransit = it.filter(r=>r.SKU===sku && (!rev || r.Rev===rev) && r.ETA_Warehouse && r.ETA_Warehouse<=need).reduce((a,b)=>a+b.Qty,0); }
      let subsAvail = 0;
      for(const s of (subsIdx[sku]||[])){
        const subOn = invUsable.filter(v=>v.SKU===s.SubSKU).reduce((a,b)=>a+b.Usable,0);
        const subIt = need ? it.filter(r=>r.SKU===s.SubSKU && r.ETA_Warehouse && r.ETA_Warehouse<=need).reduce((a,b)=>a+b.Qty,0) : 0;
        subsAvail += (subOn + subIt) * (s.Factor||1);
      }
      return { onhand, inTransit, subsAvail };
    }

    const net:any[] = [];
    for(const r of rows){
      const sku=r.ComponentSKU, rev=r.CompRev, need = r.ReqDate || null;
      const totalReq = Number(r.TotalRequired||0);
      const { onhand, inTransit, subsAvail } = availabilityByDate(sku, rev, need);
      const netShort = Math.max(0, totalReq - onhand - inTransit - subsAvail);
      const im = imIdx[`${sku}|${rev}`] || imIdx[`${sku}|`];
      const lead = Number(im?.LeadTimeDays||0), moq=Number(im?.MOQ||0), pack=Number(im?.StdPack||0);
      const cbm = Number(im?.ContainerCBM||0), supplier=String(im?.Supplier||''), uom=String(im?.UoM||'');
      const earliestCover = netShort===0? need : (need? new Date(need.getTime()+lead*86400000) : null);
      const suggested = netShort>0 ? Math.max(moq||0, Math.ceil(netShort/(pack||1))*(pack||1)) : 0;
      net.push({
        ComponentSKU:sku, CompRev:rev, ReqDate: need? need.toISOString().slice(0,10): null, Supplier:supplier, UoM:uom,
        TotalRequired:+totalReq.toFixed(3), OnHandUsable:+onhand.toFixed(3), InTransitBeforeReq:+inTransit.toFixed(3), ApprovedSubsAvail:+subsAvail.toFixed(3),
        NetShortage:+netShort.toFixed(3), LeadTimeDays:lead, MOQ:moq, StdPack:pack, ContainerCBM:cbm,
        EarliestCoverDate: earliestCover? earliestCover.toISOString().slice(0,10): null, SuggestedBuyQty: suggested,
        ActionHint: netShort>0 ? `BUY ${suggested} ${uom} of ${sku} (MOQ ${moq}, Pack ${pack}). Est. cover by ${earliestCover? earliestCover.toISOString().slice(0,10): 'N/A'}.` : 'OK'
      });
    }

    const CONTAINERS = [ {Type:'40HC', CBM:76.3}, {Type:'40FT', CBM:67.7}, {Type:'20FT', CBM:33.2} ];
    const toBuy = net.filter(r=>r.SuggestedBuyQty>0).map(r=>({...r, TotalCBM:r.SuggestedBuyQty*r.ContainerCBM}));
    const bySupplier:Record<string, any[]> = {}; for(const r of toBuy){ (bySupplier[r.Supplier||'(Unassigned)'] ||= []).push(r); }
    const containerPlan:any[] = [];
    for(const s of Object.keys(bySupplier)){
      let remaining = bySupplier[s].reduce((a,b)=>a+(b.TotalCBM||0),0);
      const plan:{Type:string, Count:number}[] = [];
      for(const c of CONTAINERS){
        const count = Math.floor(remaining / c.CBM);
        if(count>0){ plan.push({Type:c.Type, Count:count}); remaining -= count*c.CBM; }
      }
      if(remaining>0.01){
        const pick = [...CONTAINERS].reverse().find(c=>c.CBM>=remaining) || CONTAINERS[0];
        plan.push({Type:pick.Type, Count:1}); remaining = 0;
      }
      containerPlan.push({ Supplier:s, TotalShortageCBM:+bySupplier[s].reduce((a,b)=>a+(b.TotalCBM||0),0).toFixed(3), SuggestedContainers: plan.length? plan.map(p=>`${p.Type} x ${p.Count}`).join(', ') : 'No container needed' });
    }

    
    // Draft emails
    const emails:any[] = [];
    for(const s of Object.keys(bySupplier)){
      const grp = bySupplier[s];
      // compute latest need date safely
      const needDates = grp.map(r => (r.ReqDate ? parseDate(r.ReqDate) : null)).filter((d:any): d is Date => !!d) as Date[];
      const latestNeed = needDates.length ? new Date(Math.max(...needDates.map(d => d.getTime()))) : null;

      const lines = grp.map(r => {
        return `- ${r.ComponentSKU} (Rev ${r.CompRev||'-'}): please quote/confirm ${r.SuggestedBuyQty} ${r.UoM||''} | MOQ ${r.MOQ}, Pack ${r.StdPack}; target arrival by ${r.EarliestCoverDate || r.ReqDate}`;
      });

      const leadDays = Math.max(...grp.map(g=>Number(g.LeadTimeDays||0)), 0);
      const tpo = latestNeed ? new Date(latestNeed.getTime() - leadDays*86400000) : new Date();
      const csum = (containerPlan.find(c=>c.Supplier===s)?.SuggestedContainers) || 'N/A';

      emails.push({
        Supplier: s,
        Subject: `RFQ/PO request – Shortage coverage & container plan (${s})`,
        Body: `Hello ${s},\n\nWe have upcoming requirements and would like to cover shortages per the list below.\nTarget PO date: ${tpo.toISOString().slice(0,10)}. Please confirm pricing, pack, and earliest ship dates.\n\nItems:\n${lines.join('\n')}\n\nContainer plan (estimate): ${csum}. If LCL is better for dates, please advise.\n\nPlease include: lead time, next available ship window, and any consolidations you recommend.\n\nThank you,\nHS North America Supply Team\n`
      });
    }
return {
      net: net.sort((a,b)=> b.NetShortage - a.NetShortage || (a.ReqDate||'').localeCompare(b.ReqDate||'')),
      containerPlan,
      emails
    };
  }, [ItemMaster, Tooling, BOM, Inventory, InTransit, Demand, Subs]);

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">HSNA – BOM Netting (Demo)</h1>
          <p className="text-gray-600">Multi-level netting • In-transit aware • Container plan • Draft supplier emails</p>
        </header>

        <div className="flex flex-wrap gap-2 mb-4">
          {[
            {k:'Run', label:'Run Netting'},
            {k:'Demand', label:'Demand'},
            {k:'BOM', label:'BOM'},
            {k:'Inventory', label:'Inventory'},
            {k:'InTransit', label:'In Transit'},
            {k:'ItemMaster', label:'Item Master'},
            {k:'Tooling', label:'Tooling'}
          ].map((t)=> (
            <button key={t.k} onClick={()=>setTab(t.k as any)} className={`px-3 py-1.5 rounded-full text-sm border ${tab===t.k? 'bg-black text-white':'bg-white hover:bg-gray-50'}`}>{t.label}</button>
          ))}
        </div>

        {tab!=='Run' && (
          <div className="grid grid-cols-1 gap-4">
            <EditableJSON title={tab} value={(pack as any)[tab]} onChange={(v:any)=>{
              if(tab==='Demand') setDemand(v);
              if(tab==='BOM') setBOM(v);
              if(tab==='Inventory') setInventory(v);
              if(tab==='InTransit') setInTransit(v);
              if(tab==='ItemMaster') setItemMaster(v);
              if(tab==='Tooling') setTooling(v);
            }}/>
          </div>
        )}

        {tab==='Run' && (
          <div className="grid grid-cols-1 gap-6">
            <Section title="Netting Results">
              <DataTable rows={result.net} columns={['ComponentSKU','CompRev','ReqDate','Supplier','UoM','TotalRequired','OnHandUsable','InTransitBeforeReq','ApprovedSubsAvail','NetShortage','LeadTimeDays','MOQ','StdPack','ContainerCBM','EarliestCoverDate','SuggestedBuyQty','ActionHint']}/>
            </Section>
            <Section title="Container Plan (by Supplier)">
              <DataTable rows={result.containerPlan} columns={['Supplier','TotalShortageCBM','SuggestedContainers']}/>
            </Section>
            <Section title="Draft Supplier Emails">
              <DataTable rows={result.emails} columns={['Supplier','Subject','Body']}/>
            </Section>
          </div>
        )}

        <footer className="mt-8 text-xs text-gray-500">Demo UI only. For production, we’ll add FastAPI + Postgres + SSO and replace JSON editors with tables & uploaders.</footer>
      </div>
    </div>
  );
}
