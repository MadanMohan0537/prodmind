import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readdirSync} from 'node:fs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const modules=['feedback_collector','sentiment_analyzer','topic_modeler','feature_request_detector','voice_of_customer_dashboard','prioritization_engine','experiment-data-quality-auditor','product_outcome_monitor','product_learning_memory'];
const testFiles=directory=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?testFiles(`${directory}/${entry.name}`):(entry.name.endsWith('.test.js')?[`${directory}/${entry.name}`]:[]));
let failed=false;
for(const name of modules){
  console.log(`\nTesting ${name}`);
  const directory=`${root}${name}`;const result=spawnSync(process.execPath,['--test',...testFiles(directory)],{cwd:directory,stdio:'inherit'});
  if(result.status!==0)failed=true;
}
process.exitCode=failed?1:0;
