const mask_brush_draw_callback = (evn, state) => {
	if (evn.initialTarget.id === "overlayCanvas") {
		maskPaintCtx.globalCompositeOperation = "source-over";
		maskPaintCtx.strokeStyle = "#FF6A6A";

		maskPaintCtx.lineWidth = state.brushSize;
		maskPaintCtx.beginPath();
		maskPaintCtx.moveTo(evn.px, evn.py);
		maskPaintCtx.lineTo(evn.x, evn.y);
		maskPaintCtx.lineJoin = maskPaintCtx.lineCap = "round";
		maskPaintCtx.stroke();
	}
};

const mask_brush_erase_callback = (evn, state) => {
	if (evn.initialTarget.id === "overlayCanvas") {
		maskPaintCtx.globalCompositeOperation = "destination-out";
		maskPaintCtx.strokeStyle = "#FFFFFFFF";

		maskPaintCtx.lineWidth = state.brushSize;
		maskPaintCtx.beginPath();
		maskPaintCtx.moveTo(evn.px, evn.py);
		maskPaintCtx.lineTo(evn.x, evn.y);
		maskPaintCtx.lineJoin = maskPaintCtx.lineCap = "round";
		maskPaintCtx.stroke();
	}
};
