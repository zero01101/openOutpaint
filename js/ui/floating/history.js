(() => {
	const historyLogBtn = document.getElementById("history-logs-btn");
	historyLogBtn.addEventListener("click", () => {
		let logs = "";
		commands._history.forEach((entry) => {
			if (entry.extra.log) logs += ` => ${entry.extra.log}\n`;
		});

		const blob = new Blob([logs], {type: "text/plain"});
		const url = URL.createObjectURL(blob);

		var link = document.createElement("a"); // Or maybe get it from the current document
		link.href = url;
		link.download = `${new Date().toISOString()}_openOutpaint_log.txt`;
		link.click();
	});

	const historyView = document.getElementById("history");

	const makeHistoryEntry = (index, id, title) => {
		const historyItemTitle = document.createElement("span");
		historyItemTitle.classList.add(["title"]);
		historyItemTitle.textContent = `${index} - ${title}`;

		const historyItem = document.createElement("div");
		historyItem.id = id;
		historyItem.classList.add(["history-item"]);
		historyItem.title = id;
		historyItem.onclick = () => {
			const diff = commands.current - index;
			if (diff < 0) {
				commands.redo(Math.abs(diff));
			} else {
				commands.undo(diff);
			}
		};

		historyItem.appendChild(historyItemTitle);

		return historyItem;
	};

	_commands_events.on((message) => {
		if (message.action === "run") {
			Array.from(historyView.children).forEach((child) => {
				if (
					!commands._history.find((entry) => `hist-${entry.id}` === child.id)
				) {
					historyView.removeChild(child);
				}
			});
		}

		commands._history.forEach((entry, index) => {
			if (!document.getElementById(`hist-${entry.id}`)) {
				historyView.appendChild(
					makeHistoryEntry(index, `hist-${entry.id}`, entry.title)
				);
			}
		});

		Array.from(historyView.children).forEach((child, index) => {
			if (index === commands.current) {
				child.classList.remove(["past"]);
				child.classList.add(["current"]);
				child.classList.remove(["future"]);
			} else if (index < commands.current) {
				child.classList.add(["past"]);
				child.classList.remove(["current"]);
				child.classList.remove(["future"]);
			} else {
				child.classList.remove(["past"]);
				child.classList.remove(["current"]);
				child.classList.add(["future"]);
			}
		});

		if (message.action === "run") {
			historyView.scrollTo(0, historyView.scrollHeight);
		}
	});
})();
