const path='/root/ahenk-test';
const DOTENV=require('child_process').execSync("ls -d /root/ahenk-test/node_modules/.pnpm/dotenv@16*/node_modules/dotenv/config.js").toString().trim().split('\n')[0];
module.exports={apps:[{
 name:'ahenk-test-api',cwd:path+'/backend',script:path+'/backend/dist/src/main.js',node_args:`-r ${DOTENV}`,
 env:{NODE_ENV:'production',DOTENV_CONFIG_PATH:path+'/backend/.env.test',HOST:'127.0.0.1'},autorestart:false
}]};
