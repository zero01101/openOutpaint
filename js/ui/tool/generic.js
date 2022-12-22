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

		const bbvp = {
			...viewport.canvasToView(bb.x, bb.y),
			w: viewport.zoom * bb.w,
			h: viewport.zoom * bb.h,
		};

		uiCtx.save();

		// draw targeting square reticle thingy cursor
		uiCtx.lineWidth = style.reticleWidth;
		uiCtx.strokeStyle = style.reticleStyle;
		uiCtx.strokeRect(bbvp.x, bbvp.y, bbvp.w, bbvp.h); //origin is middle of the frame

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
};
