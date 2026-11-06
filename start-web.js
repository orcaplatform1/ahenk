process.chdir('/root/ahenk/apps/web');
process.argv = [process.argv[0], process.argv[1], 'start', '-p', '3004'];
require(require.resolve('next/dist/bin/next', { paths: ['/root/ahenk/apps/web'] }));
