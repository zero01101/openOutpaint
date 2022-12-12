/**
 * Floating window setup
 */
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

/**
 * Collapsible element setup
 */
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

		Array.from(content.querySelectorAll("*")).forEach((child) => {
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

/**
 * Prompt history setup
 */
const _promptHistoryEl = document.getElementById("prompt-history");
const _promptHistoryBtn = document.getElementById("prompt-history-btn");

_promptHistoryEl.addEventListener("mouseleave", () => {
	_promptHistoryEl.classList.remove("expanded");
});

_promptHistoryBtn.addEventListener("click", () =>
	_promptHistoryEl.classList.toggle("expanded")
);

/**
 * Settings overlay setup
 */
document.getElementById("settings-btn").addEventListener("click", () => {
	document.getElementById("page-overlay-wrapper").classList.toggle("invisible");
});

document.getElementById("settings-btn-close").addEventListener("click", () => {
	document.getElementById("page-overlay-wrapper").classList.toggle("invisible");
});
