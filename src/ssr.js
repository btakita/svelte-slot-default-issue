import App from './App.svelte'
import fs from 'fs'
console.debug(App)
const app = App.render({
	hydrate: true,
})
const { html: html__app } = app
const html = `
<!doctype html>
<html>
<head>
	<meta charset='utf8'>
	<meta name='viewport' content='width=device-width'>

	<title>Svelte app</title>

	<link rel='stylesheet' href='global.css'>
	<link rel='stylesheet' href='bundle.css'>
</head>

<body>
${html__app}
<script src='bundle.js'></script>
</body>
</html>
`.trim()
fs.writeFileSync('./public/index.html', html)
console.debug(app.html)
export default app