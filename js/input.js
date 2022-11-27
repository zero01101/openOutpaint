const inputConfig = {
	clickRadius: 10, // Radius to be considered a click (pixels). If farther, turns into a drag
	clickTiming: 500, // Timing window to be considered a click (ms). If longer, turns into a drag
	dClickTiming: 500, // Timing window to be considered a double click (ms).

	keyboardHoldTiming: 1000, // Timing window after which to consider holding a key (ms)
};

/**
 * Mouse input processing
 */
// Base object generator functions
function _mouse_observers(name = "generic_mouse_observer_array") {
	return makeReadOnly(
		{
			// Simple click handler
			onclick: new Observer(),
			// Double click handler (will still trigger simple click handler as well)
			ondclick: new Observer(),
			// Drag handler
			ondragstart: new Observer(),
			ondrag: new Observer(),
			ondragend: new Observer(),
			// Paint handler (like drag handler, but with no delay); will trigger during clicks too
			onpaintstart: new Observer(),
			onpaint: new Observer(),
			onpaintend: new Observer(),
		},
		name
	);
}

const mouse = {
	_contexts: [],
	buttons: {},
	coords: makeWriteOnce({}, "mouse.coords"),

	listen: makeWriteOnce({}, "mouse.listen"),

	// Register Context
	registerContext: (name, onmove, options = {}) => {
		// Options
		defaultOpt(options, {
			target: null,
			buttons: {0: "left", 1: "middle", 2: "right"},
		});

		// Context information
		const context = {
			id: guid(),
			name,
			onmove,
			target: options.target,
			buttons: options.buttons,
		};

		// Coordinate information
		mouse.coords[name] = {
			dragging: {},

			prev: {
				x: 0,
				y: 0,
			},

			pos: {
				x: 0,
				y: 0,
			},
		};

		// Listeners
		mouse.listen[name] = {
			onwheel: new Observer(),
			onmousemove: new Observer(),
		};

		// Button specific items
		Object.keys(options.buttons).forEach((index) => {
			const button = options.buttons[index];
			mouse.coords[name].dragging[button] = null;
			mouse.listen[name][button] = _mouse_observers(
				`mouse.listen[${name}][${button}]`
			);
		});

		// Add to context
		context.coords = mouse.coords[name];
		context.listen = mouse.listen[name];

		// Add to list
		mouse._contexts.push(context);

		return context;
	},
};

const _double_click_timeout = {};
const _drag_start_timeout = {};

window.onmousedown = (evn) => {
	const time = performance.now();

	if (_double_click_timeout[evn.button]) {
		// ondclick event
		mouse._contexts.forEach(({target, name, buttons}) => {
			if ((!target || target === evn.target) && buttons[evn.button])
				mouse.listen[name][buttons[evn.button]].ondclick.emit({
					target: evn.target,
					buttonId: evn.button,
					x: mouse.coords[name].pos.x,
					y: mouse.coords[name].pos.y,
					evn,
					timestamp: time,
				});
		});
	} else {
		// Start timer
		_double_click_timeout[evn.button] = setTimeout(
			() => delete _double_click_timeout[evn.button],
			inputConfig.dClickTiming
		);
	}

	// Set drag start timeout
	_drag_start_timeout[evn.button] = setTimeout(() => {
		mouse._contexts.forEach(({target, name, buttons}) => {
			const key = buttons[evn.button];
			if (
				(!target || target === evn.target) &&
				!mouse.coords[name].dragging[key].drag &&
				key
			) {
				mouse.listen[name][key].ondragstart.emit({
					target: evn.target,
					buttonId: evn.button,
					x: mouse.coords[name].pos.x,
					y: mouse.coords[name].pos.y,
					evn,
					timestamp: time,
				});

				mouse.coords[name].dragging[key].drag = true;
			}
		});
		delete _drag_start_timeout[evn.button];
	}, inputConfig.clickTiming);

	mouse.buttons[evn.button] = time;

	mouse._contexts.forEach(({target, name, buttons}) => {
		const key = buttons[evn.button];
		if ((!target || target === evn.target) && key) {
			mouse.coords[name].dragging[key] = {};
			mouse.coords[name].dragging[key].target = evn.target;
			Object.assign(mouse.coords[name].dragging[key], mouse.coords[name].pos);

			// onpaintstart event
			mouse.listen[name][key].onpaintstart.emit({
				target: evn.target,
				buttonId: evn.button,
				x: mouse.coords[name].pos.x,
				y: mouse.coords[name].pos.y,
				evn,
				timestamp: performance.now(),
			});
		}
	});
};

window.onmouseup = (evn) => {
	const time = performance.now();

	mouse._contexts.forEach(({target, name, buttons}) => {
		const key = buttons[evn.button];
		if (
			(!target || target === evn.target) &&
			key &&
			mouse.coords[name].dragging[key]
		) {
			const start = {
				x: mouse.coords[name].dragging[key].x,
				y: mouse.coords[name].dragging[key].y,
			};

			// onclick event
			const dx = mouse.coords[name].pos.x - start.x;
			const dy = mouse.coords[name].pos.y - start.y;

			if (
				mouse.buttons[evn.button] &&
				time - mouse.buttons[evn.button] < inputConfig.clickTiming &&
				dx * dx + dy * dy < inputConfig.clickRadius * inputConfig.clickRadius
			)
				mouse.listen[name][key].onclick.emit({
					target: evn.target,
					buttonId: evn.button,
					x: mouse.coords[name].pos.x,
					y: mouse.coords[name].pos.y,
					evn,
					timestamp: performance.now(),
				});

			// onpaintend event
			mouse.listen[name][key].onpaintend.emit({
				target: evn.target,
				initialTarget: mouse.coords[name].dragging[key].target,
				buttonId: evn.button,
				ix: mouse.coords[name].dragging[key].x,
				iy: mouse.coords[name].dragging[key].y,
				x: mouse.coords[name].pos.x,
				y: mouse.coords[name].pos.y,
				evn,
				timestamp: performance.now(),
			});

			// ondragend event
			if (mouse.coords[name].dragging[key].drag)
				mouse.listen[name][key].ondragend.emit({
					target: evn.target,
					initialTarget: mouse.coords[name].dragging[key].target,
					buttonId: evn.button,
					ix: mouse.coords[name].dragging[key].x,
					iy: mouse.coords[name].dragging[key].y,
					x: mouse.coords[name].pos.x,
					y: mouse.coords[name].pos.y,
					evn,
					timestamp: performance.now(),
				});

			mouse.coords[name].dragging[key] = null;
		}
	});

	if (_drag_start_timeout[evn.button] !== undefined) {
		clearTimeout(_drag_start_timeout[evn.button]);
		delete _drag_start_timeout[evn.button];
	}
	mouse.buttons[evn.button] = null;
};

window.onmousemove = (evn) => {
	mouse._contexts.forEach((context) => {
		const target = context.target;
		const name = context.name;

		if (!target || target === evn.target) {
			context.onmove(evn, context);

			mouse.listen[name].onmousemove.emit({
				target: evn.target,
				px: mouse.coords[name].prev.x,
				py: mouse.coords[name].prev.y,
				x: mouse.coords[name].pos.x,
				y: mouse.coords[name].pos.y,
				evn,
				timestamp: performance.now(),
			});

			Object.keys(context.buttons).forEach((index) => {
				const key = context.buttons[index];
				// ondragstart event (2)
				if (mouse.coords[name].dragging[key]) {
					const dx =
						mouse.coords[name].pos.x - mouse.coords[name].dragging[key].x;
					const dy =
						mouse.coords[name].pos.y - mouse.coords[name].dragging[key].y;
					if (
						!mouse.coords[name].dragging[key].drag &&
						dx * dx + dy * dy >=
							inputConfig.clickRadius * inputConfig.clickRadius
					) {
						mouse.listen[name][key].ondragstart.emit({
							target: evn.target,
							buttonId: evn.button,
							ix: mouse.coords[name].dragging[key].x,
							iy: mouse.coords[name].dragging[key].y,
							x: mouse.coords[name].pos.x,
							y: mouse.coords[name].pos.y,
							evn,
							timestamp: performance.now(),
						});

						mouse.coords[name].dragging[key].drag = true;
					}
				}

				// ondrag event
				if (
					mouse.coords[name].dragging[key] &&
					mouse.coords[name].dragging[key].drag
				)
					mouse.listen[name][key].ondrag.emit({
						target: evn.target,
						initialTarget: mouse.coords[name].dragging[key].target,
						button: index,
						ix: mouse.coords[name].dragging[key].x,
						iy: mouse.coords[name].dragging[key].y,
						px: mouse.coords[name].prev.x,
						py: mouse.coords[name].prev.y,
						x: mouse.coords[name].pos.x,
						y: mouse.coords[name].pos.y,
						evn,
						timestamp: performance.now(),
					});

				// onpaint event
				if (mouse.coords[name].dragging[key]) {
					mouse.listen[name][key].onpaint.emit({
						target: evn.target,
						initialTarget: mouse.coords[name].dragging[key].target,
						button: index,
						ix: mouse.coords[name].dragging[key].x,
						iy: mouse.coords[name].dragging[key].y,
						px: mouse.coords[name].prev.x,
						py: mouse.coords[name].prev.y,
						x: mouse.coords[name].pos.x,
						y: mouse.coords[name].pos.y,
						evn,
						timestamp: performance.now(),
					});
				}
			});
		}
	});
};

window.addEventListener(
	"wheel",
	(evn) => {
		mouse._contexts.forEach(({name}) => {
			mouse.listen[name].onwheel.emit({
				target: evn.target,
				delta: evn.deltaY,
				deltaX: evn.deltaX,
				deltaY: evn.deltaY,
				deltaZ: evn.deltaZ,
				mode: evn.deltaMode,
				x: mouse.coords[name].pos.x,
				y: mouse.coords[name].pos.y,
				evn,
				timestamp: performance.now(),
			});
		});
	},
	{passive: false}
);

mouse.registerContext("window", (evn, ctx) => {
	ctx.coords.prev.x = ctx.coords.pos.x;
	ctx.coords.prev.y = ctx.coords.pos.y;
	ctx.coords.pos.x = evn.clientX;
	ctx.coords.pos.y = evn.clientY;
});

mouse.registerContext(
	"canvas",
	(evn, ctx) => {
		ctx.coords.prev.x = ctx.coords.pos.x;
		ctx.coords.prev.y = ctx.coords.pos.y;
		ctx.coords.pos.x = evn.layerX;
		ctx.coords.pos.y = evn.layerY;
	},
	document.getElementById("overlayCanvas")
);
/**
 * Keyboard input processing
 */
// Base object generator functions

const keyboard = {
	keys: {},

	isPressed(code) {
		return this.keys[key].pressed;
	},

	isHeld(code) {
		return !!this;
	},

	shortcuts: {},
	onShortcut(shortcut, callback) {
		/**
		 * Adds a shortcut handler (shorcut must be in format: {ctrl?: bool, alt?: bool, shift?: bool, key: string (code)})
		 * key must be the "code" parameter from keydown event; A key is "KeyA" for example
		 */
		if (this.shortcuts[shortcut.key] === undefined)
			this.shortcuts[shortcut.key] = [];

		this.shortcuts[shortcut.key].push({
			ctrl: shortcut.ctrl,
			alt: shortcut.alt,
			shift: shortcut.shift,
			id: guid(),
			callback,
		});
	},
	deleteShortcut(id, key = null) {
		if (key) {
			this.shortcuts[key] = this.shortcuts[key].filter(
				(v) => v.id !== id && v.callback !== id
			);
			return;
		}
		this.shortcuts.keys().forEach((key) => {
			this.shortcuts[key] = this.shortcuts[key].filter(
				(v) => v.id !== id && v.callback !== id
			);
		});
	},

	listen: {
		onkeydown: new Observer(),
		onkeyup: new Observer(),
		onkeyholdstart: new Observer(),
		onkeyholdend: new Observer(),
		onkeyclick: new Observer(),
		onshortcut: new Observer(),
	},
};

window.onkeydown = (evn) => {
	// onkeydown event
	keyboard.listen.onkeydown.emit({
		target: evn.target,
		code: evn.code,
		key: evn.key,
		evn,
	});

	keyboard.keys[evn.code] = {
		pressed: true,
		held: false,
		_hold_to: setTimeout(() => {
			keyboard.keys[evn.code].held = true;
			delete keyboard.keys[evn.code]._hold_to;
			// onkeyholdstart event
			keyboard.listen.onkeyholdstart.emit({
				target: evn.target,
				code: evn.code,
				key: evn.key,
				evn,
			});
		}, inputConfig.keyboardHoldTiming),
	};

	// Process shortcuts if input target is not a text field
	switch (evn.target.tagName.toLowerCase()) {
		case "input":
		case "textarea":
		case "select":
		case "button":
			return; // If in an input field, do not process shortcuts
		default:
			// Do nothing
			break;
	}

	const callbacks = keyboard.shortcuts[evn.code];

	if (callbacks)
		callbacks.forEach((callback) => {
			if (
				!!callback.ctrl === evn.ctrlKey &&
				!!callback.alt === evn.altKey &&
				!!callback.shift === evn.shiftKey
			) {
				// onshortcut event
				keyboard.listen.onshortcut.emit({
					target: evn.target,
					code: evn.code,
					key: evn.key,
					id: callback.id,
					evn,
				});
				callback.callback(evn);
			}
		});
};

window.onkeyup = (evn) => {
	// onkeyup event
	keyboard.listen.onkeyup.emit({
		target: evn.target,
		code: evn.code,
		key: evn.key,
		evn,
	});
	if (keyboard.keys[evn.code] && keyboard.keys[evn.code].held) {
		// onkeyholdend event
		keyboard.listen.onkeyholdend.emit({
			target: evn.target,
			code: evn.code,
			key: evn.key,
			evn,
		});
	} else {
		// onkeyclick event
		keyboard.listen.onkeyclick.emit({
			target: evn.target,
			code: evn.code,
			key: evn.key,
			evn,
		});
	}

	keyboard.keys[evn.code] = {
		pressed: false,
		held: false,
	};
};
