// info div, sometimes hidden
let mouseXInfo = document.getElementById("mouseX");
let mouseYInfo = document.getElementById("mouseY");
let canvasXInfo = document.getElementById("canvasX");
let canvasYInfo = document.getElementById("canvasY");
let snapXInfo = document.getElementById("snapX");
let snapYInfo = document.getElementById("snapY");
let heldButtonInfo = document.getElementById("heldButton");

mouse.listen.window.onmousemove.on((evn) => {
	mouseXInfo.textContent = evn.x;
	mouseYInfo.textContent = evn.y;
});

mouse.listen.world.onmousemove.on((evn) => {
	canvasXInfo.textContent = evn.x;
	canvasYInfo.textContent = evn.y;
	snapXInfo.textContent = evn.x + snap(evn.x);
	snapYInfo.textContent = evn.y + snap(evn.y);

	if (global.debug) {
		debugLayer.clear();
		debugCtx.fillStyle = "#F0F";
		debugCtx.beginPath();
		debugCtx.arc(viewport.cx, viewport.cy, 5, 0, Math.PI * 2);
		debugCtx.fill();

		debugCtx.fillStyle = "#0FF";
		debugCtx.beginPath();
		debugCtx.arc(evn.x, evn.y, 5, 0, Math.PI * 2);
		debugCtx.fill();
	}
});

window.addEventListener("DOMContentLoaded", () => (global.debug = true));
