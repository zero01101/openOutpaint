/**
 * Enum representing the location of the notifications
 * @readonly
 * @enum {string}
 */
const NotificationLocation = {
	TOPLEFT: "top-left",
	TOPCENTER: "top-center",
	TOPRIGHT: "top-right",
	BOTTOMLEFT: "bottom-left",
	BOTTOMCENTER: "bottom-center",
	BOTTOMRIGHT: "bottom-right",
};

/**
 * Enum representing notification types
 * @readonly
 * @enum {string}
 */
const NotificationType = {
	INFO: "info",
	ERROR: "error",
	WARN: "warn",
	SUCCESS: "success",
};

/**
 * Responsible for the notification system
 */
const notifications = {
	/** @type {NotificationLocation} */
	_location: NotificationLocation.BOTTOMLEFT,
	/** @type {NotificationLocation} */
	get location() {
		return this.location;
	},
	/** @type {NotificationLocation} */
	set location(location) {
		this._location = location;
	},

	// Notification Area Element
	_areaEl: null,

	// Dialog BG Element
	_dialogBGEl: null,
	// Dialog Element
	_dialogEl: null,

	/**
	 * Creates a simple notification for the user. Equivalent to alert()
	 *
	 * @param {string | HTMLElement} message Message to display to the user.
	 * @param {Object} options Extra options for the notification.
	 * @param {NotificationType} type Notification type
	 */
	notify(message, options = {}) {
		defaultOpt(options, {
			type: NotificationType.INFO,
			timeout: config.notificationTimeout,
		});

		const notificationEl = document.createElement("div");
		notificationEl.classList.add("notification", "expanded", options.type);
		notificationEl.title = new Date().toISOString();
		notificationEl.addEventListener("click", () =>
			notificationEl.classList.toggle("expanded")
		);

		const contentEl = document.createElement("div");
		contentEl.classList.add("notification-content");
		contentEl.innerHTML = message;

		notificationEl.append(contentEl);

		const closeBtn = document.createElement("button");
		closeBtn.classList.add("notification-closebtn");
		closeBtn.addEventListener("click", () => notificationEl.remove());

		notificationEl.append(closeBtn);

		this._areaEl.prepend(notificationEl);
		if (options.timeout)
			setTimeout(() => {
				if (this._areaEl.contains(notificationEl)) {
					notificationEl.remove();
				}
			}, options.timeout);
	},

	/**
	 * Creates a dialog box for the user with set options.
	 *
	 * @param {string} title The title of the dialog box to be displayed to the user.
	 * @param {string | HTMLElement} message The message to be displayed to the user.
	 * @param {Object} options Extra options for the dialog.
	 * @param {Array<{label: string, value: any}>} options.choices The choices to be displayed to the user.
	 */
	async dialog(title, message, options = {}) {
		defaultOpt(options, {
			// By default, it is a await notifications.dialogation dialog
			choices: [
				{label: "No", value: false},
				{label: "Yes", value: true},
			],
		});

		const titleEl = this._dialogEl.querySelector(".dialog-title");
		titleEl.textContent = title;

		const contentEl = this._dialogEl.querySelector(".dialog-content");
		contentEl.innerHTML = message;

		const choicesEl = this._dialogEl.querySelector(".dialog-choices");
		while (choicesEl.firstChild) {
			choicesEl.firstChild.remove();
		}

		return new Promise((resolve, reject) => {
			options.choices.forEach((choice) => {
				const choiceBtn = document.createElement("button");
				choiceBtn.textContent = choice.label;
				choiceBtn.addEventListener("click", () => {
					this._dialogBGEl.style.display = "none";
					this._dialogEl.style.display = "none";

					resolve(choice.value);
				});

				choicesEl.append(choiceBtn);
			});

			this._dialogBGEl.style.display = "flex";
			this._dialogEl.style.display = "block";
		});
	},
};
var k = 0;

window.addEventListener("DOMContentLoaded", () => {
	// Creates the notification area
	const notificationArea = document.createElement("div");
	notificationArea.classList.add(
		"notification-area",
		NotificationLocation.BOTTOMLEFT
	);

	notifications._areaEl = notificationArea;

	document.body.appendChild(notificationArea);

	// Creates the dialog box element
	const dialogBG = document.createElement("div");
	dialogBG.classList.add("dialog-bg");
	dialogBG.style.display = "none";

	const dialogEl = document.createElement("div");
	dialogEl.classList.add("dialog");
	dialogEl.style.display = "none";

	const titleEl = document.createElement("div");
	titleEl.classList.add("dialog-title");

	const contentEl = document.createElement("div");
	contentEl.classList.add("dialog-content");

	const choicesEl = document.createElement("div");
	choicesEl.classList.add("dialog-choices");

	dialogEl.append(titleEl);
	dialogEl.append(contentEl);
	dialogEl.append(choicesEl);

	dialogBG.append(dialogEl);

	notifications._dialogEl = dialogEl;
	notifications._dialogBGEl = dialogBG;

	document.body.appendChild(dialogBG);
});
