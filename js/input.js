const inputConfig = {
	clickRadius: 10, // Radius to be considered a click (pixels). If farther, turns into a drag
	clickTiming: 500, // Timing window to be considered a click (ms). If longer, turns into a drag
	dClickTiming: 500, // Timing window to be considered a double click (ms).
};

/**
 * Mouse input processing
 */
// Base object generator functions
function _context_coords() {
	return {
		dragging: {
			left: null,
			middle: null,
			right: null,
		},

		prev: {
			x: 0,
			y: 0,
		},

		pos: {
			x: 0,
			y: 0,
		},
	};
}
function _mouse_observers() {
	return {
		// Simple click handlers
		onclick: new Observer(),
		// Double click handlers (will still trigger simple click handler as well)
		ondclick: new Observer(),
		// Drag handler
		ondragstart: new Observer(),
		ondrag: new Observer(),
		ondragend: new Observer(),
		// Paint handler (like drag handler, but with no delay); will trigger during clicks too
		onpaintstart: new Observer(),
		onpaint: new Observer(),
		onpaintend: new Observer(),
	};
}

function _context_observers() {
	return {
		onmousemove: new Observer(),
		left: _mouse_observers(),
		middle: _mouse_observers(),
		right: _mouse_observers(),
	};
}

const mouse = {
	buttons: {
		right: null,
		left: null,
		middle: null,
	},

	// Mouse Actions in Window Coordinates
	window: _context_coords(),

	// Mouse Actions in Canvas Coordinates
	canvas: _context_coords(),

	// Mouse Actions in World Coordinates
	world: _context_coords(),

	listen: {
		window: _context_observers(),
		canvas: _context_observers(),
		world: _context_observers(),
	},
};

function _mouse_state_snapshot() {
	return {
		buttons: window.structuredClone(mouse.buttons),
		window: window.structuredClone(mouse.window),
		canvas: window.structuredClone(mouse.canvas),
		world: window.structuredClone(mouse.world),
	};
}

const _double_click_timeout = {};
const _drag_start_timeout = {};

window.onmousedown = (evn) => {
	const time = new Date();

	// Processes for a named button
	const onhold = (key) => () => {
		if (_double_click_timeout[key]) {
			// ondclick event
			["window", "canvas", "world"].forEach((ctx) =>
				mouse.listen[ctx][key].ondclick.emit({
					target: evn.target,
					buttonId: evn.button,
					x: mouse[ctx].pos.x,
					y: mouse[ctx].pos.y,
					timestamp: new Date(),
				})
			);
		} else {
			// Start timer
			_double_click_timeout[key] = setTimeout(
				() => delete _double_click_timeout[key],
				inputConfig.dClickTiming
			);
		}

		// Set drag start timeout
		_drag_start_timeout[key] = setTimeout(() => {
			["window", "canvas", "world"].forEach((ctx) => {
				mouse.listen[ctx][key].ondragstart.emit({
					target: evn.target,
					buttonId: evn.button,
					x: mouse[ctx].pos.x,
					y: mouse[ctx].pos.y,
					timestamp: new Date(),
				});
				if (mouse[ctx].dragging[key]) mouse[ctx].dragging[key].drag = true;

				delete _drag_start_timeout[key];
			});
		}, inputConfig.clickTiming);

		["window", "canvas", "world"].forEach((ctx) => {
			mouse.buttons[key] = time;
			mouse[ctx].dragging[key] = {target: evn.target};
			Object.assign(mouse[ctx].dragging[key], mouse[ctx].pos);

			// onpaintstart event
			mouse.listen[ctx][key].onpaintstart.emit({
				target: evn.target,
				buttonId: evn.button,
				x: mouse[ctx].pos.x,
				y: mouse[ctx].pos.y,
				timestamp: new Date(),
			});
		});
	};

	// Runs the correct handler
	const buttons = [onhold("left"), onhold("middle"), onhold("right")];

	buttons[evn.button] && buttons[evn.button]();
};

window.onmouseup = (evn) => {
	const time = new Date();

	// Processes for a named button
	const onrelease = (key) => () => {
		["window", "canvas", "world"].forEach((ctx) => {
			const start = {
				x: mouse[ctx].dragging[key].x,
				y: mouse[ctx].dragging[key].y,
			};

			// onclick event
			const dx = mouse[ctx].pos.x - start.x;
			const dy = mouse[ctx].pos.y - start.y;

			if (
				time.getTime() - mouse.buttons[key].getTime() <
					inputConfig.clickTiming &&
				dx * dx + dy * dy < inputConfig.clickRadius * inputConfig.clickRadius
			)
				mouse.listen[ctx][key].onclick.emit({
					target: evn.target,
					buttonId: evn.button,
					x: mouse[ctx].pos.x,
					y: mouse[ctx].pos.y,
					timestamp: new Date(),
				});

			// onpaintend event
			mouse.listen[ctx][key].onpaintend.emit({
				target: evn.target,
				initialTarget: mouse[ctx].dragging[key].target,
				buttonId: evn.button,
				x: mouse[ctx].pos.x,
				y: mouse[ctx].pos.y,
				timestamp: new Date(),
			});

			// ondragend event
			if (mouse[ctx].dragging[key].drag)
				mouse.listen[ctx][key].ondragend.emit({
					target: evn.target,
					initialTarget: mouse[ctx].dragging[key].target,
					buttonId: evn.button,
					x: mouse[ctx].pos.x,
					y: mouse[ctx].pos.y,
					timestamp: new Date(),
				});

			mouse[ctx].dragging[key] = null;
		});

		if (_drag_start_timeout[key] !== undefined) {
			clearTimeout(_drag_start_timeout[key]);
			delete _drag_start_timeout[key];
		}
		mouse.buttons[key] = null;
	};

	// Runs the correct handler
	const buttons = [onrelease("left"), onrelease("middle"), onrelease("right")];

	buttons[evn.button] && buttons[evn.button]();
};

window.onmousemove = (evn) => {
	// Set Window Coordinates
	Object.assign(mouse.window.prev, mouse.window.pos);
	mouse.window.pos = {x: evn.clientX, y: evn.clientY};

	// Set Canvas Coordinates (using overlay canvas as reference)
	if (evn.target.id === "overlayCanvas") {
		Object.assign(mouse.canvas.prev, mouse.canvas.pos);
		mouse.canvas.pos = {x: evn.layerX, y: evn.layerY};
	}

	// Set World Coordinates (For now the same as canvas coords; Will be useful with infinite canvas)
	if (evn.target.id === "overlayCanvas") {
		Object.assign(mouse.world.prev, mouse.world.pos);
		mouse.world.pos = {x: evn.layerX, y: evn.layerY};
	}

	["window", "canvas", "world"].forEach((ctx) => {
		mouse.listen[ctx].onmousemove.emit({
			target: evn.target,
			px: mouse[ctx].prev.x,
			py: mouse[ctx].prev.y,
			x: mouse[ctx].pos.x,
			y: mouse[ctx].pos.y,
			timestamp: new Date(),
		});
		["left", "middle", "right"].forEach((key) => {
			// ondrag event
			if (mouse[ctx].dragging[key] && mouse[ctx].dragging[key].drag)
				mouse.listen[ctx][key].ondrag.emit({
					target: evn.target,
					initialTarget: mouse[ctx].dragging[key].target,
					px: mouse[ctx].prev.x,
					py: mouse[ctx].prev.y,
					x: mouse[ctx].pos.x,
					y: mouse[ctx].pos.y,
					timestamp: new Date(),
				});

			// onpaint event
			if (mouse[ctx].dragging[key])
				mouse.listen[ctx][key].onpaint.emit({
					target: evn.target,
					initialTarget: mouse[ctx].dragging[key].target,
					px: mouse[ctx].prev.x,
					py: mouse[ctx].prev.y,
					x: mouse[ctx].pos.x,
					y: mouse[ctx].pos.y,
					timestamp: new Date(),
				});
		});
	});
};
/** MOUSE DEBUG */
/*
mouse.listen.window.right.onclick.on(() =>
    console.debug('mouse.listen.window.right.onclick')
);

mouse.listen.window.right.ondclick.on(() =>
    console.debug('mouse.listen.window.right.ondclick')
);
mouse.listen.window.right.ondragstart.on(() =>
    console.debug('mouse.listen.window.right.ondragstart')
);
mouse.listen.window.right.ondrag.on(() =>
    console.debug('mouse.listen.window.right.ondrag')
);
mouse.listen.window.right.ondragend.on(() =>
    console.debug('mouse.listen.window.right.ondragend')
);

mouse.listen.window.right.onpaintstart.on(() =>
    console.debug('mouse.listen.window.right.onpaintstart')
);
mouse.listen.window.right.onpaint.on(() =>
    console.debug('mouse.listen.window.right.onpaint')
);
mouse.listen.window.right.onpaintend.on(() =>
    console.debug('mouse.listen.window.right.onpaintend')
);
*/

/**
 * Mouse input processing
 */
