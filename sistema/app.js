'use strict';
const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e = escapeHtml;
const icon = name => `<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><use href="/assets/management-icons.svg#${name}"/></svg>`;
const money = cents => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((cents || 0)/100);
const formatDate = value => value ? new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(new Date(value.slice(0,10)+'T12:00:00Z')) : '—';
const shortDate = value => value ? formatDate(value).slice(0,5) : '—';
const initials = name => String(name || '').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
const statusNames = {active:'Ativa',inactive:'Inativo',pending:'Em aberto',overdue:'Em atraso',paid:'Pago',canceled:'Cancelada',paused:'Pausada',scheduled:'Agendado',completed:'Concluído'};
const badge = (status,label) => `<span class="badge ${e(status)}">${e(label || statusNames[status] || status)}</span>`;
const avatar = member => `<span class="avatar tone-${(member.id || 0)%5}">${e(initials(member.name || member.member_name))}</span>`;
const person = member => `<div class="person">${avatar(member)}<div><button type="button" data-action="profile" data-id="${member.id}"><strong>${e(member.name)}</strong><small>${e(member.email || member.phone || 'Contato não informado')}</small></button></div></div>`;
const action = (name,id,label,graphic,extra='') => `<button type="button" class="icon-button ${extra}" data-action="${name}" data-id="${id}" aria-label="${e(label)}" title="${e(label)}">${icon(graphic)}</button>`;
const button = (label,name,id='',kind='primary',graphic='plus-lg') => `<button type="button" class="button ${kind}" data-action="${name}" data-id="${id}">${graphic?icon(graphic):''}${e(label)}</button>`;
const routes = [
  ['visao-geral','Visão geral','grid-1x2'],['mensalistas','Mensalistas','people'],['agenda','Agenda','calendar3'],['assinaturas','Assinaturas','arrow-repeat'],['cobrancas','Cobranças','receipt'],['planos','Planos','sliders'],['loja','Loja','bag'],['profissionais','Profissionais','person-gear'],['equipe','Equipe','person-gear'],
];
const state = { view:'visao-geral', query:'', filter:'all', page:1, date:'', calendarMode:'month', calendarFilter:'all', calendarInstructor:'', data:null, user:null, demo:false };
let toastTimer;
let refreshTimer;
let lastFocus;

async function api(url,method='GET',data) {
  const response = await fetch(url,{method,headers:data ? {'Content-Type':'application/json'} : {},body:data ? JSON.stringify(data) : undefined,credentials:'same-origin'});
  let result; try { result=await response.json(); } catch { result={error:'Não foi possível ler a resposta do servidor.'}; }
  if (!response.ok) {
    if (response.status===401 && state.user && !url.includes('/auth/')) { state.user=null; clearInterval(refreshTimer); await boot(); }
    throw new Error(result.error || 'Não foi possível concluir a operação.');
  }
  return result;
}
function notify(message) { clearTimeout(toastTimer); $('#toast').textContent=message; $('#toast').hidden=false; toastTimer=setTimeout(()=>$('#toast').hidden=true,4800); }
function errorBox(message) { return `<p class="error-message" role="alert">${e(message)}</p>`; }
function selected(value,expected) { return String(value)===String(expected)?' selected':''; }
function options(items,current,label='Selecione') { return `<option value="">${e(label)}</option>`+items.map(x=>`<option value="${x.id}"${selected(current,x.id)}>${e(x.name)}</option>`).join(''); }
function field(label,name,value='',type='text',attrs='',help='') { return `<label class="field"><span>${e(label)}</span><input name="${name}" type="${type}" value="${e(value)}" ${attrs}/>${help?`<small>${e(help)}</small>`:''}</label>`; }
function selectField(label,name,content,attrs='') { return `<label class="field"><span>${e(label)}</span><select name="${name}" ${attrs}>${content}</select></label>`; }
function notes(value='') { return `<label class="field"><span>Observações</span><textarea name="notes" maxlength="2000" rows="3">${e(value)}</textarea></label>`; }
function form(content,name,id='',submit='Salvar') { return `<form class="form-grid" data-form="${name}" data-id="${id}"><div class="form-error" hidden></div>${content}<div class="form-actions"><button type="button" class="button" data-action="close-modal">Cancelar</button><button class="button primary" type="submit">${e(submit)}</button></div></form>`; }
function openModal(title,content) { lastFocus=document.activeElement; $('#modal-title').textContent=title; $('#modal-content').innerHTML=content; if (!$('#modal').open) $('#modal').showModal(); }
function closeModal() { $('#modal').close(); lastFocus?.focus?.(); }
function empty(title,copy,graphic='people',cta='') { return `<div class="empty">${icon(graphic)}<h3>${e(title)}</h3><p>${e(copy)}</p>${cta}</div>`; }
function table(headers,rows,blank) { return rows.length ? `<div class="table-wrap" role="region" aria-label="Lista de registros" tabindex="0"><table class="${headers.at(-1)==='Ações'?'has-actions':''}"><thead><tr>${headers.map(h=>`<th scope="col"${h==='Ações'?' class="actions-column"':''}>${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>` : blank; }
function paginate(items) {
  const pages=Math.max(1,Math.ceil(items.length/10)); state.page=Math.min(state.page,pages);
  return {rows:items.slice((state.page-1)*10,state.page*10),footer:`<div class="table-footer"><span>${items.length?`${(state.page-1)*10+1}–${Math.min(state.page*10,items.length)} de ${items.length} registros`:'Nenhum registro'}</span><div class="pagination"><button type="button" data-action="page" data-id="${state.page-1}" aria-label="Página anterior" ${state.page===1?'disabled':''}>${icon('chevron-left')}</button><span>${state.page} / ${pages}</span><button type="button" data-action="page" data-id="${state.page+1}" aria-label="Próxima página" ${state.page===pages?'disabled':''}>${icon('chevron-right')}</button></div></div>`};
}
function tabs(entries) { return `<div class="filter-tabs">${entries.map(([value,label,count])=>`<button type="button" class="${state.filter===value?'active':''}" data-action="filter" data-id="${value}" aria-pressed="${state.filter===value}">${e(label)}${count===undefined?'':`<span>${count}</span>`}</button>`).join('')}</div>`; }
function searched(items,keys) { const q=state.query.toLocaleLowerCase('pt-BR'); return items.filter(x=>keys.some(k=>String(x[k] || '').toLocaleLowerCase('pt-BR').includes(q))); }
function header(title,copy,cta='') { return `<div class="page-heading"><div><h1>${e(title)}</h1></div><div class="heading-actions">${cta}</div></div>`; }
function stat(label,value,note,graphic,alert=false) { return `<article class="stat ${alert?'alert':''}"><div class="stat-top"><p>${e(label)}</p>${icon(graphic)}</div><strong class="stat-value">${e(value)}</strong><p class="stat-note">${e(note)}</p></article>`; }
function addDays(value,days) { const d=new Date(value+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10); }
function memberById(id) { return state.data.members.find(x=>x.id===+id); }
function invoiceById(id) { return state.data.invoices.find(x=>x.id===+id); }
function paymentMethod(value) { return ({pix:'Pix',dinheiro:'Dinheiro',cartao:'Cartão',transferencia:'Transferência'})[value] || value; }

function renderNavigation() {
  const overdue=state.data.invoices.filter(x=>x.display_status==='overdue').length;
  $('#navigation').innerHTML=routes.filter(x=>x[0]!=='equipe' || state.user.role==='admin').map(([route,label,graphic],i)=>`<a href="#${route}" class="nav-link ${i===5?'nav-section':''}" ${route===state.view?'aria-current="page"':''}>${icon(graphic)}${e(label)}${route==='cobrancas'&&overdue?`<span class="nav-count">${overdue}</span>`:''}</a>`).join('');
  $('#breadcrumb').textContent=routes.find(x=>x[0]===state.view)?.[1] || 'Visão geral';
  $('#search').placeholder=({cobrancas:'Buscar cobrança…',assinaturas:'Buscar assinatura…',agenda:'Buscar na agenda…',planos:'Buscar plano…',loja:'Buscar na loja…',profissionais:'Buscar profissional…',equipe:'Buscar na equipe…'})[state.view] || 'Buscar mensalista…';
}
function navigate(route,preserveQuery=false) {
  if (!routes.some(x=>x[0]===route) || (route==='equipe'&&state.user?.role!=='admin')) route='visao-geral';
  state.view=route; state.filter='all'; state.page=1;
  if(!preserveQuery) {state.query=''; $('#search').value='';}
  if(location.hash!==`#${route}`) history.replaceState(null,'',`#${route}`);
  setMenu(false); renderNavigation(); renderView();
}
async function loadData() {
  state.data=await api('/api/state'); state.user=state.data.user; state.demo=state.data.demo;
  if(state.view==='equipe'&&state.user.role!=='admin'){state.view='visao-geral';history.replaceState(null,'','#visao-geral');}
  if(!state.date) state.date=state.data.today;
  $('#last-updated').textContent='Atualizado às '+new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(new Date());
  $('#user-name').textContent=state.user.name; $('#user-initials').textContent=initials(state.user.name);
  $('#user-role').textContent=state.user.role==='admin'?'Administrador':'Equipe';
  renderNavigation(); renderView();
}
function invoiceActions(invoice) {
  if(!['pending','overdue'].includes(invoice.display_status)) return '<span class="muted">—</span>';
  const contact=invoice.member_phone ? `<a class="icon-button" href="${reminderLink(invoice)}" target="_blank" rel="noopener" aria-label="Preparar lembrete para ${e(invoice.member_name)}" title="Revisar lembrete no WhatsApp">${icon('whatsapp')}</a>` : '';
  return `${action('pay',invoice.id,'Registrar pagamento','check2')}${contact}${action('cancel-invoice',invoice.id,'Cancelar cobrança','x-lg','danger')}`;
}
function reminderLink(invoice) {
  const message=`Olá, ${invoice.member_name.split(' ')[0]}! Aqui é da Academia Spartans. A cobrança de ${money(invoice.amount_cents)}, referente a ${invoice.description}, vence em ${formatDate(invoice.due_date)}. Podemos ajudar com o pagamento?`;
  return `https://wa.me/55${invoice.member_phone}?text=${encodeURIComponent(message)}`;
}

function dashboard() {
  const d=state.data, month=d.today.slice(0,7), payments=d.payments.filter(p=>p.paid_on.startsWith(month));
  const overdue=d.invoices.filter(x=>x.display_status==='overdue'), pending=d.invoices.filter(x=>x.status==='pending');
  const active=d.subscriptions.filter(x=>x.status==='active');
  const agenda=d.appointments.filter(x=>x.starts_at.startsWith(d.today)&&x.status==='scheduled');
  const pendingRows=[...pending].sort((a,b)=>a.due_date.localeCompare(b.due_date)).slice(0,5);
  const monthNames=['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
  const chartMonths=Array.from({length:6},(_,i)=>{const date=new Date(d.today+'T12:00:00Z'); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth()-5+i); const key=date.toISOString().slice(0,7); return {label:monthNames[date.getUTCMonth()],value:d.payments.filter(p=>p.paid_on.startsWith(key)).reduce((n,p)=>n+p.amount_cents,0)};});
  const chartMax=Math.max(10000,...chartMonths.map(x=>x.value));
  const chart=`<svg class="cash-chart" viewBox="0 0 480 195" role="img" aria-label="Recebimentos nos últimos seis meses: ${e(chartMonths.map(x=>`${x.label}: ${money(x.value)}`).join('; '))}"><path class="chart-line" d="M20 25H465M20 65H465M20 105H465M20 150H465"/>${chartMonths.map((x,i)=>`<rect x="${40+i*72}" y="${150-(x.value/chartMax*120)}" width="30" height="${Math.max(x.value?4:2,x.value/chartMax*120)}" rx="2" fill="${i===5?'#e1090a':'#e8e3e7'}"/><text x="${55+i*72}" y="178" text-anchor="middle">${x.label}</text>`).join('')}</svg>`;
  return header('Visão geral','',`<span class="date-label">${icon('calendar3')}${formatDate(d.today)}</span>${button('Novo mensalista','new-member')}`)+
    `<div class="stats">${stat('Recebido no mês',money(payments.reduce((n,p)=>n+p.amount_cents,0)),`${payments.length} pagamentos registrados`,'cash-stack')}${stat('Assinaturas ativas',String(active.length),`${d.members.filter(m=>m.status==='active').length} mensalistas cadastrados`,'people')}${stat('Em aberto',money(pending.reduce((n,p)=>n+p.amount_cents,0)),`${pending.length} cobranças aguardando pagamento`,'receipt')}${stat('Em atraso',money(overdue.reduce((n,p)=>n+p.amount_cents,0)),`${overdue.length} vencimentos para acompanhar`,'exclamation-circle',true)}</div>`+
    `<div class="dashboard-grid"><section class="panel"><div class="panel-header"><div><h2>Recebimentos</h2><p>Pagamentos registrados nos últimos seis meses</p></div></div><div class="panel-body"><div class="chart-summary"><strong>${money(payments.reduce((n,p)=>n+p.amount_cents,0))}</strong><span>neste mês</span></div>${chart}</div></section><section class="panel"><div class="panel-header"><div><h2>Hoje na agenda</h2><p>${agenda.length} ${agenda.length===1?'agendamento':'agendamentos'} previstos</p></div><a class="text-link" href="#agenda">Ver agenda ${icon('arrow-up-right')}</a></div>${agenda.length?`<div class="agenda-preview">${agenda.slice(0,4).map(a=>`<div class="agenda-entry"><span class="agenda-time">${a.starts_at.slice(11)}</span><div><h3>${e(a.member_name)}</h3><p>${e(a.kind)}</p></div><i class="mini-status" aria-hidden="true"></i></div>`).join('')}</div>`:empty('Sua agenda está livre','Organize avaliações, visitas e acompanhamentos.','calendar3',button('Agendar','new-appointment','','ghost'))}</section></div>`+
    (overdue.length?`<div class="attention-strip">${icon('exclamation-circle')}<p><strong>${overdue.length} ${overdue.length===1?'cobrança precisa':'cobranças precisam'} de atenção.</strong> Revise os vencimentos e prepare os lembretes de pagamento.</p><a class="text-link" href="#cobrancas">Acompanhar ${icon('arrow-up-right')}</a></div>`:'')+
    `<section class="panel full"><div class="panel-header"><div><h2>Próximos recebimentos</h2><p>Prioridade para os vencimentos mais antigos</p></div><a class="text-link" href="#cobrancas">Todas as cobranças ${icon('arrow-up-right')}</a></div>${table(['Mensalista','Descrição','Vencimento','Valor','Situação','Ações'],pendingRows.map(i=>`<tr><td class="table-main">${e(i.member_name)}</td><td>${e(i.description)}</td><td>${formatDate(i.due_date)}</td><td class="money table-main">${money(i.amount_cents)}</td><td>${badge(i.display_status)}</td><td><div class="row-actions">${invoiceActions(i)}</div></td></tr>`),empty('Nenhuma cobrança em aberto','As mensalidades e cobranças cadastradas aparecerão aqui.','receipt'))}</section>`;
}

function membersView() {
  let items=searched(state.data.members,['name','phone','email']);
  if(state.filter!=='all') items=items.filter(x=>x.status===state.filter);
  const p=paginate(items);
  return header('Mensalistas','Pessoas, contatos e histórico de cada jornada.',`<a class="button ghost" href="/api/export/members.csv">${icon('download')}Exportar</a>${button('Novo mensalista','new-member')}`)+
  `<section class="panel"><div class="toolbar">${tabs([['all','Todos',state.data.members.length],['active','Ativos'],['inactive','Inativos']])}<span class="toolbar-note">${items.length} mensalistas encontrados</span></div>${table(['Mensalista','Plano atual','Professor','Cadastro','Situação','Ações'],p.rows.map(m=>{const sub=state.data.subscriptions.find(s=>s.member_id===m.id&&s.status!=='canceled');return `<tr><td>${person(m)}</td><td>${sub?`<span class="table-main">${e(sub.plan_name)}</span><span class="cell-secondary">${money(sub.amount_cents)} / mês</span>`:'<span class="muted">Sem assinatura</span>'}</td><td><button class="assignment-button" type="button" data-action="assign-professor" data-id="${m.id}">${e(m.professor_name||'Vincular professor')}${icon(m.professor_id?'pencil':'plus-lg')}</button></td><td>${formatDate(m.joined_on)}</td><td>${badge(m.status,m.status==='active'?'Ativo':'Inativo')}</td><td><div class="row-actions">${action('profile',m.id,'Ver histórico de '+m.name,'people')}${action('member-portal',m.id,'Área do mensalista e treinos','person-gear')+action('edit-member',m.id,'Editar '+m.name,'pencil')}${!sub&&m.status==='active'?action('new-subscription',m.id,'Vincular plano','plus-lg'):''}</div></td></tr>`;}),empty('Nenhum mensalista por aqui','Cadastre a primeira pessoa ou ajuste sua busca.','people',button('Cadastrar mensalista','new-member','','ghost')))}${p.footer}</section>`;
}
function subscriptionsView() {
  let items=searched(state.data.subscriptions,['member_name','plan_name']);
  if(state.filter!=='all') items=items.filter(x=>x.status===state.filter);
  const p=paginate(items);
  return header('Assinaturas','Planos vinculados, vigências e próximas renovações.',button('Nova assinatura','new-subscription'))+
    `<section class="panel"><div class="toolbar">${tabs([['all','Todas'],['active','Ativas'],['paused','Pausadas'],['canceled','Canceladas']])}<span class="toolbar-note">Renovação controlada pela equipe</span></div>${table(['Mensalista / plano','Mensalidade','Início','Vigência até','Situação','Ações'],p.rows.map(s=>`<tr><td><strong class="table-main">${e(s.member_name)}</strong><span class="cell-secondary">${e(s.plan_name)}</span></td><td class="money">${money(s.amount_cents)}</td><td>${formatDate(s.start_date)}</td><td>${formatDate(s.end_date)}</td><td>${badge(s.status)}</td><td><div class="row-actions">${s.status==='active'?action('renew',s.id,'Gerar próxima mensalidade','arrow-repeat')+action('pause-subscription',s.id,'Pausar assinatura','clock'):s.status==='paused'?action('resume-subscription',s.id,'Retomar assinatura','check2'):''}${s.status!=='canceled'?action('cancel-subscription',s.id,'Cancelar assinatura','x-lg','danger'):''}</div></td></tr>`),empty('Nenhuma assinatura encontrada','Vincule um mensalista a um plano para gerar a primeira cobrança.','arrow-repeat',button('Vincular plano','new-subscription','','ghost')))}${p.footer}</section>`;
}
function invoicesView() {
  let items=searched(state.data.invoices,['member_name','description']);
  if(state.filter!=='all') items=items.filter(x=>x.display_status===state.filter);
  const p=paginate(items), paid=state.data.payments;
  return header('Cobranças','Vencimentos sob controle. Pagamentos com histórico.',button('Nova cobrança','new-invoice'))+
    `<div class="stats">${stat('Em aberto',money(state.data.invoices.filter(i=>i.status==='pending').reduce((n,i)=>n+i.amount_cents,0)),'Inclui cobranças vencidas','receipt')}${stat('Em atraso',money(state.data.invoices.filter(i=>i.display_status==='overdue').reduce((n,i)=>n+i.amount_cents,0)),'Vencimentos anteriores a hoje','exclamation-circle',true)}${stat('Recebido no mês',money(paid.filter(p=>p.paid_on.startsWith(state.data.today.slice(0,7))).reduce((n,p)=>n+p.amount_cents,0)),'Baixas registradas pela equipe','cash-stack')}${stat('Pagamentos',String(paid.length),'Registros no histórico','credit-card')}</div>`+
    `<section class="panel"><div class="toolbar">${tabs([['all','Todas'],['pending','Em aberto'],['overdue','Em atraso'],['paid','Pagas'],['canceled','Canceladas']])}<span class="toolbar-note">${items.length} cobranças</span></div>${table(['Mensalista / descrição','Vencimento','Valor','Situação','Pagamento','Ações'],p.rows.map(i=>{const payment=paid.find(p=>p.invoice_id===i.id);return `<tr><td><strong class="table-main">${e(i.member_name)}</strong><span class="cell-secondary">${e(i.description)}</span></td><td>${formatDate(i.due_date)}</td><td class="money table-main">${money(i.amount_cents)}</td><td>${badge(i.display_status)}</td><td>${payment?`${formatDate(payment.paid_on)}<span class="cell-secondary">${e(paymentMethod(payment.method))}</span>`:'—'}</td><td><div class="row-actions">${invoiceActions(i)}</div></td></tr>`;}),empty('Nenhuma cobrança encontrada','Crie uma cobrança ou vincule um mensalista a uma assinatura.','receipt',button('Criar cobrança','new-invoice','','ghost')))}${p.footer}</section>`;
}
function plansView() {
  const plans=searched(state.data.plans,['name','notes']);
  return header('Planos','Organize valores e condições para as novas assinaturas.',button('Novo plano','new-plan'))+`<div class="plan-list">${plans.map(p=>`<article class="management-plan"><div class="plan-top"><h2>${e(p.name)}</h2>${badge(p.enabled?'active':'inactive',p.enabled?'Disponível':'Inativo')}</div><strong class="price">${money(p.amount_cents)}<small>/ mês</small></strong><p>${e(p.notes || 'Plano mensal da academia.')}</p><div class="plan-bottom"><span>${state.data.subscriptions.filter(s=>s.plan_id===p.id&&s.status==='active').length} assinaturas ativas</span>${button('Editar plano','edit-plan',p.id,'ghost small','pencil')}</div></article>`).join('') || empty('Nenhum plano encontrado','Cadastre um plano mensal para começar.','sliders')}</div>`;
}
function teamView() {
  const users=searched(state.data.users,['name','email']);
  return header('Equipe','Acesso individual para quem cuida da academia.',button('Adicionar acesso','new-user'))+`<section class="panel">${table(['Pessoa','E-mail','Perfil','Situação','Ações'],users.map(u=>`<tr><td><div class="person">${avatar(u)}<strong class="table-main">${e(u.name)}</strong></div></td><td>${e(u.email)}</td><td>${u.role==='admin'?'Administrador':'Equipe'}</td><td>${badge(u.enabled?'active':'inactive',u.enabled?'Ativo':'Inativo')}</td><td><div class="row-actions">${action(u.id===state.user.id?'account':'edit-user',u.id,'Editar acesso','pencil')}</div></td></tr>`),empty('Nenhum acesso encontrado','Ajuste a busca para ver a equipe.','people'))}</section>`;
}
function renderView() {
  if(!state.data) return;
  const views={'visao-geral':dashboard,mensalistas:membersView,agenda:completeAgendaView,assinaturas:subscriptionsView,cobrancas:invoicesView,planos:plansView,loja:storeAdminView,profissionais:professionalsView,equipe:teamView};
  $('#view').innerHTML=(views[state.view] || dashboard)();
  if(state.view==='agenda')layoutCalendar();
  document.title=`${routes.find(x=>x[0]===state.view)?.[1] || 'Gestão'} • Spartans`;
}

function memberForm(member={}) {
  openModal(member.id?'Editar mensalista':'Novo mensalista',form(`${field('Nome completo','name',member.name,'text','required maxlength="120" autocomplete="name"')}
    <div class="form-row">${field('WhatsApp com DDD','phone',member.phone,'tel','autocomplete="tel" inputmode="tel" maxlength="30"')}${field('E-mail','email',member.email,'email','autocomplete="email" maxlength="254"')}</div>
    <div class="form-row">${field('Data de cadastro','joined_on',member.joined_on || state.data.today,'date','required')}${selectField('Situação','status',`<option value="active"${selected(member.status || 'active','active')}>Ativo</option><option value="inactive"${selected(member.status,'inactive')}>Inativo</option>`)}</div>${notes(member.notes)}`,'member',member.id || ''));
}
function subscriptionForm(memberId='') {
  const available=state.data.members.filter(m=>m.status==='active'&&!state.data.subscriptions.some(s=>s.member_id===m.id&&s.status!=='canceled'));
  if(!available.length) return openModal('Nova assinatura',empty('Nenhum mensalista disponível','Cadastre um mensalista ativo e sem assinatura para vincular um plano.','people',button('Cadastrar mensalista','new-member','','ghost')));
  const plans=state.data.plans.filter(p=>p.enabled).map(p=>({...p,name:`${p.name} — ${money(p.amount_cents)} / mês`}));
  openModal('Nova assinatura',form(`${selectField('Mensalista','member_id',options(available,memberId),'required')}${selectField('Plano mensal','plan_id',options(plans,''),'required')}<div class="form-row">${field('Início da assinatura','start_date',state.data.today,'date','required')}${field('Primeiro vencimento','due_date',state.data.today,'date','required')}</div><p class="form-caption">A primeira cobrança será registrada junto da assinatura. Nenhum valor será debitado automaticamente.</p>`,'subscription','','Criar assinatura'));
}
function invoiceForm() {
  if(!state.data.members.length) return openModal('Nova cobrança',empty('Cadastre um mensalista primeiro','A cobrança precisa estar vinculada a uma pessoa.','people',button('Cadastrar mensalista','new-member','','ghost')));
  openModal('Nova cobrança',form(`${selectField('Mensalista','member_id',options(state.data.members,''),'required')}${field('Descrição','description','','text','required maxlength="180" placeholder="Ex.: Mensalidade de novembro"')}<div class="form-row">${field('Valor (R$)','amount','', 'text','required inputmode="decimal" placeholder="119,90"')}${field('Vencimento','due_date',state.data.today,'date','required')}</div><p class="form-caption">Este registro serve para controle interno. Não gera Pix, boleto ou débito automático.</p>`,'invoice','','Criar cobrança'));
}
function paymentForm(invoice) {
  openModal('Registrar pagamento',form(`<div class="payment-summary"><div><span>${e(invoice.description)}</span><h3>${e(invoice.member_name)}</h3></div><strong>${money(invoice.amount_cents)}</strong></div><div class="form-row">${selectField('Forma de pagamento','method',Object.entries({pix:'Pix',dinheiro:'Dinheiro',cartao:'Cartão',transferencia:'Transferência'}).map(([k,v])=>`<option value="${k}">${v}</option>`).join(''))}${field('Data do pagamento','paid_on',state.data.today,'date',`required max="${state.data.today}"`)}</div><p class="form-caption">Confirme somente após verificar o recebimento. A baixa será vinculada ao seu acesso.</p>`,'payment',invoice.id,'Confirmar recebimento'));
}
function appointmentForm(appointment={}) {
  const duration=appointment.ends_at?(Date.parse(appointment.ends_at+'Z')-Date.parse(appointment.starts_at+'Z'))/60000:(appointment.duration_minutes || 45);
  openModal(appointment.id?'Editar agendamento':'Novo agendamento',form(`${selectField('Mensalista (opcional)','member_id',options(state.data.members,appointment.member_id,'Visitante / treino experimental'))}${field('Nome do visitante, se não for mensalista','contact_name',appointment.contact_name,'text','maxlength="120"')}<div class="form-row">${selectField('Tipo','kind',['Avaliação física','Treino experimental','Acompanhamento','Mobilidade','Outro'].map(k=>`<option${selected(appointment.kind,k)}>${e(k)}</option>`).join(''))}${field('Responsável','instructor',appointment.instructor || 'Equipe Spartans','text','required maxlength="100"')}</div><div class="form-row">${field('Data e horário','starts_at',appointment.starts_at || `${state.date}T09:00`,'datetime-local','required')}${selectField('Duração','duration_minutes',[15,30,45,60,90,120,180,240].map(n=>`<option value="${n}"${selected(duration,n)}>${n} minutos</option>`).join(''))}</div>${appointment.id?selectField('Situação','status',['scheduled','completed','canceled'].map(k=>`<option value="${k}"${selected(appointment.status,k)}>${statusNames[k]}</option>`).join('')):''}${notes(appointment.notes)}`,'appointment',appointment.id || '','Salvar agendamento'));
}
function planForm(plan={}) {
  openModal(plan.id?'Editar plano':'Novo plano',form(`${field('Nome do plano','name',plan.name,'text','required maxlength="100"')}<div class="form-row">${field('Mensalidade (R$)','amount',plan.amount_cents?((plan.amount_cents/100).toFixed(2).replace('.',',')):'','text','required inputmode="decimal" placeholder="119,90"')}${selectField('Disponibilidade','enabled',`<option value="1"${selected(plan.enabled ?? 1,1)}>Disponível</option><option value="0"${selected(plan.enabled,0)}>Inativo</option>`)}</div><label class="field"><span>Condições e horários</span><textarea name="notes" rows="3" maxlength="500">${e(plan.notes)}</textarea></label><p class="form-caption">Mudanças no preço não alteram o valor das assinaturas já existentes.</p>`,'plan',plan.id || ''));
}
function userForm(user={}) {
  openModal(user.id?'Editar acesso':'Novo acesso à equipe',form(`${field('Nome','name',user.name,'text','required maxlength="120" autocomplete="off"')}${field('E-mail de acesso','email',user.email,'email','required autocomplete="off"')}${selectField('Perfil','role',`<option value="staff"${selected(user.role,'staff')}>Equipe</option><option value="admin"${selected(user.role,'admin')}>Administrador</option>`)}${user.id?selectField('Situação','enabled',`<option value="1"${selected(user.enabled,1)}>Ativo</option><option value="0"${selected(user.enabled,0)}>Inativo</option>`):''}${field(user.id?'Nova senha (opcional)':'Senha inicial','password','','password',`${user.id?'':'required'} minlength="12" maxlength="128" autocomplete="new-password"`,user.id?'Preencha apenas para redefinir a senha.':'Use pelo menos 12 caracteres. Entregue a senha ao responsável por um canal privado.')}`,'user',user.id || '',user.id?'Salvar acesso':'Criar acesso'));
}
function accountForm() {
  openModal('Minha conta',form(`${field('Seu nome','name',state.user.name,'text','required maxlength="120" autocomplete="name"')}<p class="form-caption">Para alterar sua senha, preencha os três campos abaixo. Deixe-os vazios para manter a senha atual.</p>${field('Senha atual','current_password','','password','autocomplete="current-password" maxlength="128"')}${field('Nova senha','password','','password','minlength="12" maxlength="128" autocomplete="new-password"')}${field('Confirmar nova senha','confirm_password','','password','minlength="12" maxlength="128" autocomplete="new-password"')}`,'account','','Salvar perfil'));
}
function profile(member) {
  const subscriptions=state.data.subscriptions.filter(s=>s.member_id===member.id), invoices=state.data.invoices.filter(i=>i.member_id===member.id);
  const current=subscriptions.find(s=>s.status!=='canceled');
  openModal('Histórico do mensalista',`<div class="profile-heading">${avatar(member)}<div><h3>${e(member.name)}</h3>${badge(member.status,member.status==='active'?'Ativo':'Inativo')}</div></div><div class="profile-grid"><div><span>WhatsApp</span><strong>${e(member.phone || 'Não informado')}</strong></div><div><span>E-mail</span><strong>${e(member.email || 'Não informado')}</strong></div><div><span>Plano atual</span><strong>${e(current?.plan_name || 'Sem assinatura')}</strong></div><div><span>Cadastro</span><strong>${formatDate(member.joined_on)}</strong></div></div>${member.notes?`<p class="profile-notes">${e(member.notes)}</p>`:''}<div class="profile-section"><h4>Cobranças recentes</h4>${invoices.length?[...invoices].reverse().slice(0,8).map(i=>`<div class="profile-history"><span>${shortDate(i.due_date)} · ${e(i.description)}</span><strong class="money">${money(i.amount_cents)}</strong>${badge(i.display_status)}</div>`).join(''):'<p class="small-text muted">Nenhuma cobrança cadastrada.</p>'}</div><div class="form-actions">${button('Área do mensalista','member-portal',member.id,'ghost','person-gear')}${button('Editar cadastro','edit-member',member.id,'ghost','pencil')}</div>`);
}
function confirmAction(title,copy,name,id,submit='Confirmar') { openModal(title,form(`<p class="form-caption">${e(copy)}</p>`,'confirm-'+name,id,submit)); }
function toCents(value) { const raw=String(value).replace(/\s/g,''); if(!/^\d+(?:[.,]\d{1,2})?$/.test(raw)) throw Error('Digite o valor sem separador de milhar, por exemplo 119,90.'); const result=Math.round(Number(raw.replace(',','.'))*100); if(!Number.isSafeInteger(result)||result<1) throw Error('Informe um valor maior que zero.'); return result; }

async function handleForm(formElement) {
  const name=formElement.dataset.form, id=formElement.dataset.id, values=Object.fromEntries(new FormData(formElement));
  const submit=formElement.querySelector('[type=submit]'), oldText=submit.textContent, box=formElement.querySelector('.form-error');
  box.hidden=true; submit.disabled=true; submit.textContent='Salvando…';
  try {
    if(name==='store-product'){await api('/api/store/products'+(id?'/'+id:''),id?'PATCH':'POST',readStoreProduct(formElement));invalidateStore();}
    else if(name==='store-pay'){await api(`/api/store/orders/${id}/pay`,'POST',values);invalidateStore();}
    else if(name==='store-ready'||name==='store-collect'){await api(`/api/store/orders/${id}`,'PATCH',{status:name==='store-ready'?'ready':'collected'});invalidateStore();}
    else if(name==='store-cancel'){await api(`/api/store/orders/${id}/cancel`,'POST',{});invalidateStore();}
    else if(name==='professional') await api('/api/professionals'+(id?'/'+id:''),id?'PATCH':'POST',{...values,enabled:values.enabled==='1'});
    else if(name==='member-assignment') await api(`/api/members/${id}/professor`,'POST',{professor_id:values.professor_id?+values.professor_id:null});
    else if(name==='member-access') await api(`/api/members/${id}/portal`,'POST',{email:values.email,password:values.password,enabled:values.enabled==='1',telemedicine:values.telemedicine==='1',discounts:values.discounts==='1',professor_id:values.professor_id?+values.professor_id:null});
    else if(name==='member-workout') await api(`/api/members/${id}/workouts/${values.weekday}`,'POST',readWorkoutForm(formElement));
    else if(name==='member') await api('/api/members'+(id?'/'+id:''),id?'PATCH':'POST',values);
    else if(name==='subscription') await api('/api/subscriptions','POST',{...values,member_id:+values.member_id,plan_id:+values.plan_id});
    else if(name==='invoice') await api('/api/invoices','POST',{...values,member_id:+values.member_id,amount_cents:toCents(values.amount)});
    else if(name==='payment') await api(`/api/invoices/${id}/pay`,'POST',values);
    else if(name==='appointment') await api('/api/appointments'+(id?'/'+id:''),id?'PATCH':'POST',{...values,member_id:values.member_id?+values.member_id:null,duration_minutes:+values.duration_minutes});
    else if(name==='plan') await api('/api/plans'+(id?'/'+id:''),id?'PATCH':'POST',{...values,enabled:values.enabled==='1',amount_cents:toCents(values.amount)});
    else if(name==='user') {if(!values.password)delete values.password;await api('/api/users'+(id?'/'+id:''),id?'PATCH':'POST',{...values,...(values.enabled!==undefined?{enabled:values.enabled==='1'}:{})});}
    else if(name==='account') {if(values.password!==values.confirm_password)throw Error('A confirmação da senha não confere.');await api('/api/auth/account','PATCH',values);}
    else if(name==='confirm-renew') await api(`/api/subscriptions/${id}/renew`,'POST',{});
    else if(name.startsWith('confirm-')&&name.endsWith('-subscription')) await api(`/api/subscriptions/${id}`,'PATCH',{status:name.includes('pause-')?'paused':name.includes('resume-')?'active':'canceled'});
    else if(name==='confirm-cancel-invoice') await api(`/api/invoices/${id}/cancel`,'POST',{});
    else if(name.startsWith('confirm-')&&name.endsWith('-appointment')) await api(`/api/appointments/${id}`,'PATCH',{status:name.includes('complete-')?'completed':'canceled'});
    else throw Error('Ação não encontrada.');
    await loadData(); closeModal(); notify(name==='payment'?'Pagamento registrado.':'Registro salvo com sucesso.');
  } catch(error) { box.innerHTML=errorBox(error.message); box.hidden=false; box.scrollIntoView({block:'nearest'}); }
  finally { submit.disabled=false; submit.textContent=oldText; }
}
function focusSearchShortcut(event) {const active=document.activeElement;if(event.key!=='/'||event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||event.isComposing||!state.user||$('#modal').open||['INPUT','TEXTAREA','SELECT'].includes(active?.tagName)||active?.isContentEditable||active?.closest?.('[contenteditable="true"],[role="textbox"]'))return false;event.preventDefault();$('#search').focus();return true;}
function setMenu(open) { $('#sidebar').classList.toggle('open',open); $('#nav-overlay').hidden=!open; $('#menu-toggle').setAttribute('aria-expanded',String(open)); $('#menu-toggle').setAttribute('aria-label',open?'Fechar menu':'Abrir menu'); }
function authScreen(status,message='') {
  $('#shell').hidden=true; $('#boot').hidden=true; $('#auth').hidden=false;
  const setup=status.setupRequired;
  $('#auth-content').innerHTML=`<p class="eyebrow">${setup?'PRIMEIRO ACESSO':'BEM-VINDO DE VOLTA'}</p><h2>${setup?'Vamos organizar a casa.':'Entre no seu ritmo.'}</h2><p class="intro">${setup?'Crie o primeiro acesso de administrador para começar a gestão da academia.':'Acesse sua conta para acompanhar a operação da Spartans.'}</p>${status.demo?`<div class="demo-entry"><button class="button dark" type="button" id="demo-login">Explorar demonstração ${icon('arrow-up-right')}</button></div>`:''}${message?errorBox(message):''}<form id="auth-form"><div class="auth-error" hidden></div>${setup?field('Seu nome','name','','text','required maxlength="120" autocomplete="name"'):''}${field('E-mail','email','','email','required autocomplete="username"')}${field('Senha','password','','password',`required ${setup?'minlength="12" autocomplete="new-password"':'autocomplete="current-password"'} maxlength="128"`,setup?'Pelo menos 12 caracteres.':'')}${setup?field('Código de configuração (somente acesso remoto)','setup_token','','password','autocomplete="off"'):''}<button class="button primary" type="submit">${setup?'Criar acesso e começar':'Entrar no sistema'} ${icon('arrow-up-right')}</button></form><p class="auth-note">${setup?'O primeiro acesso será o administrador da equipe.':'Acesso exclusivo à equipe da academia. Se precisar de acesso, procure o administrador.'}</p>`;
  $('#auth-form').addEventListener('submit',async event=>{
    event.preventDefault(); const form=event.currentTarget, btn=form.querySelector('[type=submit]'), box=form.querySelector('.auth-error'); btn.disabled=true; box.hidden=true;
    try { await api('/api/auth/'+(setup?'setup':'login'),'POST',Object.fromEntries(new FormData(form))); await startSession(); }
    catch(error) {box.innerHTML=errorBox(error.message); box.hidden=false;}
    finally {btn.disabled=false;}
  });
  $('#demo-login')?.addEventListener('click',async event=>{event.currentTarget.disabled=true;try{await api('/api/auth/login','POST',{email:'demo@dontstop.local',password:'Demonstracao!2026'});await startSession();}catch(error){authScreen(status,error.message);}});
}
async function startSession() {
  await loadData(); $('#auth').hidden=true; $('#boot').hidden=true; $('#shell').hidden=false;
  navigate(location.hash.slice(1)||'visao-geral'); clearInterval(refreshTimer);
  refreshTimer=setInterval(()=>{if(!document.hidden&&!$('#modal').open&&state.user) loadData().catch(()=>{});},60000);
}
async function boot() {
  try {const status=await api('/api/auth/status'); state.demo=status.demo; if(status.demo&&!status.user&&new URLSearchParams(location.search).get('demo')==='1'){await api('/api/auth/login','POST',{email:'demo@dontstop.local',password:'Demonstracao!2026'});await startSession();}else if(status.user){state.user=status.user;await startSession();}else authScreen(status);}
  catch(error){$('#boot').innerHTML=errorBox('Não foi possível conectar ao sistema. Verifique se o servidor está em execução.')+'<button class="button" id="retry-boot">Tentar novamente</button>';$('#boot').hidden=false;$('#retry-boot').addEventListener('click',boot);}
}

document.addEventListener('submit',event=>{if(event.target.matches('[data-form]')){event.preventDefault();handleForm(event.target);}});
document.addEventListener('click',event=>{
  const link=event.target.closest('a[href^="#"]'); if(link&&state.user){event.preventDefault();navigate(link.hash.slice(1));return;}
  const control=event.target.closest('[data-action]'); if(!control || control.disabled || !state.data) return;
  const name=control.dataset.action,id=control.dataset.id;
  if(calendarAction(name,id,event,control))return;
  if(name==='close-modal') return closeModal();
  if(name==='filter'){state.filter=id;state.page=1;return renderView();}
  if(name==='page'){state.page=+id;return renderView();}
  if(name==='day'){state.date=id;return renderView();}
  if(name==='week'){state.date=addDays(state.date,+id);return renderView();}
  if(name==='today'){state.date=state.data.today;return renderView();}
  if(name==='new-member') return memberForm();
  if(name==='edit-member') return memberForm(memberById(id));
  if(name==='new-store-product') return storeProductForm();
  if(name==='edit-store-product') return storeProductForm(adminStore.products.find(p=>p.id===+id));
  if(name==='pay-store-order') return storePaymentForm(id);
  if(name==='ready-store-order') return storeOrderConfirmation(id,'ready');
  if(name==='collect-store-order') return storeOrderConfirmation(id,'collect');
  if(name==='cancel-store-order') return storeOrderConfirmation(id,'cancel');
  if(name==='new-professional') return professionalForm();
  if(name==='edit-professional') return professionalForm((state.data.professionals||[]).find(p=>p.id===+id));
  if(name==='assign-professor') return assignmentForm(id);
  if(name==='member-portal') return openMemberPortal(id);
  if(name==='profile') return profile(memberById(id));
  if(name==='new-subscription') return subscriptionForm(id);
  if(name==='new-invoice') return invoiceForm();
  if(name==='pay') return paymentForm(invoiceById(id));
  if(name==='new-appointment') return appointmentForm();
  if(name==='edit-appointment') return appointmentForm(state.data.appointments.find(a=>a.id===+id));
  if(name==='new-plan') return planForm();
  if(name==='edit-plan') return planForm(state.data.plans.find(p=>p.id===+id));
  if(name==='new-user') return userForm();
  if(name==='edit-user') return userForm(state.data.users.find(u=>u.id===+id));
  if(name==='account') return accountForm();
  const confirmations={renew:['Gerar próxima mensalidade','Uma nova cobrança mensal será criada com o valor contratado. A mensalidade atual precisa estar paga.','Gerar cobrança'],'pause-subscription':['Pausar assinatura','A assinatura ficará pausada. Cobranças já registradas permanecem no histórico.','Pausar'],'resume-subscription':['Retomar assinatura','A assinatura voltará a ficar ativa. Nenhum débito será feito automaticamente.','Retomar'],'cancel-subscription':['Cancelar assinatura','O contrato será encerrado. As cobranças existentes permanecem disponíveis para acompanhamento.','Cancelar assinatura'],'cancel-invoice':['Cancelar cobrança','A cobrança sairá dos valores em aberto e ficará no histórico como cancelada.','Cancelar cobrança'],'complete-appointment':['Concluir agendamento','Registrar este atendimento como concluído?','Concluir'],'cancel-appointment':['Cancelar agendamento','O horário será liberado e o agendamento ficará no histórico como cancelado.','Cancelar agendamento']};
  if(confirmations[name]) return confirmAction(confirmations[name][0],confirmations[name][1],name,id,confirmations[name][2]);
});
document.addEventListener('change',event=>{if(event.target.id==='calendar-filter'){state.calendarFilter=event.target.value;renderView();return;}if(event.target.id==='calendar-instructor'){state.calendarInstructor=event.target.value;renderView();return;}if(event.target.id==='agenda-date'&&event.target.value){state.date=event.target.value;renderView();}});
$('#search').addEventListener('input',event=>{state.query=event.target.value;state.page=1;if(state.view==='visao-geral'){state.view='mensalistas';history.replaceState(null,'','#mensalistas');renderNavigation();}renderView();});
$('#menu-toggle').addEventListener('click',()=>setMenu(!$('#sidebar').classList.contains('open')));
$('#my-account').addEventListener('click',accountForm);
$('#nav-overlay').addEventListener('click',()=>setMenu(false));
$('#modal-close').addEventListener('click',closeModal);
$('#modal').addEventListener('cancel',()=>lastFocus?.focus?.());
document.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('.calendar-day-track')){event.preventDefault();state.date=event.target.dataset.id;appointmentForm();return;}if(event.key==='Escape'&&$('#sidebar').classList.contains('open')){setMenu(false);$('#menu-toggle').focus();}focusSearchShortcut(event);});
$('#refresh').addEventListener('click',async event=>{event.currentTarget.disabled=true;try{await loadData();notify('Dados atualizados.');}catch(error){notify(error.message);}finally{$('#refresh').disabled=false;}});
$('#logout').addEventListener('click',async()=>{try{await api('/api/auth/logout','POST',{});state.user=null;state.data=null;clearInterval(refreshTimer);await boot();}catch(error){notify(error.message);}});
window.addEventListener('hashchange',()=>{if(state.user)navigate(location.hash.slice(1));});
matchMedia('(min-width: 761px)').addEventListener('change',event=>{if(event.matches)setMenu(false);});
boot();
