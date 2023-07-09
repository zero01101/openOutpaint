(() => {
	const saveWorkspaceBtn = document.getElementById("save-workspace-btn");
	const renameWorkspaceBtn = document.getElementById("rename-workspace-btn");
	const moreWorkspaceBtn = document.getElementById("more-workspace-btn");
	const expandedWorkspaceMenu = document.getElementById("more-workspace-menu");
	const exportWorkspaceBtn = document.getElementById("export-workspace-btn");
	const importWorkspaceBtn = document.getElementById("import-workspace-btn");
	const deleteWorkspaceBtn = document.getElementById("delete-workspace-btn");

	moreWorkspaceBtn.addEventListener("click", () => {
		expandedWorkspaceMenu.classList.toggle("collapsed");
	});

	const workspaceAutocomplete = createAutoComplete(
		"Workspace",
		document.getElementById("workspace-select")
	);

	workspaceAutocomplete.options = [{name: "Default", value: "default"}];
	workspaceAutocomplete.value = "default";
	renameWorkspaceBtn.disabled = true;
	deleteWorkspaceBtn.disabled = true;

	workspaceAutocomplete.onchange.on(async ({name, value}) => {
		if (value === "default") {
			renameWorkspaceBtn.disabled = true;
			deleteWorkspaceBtn.disabled = true;
			await commands.clear();
			return;
		}
		renameWorkspaceBtn.disabled = false;
		deleteWorkspaceBtn.disabled = false;

		const workspaces = db
			.transaction("workspaces", "readonly")
			.objectStore("workspaces");

		workspaces.get(value).onsuccess = (e) => {
			console.debug("[workspace.populate] Loading workspace");

			const res = e.target.result;
			const {name, workspace} = res;
			importWorkspaceState(workspace);
			notifications.notify(`Loaded workspace '${name}'`, {
				type: NotificationType.SUCCESS,
			});
		};
	});

	/**
	 * Updates Workspace selection list
	 */
	const listWorkspaces = async (value = undefined) => {
		const options = [{name: "Default", value: "default"}];

		const workspaces = db
			.transaction("workspaces", "readonly")
			.objectStore("workspaces");

		workspaces.openCursor().onsuccess = (e) => {
			/** @type {IDBCursor} */
			const c = e.target.result;
			if (c) {
				options.push({name: c.value.name, value: c.key});
				c.continue();
			} else {
				const previousValue = workspaceAutocomplete.value;

				workspaceAutocomplete.options = options;
				workspaceAutocomplete.value = value ?? previousValue;
			}
		};
	};

	const saveWorkspaceToDB = async (value) => {
		const workspace = await exportWorkspaceState();

		const workspaces = db
			.transaction("workspaces", "readwrite")
			.objectStore("workspaces");

		let id = value;
		if (value === "default" && commands._history.length > 0) {
			// If Workspace is the Default
			const name = (prompt("Please enter the workspace name") ?? "").trim();

			if (name) {
				id = guid();
				workspaces.add({id, name, workspace}).onsuccess = () => {
					listWorkspaces(id);
					notifications.notify(`Workspace saved as '${name}'`, {
						type: "success",
					});
				};
			}
		} else {
			workspaces.get(id).onsuccess = (e) => {
				const ws = e.target.result;
				if (ws) {
					var name = ws.name;
					workspaces.delete(id).onsuccess = () => {
						workspaces.add({id, name, workspace}).onsuccess = () => {
							notifications.notify(`Workspace saved as '${name}'`, {
								type: "success",
							});
						}; //workspaces.put is failing, delete and re-add?
						listWorkspaces();
					};
				}
			};
		}
	};

	// Normal Workspace Export/Import
	exportWorkspaceBtn.addEventListener("click", () => saveWorkspaceToFile());
	importWorkspaceBtn.addEventListener("click", () => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "application/json";
		input.addEventListener("change", async (evn) => {
			let files = Array.from(input.files);
			const json = await files[0].text();

			await importWorkspaceState(JSON.parse(json));
			saveWorkspaceToDB("default");
		});
		input.click();
	});

	const onDatabaseLoad = async () => {
		// Get workspaces from database
		listWorkspaces();

		// Save Workspace Button
		saveWorkspaceBtn.addEventListener("click", () =>
			saveWorkspaceToDB(workspaceAutocomplete.value)
		);

		// Rename Workspace
		renameWorkspaceBtn.addEventListener("click", () => {
			const workspaces = db
				.transaction("workspaces", "readwrite")
				.objectStore("workspaces");

			let id = workspaceAutocomplete.value;

			workspaces.get(id).onsuccess = (e) => {
				const workspace = e.target.result;
				const name = prompt(
					`Please enter the new workspace name.<br>Original is '${workspace.name}'`
				).trim();

				if (!name) return;

				workspace.name = name;

				workspaces.put(workspace).onsuccess = () => {
					notifications.notify(
						`Workspace name was updated to '${workspace.name}'`,
						{type: NotificationType.SUCCESS}
					);
					listWorkspaces();
				};
			};
		});
		// Delete Workspace
		deleteWorkspaceBtn.addEventListener("click", () => {
			const workspaces = db
				.transaction("workspaces", "readwrite")
				.objectStore("workspaces");

			let id = workspaceAutocomplete.value;

			workspaces.get(id).onsuccess = async (e) => {
				const workspace = e.target.result;

				if (
					await notifications.dialog(
						"Delete Workspace",
						`Do you really want to delete the workspace '${workspace.name}'?`
					)
				) {
					workspaces.delete(id).onsuccess = (e) => {
						listWorkspaces("default");
					};
				}
			};
		});
	};

	if (db) onDatabaseLoad();
	else ondatabaseload.on(onDatabaseLoad);
})();
