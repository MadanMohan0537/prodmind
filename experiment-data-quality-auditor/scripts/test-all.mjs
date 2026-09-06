import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const modules=['feedback_collector','sentiment_analyzer','topic_modeler','feature_request_detector','voice_of_customer_dashboard','prioritization_engine','experiment-data-quality-auditor','product_outcome_monitor'];
let failed=false;
for(const name of modules){
  console.log(`\nTesting ${name}`);
  const result=spawnSync(process.execPath,['--test'],{cwd:`${root}${name}`,stdio:'inherit'});
  if(result.status!==0)failed=true;
}
process.exitCode=failed?1:0;
