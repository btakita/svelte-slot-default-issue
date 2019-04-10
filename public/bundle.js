var app = (function () {
	'use strict';

	function noop() {}

	function assign(tar, src) {
		for (const k in src) tar[k] = src[k];
		return tar;
	}

	function add_location(element, file, line, column, char) {
		element.__svelte_meta = {
			loc: { file, line, column, char }
		};
	}

	function run(fn) {
		return fn();
	}

	function blank_object() {
		return Object.create(null);
	}

	function run_all(fns) {
		fns.forEach(run);
	}

	function is_function(thing) {
		return typeof thing === 'function';
	}

	function safe_not_equal(a, b) {
		return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
	}

	function create_slot(definition, ctx, fn) {
		if (definition) {
			const slot_ctx = get_slot_context(definition, ctx, fn);
			return definition[0](slot_ctx);
		}
	}

	function get_slot_context(definition, ctx, fn) {
		return definition[1]
			? assign({}, assign(ctx.$$scope.ctx, definition[1](fn ? fn(ctx) : {})))
			: ctx.$$scope.ctx;
	}

	function get_slot_changes(definition, ctx, changed, fn) {
		return definition[1]
			? assign({}, assign(ctx.$$scope.changed || {}, definition[1](fn ? fn(changed) : {})))
			: ctx.$$scope.changed || {};
	}

	function append(target, node) {
		target.appendChild(node);
	}

	function insert(target, node, anchor) {
		target.insertBefore(node, anchor);
	}

	function detach(node) {
		node.parentNode.removeChild(node);
	}

	function element(name) {
		return document.createElement(name);
	}

	function svg_element(name) {
		return document.createElementNS('http://www.w3.org/2000/svg', name);
	}

	function text(data) {
		return document.createTextNode(data);
	}

	function space() {
		return text(' ');
	}

	function attr(node, attribute, value) {
		if (value == null) node.removeAttribute(attribute);
		else node.setAttribute(attribute, value);
	}

	function children(element) {
		return Array.from(element.childNodes);
	}

	function claim_element(nodes, name, attributes, svg) {
		for (let i = 0; i < nodes.length; i += 1) {
			const node = nodes[i];
			if (node.nodeName === name) {
				for (let j = 0; j < node.attributes.length; j += 1) {
					const attribute = node.attributes[j];
					if (!attributes[attribute.name]) node.removeAttribute(attribute.name);
				}
				return nodes.splice(i, 1)[0]; // TODO strip unwanted attributes
			}
		}

		return svg ? svg_element(name) : element(name);
	}

	function claim_text(nodes, data) {
		for (let i = 0; i < nodes.length; i += 1) {
			const node = nodes[i];
			if (node.nodeType === 3) {
				node.data = data;
				return nodes.splice(i, 1)[0];
			}
		}

		return text(data);
	}

	let current_component;

	function set_current_component(component) {
		current_component = component;
	}

	const dirty_components = [];

	let update_promise;
	const binding_callbacks = [];
	const render_callbacks = [];

	function schedule_update() {
		if (!update_promise) {
			update_promise = Promise.resolve();
			update_promise.then(flush);
		}
	}

	function add_render_callback(fn) {
		render_callbacks.push(fn);
	}

	function flush() {
		const seen_callbacks = new Set();

		do {
			// first, call beforeUpdate functions
			// and update components
			while (dirty_components.length) {
				const component = dirty_components.shift();
				set_current_component(component);
				update(component.$$);
			}

			while (binding_callbacks.length) binding_callbacks.shift()();

			// then, once components are updated, call
			// afterUpdate functions. This may cause
			// subsequent updates...
			while (render_callbacks.length) {
				const callback = render_callbacks.pop();
				if (!seen_callbacks.has(callback)) {
					callback();

					// ...so guard against infinite loops
					seen_callbacks.add(callback);
				}
			}
		} while (dirty_components.length);

		update_promise = null;
	}

	function update($$) {
		if ($$.fragment) {
			$$.update($$.dirty);
			run_all($$.before_render);
			$$.fragment.p($$.dirty, $$.ctx);
			$$.dirty = null;

			$$.after_render.forEach(add_render_callback);
		}
	}

	function mount_component(component, target, anchor) {
		const { fragment, on_mount, on_destroy, after_render } = component.$$;

		fragment.m(target, anchor);

		// onMount happens after the initial afterUpdate. Because
		// afterUpdate callbacks happen in reverse order (inner first)
		// we schedule onMount callbacks before afterUpdate callbacks
		add_render_callback(() => {
			const new_on_destroy = on_mount.map(run).filter(is_function);
			if (on_destroy) {
				on_destroy.push(...new_on_destroy);
			} else {
				// Edge case - component was destroyed immediately,
				// most likely as a result of a binding initialising
				run_all(new_on_destroy);
			}
			component.$$.on_mount = [];
		});

		after_render.forEach(add_render_callback);
	}

	function destroy(component, detaching) {
		if (component.$$) {
			run_all(component.$$.on_destroy);
			component.$$.fragment.d(detaching);

			// TODO null out other refs, including component.$$ (but need to
			// preserve final state?)
			component.$$.on_destroy = component.$$.fragment = null;
			component.$$.ctx = {};
		}
	}

	function make_dirty(component, key) {
		if (!component.$$.dirty) {
			dirty_components.push(component);
			schedule_update();
			component.$$.dirty = {};
		}
		component.$$.dirty[key] = true;
	}

	function init(component, options, instance, create_fragment, not_equal$$1, prop_names) {
		const parent_component = current_component;
		set_current_component(component);

		const props = options.props || {};

		const $$ = component.$$ = {
			fragment: null,
			ctx: null,

			// state
			props: prop_names,
			update: noop,
			not_equal: not_equal$$1,
			bound: blank_object(),

			// lifecycle
			on_mount: [],
			on_destroy: [],
			before_render: [],
			after_render: [],
			context: new Map(parent_component ? parent_component.$$.context : []),

			// everything else
			callbacks: blank_object(),
			dirty: null
		};

		let ready = false;

		$$.ctx = instance
			? instance(component, props, (key, value) => {
				if ($$.bound[key]) $$.bound[key](value);

				if ($$.ctx) {
					const changed = not_equal$$1(value, $$.ctx[key]);
					if (ready && changed) {
						make_dirty(component, key);
					}

					$$.ctx[key] = value;
					return changed;
				}
			})
			: props;

		$$.update();
		ready = true;
		run_all($$.before_render);
		$$.fragment = create_fragment($$.ctx);

		if (options.target) {
			if (options.hydrate) {
				$$.fragment.l(children(options.target));
			} else {
				$$.fragment.c();
			}

			if (options.intro && component.$$.fragment.i) component.$$.fragment.i();
			mount_component(component, options.target, options.anchor);
			flush();
		}

		set_current_component(parent_component);
	}

	class SvelteComponent {
		$destroy() {
			destroy(this, true);
			this.$destroy = noop;
		}

		$on(type, callback) {
			const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
			callbacks.push(callback);

			return () => {
				const index = callbacks.indexOf(callback);
				if (index !== -1) callbacks.splice(index, 1);
			};
		}

		$set() {
			// overridden by instance, if it has props
		}
	}

	class SvelteComponentDev extends SvelteComponent {
		constructor(options) {
			if (!options || (!options.target && !options.$$inline)) {
				throw new Error(`'target' is a required option`);
			}

			super();
		}

		$destroy() {
			super.$destroy();
			this.$destroy = () => {
				console.warn(`Component was already destroyed`); // eslint-disable-line no-console
			};
		}
	}

	/* src/Component.svelte generated by Svelte v3.0.0-beta.23 */

	const file = "src/Component.svelte";

	function create_fragment(ctx) {
		var div1, div0, a, t0, t1, current;

		const test_slot_1 = ctx.$$slots.test;
		const test_slot = create_slot(test_slot_1, ctx, null);

		const test1_slot_1 = ctx.$$slots.test1;
		const test1_slot = create_slot(test1_slot_1, ctx, null);

		const test2_slot_1 = ctx.$$slots.test2;
		const test2_slot = create_slot(test2_slot_1, ctx, null);

		const default_slot_1 = ctx.$$slots.default;
		const default_slot = create_slot(default_slot_1, ctx, null);

		return {
			c: function create() {
				div1 = element("div");

				if (!test_slot) {
					div0 = element("div");

					if (!test1_slot) {
						a = element("a");

						if (!test2_slot) {
							t0 = text("default value");
						}

						if (test2_slot) test2_slot.c();
					}

					if (test1_slot) test1_slot.c();
				}

				if (test_slot) test_slot.c();
				t1 = space();

				if (default_slot) default_slot.c();
				this.h();
			},

			l: function claim(nodes) {
				div1 = claim_element(nodes, "DIV", { class: true }, false);
				var div1_nodes = children(div1);

				div0 = claim_element(div1_nodes, "DIV", { class: true }, false);
				var div0_nodes = children(div0);

				a = claim_element(div0_nodes, "A", { href: true }, false);
				var a_nodes = children(a);

				t0 = claim_text(a_nodes, "default value");
				if (test2_slot) test2_slot.l(a_nodes);
				a_nodes.forEach(detach);
				if (test1_slot) test1_slot.l(div0_nodes);
				div0_nodes.forEach(detach);
				if (test_slot) test_slot.l(div1_nodes);
				t1 = claim_text(div1_nodes, "\n\t");
				if (default_slot) default_slot.l(div1_nodes);
				div1_nodes.forEach(detach);
				this.h();
			},

			h: function hydrate() {
				if (!test_slot) {
					if (!test1_slot) {
						a.href = ctx.href;
						add_location(a, file, 8, 4, 132);
					}

					div0.className = "test__Component";
					add_location(div0, file, 6, 2, 79);
				}

				div1.className = "Component";
				add_location(div1, file, 4, 0, 37);
			},

			m: function mount(target, anchor) {
				insert(target, div1, anchor);

				if (!test_slot) {
					append(div1, div0);

					if (!test1_slot) {
						append(div0, a);

						if (!test2_slot) {
							append(a, t0);
						}

						else {
							test2_slot.m(a, null);
						}
					}

					else {
						test1_slot.m(div0, null);
					}
				}

				else {
					test_slot.m(div1, null);
				}

				append(div1, t1);

				if (default_slot) {
					default_slot.m(div1, null);
				}

				current = true;
			},

			p: function update(changed, ctx) {
				if (!test_slot) {
					if (!test1_slot) {
						if (test2_slot && test2_slot.p && changed.$$scope) {
							test2_slot.p(get_slot_changes(test2_slot_1, ctx, changed,), get_slot_context(test2_slot_1, ctx, null));
						}

						if (!current || changed.href) {
							a.href = ctx.href;
						}
					}

					if (test1_slot && test1_slot.p && changed.$$scope) {
						test1_slot.p(get_slot_changes(test1_slot_1, ctx, changed,), get_slot_context(test1_slot_1, ctx, null));
					}
				}

				if (test_slot && test_slot.p && changed.$$scope) {
					test_slot.p(get_slot_changes(test_slot_1, ctx, changed,), get_slot_context(test_slot_1, ctx, null));
				}

				if (default_slot && default_slot.p && changed.$$scope) {
					default_slot.p(get_slot_changes(default_slot_1, ctx, changed,), get_slot_context(default_slot_1, ctx, null));
				}
			},

			i: function intro(local) {
				if (current) return;
				if (test2_slot && test2_slot.i) test2_slot.i(local);
				if (test1_slot && test1_slot.i) test1_slot.i(local);
				if (test_slot && test_slot.i) test_slot.i(local);
				if (default_slot && default_slot.i) default_slot.i(local);
				current = true;
			},

			o: function outro(local) {
				if (test2_slot && test2_slot.o) test2_slot.o(local);
				if (test1_slot && test1_slot.o) test1_slot.o(local);
				if (test_slot && test_slot.o) test_slot.o(local);
				if (default_slot && default_slot.o) default_slot.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div1);
				}

				if (!test_slot) {
					if (!test1_slot) {
						if (test2_slot) test2_slot.d(detaching);
					}

					if (test1_slot) test1_slot.d(detaching);
				}

				if (test_slot) test_slot.d(detaching);

				if (default_slot) default_slot.d(detaching);
			}
		};
	}

	function instance($$self, $$props, $$invalidate) {
		let { href } = $$props;

		let { $$slots = {}, $$scope } = $$props;

		$$self.$set = $$props => {
			if ('href' in $$props) $$invalidate('href', href = $$props.href);
			if ('$$scope' in $$props) $$invalidate('$$scope', $$scope = $$props.$$scope);
		};

		return { href, $$slots, $$scope };
	}

	class Component extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance, create_fragment, safe_not_equal, ["href"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.href === undefined && !('href' in props)) {
				console.warn("<Component> was created without expected prop 'href'");
			}
		}

		get href() {
			throw new Error("<Component>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set href(value) {
			throw new Error("<Component>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src/App.svelte generated by Svelte v3.0.0-beta.23 */

	const file$1 = "src/App.svelte";

	// (6:1) <div slot=test2>
	function create_test2_slot(ctx) {
		var div, t;

		return {
			c: function create() {
				div = element("div");
				t = text("override");
				this.h();
			},

			l: function claim(nodes) {
				div = claim_element(nodes, "DIV", { slot: true }, false);
				var div_nodes = children(div);

				t = claim_text(div_nodes, "override");
				div_nodes.forEach(detach);
				this.h();
			},

			h: function hydrate() {
				attr(div, "slot", "test2");
				add_location(div, file$1, 5, 1, 86);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				append(div, t);
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div);
				}
			}
		};
	}

	// (5:0) <Component href='.'>
	function create_default_slot(ctx) {
		var t;

		return {
			c: function create() {
				t = text("\n\tRest of slot");
			},

			l: function claim(nodes) {
				t = claim_text(nodes, "\n\tRest of slot");
			},

			m: function mount(target, anchor) {
				insert(target, t, anchor);
			},

			p: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	function create_fragment$1(ctx) {
		var current;

		var component = new Component({
			props: {
			href: ".",
			$$slots: {
			default: [create_default_slot],
			test2: [create_test2_slot]
		},
			$$scope: { ctx }
		},
			$$inline: true
		});

		return {
			c: function create() {
				component.$$.fragment.c();
			},

			l: function claim(nodes) {
				component.$$.fragment.l(nodes);
			},

			m: function mount(target, anchor) {
				mount_component(component, target, anchor);
				current = true;
			},

			p: noop,

			i: function intro(local) {
				if (current) return;
				component.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				component.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				component.$destroy(detaching);
			}
		};
	}

	class App extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, null, create_fragment$1, safe_not_equal, []);
		}
	}

	var app = new App({
		target: document.body,
		hydrate: true,
	});

	return app;

}());
//# sourceMappingURL=bundle.js.map
