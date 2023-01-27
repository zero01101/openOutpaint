const idb = window.indexedDB.open("openoutpaint", 2);

idb.onerror = (e) => {
	console.warn("[stamp] Failed to connect to IndexedDB");
	console.warn(e);
};

idb.onupgradeneeded = (e) => {
	const db = e.target.result;

	console.debug(`[stamp] Setting up database version ${db.version}`);

	if (e.oldVersion < 1) {
		// Resources Store
		const resourcesStore = db.createObjectStore("resources", {
			keyPath: "id",
		});
		resourcesStore.createIndex("name", "name", {unique: false});
	}

	// Workspaces Store
	const workspacesStore = db.createObjectStore("workspaces", {
		keyPath: "id",
	});
	workspacesStore.createIndex("name", "name", {unique: false});
};

/** @type {IDBDatabase} */
let db = null;
/** @type {Observer<{db: IDBDatabase}>} */
const ondatabaseload = new Observer();

idb.onsuccess = (e) => {
	db = e.target.result;
	ondatabaseload.emit({db});
};
