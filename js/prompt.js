/**
 * This file is for processing prompt/negative prompt and prompt style data
 */

// Prompt Style Element
const styleSelectElement = createAutoComplete(
	"Style",
	document.getElementById("style-ac-mselect"),
	{multiple: true}
);

// Function to get styles from AUTOMATIC1111 webui
async function getStyles() {
	var url = document.getElementById("host").value + "/sdapi/v1/prompt-styles";
	try {
		const response = await fetch(url);
		/** @type {{name: string, prompt: string, negative_prompt: string}[]} */
		const data = await response.json();

		/** @type {string[]} */
		let stored = null;
		try {
			stored = JSON.parse(localStorage.getItem("openoutpaint/promptStyle"));
			// doesn't seem to throw a syntaxerror if the localStorage item simply doesn't exist?
			if (stored == null) stored = [];
		} catch (e) {
			stored = [];
		}

		styleSelectElement.options = data.map((style) => ({
			name: style.name,
			value: style.name,
			title: `prompt: ${style.prompt}\nnegative: ${style.negative_prompt}`,
		}));
		styleSelectElement.onchange.on(({value}) => {
			let selected = [];
			if (value.find((v) => v === "None")) {
				styleSelectElement.value = [];
			} else {
				selected = value;
			}
			stableDiffusionData.styles = selected;
			localStorage.setItem(
				"openoutpaint/promptStyle",
				JSON.stringify(selected)
			);
		});

		styleSelectElement.value = stored;
		localStorage.setItem("openoutpaint/promptStyle", JSON.stringify(stored));
	} catch (e) {
		console.warn("[index] Failed to fetch prompt styles");
		console.warn(e);
	}
}

(async () => {
	// Default configurations
	const defaultPrompt =
		"ocean floor scientific expedition, underwater wildlife";
	const defaultNegativePrompt =
		"people, person, humans, human, divers, diver, glitch, error, text, watermark, bad quality, blurry";

	// Prompt Elements
	const promptEl = document.getElementById("prompt");
	const negativePromptEl = document.getElementById("negPrompt");

	// Add prompt change handlers
	promptEl.oninput = () => {
		stableDiffusionData.prompt = promptEl.value;
		promptEl.title = promptEl.value;
		localStorage.setItem("openoutpaint/prompt", stableDiffusionData.prompt);
	};

	negativePromptEl.oninput = () => {
		stableDiffusionData.negative_prompt = negativePromptEl.value;
		negativePromptEl.title = negativePromptEl.value;
		localStorage.setItem(
			"openoutpaint/neg_prompt",
			stableDiffusionData.negative_prompt
		);
	};

	// Load from local storage if set
	const storedPrompt = localStorage.getItem("openoutpaint/prompt");
	const storedNeg = localStorage.getItem("openoutpaint/neg_prompt");
	const promptDefaultValue =
		storedPrompt === null ? defaultPrompt : storedPrompt;
	const negativePromptDefaultValue =
		storedNeg === null ? defaultNegativePrompt : storedNeg;

	promptEl.value = promptEl.title = promptDefaultValue;
	negativePromptEl.value = negativePromptEl.title = negativePromptDefaultValue;

	/**
	 * Prompt History
	 */

	// Get history-related elements
	const promptHistoryEl = document.getElementById("prompt-history");

	// History
	const history = [];

	function syncPromptHistory() {
		const historyCopy = Array.from(history);
		historyCopy.reverse();

		for (let i = 0; i < historyCopy.length; i++) {
			const historyItem = historyCopy[i];

			const id = `prompt-history-${historyItem.id}`;
			if (promptHistoryEl.querySelector(`#${id}`)) break;

			const historyEntry = document.createElement("div");
			historyEntry.classList.add("entry");
			historyEntry.id = id;
			historyEntry.title = `prompt: ${historyItem.prompt}\nnegative: ${
				historyItem.negative
			}\nstyles: ${historyItem.styles.join(", ")}`;

			// Compare with previous
			const samePrompt =
				i !== historyCopy.length - 1 &&
				historyItem.prompt === historyCopy[i + 1].prompt;
			const sameNegativePrompt =
				i !== historyCopy.length - 1 &&
				historyItem.negative === historyCopy[i + 1].negative;
			const sameStyles =
				i !== historyCopy.length - 1 &&
				historyItem.styles.length === historyCopy[i + 1].styles.length &&
				!historyItem.styles.some(
					(v, index) => v !== historyCopy[i + 1].styles[index]
				);

			const prompt = historyItem.prompt;
			const negative = historyItem.negative;
			const styles = historyItem.styles;

			const promptBtn = document.createElement("button");
			promptBtn.classList.add("prompt");
			promptBtn.addEventListener("click", () => {
				stableDiffusionData.prompt = prompt;
				promptEl.title = prompt;
				promptEl.value = prompt;
				localStorage.setItem("openoutpaint/prompt", prompt);
			});
			promptBtn.textContent = (samePrompt ? "= " : "") + prompt;

			const negativeBtn = document.createElement("button");
			negativeBtn.classList.add("negative");
			negativeBtn.addEventListener("click", () => {
				stableDiffusionData.negative_prompt = negative;
				negativePromptEl.title = negative;
				negativePromptEl.value = negative;
				localStorage.setItem("openoutpaint/neg_prompt", negative);
			});
			negativeBtn.textContent = (sameNegativePrompt ? "= " : "") + negative;

			const stylesBtn = document.createElement("button");
			stylesBtn.classList.add("styles");
			stylesBtn.textContent = (sameStyles ? "= " : "") + styles.join(", ");
			stylesBtn.addEventListener("click", () => {
				styleSelectElement.value = styles;
			});

			historyEntry.appendChild(promptBtn);
			historyEntry.appendChild(negativeBtn);
			historyEntry.appendChild(stylesBtn);

			promptHistoryEl.insertBefore(historyEntry, promptHistoryEl.firstChild);
		}
	}

	// Listen for dreaming to add to history
	events.tool.dream.on((message) => {
		const {event} = message;
		if (event === "generate") {
			const {prompt, negative_prompt, styles} = message.request;
			const hash = hashCode(
				`p: ${prompt}, n: ${negative_prompt}, s: ${JSON.stringify(styles)}`
			);
			if (
				!history[history.length - 1] ||
				history[history.length - 1].hash !== hash
			)
				history.push({
					id: guid(),
					hash,
					prompt,
					negative: negative_prompt,
					styles,
				});
		}

		syncPromptHistory();
	});
})();
