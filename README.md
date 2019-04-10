This demonstrates the issue https://github.com/sveltejs/svelte/issues/2394

There is a SSR build, which generates `public/index.html`, and a web server.

To run the demonstration, do the following:

```shell
npm run build
node ./public/bundle.ssr.js
npm run start
```