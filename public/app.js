import { deduplicate, normalizeRecord, parseCsv } from "./feedback.js";

const seed = [
  { text: "The dashboard is fast and easy to understand", source: "Interview", customer: "Acme" },
  { text: "Please add CSV exports for weekly reports", source: "Support", customer: "Northstar" },
  { text: "The mobile page crashes when I open filters", source: "App review", customer: "Anonymous" },
  { text: "I would like a way to merge duplicate requests", source: "Survey", customer: "Orbit" }
];
const key = "prodmind.feedback.v1";
let feedback = load();
function load(){try{return JSON.parse(localStorage.getItem(key))||seed.map(normalizeRecord)}catch{return seed.map(normalizeRecord)}}
function save(){localStorage.setItem(key,JSON.stringify(feedback))}
function escapeHtml(value){return value.replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char])}
function render(){const counts=feedback.reduce((acc,item)=>({...acc,[item.sentiment]:(acc[item.sentiment]||0)+1}),{});document.querySelector("#total").textContent=feedback.length;document.querySelector("#requests").textContent=feedback.filter(x=>x.intent==="feature-request").length;document.querySelector("#negative").textContent=counts.negative||0;document.querySelector("#sources").textContent=new Set(feedback.map(x=>x.source)).size;document.querySelector("#feedback-list").innerHTML=feedback.map(item=>`<article class="feedback-card"><div class="card-top"><span class="tag ${item.sentiment}">${item.sentiment}</span><span class="tag">${item.intent.replace("-"," ")}</span></div><p>${escapeHtml(item.text)}</p><small>${escapeHtml(item.source)} · ${escapeHtml(item.customer)}</small></article>`).join("")||`<div class="empty">No feedback yet. Add an entry or import a file.</div>`}
document.querySelector("#feedback-form").addEventListener("submit",event=>{event.preventDefault();const item=normalizeRecord(Object.fromEntries(new FormData(event.currentTarget)),feedback.length);if(item)feedback=deduplicate([item,...feedback]);save();render();event.currentTarget.reset()});
document.querySelector("#file-input").addEventListener("change",async event=>{const file=event.target.files[0];if(!file)return;const content=await file.text();let records;try{records=file.name.endsWith(".json")?JSON.parse(content):parseCsv(content)}catch{document.querySelector("#import-status").textContent="The file could not be parsed.";return}if(!Array.isArray(records))records=[records];const before=feedback.length;feedback=deduplicate([...records.map(normalizeRecord).filter(Boolean),...feedback]);save();render();document.querySelector("#import-status").textContent=`${feedback.length-before} new records imported.`;event.target.value=""});
document.querySelector("#reset").addEventListener("click",()=>{feedback=seed.map(normalizeRecord);save();render();document.querySelector("#import-status").textContent="Demo data restored."});
render();
