(function(root){
  function createMemberDemoApi({get,save,today}){
    const clone=x=>JSON.parse(JSON.stringify(x)),fail=(status,message)=>{throw Object.assign(Error(message),{status});};
    const hash=async value=>Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');
    const clean=value=>String(value??'').trim();
    const required=value=>{const v=clean(value);if(!v||v.length>2000)fail(422,'Preencha os campos obrigatórios.');return v;};
    const accessFor=(d,id)=>d.member_access.find(a=>a.member_id===id&&a.enabled);
    const current=d=>d.members.find(m=>m.id===d.portalMemberId&&m.status==='active'&&accessFor(d,m.id));
    const staff=d=>!d.signedOut&&d.users.some(u=>u.id===d.currentUser&&u.enabled);
    const validPassword=async(a,p)=>a.password_digest?a.password_digest===await hash(p||''):p==='Mensalista!2026';
    function state(d,m){const sub=d.subscriptions.filter(s=>s.member_id===m.id).sort((a,b)=>(a.status==='active'?-1:1)-(b.status==='active'?-1:1)||b.id-a.id)[0];const flags=d.member_benefits.find(x=>x.member_id===m.id)||{};const invoices=d.invoices.filter(i=>i.member_id===m.id).map(i=>({...i,display_status:i.status==='pending'&&i.due_date<today()?'overdue':i.status})).sort((a,b)=>b.due_date.localeCompare(a.due_date));return {member:{id:m.id,name:m.name,email:m.email,phone:m.phone,joined_on:m.joined_on,status:m.status},today:today(),demo:true,professor:(()=>{const a=d.member_professors.find(a=>a.member_id===m.id),u=a&&d.users.find(u=>u.id===a.user_id&&u.enabled),p=u&&d.professional_profiles.find(p=>p.user_id===u.id);return u?{id:u.id,name:u.name,specialty:p?.specialty||''}:null;})(),subscription:sub?{...sub,plan_name:d.plans.find(p=>p.id===sub.plan_id)?.name}:null,invoices,payments:d.payments.filter(p=>invoices.some(i=>i.id===p.invoice_id)),workouts:d.member_workouts.filter(w=>w.member_id===m.id),logs:d.member_workout_logs.filter(l=>l.member_id===m.id),benefits:{telemedicine:{enabled:!!flags.telemedicine&&sub?.status==='active',url:null},discounts:{enabled:!!flags.discounts&&sub?.status==='active',url:null}}};}
    async function handle(path,method='GET',b={}){
      try{
        const d=clone(get());let result={ok:true};
        if(path==='/api/member/status')return {status:200,body:{member:current(d)?state(d,current(d)).member:null,demo:true,candidates:d.members.filter(m=>m.status==='active'&&accessFor(d,m.id)).map(m=>({id:m.id,name:m.name,email:accessFor(d,m.id).email}))}};
        if(path==='/api/member/login'){
          const a=d.member_access.find(a=>a.email===clean(b.email).toLowerCase()&&a.enabled),m=a&&d.members.find(m=>m.id===a.member_id&&m.status==='active');if(!m||!await validPassword(a,b.password))fail(401,'E-mail ou senha inválidos.');d.portalMemberId=m.id;
        }else if(path.startsWith('/api/member/')){
          const m=current(d);if(!m)fail(401,'Entre na sua conta de mensalista.');
          if(path==='/api/member/state'&&method==='GET')return {status:200,body:state(d,m)};
          if(path==='/api/member/logout')d.portalMemberId=null;
          else if(path==='/api/member/profile'&&method==='PATCH'){
            const a=accessFor(d,m.id),name=required(b.name??m.name),phone=clean(b.phone??m.phone).replace(/\D/g,'');if(clean(b.phone??m.phone)&&![10,11].includes(phone.length))fail(422,'Informe telefone com DDD.');if(b.password){if(!await validPassword(a,b.current_password))fail(422,'A senha atual não confere.');if(b.password.length<12)fail(422,'Use pelo menos 12 caracteres.');a.password_digest=await hash(b.password);}m.name=name;m.phone=phone;
          }else{
            const match=path.match(/^\/api\/member\/workouts\/(\d+)\/complete$/),w=match&&d.member_workouts.find(w=>w.id===+match[1]&&w.member_id===m.id);if(!w)fail(404,'Treino não encontrado.');if(w.weekday!==new Date(today()+'T12:00:00Z').getUTCDay())fail(422,'Conclua o treino no dia programado.');if(!d.member_workout_logs.some(l=>l.workout_id===w.id&&l.completed_on===today()))d.member_workout_logs.push({member_id:m.id,workout_id:w.id,completed_on:today()});
          }
        }else{
          if(!staff(d))fail(401,'Entre como equipe para continuar.');const match=path.match(/^\/api\/members\/(\d+)\/(portal|workouts)(?:\/([0-6]))?$/),m=match&&d.members.find(m=>m.id===+match[1]);if(!m)fail(404,'Mensalista não encontrado.');const a=d.member_access.find(a=>a.member_id===m.id);
          if(method==='GET'&&match[2]==='portal')return {status:200,body:{access:a?{email:a.email,enabled:a.enabled}:null,benefits:d.member_benefits.find(x=>x.member_id===m.id)||{},professor_id:d.member_professors.find(a=>a.member_id===m.id)?.user_id||null,professionals:d.professional_profiles.map(p=>d.users.find(u=>u.id===p.user_id&&u.enabled)).filter(Boolean).map(u=>({id:u.id,name:u.name})),workouts:d.member_workouts.filter(w=>w.member_id===m.id)}};
          if(match[2]==='portal'){
            if(b.professor_id&&!d.professional_profiles.some(p=>p.user_id===+b.professor_id&&d.users.some(u=>u.id===p.user_id&&u.enabled)))fail(422,'Escolha um professor ativo.');
            if(b.professor_id!==undefined){d.member_professors=d.member_professors.filter(a=>a.member_id!==m.id);if(b.professor_id)d.member_professors.push({member_id:m.id,user_id:+b.professor_id});}
            const address=required(b.email??a?.email).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))fail(422,'E-mail inválido.');if(d.member_access.some(x=>x.member_id!==m.id&&x.email===address))fail(409,'Este e-mail já possui acesso.');if(!a&&!b.password)fail(422,'Informe a senha inicial.');let digest=a?.password_digest;if(b.password){if(b.password.length<12)fail(422,'Use pelo menos 12 caracteres.');digest=await hash(b.password);}const value={member_id:m.id,email:address,enabled:b.enabled===undefined?(a?.enabled??1):Number(!!b.enabled),...(digest?{password_digest:digest}:{})};if(a)Object.assign(a,value);else d.member_access.push(value);let flags=d.member_benefits.find(x=>x.member_id===m.id);if(!flags){flags={member_id:m.id};d.member_benefits.push(flags);}flags.telemedicine=Number(!!b.telemedicine);flags.discounts=Number(!!b.discounts);if(!value.enabled||b.password)d.portalMemberId=null;
          }else if(match[3]!==undefined){
            if(!Array.isArray(b.exercises)||b.exercises.length>30)fail(422,'Informe até 30 exercícios.');const exercises=b.exercises.map(x=>({name:required(x.name),sets:required(x.sets),reps:required(x.reps),load:clean(x.load),rest:clean(x.rest)})),previous=d.member_workouts.find(w=>w.member_id===m.id&&w.weekday===+match[3]),value={member_id:m.id,weekday:+match[3],title:required(b.title),instructor:clean(b.instructor),notes:clean(b.notes),exercises};if(previous)Object.assign(previous,value);else d.member_workouts.push({...value,id:Math.max(0,...d.member_workouts.map(w=>w.id))+1});
          }else fail(404,'Ação não encontrada.');
        }
        save(d);return {status:200,body:result};
      }catch(error){return {status:error.status||422,body:{error:error.message}};}
    }
    return {handle};
  }
  if(typeof module==='object'&&module.exports)module.exports={createMemberDemoApi};else root.createMemberDemoApi=createMemberDemoApi;
})(typeof window==='object'?window:globalThis);
