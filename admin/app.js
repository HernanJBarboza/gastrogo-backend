const base = '';
let token = null;
const el = (id)=>document.getElementById(id);

async function loginOrRegister(){
  const email = el('email').value.trim();
  const password = el('password').value.trim();
  if(!email||!password){ el('auth-msg').innerText='email+password required'; return }
  // try register, if exists then login
  try{
    const res = await fetch(base+'/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})});
    const j=await res.json(); if(res.ok){ token=j.token; afterAuth(); return }
    // if 409 then login
    if(j.error==='user_exists'){
      const r2=await fetch(base+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})}); const j2=await r2.json(); if(r2.ok){ token=j2.token; afterAuth(); return } else el('auth-msg').innerText=j2.error||JSON.stringify(j2);
    } else el('auth-msg').innerText=j.error||JSON.stringify(j);
  }catch(e){ el('auth-msg').innerText=e.message }
}

function afterAuth(){
  el('auth').style.display='none'; el('main').style.display='block'; loadMenus();
}

async function loadMenus(){
  const res = await fetch(base+'/menus'); const j=await res.json(); const ul=el('menus'); ul.innerHTML=''; j.forEach(m=>{ const li=document.createElement('li'); li.innerText=m.title+' ('+m.id+')'; ul.appendChild(li) });
}

async function createMenu(){
  const title = el('m-title').value.trim(); let items=[]; try{ items = JSON.parse(el('m-items').value||'[]') }catch(e){ el('msg').innerText='Invalid items JSON'; return }
  const templateId = el('m-template').value.trim();
  const res = await fetch(base+'/menus',{method:'POST',headers:{'content-type':'application/json','x-api-key':'secret-api-key'},body:JSON.stringify({title,items,templateId})});
  const j=await res.json(); if(res.ok){ el('msg').innerText='Created '+j.id; loadMenus() } else el('msg').innerText=j.error||JSON.stringify(j);
}

el('login').addEventListener('click',loginOrRegister);
el('refresh').addEventListener('click',loadMenus);
el('create-menu').addEventListener('click',createMenu);
