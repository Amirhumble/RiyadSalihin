import { register } from 'node:module';

// App sources are ESM but package.json does not set "type": "module"
// (Expo owns that). This loader treats src/*.js as ESM for the test run only.
register('./esm-loader.mjs', {
  parentURL: import.meta.url,
});
