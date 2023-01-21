/**
 * This is a manager for the many canvas and content layers that compose the application
 *
 * It manages canvases and their locations and sizes according to current viewport views
 */
/**
 * Here is where the old magic is created.
 *
 * This is probably not recommended, but it works and
 * is probably the most reliable way to not break everything.
 */
(() => {
	const original = {
		drawImage: CanvasRenderingContext2D.prototype.drawImage,
		getImageData: CanvasRenderingContext2D.prototype.getImageData,
		putImageData: CanvasRenderingContext2D.prototype.putImageData,

		// Drawing methods
		moveTo: CanvasRenderingContext2D.prototype.moveTo,
		lineTo: CanvasRenderingContext2D.prototype.lineTo,

		arc: CanvasRenderingContext2D.prototype.arc,
		fillRect: CanvasRenderingContext2D.prototype.fillRect,
		clearRect: CanvasRenderingContext2D.prototype.clearRect,
	};

	// Backing up original functions to <key>Root
	Object.keys(original).forEach((key) => {
		CanvasRenderingContext2D.prototype[key + "Root"] = function (...args) {
			return original[key].call(this, ...args);
		};
	});

	// Add basic get bounding box support (canvas coordinates)
	Reflect.defineProperty(CanvasRenderingContext2D.prototype, "bb", {
		get: function () {
			return new BoundingBox({
				x: -this.origin.x,
				y: -this.origin.y,
				w: this.canvas.width,
				h: this.canvas.height,
			});
		},
	});

	// Modifying drawImage
	Reflect.defineProperty(CanvasRenderingContext2D.prototype, "drawImage", {
		value: function (...args) {
			switch (args.length) {
				case 3:
				case 5:
					if (this.origin !== undefined) {
						args[1] += this.origin.x;
						args[2] += this.origin.y;
					}
					break;
				case 9:
					// Check for origin on source
					const sctx = args[0].getContext && args[0].getContext("2d");
					if (sctx && sctx.origin !== undefined) {
						args[1] += sctx.origin.x;
						args[2] += sctx.origin.y;
					}

					// Check for origin on destination
					if (this.origin !== undefined) {
						args[5] += this.origin.x;
						args[6] += this.origin.y;
					}
					break;
			}
			// Pass arguments through
			return original.drawImage.call(this, ...args);
		},
	});

	// Modifying getImageData method
	Reflect.defineProperty(CanvasRenderingContext2D.prototype, "getImageData", {
		value: function (...args) {
			if (this.origin) {
				args[0] += this.origin.x;
				args[1] += this.origin.y;
			}
			// Pass arguments through
			return original.getImageData.call(this, ...args);
		},
	});

	// Modifying putImageData method
	Reflect.defineProperty(CanvasRenderingContext2D.prototype, "putImageData", {
		value: function (...args) {
			if (this.origin) {
				args[0] += this.origin.x;
				args[1] += this.origin.y;
			}
			// Pass arguments through
			return original.putImageData.call(this, ...args);
		},
	});

	// Modifying moveTo method
	Reflect.defineProperty(CanvasRenderingContext2D.prototype, "moveTo", {
		value: function (...args) {
			if (this.origin) {
				args[0] += this.origin.x;
				args[1] += this.origin.y;
			}
			// Pass arguments through
			return original.moveTo.call(this, ...args);
		},
	});

	// Modifying lineTo method
	Reflect.defineProperty(CanvasRenderingContext2D.prototype, "lineTo", {
		value: function (...args) {
			if (this.origin) {
				args[0] += this.origin.x;
				args[1] += this.origin.y;
			}
			// Pass arguments through
			return original.lineTo.call(this, ...args);
		},
	});

	// Modifying arc
	Reflect.defineProperty(CanvasRenderingContext2D.prototype, "arc", {
		value: function (...args) {
			if (this.origin) {
				args[0] += this.origin.x;
				args[1] += this.origin.y;
			}
			// Pass arguments through
			return original.arc.call(this, ...args);
		},
	});

	// Modifying fillRect
	Reflect.defineProperty(CanvasRenderingContext2D.prototype, "fillRect", {
		value: function (...args) {
			if (this.origin) {
				args[0] += this.origin.x;
				args[1] += this.origin.y;
			}
			// Pass arguments through
			return original.fillRect.call(this, ...args);
		},
	});
	// Modifying clearRect
	Reflect.defineProperty(CanvasRenderingContext2D.prototype, "clearRect", {
		value: function (...args) {
			if (this.origin) {
				args[0] += this.origin.x;
				args[1] += this.origin.y;
			}
			// Pass arguments through
			return original.clearRect.call(this, ...args);
		},
	});
})();
// End of black magic

const layers = {
	_collections: [],
	collections: makeWriteOnce({}, "layers.collections"),

	listen: {
		oncollectioncreate: new Observer(),
		oncollectiondelete: new Observer(),

		onlayercreate: new Observer(),
		onlayerdelete: new Observer(),
	},

	// Registers a new collection
	// Layer collections are a group of layers (canvases) that are rendered in tandem. (same width, height, position, transform, etc)
	/**
	 *
	 * @param {string} key A key used to identify the collection
	 * @param {Size} size The initial size of the collection in pixels (CSS size)
	 * @param {object} options Extra options for the collection
	 * @param {string} [options.name=key] The display name of the collection
	 * @param {{key: string, options: object}} [options.initLayer] The configuration for the initial layer to be created
	 * @param {number} [options.inputSizeMultiplier=9] Size of the input area element, in pixels
	 * @param {HTMLElement} [options.targetElement] Element the collection will be inserted into
	 * @param {Size} [options.resolution=size] The resolution of the collection (canvas size). Not sure it works.
	 * @returns {LayerCollection} The newly created layer collection
	 */
	registerCollection: (key, size, options = {}) => {
		defaultOpt(options, {
			// Display name for the collection
			name: key,

			// Initial layer
			initLayer: {
				key: "default",
				options: {},
			},

			// Input multiplier (Size of the input element div)
			inputSizeMultiplier: 9,

			// Target
			targetElement: document.getElementById("layer-render"),

			// Resolution of the image
			resolution: size,
		});

		if (options.inputSizeMultiplier % 2 === 0) options.inputSizeMultiplier++;

		// Path used for logging purposes
		const _logpath = "layers.collections." + key;

		// Collection ID
		const id = guid();

		// Collection element
		const element = document.createElement("div");
		element.id = `collection-${id}`;
		element.style.width = `${size.w}px`;
		element.style.height = `${size.h}px`;
		element.classList.add("collection");

		// Input element (overlay element for input handling)
		const inputel = document.createElement("div");
		inputel.id = `collection-input-${id}`;
		inputel.classList.add("collection-input-overlay");
		element.appendChild(inputel);

		options.targetElement.appendChild(element);

		/** @type {LayerCollection} */
		const collection = makeWriteOnce(
			{
				id,

				_logpath,

				_layers: [],
				layers: {},

				key,
				name: options.name,
				element,
				inputElement: inputel,
				_inputOffset: null,
				get inputOffset() {
					return this._inputOffset;
				},

				_origin: {x: 0, y: 0},
				get origin() {
					return {...this._origin};
				},

				get bb() {
					return new BoundingBox({
						x: -this.origin.x,
						y: -this.origin.y,
						w: this.size.w,
						h: this.size.h,
					});
				},

				_resizeInputDiv() {
					// Set offset
					const oldOffset = {...this._inputOffset};
					this._inputOffset = {
						x:
							-Math.floor(options.inputSizeMultiplier / 2) * size.w -
							this._origin.x,
						y:
							-Math.floor(options.inputSizeMultiplier / 2) * size.h -
							this._origin.y,
					};

					// Resize the input element
					this.inputElement.style.left = `${this.inputOffset.x}px`;
					this.inputElement.style.top = `${this.inputOffset.y}px`;
					this.inputElement.style.width = `${
						size.w * options.inputSizeMultiplier
					}px`;
					this.inputElement.style.height = `${
						size.h * options.inputSizeMultiplier
					}px`;

					// Move elements inside to new offset
					for (const child of this.inputElement.children) {
						if (child.style.position === "absolute") {
							child.style.left = `${
								parseInt(child.style.left, 10) +
								oldOffset.x -
								this._inputOffset.x
							}px`;
							child.style.top = `${
								parseInt(child.style.top, 10) +
								oldOffset.y -
								this._inputOffset.y
							}px`;
						}
					}
				},

				/**
				 * Expands the collection and its full layers by the specified amounts
				 *
				 * @param {number} left Pixels to expand left
				 * @param {number} top Pixels to expand top
				 * @param {number} right Pixels to expand right
				 * @param {number} bottom Pixels to expand bottom
				 */
				expand(left, top, right, bottom) {
					this._layers.forEach((layer) => {
						if (layer.full) layer._expand(left, top, right, bottom);
					});

					this._origin.x += left;
					this._origin.y += top;

					this.size.w += left + right;
					this.size.h += top + bottom;

					this._resizeInputDiv();

					for (const layer of this._layers) {
						layer.moveTo(layer.x, layer.y);
					}
				},

				size,
				resolution: options.resolution,

				/**
				 * Registers a new layer
				 *
				 * @param {string | null} key Name and key to use to access layer. If null, it is a temporary layer.
				 * @param {object} options
				 * @param {string} options.name
				 * @param {?BoundingBox} options.bb
				 * @param {string} [options.category]
				 * @param {{w: number, h: number}} options.resolution
				 * @param {?string} options.group
				 * @param {object} options.after
				 * @param {object} options.ctxOptions
				 * @returns {Layer} The newly created layer
				 */
				registerLayer(key = null, options = {}) {
					// Make ID
					const id = guid();

					defaultOpt(options, {
						// Display name for the layer
						name: key || `Temporary ${id}`,

						// Bounding box for layer
						bb: {
							x: -collection.origin.x,
							y: -collection.origin.y,
							w: collection.size.w,
							h: collection.size.h,
						},

						// Category of the layer
						category: null,

						// Resolution for layer
						resolution: null,

						// Group for the layer ("group/subgroup/subsubgroup")
						group: null,

						// If set, will insert the layer after the given one
						after: null,

						// Context creation options
						ctxOptions: {},
					});

					// Check if the layer is full
					let full = false;
					if (
						options.bb.x === -collection.origin.x &&
						options.bb.y === -collection.origin.y &&
						options.bb.w === collection.size.w &&
						options.bb.h === collection.size.h
					)
						full = true;

					if (!options.resolution)
						// Calculate resolution
						options.resolution = {
							w: Math.round(
								(collection.resolution.w / collection.size.w) * options.bb.w
							),
							h: Math.round(
								(collection.resolution.h / collection.size.h) * options.bb.h
							),
						};

					// This layer's canvas
					// This is where black magic will take place in the future
					/**
					 * @todo Use the canvas black arts to auto-scale canvas
					 */
					const canvas = document.createElement("canvas");
					canvas.id = `layer-${id}`;

					canvas.style.left = `${options.bb.x}px`;
					canvas.style.top = `${options.bb.y}px`;
					canvas.style.width = `${options.bb.w}px`;
					canvas.style.height = `${options.bb.h}px`;
					canvas.width = options.resolution.w;
					canvas.height = options.resolution.h;

					if (!options.after) collection.element.appendChild(canvas);
					else {
						options.after.canvas.after(canvas);
					}

					/**
					 * Here we set the context origin for using the black magic.
					 */
					const ctx = canvas.getContext("2d", options.ctxOptions);
					if (full) {
						// Modify context to add origin information
						ctx.origin = {
							get x() {
								return collection.origin.x;
							},
							get y() {
								return collection.origin.y;
							},
						};
					}

					// Path used for logging purposes
					const _layerlogpath = key
						? _logpath + ".layers." + key
						: _logpath + ".layers[" + id + "]";
					const layer = makeWriteOnce(
						{
							_logpath: _layerlogpath,
							_collection: collection,

							_bb: new BoundingBox(options.bb),
							get bb() {
								return new BoundingBox(this._bb);
							},

							resolution: new Size(options.resolution),
							id,
							key,
							name: options.name,
							full,
							category: options.category,

							state: new Proxy(
								{visible: true},
								{
									set(obj, opt, val) {
										switch (opt) {
											case "visible":
												layer.canvas.style.display = val ? "block" : "none";
												break;
										}
										obj[opt] = val;
									},
								}
							),

							get x() {
								return this._bb.x;
							},

							get y() {
								return this._bb.y;
							},

							get width() {
								return this._bb.w;
							},

							get height() {
								return this._bb.h;
							},

							get w() {
								return this._bb.w;
							},

							get h() {
								return this._bb.h;
							},

							get origin() {
								return this._collection.origin;
							},

							get hidden() {
								return !this.state.visible;
							},

							/** Our canvas */
							canvas,
							ctx,

							/**
							 * This is called by the collection when the layer must be expanded.
							 *
							 * Should NOT be called directly
							 *
							 * @param {number} left Pixels to expand left
							 * @param {number} top Pixels to expand top
							 * @param {number} right Pixels to expand right
							 * @param {number} bottom Pixels to expand bottom
							 */
							_expand(left, top, right, bottom) {
								const tmpCanvas = document.createElement("canvas");
								tmpCanvas.width = this.w;
								tmpCanvas.height = this.h;
								tmpCanvas.getContext("2d").drawImage(this.canvas, 0, 0);

								this.resize(this.w + left + right, this.h + top + bottom);
								this.clear();
								this.ctx.drawImageRoot(tmpCanvas, left, top);

								this.moveTo(this.x - left, this.y - top);
							},

							/**
							 * Clears the layer contents
							 */
							clear() {
								this.ctx.clearRectRoot(
									0,
									0,
									this.canvas.width,
									this.canvas.height
								);
							},

							/**
							 * Recalculates DOM positioning
							 */
							syncDOM() {
								this.moveTo(this.x, this.y);
								this.resize(this.w, this.h);
							},

							/**
							 * Moves this layer to another level (after given layer)
							 *
							 * @param {Layer} layer Will move layer to after this one
							 */
							moveAfter(layer) {
								layer.canvas.after(this.canvas);
							},

							/**
							 * Moves this layer to another level (before given layer)
							 *
							 * @param {Layer} layer Will move layer to before this one
							 */
							moveBefore(layer) {
								layer.canvas.before(this.canvas);
							},

							/**
							 * Moves this layer to another location
							 *
							 * @param {number} x X coordinate of the top left of the canvas
							 * @param {number} y Y coordinate of the top left of the canvas
							 */
							moveTo(x, y) {
								this._bb.x = x;
								this._bb.y = y;
								this.canvas.style.left = `${x}px`;
								this.canvas.style.top = `${y}px`;
							},

							/**
							 * Resizes layer in place
							 *
							 * @param {number} w New width
							 * @param {number} h New height
							 */
							resize(w, h) {
								canvas.width = Math.round(
									options.resolution.w * (w / options.bb.w)
								);
								canvas.height = Math.round(
									options.resolution.h * (h / options.bb.h)
								);
								this._bb.w = w;
								this._bb.h = h;
								canvas.style.width = `${w}px`;
								canvas.style.height = `${h}px`;
							},

							// Hides this layer (don't draw)
							hide() {
								this.canvas.style.display = "none";
							},
							// Hides this layer (don't draw)
							unhide() {
								this.canvas.style.display = "block";
							},
						},
						_layerlogpath
					);

					// Add to indexers
					if (!options.after) collection._layers.push(layer);
					else {
						const index = collection._layers.findIndex(
							(l) => l === options.after
						);
						collection._layers.splice(index, 0, layer);
					}
					if (key) collection.layers[key] = layer;
					collection.layers[id] = layer;

					if (key === null)
						console.debug(
							`[layers] Anonymous layer '${layer.name}' registered`
						);
					else
						console.info(
							`[layers] Layer '${layer.name}' at ${layer._logpath} registered`
						);

					layers.listen.onlayercreate.emit({
						layer,
					});
					return layer;
				},

				/**
				 *	Deletes a layer from the collection
				 *
				 * @param {Layer} layer Layer to delete
				 */
				deleteLayer: (layer) => {
					const lobj = collection._layers.splice(
						collection._layers.findIndex(
							(l) => l.id === layer || l.id === layer.id
						),
						1
					)[0];
					if (!lobj) return;

					layers.listen.onlayerdelete.emit({
						layer: lobj,
					});
					if (lobj.key) collection.layers[lobj.key] = undefined;
					collection.layers[lobj.id] = undefined;

					collection.element.removeChild(lobj.canvas);

					if (lobj.key) console.info(`[layers] Layer '${lobj.key}' deleted`);
					else console.debug(`[layers] Anonymous layer '${lobj.id}' deleted`);
				},
			},
			_logpath,
			["_inputOffset"]
		);

		collection._resizeInputDiv();

		layers._collections.push(collection);
		layers.collections[key] = collection;

		console.info(
			`[layers] Collection '${options.name}' at ${_logpath} registered`
		);

		return collection;
	},
};
