(() => {
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
					!commands.history.find((entry) => `hist-${entry.id}` === child.id)
				) {
					console.log("Removing " + entry.id);
					historyView.removeChild(child);
				}
			});
		}

		commands.history.forEach((entry, index) => {
			if (!document.getElementById(`hist-${entry.id}`)) {
				console.log("Inserting " + entry.id);
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
