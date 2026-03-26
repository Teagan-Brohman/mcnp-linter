import * as esbuild from 'esbuild';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const serverConfig = {
  entryPoints: ['server/src/server.ts'],
  bundle: true,
  outfile: 'server/out/server.js',
  format: 'cjs',
  platform: 'node',
  target: 'es2020',
  external: ['vscode'],
  sourcemap: !production,
  minify: production,
  nodePaths: ['server/node_modules'],
};

const clientConfig = {
  entryPoints: ['client/src/extension.ts'],
  bundle: true,
  outfile: 'client/out/extension.js',
  format: 'cjs',
  platform: 'node',
  target: 'es2020',
  external: ['vscode'],
  sourcemap: !production,
  minify: production,
  nodePaths: ['client/node_modules'],
};

async function main() {
  if (watch) {
    const [serverCtx, clientCtx] = await Promise.all([
      esbuild.context(serverConfig),
      esbuild.context(clientConfig),
    ]);
    await Promise.all([serverCtx.watch(), clientCtx.watch()]);
    console.log('Watching for changes...');
  } else {
    await Promise.all([
      esbuild.build(serverConfig),
      esbuild.build(clientConfig),
    ]);
    console.log('Build complete.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
