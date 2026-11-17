/* Monthly and weekly calendars share the same persistent appointment records. */
function agendaItems() {
  return searched(state.data.appointments,['member_name','kind','instructor'])
    .filter(a=>state.calendarFilter==='all'||a.status===state.calendarFilter)
    .filter(a=>!state.calendarInstructor||a.instructor===state.calendarInstructor);
}
function agendaList(items) {
  return `<div class="day-agenda">${items.length?items.map(a=>`<article class="schedule-item"><div class="schedule-hours"><strong>${a.starts_at.slice(11)}</strong><span>${a.ends_at.slice(11)}</span></div><div class="schedule-info"><h3>${e(a.member_name)}</h3><p>${e(a.kind)} ${badge(a.status)}</p><small>${e(a.instructor)}</small></div><div class="row-actions">${action('edit-appointment',a.id,'Editar agendamento','pencil')}${a.status==='scheduled'?action('complete-appointment',a.id,'Marcar como concluído','check2')+action('cancel-appointment',a.id,'Cancelar agendamento','x-lg','danger'):''}</div></article>`).join(''):empty('Agenda livre neste dia','Escolha outra data ou marque uma visita, avaliação ou acompanhamento.','calendar3',button('Agendar horário','new-appointment','','ghost'))}</div>`;
}
function monthCalendar(items) {
  const date=new Date(state.date+'T12:00:00Z'); date.setUTCDate(1);
  const first=date.toISOString().slice(0,10), monday=addDays(first,-((date.getUTCDay()+6)%7));
  const cells=Array.from({length:42},(_,i)=>{
    const date=addDays(monday,i),entries=items.filter(a=>a.starts_at.startsWith(date));
    return `<article class="month-day ${date.slice(0,7)!==state.date.slice(0,7)?'outside-month':''} ${date===state.data.today?'is-today':''}" aria-label="${formatDate(date)}"><div class="month-day-heading"><button type="button" class="month-day-number" data-action="calendar-day" data-id="${date}" aria-label="Ver agenda de ${formatDate(date)}">${+date.slice(-2)}</button><button type="button" class="month-add" data-action="calendar-add" data-id="${date}" aria-label="Agendar em ${formatDate(date)}" title="Novo agendamento">${icon('plus-lg')}</button></div><div class="month-events">${entries.slice(0,3).map(a=>`<button type="button" class="month-event ${a.status}" data-action="edit-appointment" data-id="${a.id}" title="${e(a.starts_at.slice(11)+' · '+a.member_name+' · '+a.kind+' · '+statusNames[a.status])}" aria-label="Editar ${e(a.member_name)}, ${a.starts_at.slice(11)}, ${e(a.kind)}"><span class="event-time">${a.starts_at.slice(11)}</span><span class="event-title">${e(a.member_name)}</span></button>`).join('')}${entries.length>3?`<button type="button" class="month-more" data-action="calendar-day" data-id="${date}">+${entries.length-3} horários</button>`:''}</div>${entries.length?`<button class="month-mobile-count" data-action="calendar-day" data-id="${date}" aria-label="Ver os ${entries.length} horários de ${formatDate(date)}">${entries.length} ${entries.length===1?'horário':'horários'}</button>`:''}</article>`;
  });
  return `<div class="month-weekdays" aria-hidden="true">${['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'].map(n=>`<span>${n}</span>`).join('')}</div><div class="month-grid">${cells.join('')}</div>`;
}
function weekCalendar(items) {
  const weekday=(new Date(state.date+'T12:00:00Z').getUTCDay()+6)%7,monday=addDays(state.date,-weekday);
  const dates=Array.from({length:7},(_,i)=>addDays(monday,i));
  const entries=items.filter(a=>dates.includes(a.starts_at.slice(0,10)));
  const startHour=Math.min(5,...entries.map(a=>+a.starts_at.slice(11,13)));
  const hours=24-startHour;
  const names=['SEG','TER','QUA','QUI','SEX','SÁB','DOM'];
  const columns=dates.map(day=>{
    const dayItems=entries.filter(a=>a.starts_at.startsWith(day));
    const lanes=[],positions=[];
    for(const appointment of dayItems){
      const start=+appointment.starts_at.slice(11,13)*60 + +appointment.starts_at.slice(14,16);
      const end=appointment.ends_at.slice(0,10)!==day?1440:+appointment.ends_at.slice(11,13)*60 + +appointment.ends_at.slice(14,16);
      let lane=lanes.findIndex(until=>until<=start); if(lane<0)lane=lanes.length;
      lanes[lane]=end; positions.push({appointment,start,end,lane});
    }
    const count=Math.max(1,lanes.length);
    return `<div class="calendar-day-track ${day===state.data.today?'today-track':''}" role="button" tabindex="0" aria-label="Criar agendamento em ${formatDate(day)}" data-action="calendar-slot" data-id="${day}" data-start-hour="${startHour}">${positions.map(({appointment:a,start,end,lane})=>`<button type="button" class="calendar-event ${a.status} ${end-start<35?'compact':''}" data-action="edit-appointment" data-id="${a.id}" data-offset="${(start-startHour*60)/60*48}" data-height="${Math.max(13,(end-start)/60*48-2)}" data-lane="${lane}" data-lanes="${count}" title="${e(a.starts_at.slice(11)+' · '+a.member_name+' · '+a.kind+' · '+a.instructor)}" aria-label="Editar ${e(a.member_name)}, ${formatDate(day)}, ${a.starts_at.slice(11)}"><strong>${e(a.member_name)}</strong><span>${a.starts_at.slice(11)} · ${e(a.kind)}</span></button>`).join('')}</div>`;
  });
  return `<div id="calendar-scroll" class="calendar-scroll"><div class="calendar-week-header"><span class="calendar-timezone">BRT</span>${dates.map((day,i)=>`<div class="calendar-week-day ${day===state.data.today?'is-today':''}"><button type="button" data-action="calendar-day" data-id="${day}" aria-label="Ver ${formatDate(day)}"><span>${names[i]}</span><strong>${+day.slice(-2)}</strong></button><button class="icon-button" type="button" data-action="calendar-add" data-id="${day}" aria-label="Agendar em ${formatDate(day)}">${icon('plus-lg')}</button></div>`).join('')}</div><div class="calendar-week-body" data-hours="${hours}"><div class="calendar-hours">${Array.from({length:hours},(_,i)=>`<div>${String(startHour+i).padStart(2,'0')}:00</div>`).join('')}</div>${columns.join('')}</div></div>`;
}
function completeAgendaView() {
  const mode=state.calendarMode || 'month',items=agendaItems();
  const date=new Date(state.date+'T12:00:00Z');
  const weekday=(date.getUTCDay()+6)%7,monday=addDays(state.date,-weekday);
  let title=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(date);
  if(mode==='week')title=`${shortDate(monday)} a ${shortDate(addDays(monday,6))} · ${state.date.slice(0,4)}`;
  if(mode==='day')title=new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'}).format(date);
  title=title[0].toUpperCase()+title.slice(1);
  const period=items.filter(a=>mode==='month'?a.starts_at.startsWith(state.date.slice(0,7)):mode==='week'?a.starts_at.slice(0,10)>=monday&&a.starts_at.slice(0,10)<=addDays(monday,6):a.starts_at.startsWith(state.date));
  const instructors=[...new Set(state.data.appointments.map(a=>a.instructor))].sort();
  return header('Agenda','',button('Novo agendamento','new-appointment'))+
    `<section class="panel calendar-panel"><div class="calendar-controls"><div class="calendar-period"><div class="calendar-arrows"><button type="button" class="icon-button" data-action="calendar-nav" data-id="-1" aria-label="Período anterior">${icon('chevron-left')}</button><button type="button" class="icon-button" data-action="calendar-nav" data-id="1" aria-label="Próximo período">${icon('chevron-right')}</button></div><h2>${e(title)}</h2><button class="button small" data-action="today" type="button">Hoje</button></div><div class="calendar-view-tabs" role="group" aria-label="Visualização da agenda">${[['month','Mês'],['week','Semana'],['day','Dia']].map(([key,label])=>`<button type="button" class="${mode===key?'selected':''}" data-action="calendar-mode" data-id="${key}" aria-pressed="${mode===key}">${label}</button>`).join('')}</div></div><div class="calendar-filters"><span class="calendar-period-count">${period.length} ${period.length===1?'agendamento':'agendamentos'} no período</span><div><label><span class="sr-only">Filtrar situação</span><select id="calendar-filter">${[['all','Todas as situações'],['scheduled','Agendados'],['completed','Concluídos'],['canceled','Cancelados']].map(([value,label])=>`<option value="${value}"${selected(state.calendarFilter,value)}>${label}</option>`).join('')}</select></label>${instructors.length?`<label><span class="sr-only">Filtrar responsável</span><select id="calendar-instructor"><option value="">Todos os responsáveis</option>${instructors.map(name=>`<option value="${e(name)}"${selected(state.calendarInstructor,name)}>${e(name)}</option>`).join('')}</select></label>`:''}<input id="agenda-date" type="date" value="${state.date}" aria-label="Ir para uma data"/></div></div>${mode==='month'?monthCalendar(items):mode==='week'?weekCalendar(items):agendaList(period)}</section>`;
}
function layoutCalendar() {
  const body=$('.calendar-week-body');
  if(!body)return;
  body.style.setProperty('--calendar-height',`${+body.dataset.hours*48}px`);
  document.querySelectorAll('.calendar-event').forEach(element=>{
    element.style.top=`${+element.dataset.offset}px`;
    element.style.height=`${+element.dataset.height}px`;
    element.style.left=`calc(${+element.dataset.lane/+element.dataset.lanes*100}% + 3px)`;
    element.style.width=`calc(${100/+element.dataset.lanes}% - 6px)`;
  });
  const scroll=$('#calendar-scroll');
  scroll.scrollTop=state.calendarScroll ?? 120;
  scroll.addEventListener('scroll',()=>{state.calendarScroll=scroll.scrollTop;},{passive:true});
}
function calendarAction(name,value,event,control) {
  if(name==='calendar-mode'){state.calendarMode=value;renderView();return true;}
  if(name==='calendar-day'){state.date=value;state.calendarMode='day';renderView();return true;}
  if(name==='calendar-add'){state.date=value;renderView();appointmentForm();return true;}
  if(name==='calendar-nav'){
    if(state.calendarMode==='month'){
      const date=new Date(state.date+'T12:00:00Z');date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+ +value);state.date=date.toISOString().slice(0,10);
    }else state.date=addDays(state.date,+value*(state.calendarMode==='week'?7:1));
    renderView();return true;
  }
  if(name==='calendar-slot'){
    const rect=control.getBoundingClientRect();
    const minutes=Math.max(0,Math.min(1425,+control.dataset.startHour*60+Math.floor((event.clientY-rect.top)/48*4)*15));
    state.date=value;
    appointmentForm({starts_at:`${value}T${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`,duration_minutes:Math.min(45,1440-minutes)});
    return true;
  }
  return false;
}
