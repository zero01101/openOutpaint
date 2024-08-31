/**
 * Command pattern to allow for editing history
 */

const _commands_events = new Observer();

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

		/** @type {Observer<{n: int, cancel: function}>} */
		get onundo() {
			return this._onundo;
		},
		_onundo: new Observer(),

		/** @type {Observer<{n: int, cancel: function}>} */
		get onredo() {
			return this._onredo;
		},
		_onredo: new Observer(),

		/**
		 * Undoes the last commands in the history
		 *
		 * @param {number} [n] Number of actions to undo
		 */
		async undo(n = 1) {
			var cancelled = false;
			await this._onundo.emit({
				n: n,
				cancel: () => {
					cancelled = true;
				},
			});
			if (cancelled) return;
			for (var i = 0; i < n && this.current > -1; i++) {
				try {
					await this._history[this._current--].undo();
				} catch (e) {
					console.warn("[commands] Failed to undo command");
					console.warn(e);
					this._current++;
					break;
				}
			}
		},
		/**
		 * Redoes the next commands in the history
		 *
		 * @param {number} [n] Number of actions to redo
		 */
		async redo(n = 1) {
			let cancelled = false;
			await this._onredo.emit({
				n: n,
				cancel: () => {
					cancelled = true;
				},
			});
			if (cancelled) return;
			for (var i = 0; i < n && this.current + 1 < this._history.length; i++) {
				try {
					await this._history[++this._current].redo();
				} catch (e) {
					console.warn("[commands] Failed to redo command");
					console.warn(e);
					this._current--;
					break;
				}
			}
		},

		/**
		 * Clears the history
		 */
		async clear() {
			await this.undo(this._history.length);

			this._history.splice(0, this._history.length);

			_commands_events.emit({
				action: "clear",
				state: {},
				current: commands._current,
			});
		},

		/**
		 * Imports an exported command and runs it
		 *
		 * @param {{name: string, title: string, data: any}} exported Exported command
		 */
		async import(exported) {
			await this.runCommand(
				exported.command,
				exported.title,
				{},
				{importData: exported.data}
			);
		},

		/**
		 * Exports all commands in the history
		 */
		async export() {
			return Promise.all(
				this._history.map(async (command) => command.export())
			);
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
		 * @param {object} opt Extra options
		 * @param {CommandDoCallback} opt.redo A method that redoes the action after undone (default: run)
		 * @param {(state: any) => any} opt.exportfn A method that exports a serializeable object
		 * @param {(value: any, state: any) => any} opt.importfn A method that imports a serializeable object
		 * @returns {Command}
		 */
		createCommand(name, run, undo, opt = {}) {
			defaultOpt(opt, {
				redo: run,
				exportfn: null,
				importfn: null,
			});

			const command = async function runWrapper(title, options, extra = {}) {
				// Create copy of options and state object
				const copy = {};
				Object.assign(copy, options);
				const state = {};

				defaultOpt(extra, {
					recordHistory: true,
					importData: null,
				});

				const exportfn =
					opt.exportfn ?? ((state) => Object.assign({}, state.serializeable));
				const importfn =
					opt.importfn ??
					((value, state) => (state.serializeable = Object.assign({}, value)));
				const redo = opt.redo;

				/** @type {CommandEntry} */
				const entry = {
					id: guid(),
					title,
					state,
					async export() {
						return {
							command: name,
							title,
							data: await exportfn(state),
						};
					},
					extra: extra.extra,
				};

				if (extra.importData) {
					await importfn(extra.importData, state);
					state.imported = extra.importData;
				}

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

				const undoWrapper = async () => {
					console.debug(
						`[commands] Undoing '${title}'[${name}], currently ${this._current}`
					);
					await undo(title, state);
					_commands_events.emit({
						id: entry.id,
						name,
						action: "undo",
						state,
						current: this._current,
					});
				};
				const redoWrapper = async () => {
					console.debug(
						`[commands] Redoing '${title}'[${name}], currently ${this._current}`
					);
					await redo(title, copy, state);
					_commands_events.emit({
						id: entry.id,
						name,
						action: "redo",
						state,
						current: this._current,
					});
				};

				entry.undo = undoWrapper;
				entry.redo = redoWrapper;

				if (!extra.recordHistory) return entry;

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
		 * @param {CommandExtraParams} extra Extra running options
		 * @return {Promise<{undo: () => void, redo: () => void}>} The command's return value
		 */
		async runCommand(name, title, options = null, extra = {}) {
			defaultOpt(extra, {
				recordHistory: true,
				extra: {},
			});
			if (!this._types[name])
				throw new ReferenceError(`[commands] Command '${name}' does not exist`);

			return this._types[name](title, options, extra);
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
			!state.imported &&
			(!options ||
				options.image === undefined ||
				options.x === undefined ||
				options.y === undefined)
		)
			throw "Command drawImage requires options in the format: {image, x, y, w?, h?, layer?}";

		// Check if we have state
		if (!state.layer) {
			/** @type {Layer} */
			let layer = options.layer;
			if (!options.layer && state.layerId)
				layer = imageCollection.layers[state.layerId];

			if (!options.layer && !state.layerId) layer = uil.layer;

			state.layer = layer;
			state.context = layer.ctx;

			if (!state.imported) {
				const canvas = document.createElement("canvas");
				canvas.width = options.image.width;
				canvas.height = options.image.height;
				canvas.getContext("2d").drawImage(options.image, 0, 0);

				state.image = canvas;

				// Saving what was in the canvas before the command
				const imgData = state.context.getImageData(
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
				state.original = cutout;
			}
		}

		// Apply command
		state.context.drawImage(
			state.image,
			0,
			0,
			state.image.width,
			state.image.height,
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
	},
	{
		exportfn: (state) => {
			const canvas = document.createElement("canvas");
			canvas.width = state.image.width;
			canvas.height = state.image.height;
			canvas.getContext("2d").drawImage(state.image, 0, 0);

			const originalc = document.createElement("canvas");
			originalc.width = state.original.width;
			originalc.height = state.original.height;
			originalc.getContext("2d").drawImage(state.original, 0, 0);

			return {
				image: canvas.toDataURL(),
				original: originalc.toDataURL(),
				box: state.box,
				layer: state.layer.id,
			};
		},
		importfn: async (value, state) => {
			state.box = value.box;
			state.layerId = value.layer;

			const img = document.createElement("img");
			img.src = value.image;
			await img.decode();

			const imagec = document.createElement("canvas");
			imagec.width = state.box.w;
			imagec.height = state.box.h;
			imagec.getContext("2d").drawImage(img, 0, 0);

			const orig = document.createElement("img");
			orig.src = value.original;
			await orig.decode();

			const originalc = document.createElement("canvas");
			originalc.width = state.box.w;
			originalc.height = state.box.h;
			originalc.getContext("2d").drawImage(orig, 0, 0);

			state.image = imagec;
			state.original = originalc;
		},
	}
);

commands.createCommand(
	"eraseImage",
	(title, options, state) => {
		if (
			!state.imported &&
			(!options ||
				options.x === undefined ||
				options.y === undefined ||
				options.w === undefined ||
				options.h === undefined)
		)
			throw "Command eraseImage requires options in the format: {x, y, w, h, ctx?}";

		if (state.imported) {
			state.layer = imageCollection.layers[state.layerId];
			state.context = state.layer.ctx;
		}

		// Check if we have state
		if (!state.layer) {
			const layer = (options.layer || state.layerId) ?? uil.layer;
			state.layer = layer;
			state.mask = options.mask;
			state.context = layer.ctx;

			// Saving what was in the canvas before the command
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
			cutout
				.getContext("2d")
				.drawImage(
					state.context.canvas,
					options.x,
					options.y,
					options.w,
					options.h,
					0,
					0,
					options.w,
					options.h
				);
			state.original = new Image();
			state.original.src = cutout.toDataURL();
		}

		// Apply command
		const style = state.context.fillStyle;
		state.context.fillStyle = "black";

		const op = state.context.globalCompositeOperation;
		state.context.globalCompositeOperation = "destination-out";

		if (state.mask)
			state.context.drawImage(
				state.mask,
				state.box.x,
				state.box.y,
				state.box.w,
				state.box.h
			);
		else
			state.context.fillRect(
				state.box.x,
				state.box.y,
				state.box.w,
				state.box.h
			);

		state.context.fillStyle = style;
		state.context.globalCompositeOperation = op;
	},
	(title, state) => {
		// Clear destination area
		state.context.clearRect(state.box.x, state.box.y, state.box.w, state.box.h);
		// Undo
		state.context.drawImage(state.original, state.box.x, state.box.y);
	},
	{
		exportfn: (state) => {
			let mask = null;

			if (state.mask) {
				const maskc = document.createElement("canvas");
				maskc.width = state.mask.width;
				maskc.height = state.mask.height;
				maskc.getContext("2d").drawImage(state.mask, 0, 0);

				mask = maskc.toDataURL();
			}

			const originalc = document.createElement("canvas");
			originalc.width = state.original.width;
			originalc.height = state.original.height;
			originalc.getContext("2d").drawImage(state.original, 0, 0);

			return {
				original: originalc.toDataURL(),
				mask,
				box: state.box,
				layer: state.layer.id,
			};
		},
		importfn: async (value, state) => {
			state.box = value.box;
			state.layerId = value.layer;

			if (value.mask) {
				const mask = document.createElement("img");
				mask.src = value.mask;
				await mask.decode();

				const maskc = document.createElement("canvas");
				maskc.width = state.box.w;
				maskc.height = state.box.h;
				maskc.getContext("2d").drawImage(mask, 0, 0);

				state.mask = maskc;
			}

			const orig = document.createElement("img");
			orig.src = value.original;
			await orig.decode();

			const originalc = document.createElement("canvas");
			originalc.width = state.box.w;
			originalc.height = state.box.h;
			originalc.getContext("2d").drawImage(orig, 0, 0);

			state.original = originalc;
		},
	}
);
