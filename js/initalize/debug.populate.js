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
});

/**
 * Toggles the debug layer (Just run toggledebug() in the console)
 */
const toggledebug = () => {
	const hidden = debugCanvas.style.display === "none";
	if (hidden) {
		debugLayer.unhide();
		debug = true;
	} else {
		debugLayer.hide();
		debug = false;
	}
};
