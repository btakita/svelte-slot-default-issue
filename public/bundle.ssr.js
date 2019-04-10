'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var fs = _interopDefault(require('fs'));

function run(fn) {
	return fn();
}

function blank_object() {
	return Object.create(null);
}

function run_all(fns) {
	fns.forEach(run);
}

let current_component;

function set_current_component(component) {
	current_component = component;
}

const escaped = {
	'"': '&quot;',
	"'": '&#39;',
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;'
};

function escape(html) {
	return String(html).replace(/["'&<>]/g, match => escaped[match]);
}

function validate_component(component, name) {
	if (!component || !component.$$render) {
		if (name === 'svelte:component') name += ' this={...}';
		throw new Error(`<${name}> is not a valid SSR component. You may need to review your build config to ensure that dependencies are compiled, rather than imported as pre-compiled modules`);
	}

	return component;
}

let on_destroy;

function create_ssr_component(fn) {
	function $$render(result, props, bindings, slots) {
		const parent_component = current_component;

		const $$ = {
			on_destroy,
			context: new Map(parent_component ? parent_component.$$.context : []),

			// these will be immediately discarded
			on_mount: [],
			before_render: [],
			after_render: [],
			callbacks: blank_object()
		};

		set_current_component({ $$ });

		const html = fn(result, props, bindings, slots);

		set_current_component(parent_component);
		return html;
	}

	return {
		render: (props = {}, options = {}) => {
			on_destroy = [];

			const result = { head: '', css: new Set() };
			const html = $$render(result, props, {}, options);

			run_all(on_destroy);

			return {
				html,
				css: {
					code: Array.from(result.css).map(css => css.code).join('\n'),
					map: null // TODO
				},
				head: result.head
			};
		},

		$$render
	};
}

/* src/Component.svelte generated by Svelte v3.0.0-beta.23 */

const Component = create_ssr_component(($$result, $$props, $$bindings, $$slots) => {
	let { href } = $$props;

	if ($$props.href === void 0 && $$bindings.href && href !== void 0) $$bindings.href(href);

	return `<div class="Component">
		${$$slots.test ? $$slots.test() : `
			<div class="test__Component">
				${$$slots.test1 ? $$slots.test1() : `
					<a${(v => v == null ? "" : ` href="${escape(href)}"`)(href)}>
						${$$slots.test2 ? $$slots.test2() : `
							default value
						`}
					</a>
				`}
			</div>
		`}
		${$$slots.default ? $$slots.default() : ``}
	</div>`;
});

/* src/App.svelte generated by Svelte v3.0.0-beta.23 */

const App = create_ssr_component(($$result, $$props, $$bindings, $$slots) => {
	return `${validate_component(Component, 'Component').$$render($$result, { href: "." }, {}, {
		default: () => `
		`,
		test2: () => `<div slot="test2">
			override
		</div>
		Rest of slot
	`
	})}`;
});

console.debug(App);
const app = App.render({
	hydrate: true,
});
const { html: html__app } = app;
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
`.trim();
fs.writeFileSync('./public/index.html', html);
console.debug(app.html);

module.exports = app;
//# sourceMappingURL=bundle.ssr.js.map