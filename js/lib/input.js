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

/** Global Mouse Object */
const mouse = {
	/**
	 * Array of context objects
	 * @type {MouseContext[]}
	 */
	_contexts: [],
	/**
	 * Timestamps of the button's last down event
	 * @type {Record<,number | null>}
	 */
	buttons: {},
	/**
	 * Coordinate storage of mouse positions
	 * @type {{[ctxKey: string]: MouseCoordContext}}
	 */
	coords: makeWriteOnce({}, "mouse.coords"),

	/**
	 * Listener storage for event observers
	 * @type {{[ctxKey: string]: MouseListenerContext}}
	 */
	listen: makeWriteOnce({}, "mouse.listen"),

	// Register Context

	/**
	 * Registers a new mouse context
	 *
	 * @param {string} name The key name of the context
	 * @param {ContextMoveTransformer} onmove The function to perform coordinate transform
	 * @param {object} options Extra options
	 * @param {HTMLElement} [options.target=null] Target filtering
	 * @param {(evn: any) => boolean} [options.validate] Checks if we will process this event or not
	 * @param {Record<number, string>} [options.buttons={0: "left", 1: "middle", 2: "right"}] Custom button mapping
	 * @returns {MouseContext}
	 */
	registerContext: (name, onmove, options = {}) => {
		// Options
		defaultOpt(options, {
			target: null,
			validate: () => true,
			buttons: {0: "left", 1: "middle", 2: "right"},
		});

		// Context information
		/** @type {MouseContext} */
		const context = {
			id: guid(),
			name,
			onmove,
			target: options.target,
			validate: options.validate,
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
		const onany = new Observer();

		mouse.listen[name] = {
			onany,
			onwheel: new Observer(),
			onmousemove: new Observer(),
			btn: {},
		};

		// Always process onany events first
		mouse.listen[name].onwheel.on(
			async (evn, state) => await onany.emit(evn, state),
			Infinity,
			true
		);
		mouse.listen[name].onmousemove.on(
			async (evn, state) => await onany.emit(evn, state),
			Infinity,
			true
		);

		// Button specific items
		Object.keys(options.buttons).forEach((index) => {
			const button = options.buttons[index];
			mouse.coords[name].dragging[button] = null;
			mouse.listen[name].btn[button] = _mouse_observers(
				`mouse.listen[${name}].btn[${button}]`
			);

			// Always process onany events first
			mouse.listen[name].btn[button].onclick.on(
				async (evn, state) => await onany.emit(evn, state),
				Infinity,
				true
			);
			mouse.listen[name].btn[button].ondclick.on(
				async (evn, state) => await onany.emit(evn, state),
				Infinity,
				true
			);
			mouse.listen[name].btn[button].ondragstart.on(
				async (evn, state) => await onany.emit(evn, state),
				Infinity,
				true
			);
			mouse.listen[name].btn[button].ondrag.on(
				async (evn, state) => await onany.emit(evn, state),
				Infinity,
				true
			);
			mouse.listen[name].btn[button].ondragend.on(
				async (evn, state) => await onany.emit(evn, state),
				Infinity,
				true
			);
			mouse.listen[name].btn[button].onpaintstart.on(
				async (evn, state) => await onany.emit(evn, state),
				Infinity,
				true
			);
			mouse.listen[name].btn[button].onpaint.on(
				async (evn, state) => await onany.emit(evn, state),
				Infinity,
				true
			);
			mouse.listen[name].btn[button].onpaintend.on(
				async (evn, state) => await onany.emit(evn, state),
				Infinity,
				true
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

window.addEventListener(
	"mousedown",
	(evn) => {
		const time = performance.now();

		if (_double_click_timeout[evn.button]) {
			// ondclick event
			mouse._contexts.forEach(({target, name, buttons}) => {
				if ((!target || target === evn.target) && buttons[evn.button])
					mouse.listen[name].btn[buttons[evn.button]].ondclick.emit({
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
					mouse.coords[name].dragging[key] &&
					!mouse.coords[name].dragging[key].drag &&
					key
				) {
					mouse.listen[name].btn[key].ondragstart.emit({
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

		mouse._contexts.forEach(({target, name, buttons, validate}) => {
			const key = buttons[evn.button];
			if (
				(!target || target === evn.target) &&
				key &&
				(!validate || validate(evn))
			) {
				mouse.coords[name].dragging[key] = {};
				mouse.coords[name].dragging[key].target = evn.target;
				Object.assign(mouse.coords[name].dragging[key], mouse.coords[name].pos);

				// onpaintstart event
				mouse.listen[name].btn[key].onpaintstart.emit({
					target: evn.target,
					buttonId: evn.button,
					x: mouse.coords[name].pos.x,
					y: mouse.coords[name].pos.y,
					evn,
					timestamp: performance.now(),
				});
			}
		});
	},
	{
		passive: false,
	}
);

window.addEventListener(
	"mouseup",
	(evn) => {
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
					mouse.listen[name].btn[key].onclick.emit({
						target: evn.target,
						buttonId: evn.button,
						x: mouse.coords[name].pos.x,
						y: mouse.coords[name].pos.y,
						evn,
						timestamp: performance.now(),
					});

				// onpaintend event
				mouse.listen[name].btn[key].onpaintend.emit({
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
					mouse.listen[name].btn[key].ondragend.emit({
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
	},
	{passive: false}
);

window.addEventListener(
	"mousemove",
	(evn) => {
		mouse._contexts.forEach(async (context) => {
			const target = context.target;
			const name = context.name;

			if (
				!target ||
				(target === evn.target && (!context.validate || context.validate(evn)))
			) {
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
							mouse.listen[name].btn[key].ondragstart.emit({
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
						mouse.listen[name].btn[key].ondrag.emit({
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
						mouse.listen[name].btn[key].onpaint.emit({
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
	},
	{passive: false}
);

window.addEventListener(
	"wheel",
	(evn) => {
		// For firefox, we need to read a delta before deltaMode to force a PIXEL deltaMode read.
		// If we read deltaMode before a delta read, deltaMode will be LINE.
		// ref: https://bugzilla.mozilla.org/show_bug.cgi?id=1392460
		let _discard = evn.deltaY;
		_discard = evn.deltaMode;

		mouse._contexts.forEach(({name, target, validate}) => {
			if ((!target || target === evn.target) && (!validate || validate(evn))) {
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
			}
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
/**
 * Keyboard input processing
 */
/** Global Keyboard Object */
const keyboard = {
	/**
	 * Stores the key states for all keys
	 *
	 * @type {Record<string, KeyboardKeyState>}
	 */
	keys: {},

	/**
	 * Checks if a key is pressed or not
	 *
	 * @param {string} code - The code of the key
	 * @returns {boolean}
	 */
	isPressed(code) {
		return !!this.keys[code] && this.keys[code].pressed;
	},

	/**
	 * Checks if a key is held or not
	 *
	 * @param {string} code - The code of the key
	 * @returns {boolean}
	 */
	isHeld(code) {
		return !!this.key[code] && this.keys[code].held;
	},

	/**
	 * Object storing shortcuts. Uses key as indexing for better performance.
	 * @type {Record<string, KeyboardShortcut[]>}
	 */
	shortcuts: {},
	/**
	 * Adds a shortcut listener
	 *
	 * @param {object} shortcut Shortcut information
	 * @param {boolean} [shortcut.ctrl=false] If control must be pressed
	 * @param {boolean} [shortcut.alt=false] If alt must be pressed
	 * @param {boolean} [shortcut.shift=false] If shift must be pressed
	 * @param {string} shortcut.key The key code (evn.code) for the key pressed
	 * @param {KeyboardShortcutCallback} callback Will be called on shortcut detection
	 * @returns
	 */
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

		return callback;
	},
	/**
	 * Deletes a shortcut (disables callback)
	 *
	 * @param {string | KeyboardShortcutCallback} shortcut A shortcut ID or its callback
	 * @param {string} [key=null] If you know the key code, to avoid searching all shortcuts
	 * @returns
	 */
	deleteShortcut(shortcut, key = null) {
		if (key) {
			this.shortcuts[key] = this.shortcuts[key].filter(
				(v) => v.id !== shortcut && v.callback !== shortcut
			);
			return;
		}
		this.shortcuts.keys().forEach((key) => {
			this.shortcuts[key] = this.shortcuts[key].filter(
				(v) => v.id !== shortcut && v.callback !== shortcut
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
			let activate = true;

			if (callback.ctrl !== null && !!callback.ctrl !== evn.ctrlKey)
				activate = false;
			if (callback.shift !== null && !!callback.shift !== evn.shiftKey)
				activate = false;
			if (callback.alt !== null && !!callback.alt !== evn.altKey)
				activate = false;

			if (activate) {
				evn.preventDefault();
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
