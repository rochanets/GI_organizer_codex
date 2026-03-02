let state = {};
let charImageData = null;
let matImageData = null;

const tabs = document.querySelectorAll('.tabs button');
tabs.forEach(b => b.onclick = () => { tabs.forEach(x=>x.classList.remove('active')); b.classList.add('active'); document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active')); document.getElementById(b.dataset.tab).classList.add('active');});

async function api(url, method='GET', body) {
  const r = await fetch(url, {method, headers:{'Content-Type':'application/json'}, body: body?JSON.stringify(body):undefined});
  return r.json();
}
async function load(){ state = await api('/api/state'); renderAll(); }

function imgOrBlank(data, border='#8de28d'){ return data?`<img class="thumb" src="${data}" style="border-color:${border}">`:`<div class="thumb" style="border-color:${border}"></div>`; }

function renderCharacters(){
  charList.innerHTML = state.characters.map(c=>`<div class='list-row'>${imgOrBlank(c.image)}<span>${c.element}</span><b>${c.name}</b><span>${c.role}</span><button onclick='editStub()'>Editar</button><button onclick='del("characters",${c.id})'>Excluir</button></div>`).join('');
}

function renderMaterials(){
  matList.innerHTML = `<div class='table'>${state.materials.map(m=>`<div class='row'>${imgOrBlank(m.image,m.frame_color)}<span>${m.item_type}</span><span>${m.name}</span><span>Nv.${m.level}</span>${m.name==='Mora'?`<input type='number' step='0.01' value='${m.value}' onchange='setMat(${m.id},this.value)'>`:`<input type='number' ${m.is_locked?'disabled':''} value='${m.value}' onchange='setMat(${m.id},this.value)'>`}<button onclick='del("materials",${m.id})'>Excluir</button></div>`).join('')}</div>`;
}

function renderTemplates(){
  const rowsPattern = ['Boss','Gem','Gem','Gem','Gem','Nature','Enemy','Enemy','Enemy','EXP','talent','talent','talent','Enemy','Enemy','Enemy','Mora'];
  templates.innerHTML = state.farm_templates.map(t=>{
    const rows = state.farm_template_rows.filter(r=>r.template_id===t.id).sort((a,b)=>a.row_order-b.row_order);
    return `<div class='panel glass'><h4>${t.name}</h4><div class='table'>${rows.map((r,i)=>`<div class='row'><span>${rowsPattern[i]}</span><input value='${r.item_name||''}' onchange='updTemplateRow(${r.id},"item_name",this.value)'><input type='number' value='${r.required||0}' onchange='updTemplateRow(${r.id},"required",this.value)'><span>Current</span><span>Needed</span></div>`).join('')}</div><button onclick='del("farm_templates",${t.id})'>Excluir Template</button></div>`;
  }).join('');
  fcTemplate.innerHTML = state.farm_templates.map(t=>`<option value='${t.id}'>${t.name}</option>`).join('');
}

function teamBg(chars){
  const map={Pyro:'#ff8a7c',Hydro:'#7cd2ff',Electro:'#bea7ff',Cryo:'#b8f3ff',Anemo:'#98ffc6',Geo:'#ffd08d',Dendro:'#95db7e'};
  const colors = chars.map(c=>map[c?.element]||'#ffffff').slice(0,4);
  return `linear-gradient(120deg,${colors.join(',')})`;
}

function renderTeams(){
  teamsGrid.innerHTML = state.teams.map(t=>{
    const get=(sid)=>state.characters.find(c=>c.id===t[sid]);
    const chars=[get('slot1'),get('slot2'),get('slot3'),get('slot4')];
    const options=(rule,val)=>`<option value=''>+</option>`+state.characters.filter(c=>rule(c.role)).map(c=>`<option value='${c.id}' ${val===c.id?'selected':''}>${c.name}</option>`).join('');
    return `<div class='team glass' style='background:${teamBg(chars)}66'><div class='members'>
      <div class='slot'><select onchange='saveTeam(${t.id},"slot1",this.value)'>${options(r=>r==='DPS',t.slot1)}</select></div>
      <div class='slot'><select onchange='saveTeam(${t.id},"slot2",this.value)'>${options(r=>r==='SUBDPS'||r==='Support',t.slot2)}</select></div>
      <div class='slot'><select onchange='saveTeam(${t.id},"slot3",this.value)'>${options(r=>r==='Support'||r==='Sustainer',t.slot3)}</select></div>
      <div class='slot'><select onchange='saveTeam(${t.id},"slot4",this.value)'>${options(r=>r==='Support'||r==='Sustainer',t.slot4)}</select></div>
    </div><input class='team-title' value='${t.title}' onchange='saveTeam(${t.id},"title",this.value)'/></div>`;
  }).join('');
}

function renderFarmCards(){
  const cardsByCycle = {};
  state.farm_cards.forEach(c=>{cardsByCycle[c.cycle]=cardsByCycle[c.cycle]||[];cardsByCycle[c.cycle].push(c.id);});
  const neededPerCycle = {};
  state.farm_card_rows.forEach(r=>{
    const card=state.farm_cards.find(c=>c.id===r.farm_card_id); if(!card) return;
    const k=`${card.cycle}::${r.item_name}`; neededPerCycle[k]=(neededPerCycle[k]||0)+Number(r.required||0);
  });
  farmCards.innerHTML = state.farm_cards.map(c=>{
    const rows = state.farm_card_rows.filter(r=>r.farm_card_id===c.id).sort((a,b)=>a.row_order-b.row_order);
    const character = state.characters.find(x=>x.id===c.character_id);
    return `<div class='card panel glass'><div><h4>${c.name} (${c.cycle})</h4>${rows.map(r=>{
      const needed=(neededPerCycle[`${c.cycle}::${r.item_name}`]||0)-Number(r.current||0);
      return `<div class='list-row ${needed>0?'needed-ok':'needed-bad'}'><span>${r.item_type}</span><span>${r.item_name||''}</span><input type='number' value='${r.required}' onchange='setFarmRequired(${r.id},this.value)'><input type='number' value='${r.current}' onchange='setFarmCurrent(${r.id},"${(r.item_name||'').replaceAll('"','')}" ,this.value)'><b>${needed.toFixed(2)}</b></div>`;
    }).join('')}<button onclick='del("farm_cards",${c.id})'>Excluir card</button></div><div>${imgOrBlank(character?.image)}<p>${character?.name||''}</p></div></div>`;
  }).join('');
}

function renderAll(){
  renderCharacters(); renderMaterials(); renderTemplates(); renderFarmCards(); renderTeams();
  fcCharacter.innerHTML = state.characters.map(c=>`<option value='${c.id}'>${c.name}</option>`).join('');
}

async function del(table,id){ await api(`/api/delete?table=${table}&id=${id}`); await load(); }
function editStub(){alert('Edição rápida pode ser feita excluindo e recriando no MVP.');}

charImage.onchange=async e=>charImageData=await fileToData(e.target.files[0]);
matImage.onchange=async e=>matImageData=await fileToData(e.target.files[0]);

document.addEventListener('paste', async (e)=>{
  const file=[...e.clipboardData.items].find(i=>i.type.startsWith('image/'));
  if(file){ const blob=file.getAsFile(); const data=await fileToData(blob); if(document.activeElement.closest('#charForm')) charImageData=data; else matImageData=data; }
});

async function fileToData(f){ if(!f) return null; return new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(f);}); }

charForm.onsubmit=async e=>{e.preventDefault(); await api('/api/save','POST',{entity:'character',values:{image:charImageData,name:charName.value,element:charElement.value,role:charRole.value}}); charForm.reset(); charImageData=null; await load();};
matForm.onsubmit=async e=>{e.preventDefault(); await api('/api/save','POST',{entity:'material',values:{image:matImageData,name:matName.value,item_type:matType.value,level:Number(matLevel.value)}}); matForm.reset(); matImageData=null; await load();};

async function setMat(id,value){ await api('/api/save','POST',{entity:'update_material_values',values:{items:[{id,value:Number(value)}],expMineral:getExpVals()}}); await load(); }
recalcBtn.onclick=async()=>{ await api('/api/save','POST',{entity:'update_material_values',values:{items:[],expMineral:getExpVals()}}); await load(); };
function getExpVals(){ return {wanderer:expWanderer.value,adventurer:expAdventurer.value,hero:expHero.value,ore:expOre.value,fine:expFine.value,mystic:expMystic.value}; }

addTemplate.onclick=async()=>{
  const name=prompt('Nome do farm template'); if(!name) return;
  const pattern=['Boss','Gem','Gem','Gem','Gem','Nature','Enemy','Enemy','Enemy','EXP','talent','talent','talent','Enemy','Enemy','Enemy','Mora'];
  await api('/api/save','POST',{entity:'farm_template',values:{name,rows:pattern.map(p=>({item_type:p,item_name:'',required:0}))}}); await load();
};

async function updTemplateRow(id,field,val){
  const row=state.farm_template_rows.find(r=>r.id===id); row[field]=field==='required'?Number(val):val;
  const template=state.farm_templates.find(t=>t.id===row.template_id);
  const rows=state.farm_template_rows.filter(r=>r.template_id===template.id).sort((a,b)=>a.row_order-b.row_order);
  await api('/api/delete?table=farm_templates&id='+template.id);
  await api('/api/save','POST',{entity:'farm_template',values:{name:template.name,rows:rows}});
  await load();
}

addFarmCard.onclick=()=>farmCardModal.showModal();
fcClose.onclick=()=>farmCardModal.close();
fcCreate.onclick=async()=>{
  const template=state.farm_templates.find(t=>t.id===Number(fcTemplate.value));
  const rows=state.farm_template_rows.filter(r=>r.template_id===template.id).sort((a,b)=>a.row_order-b.row_order).map(r=>{
    const current = (state.materials.find(m=>m.name===r.item_name)||{}).value||0;
    return {item_type:r.item_type,item_name:r.item_name,required:r.required,current};
  });
  await api('/api/save','POST',{entity:'farm_card',values:{character_id:Number(fcCharacter.value),cycle:fcCycle.value||'Ciclo 1',template_id:template.id,name:template.name,rows}});
  farmCardModal.close(); await load();
};

async function setFarmCurrent(id,itemName,val){ await api('/api/save','POST',{entity:'update_farm_currents',values:{rows:[{id,current:Number(val),item_name:itemName}]}}); await load(); }
async function setFarmRequired(id,val){
  const row=state.farm_card_rows.find(r=>r.id===id); row.required=Number(val);
  const card=state.farm_cards.find(c=>c.id===row.farm_card_id);
  const rows=state.farm_card_rows.filter(r=>r.farm_card_id===card.id).sort((a,b)=>a.row_order-b.row_order);
  await api('/api/delete?table=farm_cards&id='+card.id);
  await api('/api/save','POST',{entity:'farm_card',values:{character_id:card.character_id,cycle:card.cycle,template_id:card.template_id,name:card.name,rows}});
  await load();
}

async function saveTeam(id,field,value){
  const t=state.teams.find(x=>x.id===id); t[field]=field==='title'?value:Number(value)||null;
  await api('/api/save','POST',{entity:'team',values:t}); await load();
}

window.del=del;window.editStub=editStub;window.setMat=setMat;window.updTemplateRow=updTemplateRow;window.setFarmCurrent=setFarmCurrent;window.setFarmRequired=setFarmRequired;window.saveTeam=saveTeam;
load();
