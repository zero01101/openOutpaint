//dragElement(document.getElementById("infoContainer"));
//dragElement(document.getElementById("historyContainer"));

function dragElement(elmnt) {
	var p3 = 0,
		p4 = 0;
	var draggableElements = elmnt.getElementsByClassName("draggable");
	for (var i = 0; i < draggableElements.length; i++) {
		draggableElements[i].onmousedown = dragMouseDown;
	}

	function dragMouseDown(e) {
		e.preventDefault();
		p3 = e.clientX;
		p4 = e.clientY;
		document.onmouseup = closeDragElement;
		document.onmousemove = elementDrag;
	}

	function elementDrag(e) {
		e.preventDefault();
		elmnt.style.bottom = null;
		elmnt.style.right = null;
		elmnt.style.top = elmnt.offsetTop - (p4 - e.clientY) + "px";
		elmnt.style.left = elmnt.offsetLeft - (p3 - e.clientX) + "px";
		p3 = e.clientX;
		p4 = e.clientY;
	}

	function closeDragElement() {
		document.onmouseup = null;
		document.onmousemove = null;
	}
}

function makeDraggable(id) {
	const element = document.getElementById(id);
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

makeDraggable("infoContainer");

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
