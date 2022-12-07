document.querySelectorAll(".floating-window").forEach(
	/**
	 * Runs for each floating window
	 *
	 * @param {HTMLDivElement} w
	 */
	(w) => {
		makeDraggable(w);
		w.addEventListener(
			"wheel",
			(e) => {
				e.stopPropagation();
			},
			{passive: false}
		);

		w.addEventListener(
			"click",
			(e) => {
				e.stopPropagation();
			},
			{passive: false}
		);
	}
);

var coll = document.getElementsByClassName("collapsible");
for (var i = 0; i < coll.length; i++) {
	let active = false;
	coll[i].addEventListener("click", function () {
		var content = this.nextElementSibling;

		if (!active) {
			this.classList.add("active");
			content.classList.add("active");
		} else {
			this.classList.remove("active");
			content.classList.remove("active");
		}

		const observer = new ResizeObserver(() => {
			if (active) content.style.maxHeight = content.scrollHeight + "px";
		});

		Array.from(content.children).forEach((child) => {
			observer.observe(child);
		});

		if (active) {
			content.style.maxHeight = null;
			active = false;
		} else {
			content.style.maxHeight = content.scrollHeight + "px";
			active = true;
		}
	});
}
