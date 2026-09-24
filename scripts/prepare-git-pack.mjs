import { prepareGitPackLayout } from './pkgutil.mjs';

const versionArgIdx = process.argv.indexOf('--version');
const versionOverride = versionArgIdx !== -1 ? process.argv[versionArgIdx + 1] : undefined;

await prepareGitPackLayout(versionOverride);
console.log('Git pack layout ready: static/, default/');
