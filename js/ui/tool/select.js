const selectTransformTool = () =>
	toolbar.registerTool(
		"res/icons/box-select.svg",
		"Select Image",
		(state, opt) => {
			// Draw new cursor immediately
			ovCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);
			state.movecb({...mouse.coords.canvas.pos, target: {id: "overlayCanvas"}});

			mouse.listen.canvas.onmousemove.on(state.movecb);
			mouse.listen.canvas.left.ondragstart.on(state.dragstartcb);
			mouse.listen.canvas.left.ondragend.on(state.dragendcb);

			mouse.listen.canvas.right.onclick.on(state.cancelcb);
		},
		(state, opt) => {
			mouse.listen.canvas.onmousemove.clear(state.movecb);
			mouse.listen.canvas.left.ondragstart.clear(state.dragstartcb);
			mouse.listen.canvas.left.ondragend.clear(state.dragendcb);

			mouse.listen.canvas.right.onclick.clear(state.cancelcb);
		},
		{
			init: (state) => {
				state.snapToGrid = true;
				state.dragging = null;

				const selectionBB = (x1, y1, x2, y2) => {
					return {
						x: Math.min(x1, x2),
						y: Math.min(y1, y2),
						w: Math.abs(x1 - x2),
						h: Math.abs(y1 - y2),
					};
				};

				state.movecb = (evn) => {
					if (evn.target.id === "overlayCanvas") {
						let x = evn.x;
						let y = evn.y;
						if (state.snapToGrid) {
							x += snap(evn.x, true, 64);
							y += snap(evn.y, true, 64);
						}

						// Draw dragging box
						if (state.dragging) {
							ovCtx.setLineDash([2, 2]);
							ovCtx.lineWidth = 1;
							ovCtx.strokeStyle = "#FFF";

							const ix = state.dragging.ix;
							const iy = state.dragging.iy;

							const bb = selectionBB(ix, iy, x, y);

							ovCtx.strokeRect(bb.x, bb.y, bb.w, bb.h);
							ovCtx.setLineDash([]);
						}

						// Draw selection box
						if (state.selected) {
							ovCtx.lineWidth = 1;
							ovCtx.strokeStyle = "#FFF";

							ovCtx.setLineDash([4, 2]);
							ovCtx.strokeRect(
								state.selected.x,
								state.selected.y,
								state.selected.w,
								state.selected.h
							);
							ovCtx.setLineDash([]);
						}

						// Draw cuttent cursor location
						ovCtx.lineWidth = 3;
						ovCtx.strokeStyle = "#FFF";

						ovCtx.beginPath();
						ovCtx.moveTo(x, y + 10);
						ovCtx.lineTo(x, y - 10);
						ovCtx.moveTo(x + 10, y);
						ovCtx.lineTo(x - 10, y);
						ovCtx.stroke();
					}
				};

				state.dragstartcb = (evn) => {
					if (evn.target.id === "overlayCanvas") {
						let ix = evn.ix;
						let iy = evn.iy;
						if (state.snapToGrid) {
							ix += snap(evn.ix, true, 64);
							iy += snap(evn.iy, true, 64);
						}

						state.dragging = {ix, iy};
					}
				};

				state.dragendcb = (evn) => {
					if (evn.target.id === "overlayCanvas" && state.dragging) {
						let x = evn.x;
						let y = evn.y;
						if (state.snapToGrid) {
							x += snap(evn.x, true, 64);
							y += snap(evn.y, true, 64);
						}

						state.selected = selectionBB(
							state.dragging.ix,
							state.dragging.iy,
							x,
							y
						);
						state.dragging = null;
					}
				};

				state.cancelcb = (evn) => {
					if (evn.target.id === "overlayCanvas") {
						if (state.dragging) state.dragging = null;
						else state.selected = null;

						ovCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);
						state.movecb(evn);
					}
				};

				// Keyboard callbacks
				state.keydowncb = (evn) => {
					console.debug(evn);
				};

				state.keyclickcb = (evn) => {
					console.debug(evn);
				};
			},
			populateContextMenu: (menu, state) => {
				if (!state.ctxmenu) {
					state.ctxmenu = {};
					// Snap To Grid Checkbox
					state.ctxmenu.snapToGridLabel = _toolbar_input.checkbox(
						state,
						"snapToGrid",
						"Snap To Grid"
					).label;
				}
				menu.appendChild(state.ctxmenu.snapToGridLabel);
			},
		}
	);
