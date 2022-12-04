/**
 * The layering UI window
 */

const uil = {
	_ui_layer_list: document.getElementById("layer-list"),
	layers: [],
	_active: null,
	set active(v) {
		Array.from(this._ui_layer_list.children).forEach((child) => {
			child.classList.remove("active");
		});

		v.entry.classList.add("active");

		this._active = v;
	},
	get active() {
		return this._active;
	},

	get layer() {
		return this.active && this.active.layer;
	},

	get canvas() {
		return this.layer && this.active.layer.canvas;
	},

	get ctx() {
		return this.layer && this.active.layer.ctx;
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

				const hideButton = document.createElement("button");
				hideButton.addEventListener(
					"click",
					(evn) => {
						evn.stopPropagation();
						uiLayer.hidden = !uiLayer.hidden;
						if (uiLayer.hidden) {
							uiLayer.entry.classList.add("hidden");
						} else uiLayer.entry.classList.remove("hidden");
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
			}
			// If the layer already exists, just move it here
			else {
				layersEl.children[index].before(uiLayer.entry);
			}
		});

		// Synchronizes with the layer lib
		this.layers.forEach((uiLayer, index) => {
			if (index === 0) uiLayer.layer.moveAfter(bgLayer);
			else uiLayer.layer.moveAfter(copy[index - 1].layer);
		});
	},

	/**
	 * Adds a user-manageable layer for image editing.
	 *
	 * @param {string} group The group the layer belongs to. [does nothing for now]
	 * @param {string} name The name of the new layer.
	 * @returns
	 */
	addLayer(group, name) {
		const layer = imageCollection.registerLayer(null, {
			name,
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
				} else {
					this._hidden = false;
					this.layer.unhide(v);
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
	 * Moves a layer to a specified position
	 *
	 * @param {UserLayer} layer Layer to move
	 * @param {number} position Position to move the layer to
	 */
	moveLayerTo(layer, position) {
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
	 * Moves a layer up a single position
	 *
	 * @param {UserLayer} [layer=uil.active] Layer to move
	 */
	moveLayerUp(layer = uil.active) {
		const index = this.layers.indexOf(layer);
		if (index === -1) throw new ReferenceError("Layer could not be found");
		try {
			this.moveLayerTo(layer, index + 1);
		} catch (e) {}
	},
	/**
	 * Moves a layer down a single position
	 *
	 * @param {UserLayer} [layer=uil.active] Layer to move
	 */
	moveLayerDown(layer = uil.active) {
		const index = this.layers.indexOf(layer);
		if (index === -1) throw new ReferenceError("Layer could not be found");
		try {
			this.moveLayerTo(layer, index - 1);
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
	 * @returns {HTMLCanvasElement}	The canvas element containing visible image data
	 */
	getVisible(bb, options = {}) {
		defaultOpt(options, {
			includeBg: false,
		});

		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");

		canvas.width = bb.w;
		canvas.height = bb.h;
		if (options.includeBg)
			ctx.drawImage(bgLayer.canvas, bb.x, bb.y, bb.w, bb.h, 0, 0, bb.w, bb.h);
		this.layers.forEach((layer) => {
			if (!layer.hidden)
				ctx.drawImage(
					layer.layer.canvas,
					bb.x,
					bb.y,
					bb.w,
					bb.h,
					0,
					0,
					bb.w,
					bb.h
				);
		});

		return canvas;
	},
};
uil.addLayer(null, "Default Image Layer");
