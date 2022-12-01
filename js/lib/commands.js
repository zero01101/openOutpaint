/**
 * Command pattern to allow for editing history
 */

const _commands_events = new Observer();

/** CommandNonExistentError */
class CommandNonExistentError extends Error {}

/** Global Commands Object */
const commands = makeReadOnly(
	{
		/** Current History Index Reader */
		get current() {
			return this._current;
		},
		/** Current History Index (private) */
		_current: -1,
		/**
		 * Command History (private)
		 *
		 * @type {CommandEntry[]}
		 */
		_history: [],
		/** The types of commands we can run (private) */
		_types: {},

		/**
		 * Undoes the last commands in the history
		 *
		 * @param {number} [n] Number of actions to undo
		 */
		async undo(n = 1) {
			for (var i = 0; i < n && this.current > -1; i++) {
				await this._history[this._current--].undo();
			}
		},
		/**
		 * Redoes the next commands in the history
		 *
		 * @param {number} [n] Number of actions to redo
		 */
		async redo(n = 1) {
			for (var i = 0; i < n && this.current + 1 < this._history.length; i++) {
				await this._history[++this._current].redo();
			}
		},

		/**
		 *	Creates a basic command, that can be done and undone
		 *
		 * They must contain a 'run' method that performs the action for the first time,
		 * a 'undo' method that undoes that action and a 'redo' method that does the
		 * action again, but without requiring parameters. 'redo' is by default the
		 * same as 'run'.
		 *
		 * The 'run' and 'redo' functions will receive a 'options' parameter which will be
		 * forwarded directly to the operation, and a 'state' parameter that
		 * can be used to store state for undoing things.
		 *
		 * The 'state' object will be passed to the 'undo' function as well.
		 *
		 * @param {string} name Command identifier (name)
		 * @param {CommandDoCallback} run A method that performs the action for the first time
		 * @param {CommandUndoCallback} undo A method that reverses what the run method did
		 * @param {CommandDoCallback} redo A method that redoes the action after undone (default: run)
		 * @returns {Command}
		 */
		createCommand(name, run, undo, redo = run) {
			const command = async function runWrapper(title, options) {
				// Create copy of options and state object
				const copy = {};
				Object.assign(copy, options);
				const state = {};

				/** @type {CommandEntry} */
				const entry = {
					id: guid(),
					title,
					state,
				};

				// Attempt to run command
				try {
					console.debug(`[commands] Running '${title}'[${name}]`);
					await run(title, copy, state);
				} catch (e) {
					console.warn(
						`[commands] Error while running command '${name}' with options:`
					);
					console.warn(copy);
					console.warn(e);
					return;
				}

				const undoWrapper = () => {
					console.debug(
						`[commands] Undoing '${title}'[${name}], currently ${this._current}`
					);
					undo(title, state);
					_commands_events.emit({
						id: entry.id,
						name,
						action: "undo",
						state,
						current: this._current,
					});
				};
				const redoWrapper = () => {
					console.debug(
						`[commands] Redoing '${title}'[${name}], currently ${this._current}`
					);
					redo(title, copy, state);
					_commands_events.emit({
						id: entry.id,
						name,
						action: "redo",
						state,
						current: this._current,
					});
				};

				// Add to history
				if (commands._history.length > commands._current + 1) {
					commands._history.forEach((entry, index) => {
						if (index >= commands._current + 1)
							_commands_events.emit({
								id: entry.id,
								name,
								action: "deleted",
								state,
								current: this._current,
							});
					});

					commands._history.splice(commands._current + 1);
				}

				commands._history.push(entry);
				commands._current++;

				entry.undo = undoWrapper;
				entry.redo = redoWrapper;

				_commands_events.emit({
					id: entry.id,
					name,
					action: "run",
					state,
					current: commands._current,
				});

				return entry;
			};

			this._types[name] = command;

			return command;
		},
		/**
		 * Runs a command
		 *
		 * @param {string} name The name of the command to run
		 * @param {string} title The display name of the command on the history panel view
		 * @param {any} options The options to be sent to the command to be run
		 */
		runCommand(name, title, options = null) {
			if (!this._types[name])
				throw new CommandNonExistentError(
					`[commands] Command '${name}' does not exist`
				);
			this._types[name](title, options);
		},
	},
	"commands",
	["_current"]
);

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
