import {defineConfig} from 'vite';
import {readFileSync} from 'node:fs';
const pkg=JSON.parse(readFileSync(new URL('./package.json',import.meta.url)));
export default defineConfig({base:'./',define:{__BUILD_VERSION__:JSON.stringify(pkg.version),__BUILD_COMMIT__:JSON.stringify(process.env.GITHUB_SHA?.slice(0,7)||'local')}});
