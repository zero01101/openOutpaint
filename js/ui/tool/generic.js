/**
 * File to add generic rendering functions and shared utilities
 */

const _tool = {
	/**
	 *  Draws a reticle used for image generation
	 *
	 * @param {BoundingBox} bb The bounding box of the reticle (world space)
	 * @param {string} tool Name of the tool to diplay
	 * @param {{w: number, h: number}} resolution Resolution of generation to display
	 * @param {object} style Styles to use for rendering the reticle
	 * @param {string} [style.sizeTextStyle = "#FFF5"] Style of the text for diplaying the bounding box size.
	 * @param {string} [style.genSizeTextStyle = "#FFF5"] Style of the text for diplaying generation size
	 * @param {string} [style.toolTextStyle = "#FFF5"] Style of the text for the tool name
	 * @param {number} [style.reticleWidth = 1] Width of the line of the reticle
	 * @param {string} [style.reticleStyle] Style of the line of the reticle
	 *
	 * @returns A function that erases this reticle drawing
	 */
	_reticle_draw(bb, tool, resolution, style = {}) {
		defaultOpt(style, {
			sizeTextStyle: "#FFF5",
			genSizeTextStyle: "#FFF5",
			toolTextStyle: "#FFF5",
			reticleWidth: 1,
			reticleStyle: global.hasActiveInput ? "#BBF" : "#FFF",
		});

		const bbvp = bb.transform(viewport.c2v);

		uiCtx.save();

		// Draw targeting square reticle thingy cursor
		uiCtx.lineWidth = style.reticleWidth;
		uiCtx.strokeStyle = style.reticleStyle;
		uiCtx.strokeRect(bbvp.x, bbvp.y, bbvp.w, bbvp.h); // Origin is middle of the frame

		uiCtx.font = `bold 20px Open Sans`;

		// Draw Tool Name
		if (bb.h > 40) {
			const xshrink = Math.min(
				1,
				(bbvp.w - 20) / uiCtx.measureText(tool).width
			);

			uiCtx.font = `bold ${20 * xshrink}px Open Sans`;

			uiCtx.textAlign = "left";
			uiCtx.fillStyle = style.toolTextStyle;
			uiCtx.fillText(tool, bbvp.x + 10, bbvp.y + 10 + 20 * xshrink, bb.w);
		}

		// Draw width and height
		{
			// Render Cursor Width
			uiCtx.textAlign = "center";
			uiCtx.fillStyle = style.sizeTextStyle;
			uiCtx.translate(bbvp.x + bbvp.w / 2, bbvp.y + bbvp.h / 2);
			const xshrink = Math.min(
				1,
				(bbvp.w - 30) / uiCtx.measureText(`${bb.w}px`).width
			);
			const yshrink = Math.min(
				1,
				(bbvp.h - 30) / uiCtx.measureText(`${bb.h}px`).width
			);
			uiCtx.font = `bold ${20 * xshrink}px Open Sans`;
			uiCtx.fillText(`${bb.w}px`, 0, bbvp.h / 2 - 10 * xshrink, bb.w);

			// Render Generation Width
			uiCtx.fillStyle = style.genSizeTextStyle;
			uiCtx.font = `bold ${10 * xshrink}px Open Sans`;
			if (bb.w !== resolution.w)
				uiCtx.fillText(`${resolution.w}px`, 0, bbvp.h / 2 - 30 * xshrink, bb.h);

			// Render Cursor Height
			uiCtx.rotate(-Math.PI / 2);
			uiCtx.fillStyle = style.sizeTextStyle;
			uiCtx.font = `bold ${20 * yshrink}px Open Sans`;
			uiCtx.fillText(`${bb.h}px`, 0, bbvp.w / 2 - 10 * yshrink, bb.h);

			// Render Generation Height
			uiCtx.fillStyle = style.genSizeTextStyle;
			uiCtx.font = `bold ${10 * yshrink}px Open Sans`;
			if (bb.h !== resolution.h)
				uiCtx.fillText(`${resolution.h}px`, 0, bbvp.w / 2 - 30 * xshrink, bb.h);

			uiCtx.restore();
		}

		return () => {
			uiCtx.save();

			uiCtx.clearRect(bbvp.x - 64, bbvp.y - 64, bbvp.w + 128, bbvp.h + 128);

			uiCtx.restore();
		};
	},

	/**
	 * Draws a generic crosshair cursor at the specified location
	 *
	 * @param {number} x X world coordinate of the cursor
	 * @param {number} y Y world coordinate of the cursor
	 * @param {object} style Style of the lines of the cursor
	 * @param {string} [style.width = 3] Line width of the lines of the cursor
	 * @param {string} [style.style] Stroke style of the lines of the cursor
	 *
	 * @returns A function that erases this cursor drawing
	 */
	_cursor_draw(x, y, style = {}) {
		defaultOpt(style, {
			width: 3,
			style: global.hasActiveInput ? "#BBF5" : "#FFF5",
		});
		const vpc = viewport.canvasToView(x, y);

		// Draw current cursor location
		uiCtx.lineWidth = style.width;
		uiCtx.strokeStyle = style.style;

		uiCtx.beginPath();
		uiCtx.moveTo(vpc.x, vpc.y + 10);
		uiCtx.lineTo(vpc.x, vpc.y - 10);
		uiCtx.moveTo(vpc.x + 10, vpc.y);
		uiCtx.lineTo(vpc.x - 10, vpc.y);
		uiCtx.stroke();
		return () => {
			uiCtx.clearRect(vpc.x - 15, vpc.y - 15, vpc.x + 30, vpc.y + 30);
		};
	},

	/**
	 * Creates generic handlers for dealing with draggable selection areas
	 *
	 * @param {object} state State of the tool
	 * @param {boolean} state.snapToGrid Whether the cursor should snap to the grid
	 * @param {() => void} [state.redraw] Function to redraw the cursor
	 * @returns
	 */
	_draggable_selection(state) {
		const selection = {
			_inside: false,
			_dirty_bb: true,
			_cached_bb: null,
			_selected: null,

			/**
			 * If the cursor is cursor is currently inside the selection
			 */
			get inside() {
				return this._inside;
			},

			/**
			 * Get intermediate selection object
			 */
			get selected() {
				return this._selected;
			},

			/**
			 * If the selection exists
			 */
			get exists() {
				return !!this._selected;
			},

			/**
			 * Gets the selection bounding box
			 *
			 * @returns {BoundingBox}
			 */
			get bb() {
				if (this._dirty_bb && this._selected) {
					this._cached_bb = BoundingBox.fromStartEnd(
						this._selected.start,
						this._selected.now
					);
					this._dirty_bb = false;
				}
				return this._selected && this._cached_bb;
			},

			/**
			 * When the cursor enters the selection
			 */
			onenter: new Observer(),

			/**
			 * When the cursor leaves the selection
			 */
			onleave: new Observer(),

			// Utility methods
			deselect() {
				if (this.inside) {
					this._inside = false;
					this.onleave.emit({evn: null});
				}
				this._selected = null;
			},

			// Dragging handlers
			/**
			 * Drag start event handler
			 *
			 * @param {Point} evn Drag start event
			 */
			dragstartcb(evn) {
				const x = state.snapToGrid ? evn.ix + snap(evn.ix, 0, 64) : evn.ix;
				const y = state.snapToGrid ? evn.iy + snap(evn.iy, 0, 64) : evn.iy;
				this._selected = {start: {x, y}, now: {x, y}};
				this._dirty_bb = true;
			},
			/**
			 * Drag event handler
			 *
			 * @param {Point} evn Drag event
			 */
			dragcb(evn) {
				const x = state.snapToGrid ? evn.x + snap(evn.x, 0, 64) : evn.x;
				const y = state.snapToGrid ? evn.y + snap(evn.y, 0, 64) : evn.y;

				if (x !== this._selected.now.x || y !== this._selected.now.y) {
					this._selected.now = {x, y};
					this._dirty_bb = true;
				}
			},
			/**
			 * Drag end event handler
			 *
			 * @param {Point} evn Drag end event
			 */
			dragendcb(evn) {
				const x = state.snapToGrid ? evn.x + snap(evn.x, 0, 64) : evn.x;
				const y = state.snapToGrid ? evn.y + snap(evn.y, 0, 64) : evn.y;

				this._selected.now = {x, y};
				this._dirty_bb = true;

				if (
					this._selected.start.x === this._selected.now.x ||
					this._selected.start.y === this._selected.now.y
				) {
					this.deselect();
				}
			},

			/**
			 * Mouse move event handler
			 *
			 * @param {Point} evn Mouse move event
			 */
			smousemovecb(evn) {
				if (!this._selected || !this.bb.contains(evn.x, evn.y)) {
					if (this.inside) {
						this._inside = false;
						this.onleave.emit({evn});
					}
				} else {
					if (!this.inside) {
						this._inside = true;
						this.onenter.emit({evn});
					}
				}
			},
		};

		return selection;
	},

	/**
	 * Processes cursor position
	 *
	 * @param {Point} wpoint World coordinate of the cursor
	 * @param {boolean} snapToGrid Snap to grid
	 */
	_process_cursor(wpoint, snapToGrid) {
		// Get cursor positions
		let x = wpoint.x;
		let y = wpoint.y;
		let sx = x;
		let sy = y;

		if (snapToGrid) {
			sx += snap(x, 0, config.gridSize);
			sy += snap(y, 0, config.gridSize);
		}

		const vpc = viewport.canvasToView(x, y);
		const vpsc = viewport.canvasToView(sx, sy);

		return {
			// World Coordinates
			x,
			y,
			sx,
			sy,

			// Viewport Coordinates
			vpx: vpc.x,
			vpy: vpc.y,
			vpsx: vpsc.x,
			vpsy: vpsc.y,
		};
	},

	/**
	 * Represents a marquee selection with an image
	 */
	MarqueeSelection: class {
		/** @type {HTMLCanvasElement} */
		canvas;

		_dirty = false;
		_position = {x: 0, y: 0};
		/**
		 * @type {Point}
		 */
		get position() {
			return this._position;
		}
		set position(v) {
			this._dirty = true;
			this._position = v;
		}

		_scale = {x: 1, y: 1};
		/**
		 * @type {Point}
		 */
		get scale() {
			return this._scale;
		}
		set scale(v) {
			if (v.x === 0 || v.y === 0) return;
			this._dirty = true;
			this._scale = v;
		}

		_rotation = 0;
		get rotation() {
			return this._rotation;
		}
		set rotation(v) {
			this._dirty = true;
			this._rotation = v;
		}

		/**
		 * @param {HTMLCanvasElement} canvas Selected image canvas
		 * @param {Point} position Initial position of the selection
		 */
		constructor(canvas, position = {x: 0, y: 0}) {
			this.canvas = canvas;
			this.position = position;
		}

		/** @type {DOMMatrix} */
		_rtmatrix = null;
		get rtmatrix() {
			if (!this._rtmatrix || this._dirty) {
				const m = new DOMMatrix();

				m.translateSelf(this.position.x, this.position.y);
				m.rotateSelf((this.rotation * 180) / Math.PI);

				this._rtmatrix = m;
			}

			return this._rtmatrix;
		}

		/** @type {DOMMatrix} */
		_matrix = null;
		get matrix() {
			if (!this._matrix || this._dirty) {
				this._matrix = this.rtmatrix.scaleSelf(this.scale.x, this.scale.y);
			}
			return this._matrix;
		}

		/**
		 * If the main marquee box contains a given point
		 *
		 * @param {number} x X coordinate of the point
		 * @param {number} y Y coordinate of the point
		 */
		contains(x, y) {
			const p = this.matrix.invertSelf().transformPoint({x, y});

			return (
				Math.abs(p.x) < this.canvas.width / 2 &&
				Math.abs(p.y) < this.canvas.height / 2
			);
		}

		hoveringHandle(x, y) {
			const localbb = new BoundingBox({
				x: -this.canvas.width / 2,
				y: -this.canvas.height / 2,
				w: this.canvas.width,
				h: this.canvas.height,
			});

			const localc = this.matrix.inverse().transformPoint({x, y});
			const ontl =
				Math.max(
					Math.abs(localc.x - localbb.tl.x),
					Math.abs(localc.y - localbb.tl.y)
				) <
				config.handleDetectSize / 2;
			const ontr =
				Math.max(
					Math.abs(localc.x - localbb.tr.x),
					Math.abs(localc.y - localbb.tr.y)
				) <
				config.handleDetectSize / 2;
			const onbl =
				Math.max(
					Math.abs(localc.x - localbb.bl.x),
					Math.abs(localc.y - localbb.bl.y)
				) <
				config.handleDetectSize / 2;
			const onbr =
				Math.max(
					Math.abs(localc.x - localbb.br.x),
					Math.abs(localc.y - localbb.br.y)
				) <
				config.handleDetectSize / 2;

			return {onHandle: ontl || ontr || onbl || onbr, ontl, ontr, onbl, onbr};
		}

		hoveringBox(x, y) {
			const localbb = new BoundingBox({
				x: -this.canvas.width / 2,
				y: -this.canvas.height / 2,
				w: this.canvas.width,
				h: this.canvas.height,
			});

			const localc = this.matrix.inverse().transformPoint({x, y});

			return (
				!this.hoveringHandle(x, y).onHandle &&
				localbb.contains(localc.x, localc.y)
			);
		}

		/**
		 * Draws the marquee selector box
		 *
		 * @param {CanvasRenderingContext2D} context A context for rendering the box to
		 * @param {Point} cursor Cursor position
		 * @param {DOMMatrix} transform A transformation matrix to transform the position by
		 */
		drawBox(context, cursor, transform = new DOMMatrix()) {
			const m = transform.multiply(this.matrix);

			context.save();

			const localbb = new BoundingBox({
				x: -this.canvas.width / 2,
				y: -this.canvas.height / 2,
				w: this.canvas.width,
				h: this.canvas.height,
			});

			// Line Style
			context.strokeStyle = "#FFF";
			context.lineWidth = 2;

			const tl = m.transformPoint(localbb.tl);
			const tr = m.transformPoint(localbb.tr);
			const bl = m.transformPoint(localbb.bl);
			const br = m.transformPoint(localbb.br);

			const bbc = m.transformPoint({x: 0, y: 0});

			context.beginPath();
			context.arc(bbc.x, bbc.y, 5, 0, Math.PI * 2);
			context.stroke();

			context.setLineDash([4, 2]);

			// Draw main rectangle
			context.beginPath();
			context.moveTo(tl.x, tl.y);
			context.lineTo(tr.x, tr.y);
			context.lineTo(br.x, br.y);
			context.lineTo(bl.x, bl.y);
			context.lineTo(tl.x, tl.y);
			context.stroke();

			// Draw handles
			const drawHandle = (pt, hover) => {
				let hsz = config.handleDrawSize / 2;
				if (hover) hsz *= config.handleDrawHoverScale;

				const hm = new DOMMatrix().rotateSelf(this.rotation);

				const htl = hm.transformPoint({x: -hsz, y: -hsz});
				const htr = hm.transformPoint({x: hsz, y: -hsz});
				const hbr = hm.transformPoint({x: hsz, y: hsz});
				const hbl = hm.transformPoint({x: -hsz, y: hsz});

				context.beginPath();
				context.moveTo(htl.x + pt.x, htl.y + pt.y);
				context.lineTo(htr.x + pt.x, htr.y + pt.y);
				context.lineTo(hbr.x + pt.x, hbr.y + pt.y);
				context.lineTo(hbl.x + pt.x, hbl.y + pt.y);
				context.lineTo(htl.x + pt.x, htl.y + pt.y);
				context.stroke();
			};

			context.strokeStyle = "#FFF";
			context.lineWidth = 2;
			context.setLineDash([]);

			const {ontl, ontr, onbl, onbr} = this.hoveringHandle(cursor.x, cursor.y);

			drawHandle(tl, ontl);
			drawHandle(tr, ontr);
			drawHandle(bl, onbl);
			drawHandle(br, onbr);

			context.restore();

			return () => {
				const border = config.handleDrawSize * config.handleDrawHoverScale;

				const minx = Math.min(tl.x, tr.x, bl.x, br.x) - border;
				const maxx = Math.max(tl.x, tr.x, bl.x, br.x) + border;
				const miny = Math.min(tl.y, tr.y, bl.y, br.y) - border;
				const maxy = Math.max(tl.y, tr.y, bl.y, br.y) + border;

				context.clearRect(minx, miny, maxx - minx, maxy - miny);
			};
		}

		/**
		 * Draws the selected image
		 *
		 * @param {CanvasRenderingContext2D} context A context for rendering the image to
		 * @param {CanvasRenderingContext2D} peekctx A context for rendering the layer peeking to
		 * @param {object} options
		 * @param {DOMMatrix} options.transform A transformation matrix to transform the position by
		 * @param {number} options.opacity Opacity of the peek display
		 */
		drawImage(context, peekctx, options = {}) {
			defaultOpt(options, {
				transform: new DOMMatrix(),
				opacity: 0.4,
			});

			context.save();
			peekctx.save();

			const m = options.transform.multiply(this.matrix);

			// Draw image
			context.setTransform(m);
			context.drawImage(
				this.canvas,
				-this.canvas.width / 2,
				-this.canvas.height / 2,
				this.canvas.width,
				this.canvas.height
			);

			// Draw peek
			peekctx.filter = `opacity(${options.opacity * 100}%)`;
			peekctx.setTransform(m);
			peekctx.drawImage(
				this.canvas,
				-this.canvas.width / 2,
				-this.canvas.height / 2,
				this.canvas.width,
				this.canvas.height
			);

			peekctx.restore();
			context.restore();

			return () => {
				// Here we only save transform for performance
				const pt = context.getTransform();
				const ppt = context.getTransform();

				context.setTransform(m);
				peekctx.setTransform(m);

				context.clearRect(
					-this.canvas.width / 2 - 10,
					-this.canvas.height / 2 - 10,
					this.canvas.width + 20,
					this.canvas.height + 20
				);

				peekctx.clearRect(
					-this.canvas.width / 2 - 10,
					-this.canvas.height / 2 - 10,
					this.canvas.width + 20,
					this.canvas.height + 20
				);

				context.setTransform(pt);
				peekctx.setTransform(ppt);
			};
		}
	},
};
