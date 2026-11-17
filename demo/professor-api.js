(function(root){
  function createProfessorDemoApi({get,save,today}){
    const fail=(status,message)=>{throw Object.assign(Error(message),{status});},clone=x=>JSON.parse(JSON.stringify(x)),clean=x=>String(x??'').trim();
    const required=x=>{const value=clean(x);if(!value||value.length>2000)fail(422,'Preencha os campos obrigatórios.');return value;};
    const hash=async value=>Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');
    const profile=(d,id)=>d.professional_profiles.find(p=>p.user_id===id);
    const teacher=d=>d.users.find(u=>u.id===d.professorUserId&&u.enabled&&profile(d,u.id));
    const safe=(d,p)=>p?{id:p.id,name:p.name,email:p.email,specialty:profile(d,p.id)?.specialty||''}:null;
    const list=d=>d.professional_profiles.map(p=>{const u=d.users.find(u=>u.id===p.user_id);return {...safe(d,u),enabled:u.enabled,member_count:d.member_professors.filter(a=>a.user_id===u.id).length};});
    const owned=(d,p,id)=>{if(!d.member_professors.some(a=>a.user_id===p.id&&a.member_id===+id))fail(404,'Aluno não encontrado entre seus acompanhamentos.');const m=d.members.find(m=>m.id===+id);if(!m)fail(404,'Aluno não encontrado.');return {id:m.id,name:m.name,phone:m.phone,joined_on:m.joined_on,status:m.status};};
    const valid=async(u,password)=>u.password_digest?u.password_digest===await hash(password||''):password==='Professor!2026';
    async function handle(path,method='GET',b={}){
      try{
        const d=clone(get());let result={ok:true},status=200;
        if(path==='/api/professor/status')return {status:200,body:{professional:safe(d,teacher(d)),demo:true,candidates:list(d).filter(p=>p.enabled)}};
        if(path==='/api/professor/login'){
          const u=d.users.find(u=>u.email===clean(b.email).toLowerCase()&&u.enabled&&profile(d,u.id));if(!u||!await valid(u,b.password))fail(401,'E-mail ou senha inválidos.');d.professorUserId=u.id;result={professional:safe(d,u)};
        }else if(path.startsWith('/api/professor/')){
          const u=teacher(d);if(!u)fail(401,'Entre na sua conta de professor.');
          if(path==='/api/professor/state'){
            const ids=d.member_professors.filter(a=>a.user_id===u.id).map(a=>a.member_id),members=d.members.filter(m=>ids.includes(m.id)).map(m=>({...owned(d,u,m.id),workout_days:d.member_workouts.filter(w=>w.member_id===m.id&&w.exercises.length).length,last_completed:d.member_workout_logs.filter(l=>l.member_id===m.id).map(l=>l.completed_on).sort().at(-1)||null}));return {status:200,body:{professional:safe(d,u),today:today(),demo:true,members,completed_today:d.member_workout_logs.filter(l=>ids.includes(l.member_id)&&l.completed_on===today()).length}};
          }
          if(path==='/api/professor/logout')d.professorUserId=null;
          else if(path==='/api/professor/profile'){
            const name=required(b.name??u.name);if(b.password){if(!await valid(u,b.current_password))fail(422,'A senha atual não confere.');if(b.password.length<12)fail(422,'Use pelo menos 12 caracteres.');u.password_digest=await hash(b.password);}u.name=name;
          }else{
            const match=path.match(/^\/api\/professor\/members\/(\d+)(?:\/workouts\/([0-6]))?$/);if(!match)fail(404,'Ação não encontrada.');const m=owned(d,u,match[1]);
            if(method==='GET'&&match[2]===undefined)return {status:200,body:{member:m,workouts:d.member_workouts.filter(w=>w.member_id===m.id),logs:d.member_workout_logs.filter(l=>l.member_id===m.id)}};
            if(method!=='POST'||match[2]===undefined)fail(404,'Ação não encontrada.');if(!Array.isArray(b.exercises)||b.exercises.length>30)fail(422,'Informe até 30 exercícios.');const value={member_id:m.id,weekday:+match[2],title:required(b.title),instructor:u.name,notes:clean(b.notes),exercises:b.exercises.map(x=>({name:required(x.name),sets:required(x.sets),reps:required(x.reps),load:clean(x.load),rest:clean(x.rest)}))},previous=d.member_workouts.find(w=>w.member_id===m.id&&w.weekday===value.weekday);if(previous)Object.assign(previous,value);else d.member_workouts.push({...value,id:Math.max(0,...d.member_workouts.map(w=>w.id))+1});
          }
        }else{
          const actor=!d.signedOut&&d.users.find(u=>u.id===d.currentUser&&u.enabled&&!profile(d,u.id));if(!actor)fail(401,'Entre na conta da equipe.');
          if(path==='/api/professionals'&&method==='GET')return {status:200,body:{professionals:list(d)}};
          const assignment=path.match(/^\/api\/members\/(\d+)\/professor$/);
          if(assignment){const id=+assignment[1];if(!d.members.some(m=>m.id===id))fail(404,'Mensalista não encontrado.');if(b.professor_id&&!list(d).some(p=>p.id===+b.professor_id&&p.enabled))fail(422,'Escolha um professor ativo.');d.member_professors=d.member_professors.filter(a=>a.member_id!==id);if(b.professor_id)d.member_professors.push({member_id:id,user_id:+b.professor_id});}
          else{
            if(actor.role!=='admin')fail(403,'Somente administradores podem gerenciar acessos profissionais.');const match=path.match(/^\/api\/professionals\/(\d+)$/),previous=match?d.users.find(u=>u.id===+match[1]&&profile(d,u.id)):null;if(match&&!previous)fail(404,'Profissional não encontrado.');if(!match&&path!=='/api/professionals')fail(404,'Ação não encontrada.');const address=required(b.email??previous?.email).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))fail(422,'Informe um e-mail válido.');if(d.users.some(u=>u.email===address&&u.id!==previous?.id))fail(409,'Este e-mail já possui acesso.');let digest=previous?.password_digest;if(!previous||b.password){if(!b.password||b.password.length<12)fail(422,'Use uma senha de pelo menos 12 caracteres.');digest=await hash(b.password);}const user={id:previous?.id||Math.max(0,...d.users.map(u=>u.id))+1,name:required(b.name??previous?.name),email:address,enabled:b.enabled===undefined?(previous?.enabled??1):Number(!!b.enabled),role:'staff',...(digest?{password_digest:digest}:{})};if(previous)Object.assign(previous,user);else d.users.push(user);const specialty=clean(b.specialty??profile(d,user.id)?.specialty),p=profile(d,user.id);if(p)p.specialty=specialty;else d.professional_profiles.push({user_id:user.id,specialty});if(!user.enabled||b.password)d.professorUserId=null;result={id:user.id};status=previous?200:201;
          }
        }
        save(d);return {status,body:result};
      }catch(error){return {status:error.status||422,body:{error:error.message}};}
    }
    return {handle,list};
  }
  if(typeof module==='object'&&module.exports)module.exports={createProfessorDemoApi};else root.createProfessorDemoApi=createProfessorDemoApi;
})(typeof window==='object'?window:globalThis);
