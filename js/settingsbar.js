function makeDraggable(element) {
	const startbb = element.getBoundingClientRect();
	let dragging = false;
	let offset = {x: 0, y: 0};

	element.style.top = startbb.y + "px";
	element.style.left = startbb.x + "px";

	mouse.listen.window.left.onpaintstart.on((evn) => {
		if (
			element.contains(evn.target) &&
			evn.target.classList.contains("draggable")
		) {
			const bb = element.getBoundingClientRect();
			offset.x = evn.x - bb.x;
			offset.y = evn.y - bb.y;
			dragging = true;
		}
	});

	mouse.listen.window.left.onpaint.on((evn) => {
		if (dragging) {
			element.style.top = evn.y - offset.y + "px";
			element.style.left = evn.x - offset.x + "px";
		}
	});

	mouse.listen.window.left.onpaintend.on((evn) => {
		dragging = false;
	});
}

document.querySelectorAll(".floating-window").forEach((w) => {
	makeDraggable(w);
});

var coll = document.getElementsByClassName("collapsible");
for (var i = 0; i < coll.length; i++) {
	coll[i].addEventListener("click", function () {
		this.classList.toggle("active");
		var content = this.nextElementSibling;
		if (content.style.maxHeight) {
			content.style.maxHeight = null;
		} else {
			content.style.maxHeight = content.scrollHeight + "px";
		}
	});
}
