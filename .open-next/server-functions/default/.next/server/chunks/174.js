exports.id=174,exports.ids=[174],exports.modules={1910:(a,b,c)=>{Promise.resolve().then(c.t.bind(c,3991,23))},33411:(a,b,c)=>{"use strict";c.d(b,{A:()=>d});let d=(0,c(49727).A)("plus",[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"M12 5v14",key:"s699le"}]])},49727:(a,b,c)=>{"use strict";c.d(b,{A:()=>i});var d=c(74515);let e=(...a)=>a.filter((a,b,c)=>!!a&&""!==a.trim()&&c.indexOf(a)===b).join(" ").trim(),f=a=>{let b=a.replace(/^([A-Z])|[\s-_]+(\w)/g,(a,b,c)=>c?c.toUpperCase():b.toLowerCase());return b.charAt(0).toUpperCase()+b.slice(1)};var g={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};let h=(0,d.forwardRef)(({color:a="currentColor",size:b=24,strokeWidth:c=2,absoluteStrokeWidth:f,className:h="",children:i,iconNode:j,...k},l)=>(0,d.createElement)("svg",{ref:l,...g,width:b,height:b,stroke:a,strokeWidth:f?24*Number(c)/Number(b):c,className:e("lucide",h),...!i&&!(a=>{for(let b in a)if(b.startsWith("aria-")||"role"===b||"title"===b)return!0;return!1})(k)&&{"aria-hidden":"true"},...k},[...j.map(([a,b])=>(0,d.createElement)(a,b)),...Array.isArray(i)?i:[i]])),i=(a,b)=>{let c=(0,d.forwardRef)(({className:c,...g},i)=>(0,d.createElement)(h,{ref:i,iconNode:b,className:e(`lucide-${f(a).replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase()}`,`lucide-${a}`,c),...g}));return c.displayName=f(a),c}},62158:(a,b,c)=>{Promise.resolve().then(c.t.bind(c,65169,23))},65169:(a,b,c)=>{let{createProxy:d}=c(39893);a.exports=d("C:\\Users\\gasto\\OneDrive\\Desktop\\LOCAL MARCELA GENTA\\proyectos-20260320T145338Z-1-001\\proyectos\\reportes-app\\node_modules\\next\\dist\\client\\app-dir\\link.js")},70673:(a,b,c)=>{"use strict";function d(a){return a.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")}function e(a){return new Date(a).toLocaleDateString("es-AR",{day:"numeric",month:"long",year:"numeric"})}c.d(b,{Yq:()=>e,Yv:()=>d})},88528:(a,b,c)=>{"use strict";c.r(b),c.d(b,{"00968ea35dc957ae6fafe3421b9584087167eefb57":()=>d.wx,"00c69eae5de879d76dd3c042b864485f12d2fd2181":()=>d.vt,"00dd29451d8b58435ff442e0926992ad4d430d3250":()=>d.oY,"4005508308e3dfa01923c652be555a682b223f7c0b":()=>d.UU,"4025278b6a5adf98b945c1d9afb86588714217bf29":()=>d.IL,"4026fbcfec587bae0eb7db4b001d06528c51f8f9a4":()=>d.Yr,"407948414ed3b75e7afedb6a7618404fb55394e0c1":()=>d.Sn,"605b223767a2f16d944e220553aa52f2f790ff561d":()=>d.LU,"60872b03038749ceb27837d892e7d72081371b679c":()=>d.vu});var d=c(89655)},89655:(a,b,c)=>{"use strict";c.d(b,{IL:()=>l,LU:()=>n,Sn:()=>r,UU:()=>k,Yr:()=>o,oY:()=>j,vt:()=>q,vu:()=>m,wx:()=>p});var d=c(75879);c(68633);var e=c(35552),f=c(67360),g=c(82161),h=c(16780),i=c(70673);async function j(){let a=await (0,f.HW)();if(!a)return[];let b=await (0,e.xA)();return"admin"===a.role?(await b.prepare(`
      SELECT p.*, u.full_name as agent_name,
        (SELECT COUNT(*) FROM reports r WHERE r.property_id = p.id) as report_count
      FROM properties p
      LEFT JOIN users u ON p.agent_id = u.id
      ORDER BY p.updated_at DESC
    `).all()).results:(await b.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM reports r WHERE r.property_id = p.id) as report_count
    FROM properties p
    WHERE p.agent_id = ?
    ORDER BY p.updated_at DESC
  `).bind(a.id).all()).results}async function k(a){let b=await (0,e.xA)(),c=await b.prepare(`
    SELECT p.*, u.full_name as agent_name, u.phone as agent_phone, u.email as agent_email
    FROM properties p
    LEFT JOIN users u ON p.agent_id = u.id
    WHERE p.id = ?
  `).bind(a).first();if(!c)return null;let d=(await b.prepare(`
    SELECT r.*, u.full_name as creator_name
    FROM reports r
    LEFT JOIN users u ON r.created_by = u.id
    WHERE r.property_id = ?
    ORDER BY r.period_start DESC
  `).bind(a).all()).results;return{...c,reports:d}}async function l(a){let b=await (0,f.HW)();b||(0,g.redirect)("/login");let c=await (0,e.xA)(),d=(0,e.$C)(),h=a.get("address"),j=a.get("neighborhood"),k=(0,i.Yv)(`${h}-${j}`);await c.prepare(`
    INSERT INTO properties (id, address, neighborhood, city, property_type, rooms, size_m2,
      asking_price, currency, owner_name, owner_phone, owner_email, public_slug, agent_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(d,h,j,a.get("city")||"Buenos Aires",a.get("property_type")||"departamento",a.get("rooms")?parseInt(a.get("rooms")):null,a.get("size_m2")?parseFloat(a.get("size_m2")):null,a.get("asking_price")?parseFloat(a.get("asking_price")):null,a.get("currency")||"USD",a.get("owner_name"),a.get("owner_phone")||null,a.get("owner_email")||null,k,b.id).run(),(0,g.redirect)(`/propiedades/${d}`)}async function m(a,b){await (0,f.HW)()||(0,g.redirect)("/login");let c=await (0,e.xA)();await c.prepare("UPDATE properties SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(b,a).run(),(0,h.revalidatePath)(`/propiedades/${a}`),(0,h.revalidatePath)("/propiedades")}async function n(a,b){let c=await (0,f.HW)();c||(0,g.redirect)("/login");let d=await (0,e.xA)(),i=(0,e.$C)();for(let f of(await d.prepare(`
    INSERT INTO reports (id, property_id, period_label, period_start, period_end, status, created_by, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(i,a,b.periodLabel,b.periodStart,b.periodEnd,b.publish?"published":"draft",c.id,b.publish?new Date().toISOString():null).run(),b.metrics)){let a=(0,e.$C)();await d.prepare(`
      INSERT INTO report_metrics (id, report_id, source, impressions, portal_visits, inquiries,
        phone_calls, whatsapp, in_person_visits, offers, ranking_position, avg_market_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(a,i,f.source,f.impressions?parseInt(f.impressions):null,f.portal_visits?parseInt(f.portal_visits):null,f.inquiries?parseInt(f.inquiries):null,f.phone_calls?parseInt(f.phone_calls):null,f.whatsapp?parseInt(f.whatsapp):null,f.in_person_visits?parseInt(f.in_person_visits):null,f.offers?parseInt(f.offers):null,f.ranking_position?parseInt(f.ranking_position):null,f.avg_market_price?parseFloat(f.avg_market_price):null).run()}let j=[{section:"strategy",title:"Estrategia comercial",body:b.strategy},{section:"marketing",title:"Marketing y difusi\xf3n",body:b.marketing},{section:"conclusion",title:"Conclusi\xf3n",body:b.conclusion},{section:"price_reference",title:"Referencia de precio",body:b.priceReference}];for(let a=0;a<j.length;a++)j[a].body?.trim()&&await d.prepare(`
        INSERT INTO report_content (id, report_id, section, title, body, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind((0,e.$C)(),i,j[a].section,j[a].title,j[a].body,a).run();for(let c of b.competitors)c.url?.trim()&&await d.prepare(`
        INSERT INTO competitor_links (id, property_id, url, address, price, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind((0,e.$C)(),a,c.url,c.address||null,c.price?parseFloat(c.price):null,c.notes||null).run();return(0,h.revalidatePath)(`/propiedades/${a}`),i}async function o(a){let b=await (0,e.xA)(),c=await b.prepare(`
    SELECT p.*, u.full_name as agent_name, u.phone as agent_phone, u.email as agent_email
    FROM properties p
    LEFT JOIN users u ON p.agent_id = u.id
    WHERE p.public_slug = ?
  `).bind(a).first();if(!c)return null;let d=(await b.prepare(`
    SELECT * FROM reports WHERE property_id = ? AND status = 'published' ORDER BY period_start ASC
  `).bind(c.id).all()).results;for(let a of d)a.metrics=(await b.prepare("SELECT * FROM report_metrics WHERE report_id = ?").bind(a.id).all()).results,a.content=(await b.prepare("SELECT * FROM report_content WHERE report_id = ? ORDER BY sort_order").bind(a.id).all()).results,a.photos=(await b.prepare("SELECT * FROM report_photos WHERE report_id = ? ORDER BY sort_order").bind(a.id).all()).results;let f=(await b.prepare("SELECT * FROM competitor_links WHERE property_id = ? ORDER BY created_at DESC").bind(c.id).all()).results;return{property:c,reports:d,competitors:f}}async function p(){let a=await (0,f.HW)();if(!a)return null;let b=await (0,e.xA)(),c="admin"===a.role,d=c?[]:[a.id];return{user:a,properties:(await b.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM reports r WHERE r.property_id = p.id) as report_count,
      (SELECT COUNT(*) FROM reports r WHERE r.property_id = p.id AND r.status = 'published') as published_count
    FROM properties p ${c?"":"WHERE p.agent_id = ?"} ORDER BY p.updated_at DESC
  `).bind(...d).all()).results,isAdmin:c}}async function q(){let a=await (0,f.HW)();if(!a||"admin"!==a.role)return[];let b=await (0,e.xA)();return(await b.prepare("SELECT id, email, full_name, phone, role, created_at FROM users ORDER BY created_at DESC").all()).results}async function r(a){let b=await (0,f.HW)();return b&&"admin"===b.role?(0,f.kg)(a.email,a.password,a.full_name,a.role,a.phone):{error:"Sin permisos"}}(0,c(51669).D)([j,k,l,m,n,o,p,q,r]),(0,d.A)(j,"00dd29451d8b58435ff442e0926992ad4d430d3250",null),(0,d.A)(k,"4005508308e3dfa01923c652be555a682b223f7c0b",null),(0,d.A)(l,"4025278b6a5adf98b945c1d9afb86588714217bf29",null),(0,d.A)(m,"60872b03038749ceb27837d892e7d72081371b679c",null),(0,d.A)(n,"605b223767a2f16d944e220553aa52f2f790ff561d",null),(0,d.A)(o,"4026fbcfec587bae0eb7db4b001d06528c51f8f9a4",null),(0,d.A)(p,"00968ea35dc957ae6fafe3421b9584087167eefb57",null),(0,d.A)(q,"00c69eae5de879d76dd3c042b864485f12d2fd2181",null),(0,d.A)(r,"407948414ed3b75e7afedb6a7618404fb55394e0c1",null)}};