process.chdir('/root/ahenk-test/apps/web');
process.argv=[process.argv[0],process.argv[1],'start','-p','3104','-H','127.0.0.1'];
require('/root/ahenk-test/apps/web/node_modules/next/dist/bin/next');
