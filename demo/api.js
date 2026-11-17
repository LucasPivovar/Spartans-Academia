(function (root) {
  'use strict';
  function createDemoApi(seed, storage, clock = () => new Date()) {
    const key = 'dontstop-presentation-v4';
    const clone = value => JSON.parse(JSON.stringify(value));
    const today = () => new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(clock());
    const fail = (status, message) => { throw Object.assign(new Error(message), {status}); };
    const day = value => { if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value) fail(422,'Informe uma data válida.'); return value; };
    const text = (value, required = false) => { const result=String(value ?? '').trim(); if(required&&!result) fail(422,'Preencha os campos obrigatórios.'); return result; };
    const amount = value => { if(!Number.isSafeInteger(value)||value<=0) fail(422,'Informe um valor válido.');return value; };
    function monthAfter(value, preferred=+value.slice(-2)) { const d=new Date(value+'T12:00:00Z');d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+1);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(preferred,last));return d.toISOString().slice(0,10); }
    function initial() {
      const data=clone(seed), shift=Math.round((Date.parse(today()+'T12:00:00Z')-Date.parse(data.today+'T12:00:00Z'))/86400000);
      for(const collection of ['members','subscriptions','invoices','payments','appointments'])for(const row of data[collection])for(const field of ['joined_on','start_date','end_date','due_date','paid_on','starts_at','ends_at'])if(row[field]){const value=row[field],d=new Date(value.slice(0,10)+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+shift);row[field]=d.toISOString().slice(0,10)+value.slice(10);}
      data.today=today();data.currentUser=data.user.id;data.signedOut=false;data.demo=true;return data;
    }
    let db;
    try { db=JSON.parse(storage.getItem(key)); } catch {}
    if(!db||!Array.isArray(db.members)||!Array.isArray(db.users))db=initial();
    const storeDemo=(typeof module==='object'&&module.exports?require('./store-api.js').createStoreDemoApi:root.createStoreDemoApi)({get:()=>db,save:data=>{storage.setItem(key,JSON.stringify(data));db=data;},today});
    const professorDemo=(typeof module==='object'&&module.exports?require('./professor-api.js').createProfessorDemoApi:root.createProfessorDemoApi)({get:()=>db,save:data=>{storage.setItem(key,JSON.stringify(data));db=data;},today});
    const memberDemo=(typeof module==='object'&&module.exports?require('./member-api.js').createMemberDemoApi:root.createMemberDemoApi)({get:()=>db,save:data=>{storage.setItem(key,JSON.stringify(data));db=data;},today});
    const find=(data,table,id)=>data[table].find(x=>x.id===+id)||fail(404,'Registro não encontrado.');
    const add=(data,table,row)=>{const item={...row,id:Math.max(0,...data[table].map(x=>x.id))+1};data[table].push(item);return item;};
    const user=data=>data.signedOut?null:data.users.find(x=>x.id===data.currentUser&&x.enabled&&!data.professional_profiles.some(p=>p.user_id===x.id));
    const safeUser=u=>u?{id:u.id,name:u.name,email:u.email,role:u.role}:null;
    function state(data) {
      const result=clone(data);result.professionals=professorDemo.list(data);result.members=result.members.map(m=>{const a=data.member_professors.find(a=>a.member_id===m.id);return {...m,professor_id:a?.user_id||null,professor_name:a?data.users.find(u=>u.id===a.user_id)?.name:null};});result.today=today();result.user=safeUser(user(data));result.demo=true;
      result.subscriptions=result.subscriptions.map(s=>({...s,member_name:find(data,'members',s.member_id).name,plan_name:find(data,'plans',s.plan_id).name}));
      result.invoices=result.invoices.map(i=>({...i,member_name:find(data,'members',i.member_id).name,member_phone:find(data,'members',i.member_id).phone,display_status:i.status==='pending'&&i.due_date<today()?'overdue':i.status})).sort((a,b)=>a.due_date.localeCompare(b.due_date));
      result.payments=result.payments.map(p=>({...p,member_name:find(data,'members',find(data,'invoices',p.invoice_id).member_id).name}));
      result.appointments=result.appointments.map(a=>({...a,member_name:a.member_id?find(data,'members',a.member_id).name:a.contact_name})).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
      result.users=result.user?.role==='admin'?data.users.filter(u=>!data.professional_profiles.some(p=>p.user_id===u.id)).map(u=>({...safeUser(u),enabled:u.enabled})):[];
      delete result.currentUser;delete result.signedOut;return result;
    }
    async function hash(value) {const bytes=await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');}
    async function handle(path, method='GET', b={}) {
      try {
        try{const persisted=JSON.parse(storage.getItem(key));if(persisted&&Array.isArray(persisted.professional_profiles))db=persisted;}catch{}
        if(path==='/api/member/store'||path.startsWith('/api/member/store/')||path.startsWith('/api/store/'))return await storeDemo.handle(path,method,b);
        if(path.startsWith('/api/professor/')||path==='/api/professionals'||/^\/api\/professionals\/\d+$/.test(path)||/^\/api\/members\/\d+\/professor$/.test(path))return await professorDemo.handle(path,method,b);
        if(path.startsWith('/api/member/')||/^\/api\/members\/\d+\/(portal|workouts)(?:\/[0-6])?$/.test(path))return await memberDemo.handle(path,method,b);
        if(path==='/api/auth/status')return {status:200,body:{user:safeUser(user(db)),setupRequired:false,demo:true,today:today()}};
        if(path==='/api/state'&&method==='GET'){if(!user(db))fail(401,'Entre na demonstração para continuar.');return {status:200,body:state(db)};}
        if(path==='/api/export/members.csv'&&method==='GET'){
          if(!user(db))fail(401,'Entre na demonstração.');const cell=v=>'"'+(/^[=+@\-\t\r]/.test(String(v))?"'":'')+String(v??'').replace(/"/g,'""')+'"';
          return {status:200,type:'text/csv',body:'\uFEFF'+[['Nome','WhatsApp','E-mail','Cadastro','Situação'],...db.members.map(m=>[m.name,m.phone,m.email,m.joined_on,m.status])].map(row=>row.map(cell).join(';')).join('\r\n')};
        }
        if(!['POST','PATCH'].includes(method))fail(404,'Ação não encontrada.');
        const data=clone(db);let result={ok:true},status=200;
        if(path==='/api/auth/login'){
          const match=data.users.find(u=>u.email===text(b.email).toLowerCase()&&u.enabled);
          if(match&&data.professional_profiles.some(p=>p.user_id===match.id))fail(403,'Use a área do professor para entrar com este acesso.');
          const valid=match&&(match.password_digest?match.password_digest===await hash(b.password||''):match.id===seed.user.id&&b.password==='Demonstracao!2026');
          if(!valid)fail(401,'E-mail ou senha da demonstração inválidos.');data.currentUser=match.id;data.signedOut=false;result={user:safeUser(match)};
        }else{
          const current=user(data);if(!current)fail(401,'Entre na demonstração para continuar.');
          const parts=path.split('/').filter(Boolean), table=parts[1], id=parts[2], operation=parts[3];
          if(path==='/api/auth/logout')data.signedOut=true;
          else if(path==='/api/auth/account'){
            current.name=text(b.name??current.name,true);
            if(b.password){const valid=current.password_digest?current.password_digest===await hash(b.current_password||''):current.id===seed.user.id&&b.current_password==='Demonstracao!2026';if(!valid)fail(422,'A senha atual não confere.');if(b.password.length<12)fail(422,'Use pelo menos 12 caracteres.');current.password_digest=await hash(b.password);}
          }else if(table==='members'){
            const previous=id?find(data,table,id):{},row={...previous,...b};row.name=text(row.name,true);const suppliedPhone=text(row.phone);row.phone=suppliedPhone.replace(/\D/g,'');if(suppliedPhone&&![10,11].includes(row.phone.length))fail(422,'Informe WhatsApp com DDD.');row.email=text(row.email).toLowerCase();if(row.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))fail(422,'Informe um e-mail válido.');row.joined_on=day(row.joined_on||today());row.status=row.status||'active';if(!['active','inactive'].includes(row.status))fail(422,'Situação inválida.');row.notes=text(row.notes);if(id)Object.assign(previous,row);else {result={id:add(data,table,row).id};status=201;}
          }else if(table==='plans'){
            const previous=id?find(data,table,id):{},row={...previous,...b};row.name=text(row.name,true);row.amount_cents=amount(row.amount_cents);row.enabled=row.enabled===undefined?1:Number(Boolean(row.enabled));row.notes=text(row.notes);if(id)Object.assign(previous,row);else{result={id:add(data,table,row).id};status=201;}
          }else if(table==='subscriptions'&&!id){
            const member=find(data,'members',b.member_id),plan=find(data,'plans',b.plan_id);if(member.status!=='active'||!plan.enabled)fail(409,'Escolha um mensalista e um plano ativos.');if(data.subscriptions.some(s=>s.member_id===member.id&&s.status!=='canceled'))fail(409,'Este mensalista já possui uma assinatura ativa ou pausada.');const start=day(b.start_date||today()),due=day(b.due_date||start);if(due<start)fail(422,'O vencimento não pode ser anterior ao início.');const sub=add(data,table,{member_id:member.id,plan_id:plan.id,amount_cents:plan.amount_cents,start_date:start,end_date:monthAfter(due),due_day:+due.slice(-2),status:'active'});add(data,'invoices',{member_id:member.id,subscription_id:sub.id,description:'Mensalidade • '+plan.name,amount_cents:sub.amount_cents,due_date:due,status:'pending'});result={id:sub.id};status=201;
          }else if(table==='subscriptions'){
            const sub=find(data,table,id);
            if(operation==='renew'){
              if(sub.status!=='active'||data.invoices.some(i=>i.subscription_id===sub.id&&i.status==='pending'))fail(409,'Registre o pagamento da mensalidade atual antes de renovar uma assinatura ativa.');const previous=data.invoices.filter(i=>i.subscription_id===sub.id).sort((a,b)=>b.due_date.localeCompare(a.due_date))[0];const due=previous?monthAfter(previous.due_date,sub.due_day):sub.start_date;result={id:add(data,'invoices',{member_id:sub.member_id,subscription_id:sub.id,description:'Mensalidade • '+find(data,'plans',sub.plan_id).name,amount_cents:sub.amount_cents,due_date:due,status:'pending'}).id};sub.end_date=monthAfter(due,sub.due_day);status=201;
            }else{if(!['active','paused','canceled'].includes(b.status))fail(422,'Situação inválida.');if(sub.status==='canceled'&&b.status!=='canceled')fail(409,'Cadastre uma nova assinatura.');sub.status=b.status;}
          }else if(table==='invoices'&&!id){find(data,'members',b.member_id);result={id:add(data,table,{member_id:+b.member_id,description:text(b.description,true),amount_cents:amount(b.amount_cents),due_date:day(b.due_date),status:'pending',subscription_id:null}).id};status=201;
          }else if(table==='invoices'&&['pay','cancel'].includes(operation)){
            const invoice=find(data,table,id);if(invoice.status!=='pending')fail(409,'Esta cobrança já foi paga ou cancelada.');if(operation==='cancel'){if(data.store_orders.some(o=>o.invoice_id===invoice.id&&o.status!=='canceled'))fail(409,'Cancele o pedido na Loja para liberar o estoque.');invoice.status='canceled';}else{if(!['pix','dinheiro','cartao','transferencia'].includes(b.method))fail(422,'Escolha uma forma de pagamento.');const paid=day(b.paid_on||today());if(paid>today())fail(422,'O pagamento não pode ter data futura.');add(data,'payments',{invoice_id:invoice.id,amount_cents:invoice.amount_cents,method:b.method,paid_on:paid,user_id:current.id});invoice.status='paid';}
          }else if(table==='appointments'){
            const previous=id?find(data,table,id):{},row={...previous,...b};row.member_id=row.member_id?find(data,'members',row.member_id).id:null;row.contact_name=text(row.contact_name,!row.member_id);row.kind=text(row.kind,true);row.instructor=text(row.instructor||'Equipe Spartans',true).replace(/\s+/g,' ');if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(row.starts_at||''))fail(422,'Informe data e horário válidos.');day(row.starts_at.slice(0,10));if(+row.starts_at.slice(11,13)>23||+row.starts_at.slice(14)>59)fail(422,'Horário inválido.');const duration=b.duration_minutes??(previous.ends_at?(Date.parse(previous.ends_at+'Z')-Date.parse(previous.starts_at+'Z'))/60000:45);if(!Number.isInteger(+duration)||duration<15||duration>240)fail(422,'A duração deve ser de 15 a 240 minutos.');row.ends_at=new Date(Date.parse(row.starts_at+'Z')+duration*60000).toISOString().slice(0,16);if(row.ends_at.slice(0,10)!==row.starts_at.slice(0,10)&&!row.ends_at.endsWith('T00:00'))fail(422,'O atendimento deve terminar até meia-noite.');row.status=row.status||'scheduled';if(!['scheduled','completed','canceled'].includes(row.status))fail(422,'Situação inválida.');if(row.status==='scheduled'&&data.appointments.some(a=>a.id!==previous.id&&a.status==='scheduled'&&a.starts_at<row.ends_at&&a.ends_at>row.starts_at&&(a.instructor.toLowerCase()===row.instructor.toLowerCase()||(row.member_id&&a.member_id===row.member_id))))fail(409,'O responsável ou mensalista já tem um agendamento nesse horário.');delete row.duration_minutes;if(id)Object.assign(previous,row);else{result={id:add(data,table,row).id};status=201;}
          }else if(table==='users'){
            if(current.role!=='admin')fail(403,'Somente administradores podem alterar a equipe.');const previous=id?find(data,table,id):{};if(previous.id===current.id)fail(409,'Use Minha conta para editar seu perfil.');const row={...previous,...b};row.name=text(row.name,true);row.email=text(row.email,true).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))fail(422,'Informe um e-mail válido.');if(data.users.some(u=>u.id!==previous.id&&u.email===row.email))fail(409,'Este e-mail já está cadastrado.');row.role=row.role||'staff';row.enabled=row.enabled===undefined?1:Number(Boolean(row.enabled));if(!['staff','admin'].includes(row.role))fail(422,'Perfil inválido.');if(!id||b.password){if(!b.password||b.password.length<12)fail(422,'Use pelo menos 12 caracteres.');row.password_digest=await hash(b.password);}delete row.password;if(id)Object.assign(previous,row);else{result={id:add(data,table,row).id};status=201;}
          }else fail(404,'Ação não encontrada.');
        }
        try{storage.setItem(key,JSON.stringify(data));}catch{fail(507,'O navegador não conseguiu salvar. Libere espaço e tente novamente.');}db=data;return {status,body:result};
      }catch(error){return {status:error.status||422,body:{error:error.message||'Não foi possível salvar a demonstração.'}};}
    }
    return {handle,reset(){const data=initial();storage.setItem(key,JSON.stringify(data));db=data;}};
  }
  if(typeof module==='object'&&module.exports){module.exports={createDemoApi};return;}
  const realFetch=root.fetch.bind(root);
  let ready=realFetch('/demo/fixture.json').then(r=>{if(!r.ok)throw Error('Não foi possível carregar a demonstração.');return r.json();}).then(seed=>createDemoApi(seed,root.localStorage));
  root.fetch=async (input,options={})=>{const url=new URL(typeof input==='string'?input:input.url,root.location.href);if(url.origin!==root.location.origin||!url.pathname.startsWith('/api/'))return realFetch(input,options);const api=await ready,result=await api.handle(url.pathname,options.method||'GET',options.body?JSON.parse(options.body):{});return new Response(typeof result.body==='string'?result.body:JSON.stringify(result.body),{status:result.status,headers:{'Content-Type':result.type||'application/json'}});};
  document.addEventListener('DOMContentLoaded',()=>{
    const bottom=document.querySelector('.sidebar-bottom');const reset=document.createElement('button');reset.type='button';reset.textContent='Restaurar demonstração';reset.addEventListener('click',async()=>{(await ready).reset();root.location.reload();});bottom.append(reset);
    document.addEventListener('click',async event=>{const link=event.target.closest('a[href="/api/export/members.csv"]');if(!link)return;event.preventDefault();const result=await (await ready).handle('/api/export/members.csv');const url=URL.createObjectURL(new Blob([result.body],{type:'text/csv;charset=utf-8'}));const download=document.createElement('a');download.href=url;download.download='mensalistas-demonstracao.csv';download.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  });
})(typeof window==='object'?window:globalThis);
