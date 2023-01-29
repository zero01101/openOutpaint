/**
 * The layering UI window
 */

const uil = {
	/** @type {Observer<{uilayer: UILayer}>} */
	onactive: new Observer(),

	_ui_layer_list: document.getElementById("layer-list"),
	layers: [],
	layerIndex: {},
	_active: null,
	set active(v) {
		this.onactive.emit({
			uilayer: v,
		});

		Array.from(this._ui_layer_list.children).forEach((child) => {
			child.classList.remove("active");
		});

		v.entry.classList.add("active");

		this._active = v;
	},
	get active() {
		return this._active;
	},

	/** @type {Layer} */
	get layer() {
		return this.active && this.active.layer;
	},

	get canvas() {
		return this.layer && this.active.layer.canvas;
	},

	get ctx() {
		return this.layer && this.active.layer.ctx;
	},

	get w() {
		return imageCollection.size.w;
	},
	get h() {
		return imageCollection.size.h;
	},

	/**
	 * Synchronizes layer array to DOM
	 */
	_syncLayers() {
		const layersEl = document.getElementById("layer-list");

		const copy = this.layers.map((i) => i);
		copy.reverse();

		copy.forEach((uiLayer, index) => {
			// If we have the correct layer here, then do nothing
			if (
				layersEl.children[index] &&
				layersEl.children[index].id === `ui-layer-${uiLayer.id}`
			)
				return;

			// If the layer we are processing does not exist, then create it and add before current element
			if (!uiLayer.entry) {
				uiLayer.entry = document.createElement("div");
				uiLayer.entry.id = `ui-layer-${uiLayer.id}`;
				uiLayer.entry.classList.add("ui-layer");
				uiLayer.entry.addEventListener("click", () => {
					this.active = uiLayer;
				});

				// Title Element
				const titleEl = document.createElement("input");
				titleEl.classList.add("title");
				titleEl.value = uiLayer.name;
				titleEl.style.pointerEvents = "none";

				const deselect = () => {
					titleEl.style.pointerEvents = "none";
					titleEl.setSelectionRange(0, 0);
				};

				titleEl.addEventListener("blur", deselect);
				uiLayer.entry.appendChild(titleEl);

				uiLayer.entry.addEventListener("change", () => {
					const name = titleEl.value.trim();
					titleEl.value = name;
					uiLayer.entry.title = name;

					uiLayer.name = name;

					this._syncLayers();

					titleEl.blur();
				});
				uiLayer.entry.addEventListener("dblclick", () => {
					titleEl.style.pointerEvents = "auto";
					titleEl.focus();
					titleEl.select();
				});

				// Add action buttons
				const actionArray = document.createElement("div");
				actionArray.classList.add("actions");

				if (uiLayer.deletable) {
					const deleteButton = document.createElement("button");
					deleteButton.addEventListener(
						"click",
						(evn) => {
							evn.stopPropagation();
							commands.runCommand(
								"deleteLayer",
								"Deleted Layer",
								{
									layer: uiLayer,
								},
								{
									extra: {
										log: `Deleted Layer ${uiLayer.name} [${uiLayer.id}]`,
									},
								}
							);
						},
						{passive: false}
					);

					deleteButton.addEventListener(
						"dblclick",
						(evn) => {
							evn.stopPropagation();
						},
						{passive: false}
					);
					deleteButton.title = "Delete Layer";
					deleteButton.appendChild(document.createElement("div"));
					deleteButton.classList.add("delete-btn");

					actionArray.appendChild(deleteButton);
				}

				const hideButton = document.createElement("button");
				hideButton.addEventListener(
					"click",
					(evn) => {
						evn.stopPropagation();
						uiLayer.hidden = !uiLayer.hidden;
					},
					{passive: false}
				);
				hideButton.addEventListener(
					"dblclick",
					(evn) => {
						evn.stopPropagation();
					},
					{passive: false}
				);
				hideButton.title = "Hide/Unhide Layer";
				hideButton.appendChild(document.createElement("div"));
				hideButton.classList.add("hide-btn");

				actionArray.appendChild(hideButton);
				uiLayer.entry.appendChild(actionArray);

				if (layersEl.children[index])
					layersEl.children[index].before(uiLayer.entry);
				else layersEl.appendChild(uiLayer.entry);
			} else if (!layersEl.querySelector(`#ui-layer-${uiLayer.id}`)) {
				// If layer exists but is not on the DOM, add it back
				if (index === 0) layersEl.children[0].before(uiLayer.entry);
				else layersEl.children[index - 1].after(uiLayer.entry);
			} else {
				// If the layer already exists, just move it here
				layersEl.children[index].before(uiLayer.entry);
			}
		});

		// Deletes layer if not in array
		for (var i = 0; i < layersEl.children.length; i++) {
			if (!copy.find((l) => layersEl.children[i].id === `ui-layer-${l.id}`)) {
				layersEl.children[i].remove();
			}
		}

		// Synchronizes with the layer lib
		const ids = this.layers.map((l) => l.id);
		ids.forEach((id, index) => {
			if (index === 0) this.layerIndex[id].layer.moveAfter(bgLayer);
			else
				this.layerIndex[id].layer.moveAfter(
					this.layerIndex[ids[index - 1]].layer
				);
		});
	},

	/**
	 * Adds a user-manageable layer for image editing.
	 *
	 * Should not be called directly. Use the command instead.
	 *
	 * @param {string} group The group the layer belongs to. [does nothing for now]
	 * @param {string} name The name of the new layer.
	 * @returns
	 */
	_addLayer(group, name) {
		const layer = imageCollection.registerLayer(null, {
			name,
			category: "user",
			after:
				(this.layers.length > 0 && this.layers[this.layers.length - 1].layer) ||
				bgLayer,
		});

		const uiLayer = {
			id: layer.id,
			group,
			name,
			_hidden: false,
			set hidden(v) {
				if (v) {
					this._hidden = true;
					this.layer.hide(v);
					this.entry && this.entry.classList.add("hidden");
				} else {
					this._hidden = false;
					this.layer.unhide(v);
					this.entry && this.entry.classList.remove("hidden");
				}
			},
			get hidden() {
				return this._hidden;
			},
			entry: null,
			layer,
		};
		this.layers.push(uiLayer);

		this._syncLayers();

		this.active = uiLayer;

		return uiLayer;
	},

	/**
	 * Moves a layer to a specified position.
	 *
	 * Should not be called directly. Use the command instead.
	 *
	 * @param {UserLayer} layer Layer to move
	 * @param {number} position Position to move the layer to
	 */
	_moveLayerTo(layer, position) {
		if (position < 0 || position >= this.layers.length)
			throw new RangeError("Position out of bounds");

		const index = this.layers.indexOf(layer);
		if (index !== -1) {
			if (this.layers.length < 2) return; // Do nothing if moving a layer doesn't make sense

			this.layers.splice(index, 1);
			this.layers.splice(position, 0, layer);

			this._syncLayers();

			return;
		}
		throw new ReferenceError("Layer could not be found");
	},
	/**
	 * Moves a layer up a single position.
	 *
	 * Should not be called directly. Use the command instead.
	 *
	 * @param {UserLayer} [layer=uil.active] Layer to move
	 */
	_moveLayerUp(layer = uil.active) {
		const index = this.layers.indexOf(layer);
		if (index === -1) throw new ReferenceError("Layer could not be found");
		try {
			this._moveLayerTo(layer, index + 1);
		} catch (e) {}
	},
	/**
	 * Moves a layer down a single position.
	 *
	 * Should not be called directly. Use the command instead.
	 *
	 * @param {UserLayer} [layer=uil.active] Layer to move
	 */
	_moveLayerDown(layer = uil.active) {
		const index = this.layers.indexOf(layer);
		if (index === -1) throw new ReferenceError("Layer could not be found");
		try {
			this._moveLayerTo(layer, index - 1);
		} catch (e) {}
	},
	/**
	 * Function that returns a canvas with full visible information of a certain bounding box.
	 *
	 * For now, only the img is used.
	 *
	 * @param {BoundingBox} bb The bouding box to get visible data from
	 * @param {object} [options] Options
	 * @param {boolean} [options.includeBg=false] Whether to include the background
	 * @param {string[]} [options.categories] Categories of layers to consider visible
	 * @returns {HTMLCanvasElement}	The canvas element containing visible image data
	 */
	getVisible(bb, options = {}) {
		defaultOpt(options, {
			includeBg: false,
			categories: ["user", "image"],
		});

		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");

		canvas.width = bb.w;
		canvas.height = bb.h;

		const categories = new Set(options.categories);
		if (options.includeBg) categories.add("background");
		const layers = imageCollection._layers;

		layers.reduceRight((_, layer) => {
			if (categories.has(layer.category) && !layer.hidden)
				ctx.drawImage(layer.canvas, bb.x, bb.y, bb.w, bb.h, 0, 0, bb.w, bb.h);
		});

		return canvas;
	},
};

class UILayer {
	/** @type {string} Layer ID */
	id;

	/** @type {string} Display name of the layer */
	name;

	/** @type {Layer} Associated real layer */
	layer;

	/** @type {string} Custom key to access this layer */
	key;

	/** @type {string} The group the UI layer is on (for some categorization) */
	group;

	/** @type {boolean} If the layer displays the delete button */
	deletable;

	/** @type {HTMLElement} The entry element on the UI */
	entry;

	/** @type {boolean} [internal] Whether the layer is actually hidden right now */
	_hidden;

	/** @type {boolean} Whether the layer is hidden or not */
	set hidden(v) {
		if (v) {
			this._hidden = true;
			this.layer.hide(v);
			this.entry && this.entry.classList.add("hidden");
		} else {
			this._hidden = false;
			this.layer.unhide(v);
			this.entry && this.entry.classList.remove("hidden");
		}
	}
	get hidden() {
		return this._hidden;
	}

	/** @type {CanvasRenderingContext2D} */
	get ctx() {
		return this.layer.ctx;
	}

	/** @type {HTMLCanvasElement} */
	get canvas() {
		return this.layer.canvas;
	}

	/**
	 * Creates a new UI Layer
	 *
	 * @param {string} name Display name of the layer
	 * @param {object} extra
	 * @param {string} extra.id The id of the layer to create
	 * @param {string} extra.group The group the layer is on (for some categorization)
	 * @param {string} extra.key Custom key to access this layer
	 * @param {string} extra.deletable If the layer displays the delete button
	 */
	constructor(name, extra = {}) {
		defaultOpt(extra, {
			id: null,
			group: null,
			key: null,
			deletable: true,
		});

		this.layer = imageCollection.registerLayer(extra.key, {
			id: extra.id,
			name,
			category: "user",
			after:
				(uil.layers.length > 0 && uil.layers[uil.layers.length - 1].layer) ||
				bgLayer,
		});

		this.name = name;
		this.id = this.layer.id;
		this.key = extra.key;
		this.group = extra.group;
		this.deletable = extra.deletable;

		this.hidden = false;
	}

	/**
	 * Register layer in uil
	 */
	register() {
		uil.layers.push(this);
		uil.layerIndex[this.id] = this;
		uil.layerIndex[this.key] = this;
	}

	/**
	 * Removes layer registration from uil
	 */
	unregister() {
		const index = uil.layers.findIndex((v) => v === this);

		if (index === -1) throw new ReferenceError("Layer could not be found");

		if (uil.active === this)
			uil.active = uil.layers[index + 1] || uil.layers[index - 1];
		uil.layers.splice(index, 1);
		uil.layerIndex[this.id] = undefined;
		uil.layerIndex[this.key] = undefined;
	}
}

/**
 * Command for creating a new layer
 */
commands.createCommand(
	"addLayer",
	(title, opt, state) => {
		const options = Object.assign({}, opt) || {};
		const id = guid();
		defaultOpt(options, {
			id,
			group: null,
			name: id,
			key: null,
			deletable: true,
		});

		if (!state.layer) {
			let {id, name, group, key, deletable} = state;

			if (!state.imported) {
				id = options.id;
				name = options.name;
				group = options.group;
				key = options.key;
				deletable = options.deletable;

				state.name = name;
				state.group = group;
				state.key = key;
				state.deletable = deletable;
			}

			state.layer = new UILayer(name, {
				id,
				group,
				key: key,
				deletable: deletable,
			});

			if (state.hidden !== undefined) state.layer.hidden = state.hidden;

			state.id = state.layer.id;
		}

		state.layer.register();

		uil._syncLayers();

		uil.active = state.layer;
	},
	(title, state) => {
		state.layer.unregister();

		uil._syncLayers();
	},
	{
		exportfn(state) {
			return {
				id: state.layer.id,
				hidden: state.layer.hidden,

				name: state.layer.name,
				group: state.group,
				key: state.key,
				deletable: state.deletable,
			};
		},
		importfn(value, state) {
			state.id = value.id;
			state.hidden = value.hidden;

			state.name = value.name;
			state.group = value.group;
			state.key = value.key;
			state.deletable = value.deletable;
		},
	}
);

/**
 * Command for moving a layer to a position
 */
commands.createCommand(
	"moveLayer",
	(title, opt, state) => {
		const options = opt || {};
		defaultOpt(options, {
			layer: null,
			to: null,
			delta: null,
		});

		if (!state.layer) {
			if (options.to === null && options.delta === null)
				throw new Error(
					"[layers.moveLayer] Options must contain one of {to?, delta?}"
				);

			const layer = options.layer || uil.active;

			const index = uil.layers.indexOf(layer);
			if (index === -1) throw new ReferenceError("Layer could not be found");

			let position = options.to;

			if (position === null) position = index + options.delta;

			state.layer = layer;
			state.oldposition = index;
			state.position = position;
		}

		uil._moveLayerTo(state.layer, state.position);
	},
	(title, state) => {
		uil._moveLayerTo(state.layer, state.oldposition);
	},
	{
		exportfn(state) {
			return {
				layer: state.layer.id,
				position: state.position,
				oldposition: state.oldposition,
			};
		},
		importfn(value, state) {
			state.layer = uil.layerIndex[value.layer];
			state.position = value.position;
			state.oldposition = value.oldposition;
		},
	}
);

/**
 * Command for deleting a layer
 */
commands.createCommand(
	"deleteLayer",
	(title, opt, state) => {
		const options = opt || {};
		defaultOpt(options, {
			layer: null,
		});

		if (!state.layer) {
			const layer = options.layer || uil.active;

			if (!layer.deletable)
				throw new TypeError("[layer.deleteLayer] Layer is not deletable");

			const index = uil.layers.indexOf(layer);
			if (index === -1)
				throw new ReferenceError(
					"[layer.deleteLayer] Layer could not be found"
				);

			state.layer = layer;
			state.position = index;
		}

		if (uil.active === state.layer)
			uil.active =
				uil.layers[state.position - 1] || uil.layers[state.position + 1];
		uil.layers.splice(state.position, 1);

		uil._syncLayers();

		state.layer.hidden = true;
	},
	(title, state) => {
		uil.layers.splice(state.position, 0, state.layer);
		uil.active = state.layer;

		uil._syncLayers();

		state.layer.hidden = false;
	},
	{
		exportfn(state) {
			return {
				layer: state.layer.id,
				position: state.position,
			};
		},
		importfn(value, state) {
			state.layer = uil.layerIndex[value.layer];
			state.position = value.position;
		},
	}
);

/**
 * Command for merging a layer into the layer below it
 */
commands.createCommand(
	"mergeLayer",
	async (title, opt, state) => {
		const options = opt || {};
		defaultOpt(options, {
			layerS: null,
			layerD: null,
		});

		if (state.imported) {
			state.layerS = uil.layerIndex[state.layerSID];
			state.layerD = uil.layerIndex[state.layerDID];
		}

		if (!state.layerS) {
			const layerS = options.layer || uil.active;

			if (!layerS.deletable)
				throw new TypeError(
					"[layer.mergeLayer] Layer is a undeletable layer and cannot be merged"
				);

			const index = uil.layers.indexOf(layerS);
			if (index === -1)
				throw new ReferenceError("[layer.mergeLayer] Layer could not be found");

			if (index === 0 && !options.layerD)
				throw new ReferenceError(
					"[layer.mergeLayer] No layer below source layer exists"
				);

			// Use layer under source layer to merge into if not given
			const layerD = options.layerD || uil.layers[index - 1];

			state.layerS = layerS;
			state.layerD = layerD;
		}

		// REFERENCE: This is a great reference for metacommands (commands that use other commands)
		// These commands should NOT record history as we are already executing a command
		state.drawCommand = await commands.runCommand(
			"drawImage",
			"Merge Layer Draw",
			{
				image: state.layerS.layer.canvas,
				x: 0,
				y: 0,
				layer: state.layerD.layer,
			},
			{recordHistory: false}
		);
		state.delCommand = await commands.runCommand(
			"deleteLayer",
			"Merge Layer Delete",
			{layer: state.layerS},
			{recordHistory: false}
		);
	},
	(title, state) => {
		state.drawCommand.undo();
		state.delCommand.undo();
	},
	{
		redo: (title, options, state) => {
			state.drawCommand.redo();
			state.delCommand.redo();
		},
		exportfn(state) {
			return {
				layerS: state.layerS.id,
				layerD: state.layerD.id,
			};
		},
		importfn(value, state) {
			state.layerSID = value.layerS;
			state.layerDID = value.layerD;
		},
	}
);

commands.runCommand(
	"addLayer",
	"Initial Layer Creation",
	{name: "Default Image Layer", key: "default", deletable: false},
	{recordHistory: false}
);
