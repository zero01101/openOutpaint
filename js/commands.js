/**
 * Command pattern to allow for editing history
 */

const _commands_events = new Observer();

const commands = {
	current: -1,
	history: [],
	undo(n = 1) {
		for (var i = 0; i < n && this.current > -1; i++) {
			this.history[this.current--].undo();
		}
	},
	redo(n = 1) {
		for (var i = 0; i < n && this.current + 1 < this.history.length; i++) {
			this.history[++this.current].redo();
		}
	},

	/**
	 * These are basic commands that can be done/undone
	 *
	 * They must contain a 'run' method that performs the action the first time,
	 * a 'undo' method that undoes that action and a 'redo' method that does the
	 * action again, but without requiring parameters. 'redo' is by default the
	 * same as 'run'.
	 *
	 * The 'run' and 'redo' functions will receive a 'options' parameter which will be
	 * forwarded directly to the operation, and a 'state' parameter that
	 * can be used to store state for undoing things.
	 *
	 * The 'state' object will be passed to the 'undo' function as well.
	 */
	createCommand(name, run, undo, redo = run) {
		const command = function runWrapper(title, options) {
			// Create copy of options and state object
			const copy = {};
			Object.assign(copy, options);
			const state = {};

			const entry = {
				id: guid(),
				title,
				state,
			};

			// Attempt to run command
			try {
				run(title, copy, state);
			} catch (e) {
				console.warn(`Error while running command '${name}' with options:`);
				console.warn(copy);
				console.warn(e);
				return;
			}

			const undoWrapper = () => {
				console.debug(`Undoing ${name}, currently ${commands.current}`);
				undo(title, state);
				_commands_events.emit({
					id: entry.id,
					name,
					action: "undo",
					state,
					current: commands.current,
				});
			};
			const redoWrapper = () => {
				console.debug(`Redoing ${name}, currently ${commands.current}`);
				redo(title, copy, state);
				_commands_events.emit({
					id: entry.id,
					name,
					action: "redo",
					state,
					current: commands.current,
				});
			};

			// Add to history
			if (commands.history.length > commands.current + 1) {
				commands.history.forEach((entry, index) => {
					if (index >= commands.current + 1)
						_commands_events.emit({
							id: entry.id,
							name,
							action: "deleted",
							state,
							current: commands.current,
						});
				});

				commands.history.splice(commands.current + 1);
			}

			commands.history.push(entry);
			commands.current++;

			entry.undo = undoWrapper;
			entry.redo = redoWrapper;

			_commands_events.emit({
				id: entry.id,
				name,
				action: "run",
				state,
				current: commands.current,
			});

			return entry;
		};

		this.types[name] = command;

		return command;
	},
	runCommand(name, title, options) {
		this.types[name](title, options);
	},
	types: {},
};

/**
 * Draw Image Command, used to draw a Image to a context
 */
commands.createCommand(
	"drawImage",
	(title, options, state) => {
		if (
			!options ||
			options.image === undefined ||
			options.x === undefined ||
			options.y === undefined
		)
			throw "Command drawImage requires options in the format: {image, x, y, w?, h?, ctx?}";

		// Check if we have state
		if (!state.context) {
			const context = options.ctx || imgCtx;
			state.context = context;

			// Saving what was in the canvas before the command
			const imgData = context.getImageData(
				options.x,
				options.y,
				options.w || options.image.width,
				options.h || options.image.height
			);
			state.box = {
				x: options.x,
				y: options.y,
				w: options.w || options.image.width,
				h: options.h || options.image.height,
			};
			// Create Image
			const cutout = document.createElement("canvas");
			cutout.width = state.box.w;
			cutout.height = state.box.h;
			cutout.getContext("2d").putImageData(imgData, 0, 0);
			state.original = new Image();
			state.original.src = cutout.toDataURL();
		}

		// Apply command
		state.context.drawImage(
			options.image,
			0,
			0,
			options.image.width,
			options.image.height,
			state.box.x,
			state.box.y,
			state.box.w,
			state.box.h
		);
	},
	(title, state) => {
		// Clear destination area
		state.context.clearRect(state.box.x, state.box.y, state.box.w, state.box.h);
		// Undo
		state.context.drawImage(state.original, state.box.x, state.box.y);
	}
);

commands.createCommand(
	"eraseImage",
	(title, options, state) => {
		if (
			!options ||
			options.x === undefined ||
			options.y === undefined ||
			options.w === undefined ||
			options.h === undefined
		)
			throw "Command eraseImage requires options in the format: {x, y, w, h, ctx?}";

		// Check if we have state
		if (!state.context) {
			const context = options.ctx || imgCtx;
			state.context = context;

			// Saving what was in the canvas before the command
			const imgData = context.getImageData(
				options.x,
				options.y,
				options.w,
				options.h
			);
			state.box = {
				x: options.x,
				y: options.y,
				w: options.w,
				h: options.h,
			};
			// Create Image
			const cutout = document.createElement("canvas");
			cutout.width = state.box.w;
			cutout.height = state.box.h;
			cutout.getContext("2d").putImageData(imgData, 0, 0);
			state.original = new Image();
			state.original.src = cutout.toDataURL();
		}

		// Apply command
		state.context.clearRect(state.box.x, state.box.y, state.box.w, state.box.h);
	},
	(title, state) => {
		// Clear destination area
		state.context.clearRect(state.box.x, state.box.y, state.box.w, state.box.h);
		// Undo
		state.context.drawImage(state.original, state.box.x, state.box.y);
	}
);
