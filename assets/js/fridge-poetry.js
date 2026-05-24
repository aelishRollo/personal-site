/*
	Fridge Poetry board custom element.
	Empty-start board + category dropdown word pickers + drag-and-drop.
*/
(function() {
	var DB_NAME = 'fridge-poetry-db';
	var DB_VERSION = 2;
	var STORE_NAME = 'boards';
	var dbPromise = null;

	var DEFAULT_COLS = 14;
	var DEFAULT_ROWS = 11;
	var DEFAULT_CELL = 44;
	var STORAGE_FALLBACK_KEY = 'fridge-poetry-state-v2';

	var DEFAULT_SOURCE = {
		categories: {
			nouns: ['code', 'music', 'systems', 'tests', 'workflow'],
			adjectives: ['clear', 'quick', 'kind', 'curious', 'bold'],
			verbs: ['build', 'ship', 'learn', 'debug', 'iterate'],
			adverbs: ['carefully', 'quickly', 'calmly', 'intentionally', 'openly'],
			connectors: ['and', 'with', 'for', 'to', 'from']
		}
	};

	function clamp(value, min, max) {
		return Math.max(min, Math.min(max, value));
	}

	function toInt(value, fallback) {
		var n = parseInt(value, 10);
		return Number.isFinite(n) ? n : fallback;
	}

	function normalizeWord(value) {
		return String(value || '').trim().toLowerCase();
	}

	function entryKey(category, word) {
		return category + '::' + word;
	}

	function wordWidth(word) {
		var len = String(word).length;
		if (len <= 3) {
			return 1;
		}
		if (len <= 7) {
			return 2;
		}
		if (len <= 11) {
			return 3;
		}
		return 4;
	}

	function rafThrottle(fn) {
		var rafId = null;
		return function() {
			if (rafId !== null) {
				return;
			}
			rafId = window.requestAnimationFrame(function() {
				rafId = null;
				fn();
			});
		};
	}

	function openDb() {
		if (dbPromise) {
			return dbPromise;
		}

		dbPromise = new Promise(function(resolve, reject) {
			if (!window.indexedDB) {
				dbPromise = null;
				reject(new Error('IndexedDB not supported'));
				return;
			}

			var req = window.indexedDB.open(DB_NAME, DB_VERSION);

			req.onupgradeneeded = function(event) {
				var db = event.target.result;
				if (!db.objectStoreNames.contains(STORE_NAME)) {
					db.createObjectStore(STORE_NAME, { keyPath: 'id' });
				}
			};

			req.onsuccess = function() {
				resolve(req.result);
			};

			req.onerror = function() {
				dbPromise = null;
				reject(req.error || new Error('Failed to open IndexedDB'));
			};
		});

		return dbPromise;
	}

	function idbGet(id) {
		return openDb().then(function(db) {
			return new Promise(function(resolve, reject) {
				var tx = db.transaction(STORE_NAME, 'readonly');
				var store = tx.objectStore(STORE_NAME);
				var req = store.get(id);

				req.onsuccess = function() {
					resolve(req.result || null);
				};

				req.onerror = function() {
					reject(req.error || new Error('Failed to read state'));
				};
			});
		});
	}

	function idbSet(record) {
		return openDb().then(function(db) {
			return new Promise(function(resolve, reject) {
				var tx = db.transaction(STORE_NAME, 'readwrite');
				var store = tx.objectStore(STORE_NAME);
				var req = store.put(record);

				req.onsuccess = function() {
					resolve();
				};

				req.onerror = function() {
					reject(req.error || new Error('Failed to save state'));
				};
			});
		});
	}

	function storageGetLocal(key) {
		try {
			var raw = localStorage.getItem(key);
			return raw ? JSON.parse(raw) : null;
		} catch (err) {
			return null;
		}
	}

	function storageSetLocal(key, value) {
		try {
			localStorage.setItem(key, JSON.stringify(value));
		} catch (err) {
			// Ignore quota/private-mode failures.
		}
	}

	function normalizeSource(source) {
		var src = source && typeof source === 'object' ? source : DEFAULT_SOURCE;
		var categories = src.categories && typeof src.categories === 'object' ? src.categories : DEFAULT_SOURCE.categories;
		var normalized = {};

		Object.keys(categories).forEach(function(categoryName) {
			var arr = Array.isArray(categories[categoryName]) ? categories[categoryName] : [];
			normalized[categoryName] = arr.map(normalizeWord).filter(Boolean);
		});

		return normalized;
	}

	class FridgePoetryBoard extends HTMLElement {
		static get observedAttributes() {
			return ['words-src', 'storage-key', 'theme', 'readonly', 'cols', 'rows'];
		}

		constructor() {
			super();
			this.attachShadow({ mode: 'open' });

			this._connected = false;
			this._boardRect = null;
			this._themeObserver = null;
			this._resizeObserver = null;
			this._saveTimer = null;
			this._rafMeasure = rafThrottle(this.measureBoard.bind(this));

			this._storageKey = this.getAttribute('storage-key') || STORAGE_FALLBACK_KEY;
			this._cols = clamp(toInt(this.getAttribute('cols'), DEFAULT_COLS), 8, 24);
			this._rows = clamp(toInt(this.getAttribute('rows'), DEFAULT_ROWS), 6, 40);
			this._cell = DEFAULT_CELL;

			this._categoryOrder = [];
			this._entriesByCategory = new Map();
			this._entryByKey = new Map();
			this._magnets = [];
			this._nextId = 1;
			this._selectedId = null;
			this._drag = null;
		}

		connectedCallback() {
			if (this._connected) {
				return;
			}
			this._connected = true;

			this.renderShell();
			this.cacheElements();
			this.bindEvents();
			this.syncTheme();
			this.watchTheme();
			this.watchSize();

			this.initialize();
		}

		disconnectedCallback() {
			if (this._themeObserver) {
				this._themeObserver.disconnect();
				this._themeObserver = null;
			}
			if (this._resizeObserver) {
				this._resizeObserver.disconnect();
				this._resizeObserver = null;
			}
			if (this._saveTimer !== null) {
				window.clearTimeout(this._saveTimer);
				this._saveTimer = null;
			}
		}

		attributeChangedCallback(name, oldValue, newValue) {
			if (oldValue === newValue || !this._connected) {
				return;
			}

			if (name === 'theme') {
				this.syncTheme();
				return;
			}

			if (name === 'storage-key') {
				this._storageKey = this.getAttribute('storage-key') || STORAGE_FALLBACK_KEY;
				this.initialize();
				return;
			}

			if (name === 'words-src') {
				this.initialize(true);
				return;
			}

			if (name === 'cols' || name === 'rows') {
				this._cols = clamp(toInt(this.getAttribute('cols'), DEFAULT_COLS), 8, 24);
				this._rows = clamp(toInt(this.getAttribute('rows'), DEFAULT_ROWS), 6, 40);
				this.compactMagnets();
				this.measureBoard();
				this.renderMagnets();
				this.scheduleSave();
			}
		}

		renderShell() {
			this.shadowRoot.innerHTML = `
				<style>
					:host {
						display: block;
						--fp-bg: #cad1d8;
						--fp-bg2: #b6bec8;
						--fp-line: rgba(38, 48, 59, 0.14);
						--fp-panel: rgba(255, 255, 255, 0.55);
						--fp-text: #102015;
						--fp-subtle: #35463a;
						--fp-magnet-bg: #f9f9f6;
						--fp-magnet-edge: #c5c7bf;
						--fp-magnet-text: #1a1d1a;
						--fp-focus: #2f7d53;
						color: var(--fp-text);
						font-family: "Lato", "Segoe UI", sans-serif;
					}
					:host([data-theme="dark"]) {
						--fp-bg: #2f3842;
						--fp-bg2: #252e37;
						--fp-line: rgba(187, 206, 226, 0.12);
						--fp-panel: rgba(21, 27, 32, 0.68);
						--fp-text: #e9f0ec;
						--fp-subtle: #c3d0c8;
						--fp-magnet-bg: #e9ece5;
						--fp-magnet-edge: #bec6bc;
						--fp-magnet-text: #101510;
						--fp-focus: #88dcae;
					}
					@media (prefers-color-scheme: dark) {
						:host(:not([data-theme="light"])) {
							--fp-bg: #2f3842;
							--fp-bg2: #252e37;
							--fp-line: rgba(187, 206, 226, 0.12);
							--fp-panel: rgba(21, 27, 32, 0.68);
							--fp-text: #e9f0ec;
							--fp-subtle: #c3d0c8;
							--fp-magnet-bg: #e9ece5;
							--fp-magnet-edge: #bec6bc;
							--fp-magnet-text: #101510;
							--fp-focus: #88dcae;
						}
					}
					.shell {
						border: 1px solid rgba(0, 0, 0, 0.16);
						border-radius: 16px;
						padding: 1rem;
						background: linear-gradient(165deg, var(--fp-panel), transparent 65%);
						box-shadow: 0 12px 24px rgba(0, 0, 0, 0.2);
					}
					.toolbar {
						display: flex;
						justify-content: space-between;
						gap: 0.8rem;
						align-items: center;
						flex-wrap: wrap;
					}
					h3 {
						margin: 0;
						font-size: 1.02rem;
						letter-spacing: 0.03em;
						text-transform: uppercase;
					}
					.actions {
						display: flex;
						gap: 0.4rem;
						flex-wrap: wrap;
					}
					button.ctrl {
						border: 1px solid rgba(0, 0, 0, 0.2);
						border-radius: 999px;
						padding: 0.32rem 0.74rem;
						font: inherit;
						font-size: 0.76rem;
						font-weight: 700;
						text-transform: uppercase;
						letter-spacing: 0.05em;
						background: rgba(255, 255, 255, 0.68);
						cursor: pointer;
						color: inherit;
					}
					.pickers {
						display: grid;
						grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
						gap: 0.65rem;
						margin: 0.9rem 0;
					}
					.picker {
						display: grid;
						grid-template-columns: 1fr auto;
						gap: 0.45rem;
						align-items: end;
						padding: 0.52rem;
						border: 1px solid rgba(0, 0, 0, 0.18);
						border-radius: 10px;
						background: rgba(255, 255, 255, 0.45);
					}
					.picker label {
						display: block;
						font-size: 0.73rem;
						font-weight: 700;
						letter-spacing: 0.04em;
						text-transform: uppercase;
						margin-bottom: 0.32rem;
					}
					.picker select {
						width: 100%;
						height: 2rem;
						border: 1px solid rgba(0, 0, 0, 0.22);
						border-radius: 7px;
						padding: 0 0.45rem;
						font: inherit;
						font-size: 0.83rem;
						background: rgba(255, 255, 255, 0.92);
						color: inherit;
					}
					.picker button {
						height: 2rem;
						border: 1px solid rgba(0, 0, 0, 0.22);
						border-radius: 7px;
						padding: 0 0.65rem;
						font: inherit;
						font-size: 0.74rem;
						font-weight: 700;
						text-transform: uppercase;
						letter-spacing: 0.05em;
						background: rgba(255, 255, 255, 0.92);
						cursor: pointer;
					}
					.picker .remain {
						grid-column: 1 / -1;
						font-size: 0.72rem;
						color: var(--fp-subtle);
					}
					.hint {
						margin: 0.2rem 0 0.75rem;
						font-size: 0.84rem;
						line-height: 1.35;
						color: var(--fp-subtle);
					}
					.board {
						position: relative;
						isolation: isolate;
						height: min(72vh, 680px);
						min-height: 430px;
						border-radius: 14px;
						overflow: hidden;
						border: 1px solid rgba(0, 0, 0, 0.22);
						background:
							radial-gradient(circle at 16% 12%, rgba(255, 255, 255, 0.32), transparent 36%),
							radial-gradient(circle at 86% 88%, rgba(255, 255, 255, 0.15), transparent 38%),
							linear-gradient(180deg, var(--fp-bg), var(--fp-bg2));
						touch-action: none;
						user-select: none;
						-webkit-user-select: none;
					}
					.board::before,
					.board::after {
						content: "";
						position: absolute;
						inset: 0;
						pointer-events: none;
					}
					.board::before {
						background-image:
							linear-gradient(90deg, transparent calc(var(--cell-size, 44px) - 1px), var(--fp-line) calc(var(--cell-size, 44px) - 1px)),
							linear-gradient(180deg, transparent calc(var(--cell-size, 44px) - 1px), var(--fp-line) calc(var(--cell-size, 44px) - 1px));
						background-size: var(--cell-size, 44px) var(--cell-size, 44px);
						opacity: 0.56;
					}
					.board::after {
						box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12), inset 0 -34px 50px rgba(0, 0, 0, 0.14);
					}
					.magnets {
						position: absolute;
						inset: 0;
					}
					.magnet {
						position: absolute;
						display: inline-flex;
						align-items: center;
						justify-content: center;
						height: calc(var(--cell-size, 44px) - 8px);
						padding: 0 0.5rem;
						border-radius: 4px;
						border: 1px solid var(--fp-magnet-edge);
						background: linear-gradient(180deg, #ffffff, var(--fp-magnet-bg));
						box-shadow: 0 1px 1px rgba(0, 0, 0, 0.25), 0 2px 5px rgba(0, 0, 0, 0.2);
						color: var(--fp-magnet-text);
						font-family: "Lucida Console", "Courier New", monospace;
						font-size: clamp(0.68rem, 1.4vw, 0.87rem);
						font-weight: 700;
						letter-spacing: 0.04em;
						text-transform: lowercase;
						white-space: nowrap;
						cursor: grab;
						will-change: transform;
						transition: box-shadow 120ms ease;
					}
					.magnet:active { cursor: grabbing; }
					.magnet[data-selected="true"] {
						box-shadow: 0 0 0 2px var(--fp-focus), 0 6px 12px rgba(0, 0, 0, 0.28);
					}
					.magnet[data-dragging="true"] {
						box-shadow: 0 0 0 2px var(--fp-focus), 0 10px 20px rgba(0, 0, 0, 0.32);
					}
					.status {
						margin: 0.72rem 0 0;
						font-size: 0.78rem;
						color: var(--fp-subtle);
						min-height: 1.1rem;
					}
					button.ctrl:focus-visible,
					.picker select:focus-visible,
					.picker button:focus-visible,
					.magnet:focus-visible,
					.board:focus-visible {
						outline: 2px solid var(--fp-focus);
						outline-offset: 2px;
					}
					@media (max-width: 760px) {
						.board { height: 68vh; min-height: 360px; }
					}
					@media (prefers-reduced-motion: reduce) {
						.magnet { transition: none; }
					}
				</style>
				<div class="shell">
					<div class="toolbar">
						<h3>Fridge Poetry</h3>
						<div class="actions">
							<button class="ctrl" type="button" data-action="clear">Clear Board</button>
						</div>
					</div>
					<div class="pickers" aria-label="Word category pickers"></div>
					<p class="hint">Choose words from category dropdowns, add them as magnets, then drag and drop to build lines.</p>
					<div class="board" tabindex="0" aria-label="Interactive fridge poetry board">
						<div class="magnets"></div>
					</div>
					<p class="status" aria-live="polite"></p>
				</div>
			`;
		}

		cacheElements() {
			this.$pickers = this.shadowRoot.querySelector('.pickers');
			this.$board = this.shadowRoot.querySelector('.board');
			this.$magnets = this.shadowRoot.querySelector('.magnets');
			this.$status = this.shadowRoot.querySelector('.status');
		}

		bindEvents() {
			var self = this;

			this.shadowRoot.addEventListener('click', function(event) {
				var ctrl = event.target.closest('button.ctrl');
				if (!ctrl) {
					return;
				}
				if (ctrl.getAttribute('data-action') === 'clear') {
					self.clearBoard();
				}
			});

			this.$pickers.addEventListener('click', function(event) {
				var button = event.target.closest('button[data-category]');
				if (!button || self.readonly) {
					return;
				}
				event.preventDefault();
				self.addFromCategory(button.getAttribute('data-category'));
			});

			this.$magnets.addEventListener('pointerdown', function(event) {
				var magnetEl = event.target.closest('.magnet');
				if (!magnetEl || self.readonly) {
					return;
				}

				var id = magnetEl.getAttribute('data-id');
				var magnet = self.getMagnet(id);
				if (!magnet) {
					return;
				}

				event.preventDefault();
				magnetEl.setPointerCapture(event.pointerId);
				self._drag = {
					id: id,
					pointerId: event.pointerId,
					startClientX: event.clientX,
					startClientY: event.clientY,
					originX: magnet.x,
					originY: magnet.y,
					candidateX: magnet.x,
					candidateY: magnet.y,
					moved: false
				};

				self.selectMagnet(id);
				magnetEl.dataset.dragging = 'true';
				self.setStatus('Dragging "' + magnet.word + '".');
			});

			this.$magnets.addEventListener('pointermove', function(event) {
				if (!self._drag || event.pointerId !== self._drag.pointerId) {
					return;
				}

				event.preventDefault();
				var drag = self._drag;
				var magnet = self.getMagnet(drag.id);
				if (!magnet) {
					return;
				}

				var dx = event.clientX - drag.startClientX;
				var dy = event.clientY - drag.startClientY;
				if (!drag.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
					drag.moved = true;
				}

				var pxX = (drag.originX * self._cell) + dx;
				var pxY = (drag.originY * self._cell) + dy;
				var slot = self.findNearestAvailableByPixel(pxX, pxY, magnet.w, magnet.h, drag.id, drag.originX, drag.originY);
				drag.candidateX = slot.x;
				drag.candidateY = slot.y;
				self.placeMagnetElement(magnet, true);
			});

			var endDrag = function(event) {
				if (!self._drag || event.pointerId !== self._drag.pointerId) {
					return;
				}

				event.preventDefault();
				var drag = self._drag;
				self._drag = null;

				var magnet = self.getMagnet(drag.id);
				var magnetEl = self.$magnets.querySelector('[data-id="' + drag.id + '"]');
				if (magnetEl) {
					magnetEl.dataset.dragging = 'false';
				}

				if (magnet && drag.moved) {
					magnet.x = drag.candidateX;
					magnet.y = drag.candidateY;
					self.setStatus('Placed "' + magnet.word + '".');
					self.renderMagnets();
					self.scheduleSave();
				}
			};

			this.$magnets.addEventListener('pointerup', endDrag);
			this.$magnets.addEventListener('pointercancel', endDrag);

			this.$magnets.addEventListener('keydown', function(event) {
				if (self.readonly) {
					return;
				}
				var el = event.target.closest('.magnet');
				if (!el) {
					return;
				}
				var id = el.getAttribute('data-id');
				var delta = null;
				if (event.key === 'ArrowLeft') {
					delta = { x: -1, y: 0 };
				} else if (event.key === 'ArrowRight') {
					delta = { x: 1, y: 0 };
				} else if (event.key === 'ArrowUp') {
					delta = { x: 0, y: -1 };
				} else if (event.key === 'ArrowDown') {
					delta = { x: 0, y: 1 };
				}
				if (!delta) {
					return;
				}
				event.preventDefault();
				self.nudgeMagnet(id, delta.x, delta.y);
			});
		}

		watchTheme() {
			var root = document.documentElement;
			if (!window.MutationObserver || !root) {
				return;
			}

			var self = this;
			this._themeObserver = new MutationObserver(function() {
				if (!self.hasAttribute('theme')) {
					self.syncTheme();
				}
			});
			this._themeObserver.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
		}

		watchSize() {
			var self = this;
			if (window.ResizeObserver) {
				this._resizeObserver = new ResizeObserver(function() {
					self._rafMeasure();
				});
				this._resizeObserver.observe(this.$board);
			} else {
				window.addEventListener('resize', function() {
					self._rafMeasure();
				});
			}
		}

		syncTheme() {
			var explicit = this.getAttribute('theme');
			if (explicit === 'light' || explicit === 'dark') {
				this.setAttribute('data-theme', explicit);
				return;
			}

			var docTheme = document.documentElement.getAttribute('data-theme');
			if (docTheme === 'light' || docTheme === 'dark') {
				this.setAttribute('data-theme', docTheme);
				return;
			}

			var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
			this.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
		}

		get readonly() {
			return this.hasAttribute('readonly') && this.getAttribute('readonly') !== 'false';
		}

		async initialize(skipSaved) {
			var source = await this.fetchWordSource();
			this.ingestSource(source);

			this._magnets = [];
			this._nextId = 1;
			this._selectedId = null;

			if (!skipSaved) {
				await this.loadSavedState();
			}

			this.compactMagnets();
			this.renderPickers();
			this.measureBoard();
			this.renderMagnets();
			this.setStatus('Board ready. Choose words from the category pickers.');
		}

		async fetchWordSource() {
			var src = this.getAttribute('words-src');
			if (!src) {
				return DEFAULT_SOURCE;
			}
			try {
				var response = await fetch(src);
				if (!response.ok) {
					throw new Error('Unable to load words source.');
				}
				return await response.json();
			} catch (err) {
				this.setStatus('Could not load source. Using default categories.');
				return DEFAULT_SOURCE;
			}
		}

		ingestSource(source) {
			this._categoryOrder = [];
			this._entriesByCategory = new Map();
			this._entryByKey = new Map();

			var categories = normalizeSource(source);
			Object.keys(categories).forEach(function(category) {
				this._categoryOrder.push(category);
				var counts = new Map();
				categories[category].forEach(function(word) {
					counts.set(word, (counts.get(word) || 0) + 1);
				});

				var entries = Array.from(counts.entries())
					.map(function(pair) {
						return {
							category: category,
							word: pair[0],
							count: pair[1],
							key: entryKey(category, pair[0])
						};
					})
					.sort(function(a, b) {
						return a.word.localeCompare(b.word);
					});

				this._entriesByCategory.set(category, entries);
				for (var i = 0; i < entries.length; i++) {
					this._entryByKey.set(entries[i].key, entries[i]);
				}
			}, this);
		}

		usedCounts() {
			var used = new Map();
			for (var i = 0; i < this._magnets.length; i++) {
				var magnet = this._magnets[i];
				var key = entryKey(magnet.category, magnet.word);
				used.set(key, (used.get(key) || 0) + 1);
			}
			return used;
		}

		remainingFor(entry, usedMap) {
			var used = (usedMap || this.usedCounts()).get(entry.key) || 0;
			return Math.max(0, entry.count - used);
		}

		renderPickers() {
			if (!this.$pickers) {
				return;
			}

			var used = this.usedCounts();
			var html = '';
			for (var i = 0; i < this._categoryOrder.length; i++) {
				var category = this._categoryOrder[i];
				var entries = this._entriesByCategory.get(category) || [];
				var options = '';
				for (var j = 0; j < entries.length; j++) {
					var entry = entries[j];
					var remain = this.remainingFor(entry, used);
					var disabled = remain <= 0 ? ' disabled' : '';
					options += '<option value="' + entry.key + '"' + disabled + '>' + entry.word + ' (' + remain + '/' + entry.count + ')</option>';
				}

				if (!options) {
					options = '<option value="">No words</option>';
				}

				html +=
					'<div class="picker" data-picker="' + category + '">' +
						'<div>' +
							'<label for="pick-' + category + '">' + category + '</label>' +
							'<select id="pick-' + category + '" data-category-select="' + category + '">' + options + '</select>' +
						'</div>' +
						'<button type="button" data-category="' + category + '">Add</button>' +
						'<div class="remain">Choose one ' + category.slice(0, -1) + ' and add it as a magnet.</div>' +
					'</div>';
			}

			this.$pickers.innerHTML = html;
		}

		addFromCategory(category) {
			var select = this.$pickers.querySelector('[data-category-select="' + category + '"]');
			if (!select || !select.value) {
				return;
			}

			var entry = this._entryByKey.get(select.value);
			if (!entry) {
				return;
			}

			var used = this.usedCounts();
			if (this.remainingFor(entry, used) <= 0) {
				this.setStatus('No remaining "' + entry.word + '" magnets in ' + category + '.');
				this.renderPickers();
				return;
			}

			var dims = {
				w: wordWidth(entry.word),
				h: 1
			};

			var slot = this.findNearestAvailable(0, 0, dims.w, dims.h, null, 0, 0);
			var magnet = {
				id: 'm' + this._nextId++,
				category: entry.category,
				word: entry.word,
				w: dims.w,
				h: dims.h,
				x: slot.x,
				y: slot.y
			};

			this._magnets.push(magnet);
			this.selectMagnet(magnet.id);
			this.renderPickers();
			this.renderMagnets();
			this.setStatus('Added "' + magnet.word + '".');
			this.scheduleSave();
		}

		clearBoard() {
			if (this.readonly) {
				return;
			}
			this._magnets = [];
			this._nextId = 1;
			this._selectedId = null;
			this.renderPickers();
			this.renderMagnets();
			this.setStatus('Board cleared.');
			this.scheduleSave();
		}

		async loadSavedState() {
			var saved = null;
			try {
				saved = await idbGet(this._storageKey);
			} catch (err) {
				saved = storageGetLocal(this._storageKey);
			}

			if (!saved || !Array.isArray(saved.magnets)) {
				return;
			}

			var working = [];
			var used = new Map();
			for (var i = 0; i < saved.magnets.length; i++) {
				var item = saved.magnets[i];
				var category = normalizeWord(item.category);
				var word = normalizeWord(item.word);
				if (!category || !word) {
					continue;
				}
				var key = entryKey(category, word);
				var entry = this._entryByKey.get(key);
				if (!entry) {
					continue;
				}

				var usedNow = used.get(key) || 0;
				if (usedNow >= entry.count) {
					continue;
				}
				used.set(key, usedNow + 1);

				working.push({
					id: String(item.id || ('m' + (i + 1))),
					category: category,
					word: word,
					w: wordWidth(word),
					h: 1,
					x: clamp(toInt(item.x, 0), 0, this._cols - 1),
					y: clamp(toInt(item.y, 0), 0, this._rows - 1)
				});
			}

			this._magnets = working;
			this._nextId = this._magnets.reduce(function(max, magnet) {
				var n = parseInt(String(magnet.id).replace(/^m/, ''), 10);
				if (!Number.isFinite(n)) {
					return max;
				}
				return Math.max(max, n + 1);
			}, 1);
		}

		measureBoard() {
			if (!this.$board) {
				return;
			}

			this._boardRect = this.$board.getBoundingClientRect();
			var width = this._boardRect.width;
			var height = this._boardRect.height;
			var byWidth = Math.floor(width / this._cols);
			var byHeight = Math.floor(height / this._rows);
			this._cell = clamp(Math.min(byWidth, byHeight), 16, 64);
			this.$board.style.setProperty('--cell-size', this._cell + 'px');
			this.renderMagnets();
		}

		getMagnet(id) {
			for (var i = 0; i < this._magnets.length; i++) {
				if (this._magnets[i].id === id) {
					return this._magnets[i];
				}
			}
			return null;
		}

		cellIndex(x, y) {
			return y * this._cols + x;
		}

		buildOccupancy(ignoreId) {
			var cells = new Array(this._cols * this._rows).fill(null);
			for (var i = 0; i < this._magnets.length; i++) {
				var magnet = this._magnets[i];
				if (ignoreId && magnet.id === ignoreId) {
					continue;
				}
				for (var y = magnet.y; y < magnet.y + magnet.h; y++) {
					for (var x = magnet.x; x < magnet.x + magnet.w; x++) {
						if (x >= 0 && y >= 0 && x < this._cols && y < this._rows) {
							cells[this.cellIndex(x, y)] = magnet.id;
						}
					}
				}
			}
			return cells;
		}

		canPlace(cells, x, y, w, h) {
			if (x < 0 || y < 0 || x + w > this._cols || y + h > this._rows) {
				return false;
			}
			for (var yy = y; yy < y + h; yy++) {
				for (var xx = x; xx < x + w; xx++) {
					if (cells[this.cellIndex(xx, yy)] !== null) {
						return false;
					}
				}
			}
			return true;
		}

		findNearestAvailable(startX, startY, w, h, ignoreId, fallbackX, fallbackY) {
			var cells = this.buildOccupancy(ignoreId);
			var sx = clamp(startX, 0, Math.max(0, this._cols - w));
			var sy = clamp(startY, 0, Math.max(0, this._rows - h));

			if (this.canPlace(cells, sx, sy, w, h)) {
				return { x: sx, y: sy };
			}

			var best = null;
			var bestDist = Infinity;
			for (var y = 0; y <= this._rows - h; y++) {
				for (var x = 0; x <= this._cols - w; x++) {
					if (!this.canPlace(cells, x, y, w, h)) {
						continue;
					}
					var dx = x - sx;
					var dy = y - sy;
					var dist = (dx * dx) + (dy * dy);
					if (dist < bestDist) {
						bestDist = dist;
						best = { x: x, y: y };
					}
				}
			}

			if (!best) {
				return { x: fallbackX || 0, y: fallbackY || 0 };
			}
			return best;
		}

		findNearestAvailableByPixel(pxX, pxY, w, h, ignoreId, fallbackX, fallbackY) {
			var centerX = pxX + ((w * this._cell) / 2);
			var centerY = pxY + (this._cell / 2);
			var gridX = Math.round((centerX / this._cell) - (w / 2));
			var gridY = Math.round((centerY / this._cell) - 0.5);
			return this.findNearestAvailable(gridX, gridY, w, h, ignoreId, fallbackX, fallbackY);
		}

		compactMagnets() {
			for (var i = 0; i < this._magnets.length; i++) {
				var magnet = this._magnets[i];
				magnet.w = wordWidth(magnet.word);
				magnet.h = 1;
				var slot = this.findNearestAvailable(magnet.x, magnet.y, magnet.w, magnet.h, magnet.id, 0, 0);
				magnet.x = slot.x;
				magnet.y = slot.y;
			}
		}

		nudgeMagnet(id, dx, dy) {
			var magnet = this.getMagnet(id);
			if (!magnet) {
				return;
			}
			var slot = this.findNearestAvailable(magnet.x + dx, magnet.y + dy, magnet.w, magnet.h, id, magnet.x, magnet.y);
			magnet.x = slot.x;
			magnet.y = slot.y;
			this.selectMagnet(id);
			this.renderMagnets();
			this.scheduleSave();
		}

		selectMagnet(id) {
			this._selectedId = id;
			this.renderMagnets();
		}

		placeMagnetElement(magnet, draggingPreview) {
			var el = this.$magnets.querySelector('[data-id="' + magnet.id + '"]');
			if (!el) {
				return;
			}

			var x = magnet.x;
			var y = magnet.y;
			if (draggingPreview && this._drag && this._drag.id === magnet.id) {
				x = this._drag.candidateX;
				y = this._drag.candidateY;
			}

			el.style.width = ((magnet.w * this._cell) - 8) + 'px';
			el.style.transform = 'translate(' + ((x * this._cell) + 4) + 'px,' + ((y * this._cell) + 4) + 'px)';
		}

		renderMagnets() {
			if (!this.$magnets) {
				return;
			}

			var existing = new Map();
			this.$magnets.querySelectorAll('.magnet').forEach(function(node) {
				existing.set(node.getAttribute('data-id'), node);
			});

			var fragment = document.createDocumentFragment();
			for (var i = 0; i < this._magnets.length; i++) {
				var magnet = this._magnets[i];
				var node = existing.get(magnet.id);
				if (!node) {
					node = document.createElement('button');
					node.type = 'button';
					node.className = 'magnet';
					node.setAttribute('data-id', magnet.id);
					node.textContent = magnet.word;
					node.setAttribute('aria-label', 'Magnet word ' + magnet.word + ' from ' + magnet.category);
				}

				node.dataset.selected = this._selectedId === magnet.id ? 'true' : 'false';
				node.dataset.dragging = this._drag && this._drag.id === magnet.id ? 'true' : 'false';

				if (this.readonly) {
					node.setAttribute('disabled', 'disabled');
				} else {
					node.removeAttribute('disabled');
				}

				existing.delete(magnet.id);
				fragment.appendChild(node);
			}

			existing.forEach(function(node) {
				node.remove();
			});

			this.$magnets.innerHTML = '';
			this.$magnets.appendChild(fragment);

			for (var j = 0; j < this._magnets.length; j++) {
				this.placeMagnetElement(this._magnets[j], false);
			}
		}

		setStatus(message) {
			if (this.$status) {
				this.$status.textContent = message;
			}
		}

		serializeState() {
			return {
				id: this._storageKey,
				version: 2,
				cols: this._cols,
				rows: this._rows,
				magnets: this._magnets.map(function(m) {
					return {
						id: m.id,
						category: m.category,
						word: m.word,
						x: m.x,
						y: m.y
					};
				}),
				nextId: this._nextId,
				updatedAt: new Date().toISOString()
			};
		}

		scheduleSave() {
			var self = this;
			if (this._saveTimer !== null) {
				window.clearTimeout(this._saveTimer);
			}
			this._saveTimer = window.setTimeout(function() {
				self._saveTimer = null;
				self.persistState();
			}, 180);
		}

		async persistState() {
			var state = this.serializeState();
			storageSetLocal(this._storageKey, state);
			try {
				await idbSet(state);
			} catch (err) {
				// localStorage fallback already written.
			}

			this.dispatchEvent(new CustomEvent('fridge-change', {
				detail: {
					storageKey: this._storageKey,
					magnets: state.magnets
				},
				bubbles: true,
				composed: true
			}));
		}
	}

	if (!customElements.get('fridge-poetry-board')) {
		customElements.define('fridge-poetry-board', FridgePoetryBoard);
	}
})();
