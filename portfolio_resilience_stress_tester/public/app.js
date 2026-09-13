const $=selector=>document.querySelector(selector);
const element=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
const details=(label,value)=>{const node=element('details');node.append(element('summary',label),element('pre',JSON.stringify(value,null,2)));return node;};

$('#run').onclick=async()=>{
  const file=$('#file').files[0],notice=$('#notice');notice.textContent='';
  if(!file||file.size>2_000_000){notice.textContent='Choose a JSON file under 2 MB.';return;}
  try{
    const response=await fetch('/api/stress',{method:'POST',headers:{Authorization:`Bearer ${$('#token').value}`,'Content-Type':'application/json'},body:await file.text()});
    const data=await response.json();if(!response.ok)throw new Error(data.error);render(data);notice.textContent='Portfolio stress test complete.';
  }catch(error){notice.textContent=error.message;}
};

function render(data){
  const parent=$('#results');parent.replaceChildren();
  const metrics=element('div',undefined,'metrics');
  for(const[label,value]of Object.entries({'Portfolio status':data.status,'Mean resilience':data.summary.meanResilienceScore,'Weakest scenario':data.summary.weakestScenarioId,'Critical scenarios':data.summary.critical})){const card=element('article');card.append(element('strong',String(value)),element('span',label));metrics.append(card);}
  parent.append(metrics,element('p',data.method,'muted'));
  for(const scenario of data.scenarios){const card=element('article',undefined,`scenario ${scenario.status}`);card.append(element('h2',scenario.name),element('p',`${scenario.status} · score ${scenario.resilienceScore} · overrun ${scenario.capacityOverrun}`),details('Inspect assumptions, allocation, and at-risk items',scenario));parent.append(card);}
}
