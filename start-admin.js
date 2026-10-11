process.chdir('/root/ahenk/apps/admin');
process.argv = [process.argv[0], process.argv[1], 'start', '-p', '3005'];
require('/root/ahenk/node_modules/.pnpm/next@14.2.5_@babel+core@7.29.7_supports-color@8.1.1__@opentelemetry+api@1.9.1_react-dom_11c486e6c26f354f9fce521a301a309b/node_modules/next/dist/bin/next');
