/*
	Fridge Poetry board custom element.
	Empty-start board + category word pools + drag-and-drop.
*/
(function() {
	var DB_NAME = 'fridge-poetry-db';
	var DB_VERSION = 2;
	var STORE_NAME = 'boards';
	var dbPromise = null;

	var DEFAULT_COLS = 64;
	var DEFAULT_ROWS = 11;
	var DEFAULT_CELL = 44;
	var MIN_ZOOM = 0.25;
	var MAX_ZOOM = 2.0;
	var MIN_COLS = 8;
	var MAX_COLS = 220;
	var MIN_ROWS = 6;
	var MAX_ROWS = 200;
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
			this._cols = clamp(toInt(this.getAttribute('cols'), DEFAULT_COLS), MIN_COLS, MAX_COLS);
			this._rows = clamp(toInt(this.getAttribute('rows'), DEFAULT_ROWS), MIN_ROWS, MAX_ROWS);
			this._cell = DEFAULT_CELL;

			this._categoryOrder = [];
			this._entriesByCategory = new Map();
			this._entryByKey = new Map();
			this._magnets = [];
			this._nextId = 1;
			this._selectedId = null;
			this._drag = null;
			this._pan = null;
			this._openCategories = new Set();
			this._zoom = 1;
			this._baseCell = DEFAULT_CELL;
			this._magnetGap = 4;
			this._minRowsFromSource = this._rows;
			this._minColsFromSource = this._cols;
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
				this._cols = clamp(toInt(this.getAttribute('cols'), DEFAULT_COLS), MIN_COLS, MAX_COLS);
				this._rows = clamp(toInt(this.getAttribute('rows'), DEFAULT_ROWS), MIN_ROWS, MAX_ROWS);
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
						--fp-cat-bg: #eef5ef;
						--fp-cat-head: #e1ece2;
						--fp-cat-border: #b8c8ba;
						--fp-cat-text: #122118;
						--fp-word-bg: #fafffa;
						--fp-word-text: #112015;
						--fp-word-border: #9fb2a2;
						--fp-fridge-border: rgba(27, 42, 33, 0.64);
						--fp-fridge-inner: rgba(255, 255, 255, 0.24);
						--fp-fridge-outer: rgba(0, 0, 0, 0.18);
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
						--fp-cat-bg: #16231c;
						--fp-cat-head: #1d2d24;
						--fp-cat-border: #365043;
						--fp-cat-text: #ebf7ef;
						--fp-word-bg: #24372b;
						--fp-word-text: #f2fff6;
						--fp-word-border: #5a7765;
						--fp-fridge-border: rgba(189, 213, 197, 0.66);
						--fp-fridge-inner: rgba(227, 242, 231, 0.2);
						--fp-fridge-outer: rgba(0, 0, 0, 0.5);
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
							--fp-cat-bg: #16231c;
							--fp-cat-head: #1d2d24;
							--fp-cat-border: #365043;
							--fp-cat-text: #ebf7ef;
							--fp-word-bg: #24372b;
							--fp-word-text: #f2fff6;
							--fp-word-border: #5a7765;
							--fp-fridge-border: rgba(189, 213, 197, 0.66);
							--fp-fridge-inner: rgba(227, 242, 231, 0.2);
							--fp-fridge-outer: rgba(0, 0, 0, 0.48);
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
					.actions-group {
						display: inline-flex;
						gap: 0.35rem;
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
					button.ctrl[data-pressed="true"] {
						background: rgba(255, 255, 255, 0.95);
						border-color: rgba(0, 0, 0, 0.34);
					}
					.pickers {
						display: grid;
						grid-template-columns: 1fr;
						gap: 0.58rem;
						margin: 0.82rem 0 0.95rem;
					}
					.category-card {
						border: 1px solid var(--fp-cat-border);
						border-radius: 11px;
						background: var(--fp-cat-bg);
						overflow: hidden;
					}
					.category-summary {
						display: flex;
						align-items: center;
						justify-content: space-between;
						gap: 0.6rem;
						padding: 0.6rem 0.7rem;
						cursor: pointer;
						list-style: none;
						background: var(--fp-cat-head);
					}
					.category-summary::-webkit-details-marker {
						display: none;
					}
					.category-summary::after {
						content: "▾";
						font-size: 0.72rem;
						opacity: 0.82;
						transform: rotate(-90deg);
						transition: transform 140ms ease;
					}
					.category-card[open] .category-summary::after {
						transform: rotate(0deg);
					}
					.category-summary-main {
						display: grid;
						gap: 0.16rem;
						min-width: 0;
						flex: 1 1 auto;
					}
					.category-title {
						font-size: 0.78rem;
						font-weight: 800;
						letter-spacing: 0.04em;
						text-transform: capitalize;
						color: var(--fp-cat-text);
					}
					.category-sub {
						font-size: 0.72rem;
						color: var(--fp-cat-text);
						opacity: 0.78;
						overflow-wrap: anywhere;
					}
					.category-body {
						display: grid;
						gap: 0.62rem;
						padding: 0 0.68rem 0.68rem;
						border-top: 1px solid rgba(0, 0, 0, 0.12);
					}
					.word-bank {
						display: grid;
						grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
						gap: 0.4rem;
						max-height: 14rem;
						overflow: auto;
						padding-right: 0.15rem;
					}
					.word-option {
						display: flex;
						justify-content: space-between;
						gap: 0.45rem;
						align-items: center;
						border: 1px solid var(--fp-word-border);
						border-radius: 8px;
						padding: 0.36rem 0.5rem;
						font: inherit;
						font-size: 0.85rem;
						font-weight: 700;
						background: var(--fp-word-bg);
						color: var(--fp-word-text);
						cursor: pointer;
						min-width: 0;
					}
					.word-option span:first-child {
						letter-spacing: 0.01em;
						min-width: 0;
						white-space: normal;
						overflow: hidden;
						text-overflow: ellipsis;
						overflow-wrap: anywhere;
						line-height: 1.2;
					}
					.word-option[disabled] {
						opacity: 0.48;
						cursor: not-allowed;
					}
					.word-option .word-meta {
						font-size: 0.71rem;
						font-weight: 700;
						color: var(--fp-word-text);
						opacity: 0.72;
						flex: 0 0 auto;
					}
					.word-bank-empty {
						font-size: 0.75rem;
						color: var(--fp-subtle);
						padding: 0.25rem 0.1rem;
					}
					.hint {
						margin: 0.2rem 0 0.75rem;
						font-size: 0.84rem;
						line-height: 1.35;
						color: var(--fp-subtle);
					}
					.board-viewport {
						position: relative;
						height: min(72vh, 680px);
						min-height: 430px;
						border-radius: 0;
						overflow: auto;
						border: 1px solid var(--fp-fridge-outer);
						box-shadow: inset 0 0 0 2px var(--fp-fridge-border), inset 0 1px 0 var(--fp-fridge-inner);
						cursor: grab;
						background:
							radial-gradient(circle at 16% 12%, rgba(255, 255, 255, 0.32), transparent 36%),
							radial-gradient(circle at 86% 88%, rgba(255, 255, 255, 0.15), transparent 38%),
							linear-gradient(180deg, var(--fp-bg), var(--fp-bg2));
					}
					.board-frame {
						position: relative;
					}
					.board-viewport[data-panning="true"] {
						cursor: grabbing;
					}
					.board {
						position: relative;
						isolation: isolate;
						width: 100%;
						height: 100%;
						min-width: 100%;
						min-height: 100%;
						touch-action: none;
						user-select: none;
						-webkit-user-select: none;
						outline: none;
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
						height: calc(var(--cell-size, 44px) - (var(--magnet-gap, 4px) * 2));
						padding: 0 calc(var(--cell-size, 44px) * 0.12);
						border-radius: 0;
						border: 1px solid var(--fp-magnet-edge);
						background: linear-gradient(180deg, #ffffff, var(--fp-magnet-bg));
						box-shadow: 0 1px 1px rgba(0, 0, 0, 0.25), 0 2px 5px rgba(0, 0, 0, 0.2);
						color: var(--fp-magnet-text);
						font-family: "Lucida Console", "Courier New", monospace;
						font-size: calc((var(--cell-size, 44px) - (var(--magnet-gap, 4px) * 2)) * 0.42);
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
					.zoom-tools {
						display: inline-flex;
						flex-direction: column;
						align-items: center;
						gap: 0.18rem;
						padding: 0.22rem;
						border-radius: 8px;
						background: rgba(8, 14, 11, 0.34);
						border: 1px solid rgba(255, 255, 255, 0.16);
						position: absolute;
						right: 0.8rem;
						bottom: 0.8rem;
						z-index: 8;
						backdrop-filter: blur(1.5px);
						pointer-events: auto;
					}
					.zoom-tools .ctrl {
						min-width: 1.7rem;
						height: 1.7rem;
						padding: 0;
						border-radius: 5px;
						font-size: 0.9rem;
						line-height: 1;
						background: rgba(250, 253, 250, 0.88);
						color: #101510;
					}
					.zoom-readout {
						min-width: 1.7rem;
						text-align: center;
						font-size: 0.61rem;
						font-weight: 700;
						letter-spacing: 0.01em;
						text-transform: uppercase;
						color: #f3faf5;
						opacity: 0.85;
					}
					button.ctrl:focus-visible,
					.category-summary:focus-visible,
					.word-option:focus-visible,
					.magnet:focus-visible,
					.board:focus-visible {
						outline: 2px solid var(--fp-focus);
						outline-offset: 2px;
					}
					@media (max-width: 760px) {
						.actions-group {
							width: 100%;
						}
						button.ctrl {
							flex: 1;
						}
						.word-bank {
							grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
							max-height: 10rem;
						}
						.zoom-tools {
							right: 0.6rem;
							bottom: 0.6rem;
						}
						.board-viewport { height: 68vh; min-height: 360px; }
					}
					@media (prefers-reduced-motion: reduce) {
						.magnet { transition: none; }
					}
				</style>
				<div class="shell">
					<div class="toolbar">
						<h3>Fridge Poetry</h3>
						<div class="actions">
							<div class="actions-group">
								<button class="ctrl" type="button" data-action="expand-all" data-pressed="false" aria-pressed="false">Expand All</button>
								<button class="ctrl" type="button" data-action="collapse-all" data-pressed="false" aria-pressed="false">Collapse All</button>
							</div>
							<button class="ctrl" type="button" data-action="clear">Clear Board</button>
						</div>
					</div>
					<div class="pickers" aria-label="Word category pools"></div>
					<p class="hint">Choose words from each category pool, place magnets on the fridge, then pan and pinch to compose lines anywhere on the board.</p>
					<div class="board-frame">
						<div class="board-viewport">
							<div class="board" tabindex="0" aria-label="Interactive fridge poetry board">
								<div class="magnets"></div>
							</div>
						</div>
						<div class="zoom-tools" role="group" aria-label="Board zoom controls">
							<button class="ctrl" type="button" data-action="zoom-out" aria-label="Zoom out">-</button>
							<button class="ctrl" type="button" data-action="zoom-in" aria-label="Zoom in">+</button>
							<span class="zoom-readout" data-zoom-readout>100%</span>
						</div>
					</div>
					<p class="status" aria-live="polite"></p>
				</div>
			`;
		}

		cacheElements() {
			this.$pickers = this.shadowRoot.querySelector('.pickers');
			this.$viewport = this.shadowRoot.querySelector('.board-viewport');
			this.$board = this.shadowRoot.querySelector('.board');
			this.$magnets = this.shadowRoot.querySelector('.magnets');
			this.$status = this.shadowRoot.querySelector('.status');
			this.$zoomReadout = this.shadowRoot.querySelector('[data-zoom-readout]');
		}

		bindEvents() {
			var self = this;

			if (this.$viewport) {
				var pointerCache = new Map();

				this.$viewport.addEventListener('pointerdown', function(event) {
					if (event.target.closest('.magnet') || event.target.closest('.zoom-tools')) {
						return;
					}

					if (event.pointerType === 'mouse' && event.button !== 0) {
						return;
					}

					pointerCache.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType });
					try {
						self.$viewport.setPointerCapture(event.pointerId);
					} catch (err) {
						// Ignore capture failures on unsupported devices.
					}

					if (pointerCache.size >= 2) {
						var points = Array.from(pointerCache.values());
						var p1 = points[0];
						var p2 = points[1];
						var dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
						var centerX = (p1.x + p2.x) / 2;
						var centerY = (p1.y + p2.y) / 2;

						self._pan = null;
						self._pinch = {
							startZoom: self._zoom,
							startDist: Math.max(dist, 1),
							centerX: centerX,
							centerY: centerY
						};
						self.$viewport.setAttribute('data-panning', 'true');
						return;
					}

					if (event.pointerType === 'mouse' || event.pointerType === 'touch' || event.pointerType === 'pen') {
						self._pinch = null;

						self._pan = {
							pointerId: event.pointerId,
							startX: event.clientX,
							startY: event.clientY,
							startLeft: self.$viewport.scrollLeft,
							startTop: self.$viewport.scrollTop
						};
						self.$viewport.setAttribute('data-panning', 'true');
					}
				});

				this.$viewport.addEventListener('pointermove', function(event) {
					if (!pointerCache.has(event.pointerId)) {
						return;
					}
					pointerCache.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType });

					if (self._pinch && pointerCache.size >= 2) {
						event.preventDefault();
						var points = Array.from(pointerCache.values());
						var a = points[0];
						var b = points[1];
						var currentDist = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
						var centerX = (a.x + b.x) / 2;
						var centerY = (a.y + b.y) / 2;
						var scaleFactor = currentDist / self._pinch.startDist;
						self.setZoom(self._pinch.startZoom * scaleFactor, true, centerX, centerY);
						return;
					}

					if (!self._pan || event.pointerId !== self._pan.pointerId) {
						return;
					}

					event.preventDefault();
					var dx = event.clientX - self._pan.startX;
					var dy = event.clientY - self._pan.startY;
					self.$viewport.scrollLeft = self._pan.startLeft - dx;
					self.$viewport.scrollTop = self._pan.startTop - dy;
				});

				var endPan = function(event) {
					pointerCache.delete(event.pointerId);

					if (self._pan && event.pointerId === self._pan.pointerId) {
						self._pan = null;
					}

					if (pointerCache.size < 2) {
						self._pinch = null;
					}

					if (!self._pan && !self._pinch) {
						self.$viewport.removeAttribute('data-panning');
					}
				};

				this.$viewport.addEventListener('pointerup', endPan);
				this.$viewport.addEventListener('pointercancel', endPan);
				this.$viewport.addEventListener('lostpointercapture', endPan);

				this.$viewport.addEventListener('wheel', function(event) {
					event.preventDefault();

					if (event.ctrlKey || event.metaKey) {
						var factor = Math.exp((-event.deltaY || 0) / 320);
						self.setZoom(self._zoom * factor, true, event.clientX, event.clientY);
						return;
					}

					self.$viewport.scrollLeft += event.deltaX;
					self.$viewport.scrollTop += event.deltaY;
				}, { passive: false });

				this.$viewport.addEventListener('gesturestart', function(event) {
					self._gestureZoomStart = self._zoom;
					event.preventDefault();
				}, { passive: false });

				this.$viewport.addEventListener('gesturechange', function(event) {
					if (!Number.isFinite(self._gestureZoomStart)) {
						self._gestureZoomStart = self._zoom;
					}
					event.preventDefault();
					self.setZoom(self._gestureZoomStart * event.scale, true, event.clientX, event.clientY);
				}, { passive: false });

				this.$viewport.addEventListener('gestureend', function(event) {
					event.preventDefault();
					self._gestureZoomStart = null;
				}, { passive: false });
			}

			this.shadowRoot.addEventListener('click', function(event) {
				var ctrl = event.target.closest('button.ctrl');
				if (!ctrl) {
					return;
				}
				var action = ctrl.getAttribute('data-action');
				if (action === 'clear') {
					self.clearBoard();
				} else if (action === 'expand-all') {
					self.expandAllCategories();
				} else if (action === 'collapse-all') {
					self.collapseAllCategories();
				} else if (action === 'zoom-in') {
					self.setZoom(self._zoom + 0.1, false);
				} else if (action === 'zoom-out') {
					self.setZoom(self._zoom - 0.1, false);
				}
			});

			this.$pickers.addEventListener('click', function(event) {
				var addEntryButton = event.target.closest('button[data-entry-key]');
				if (!addEntryButton || self.readonly) {
					return;
				}
				event.preventDefault();
				self.addEntryByKey(addEntryButton.getAttribute('data-entry-key'));
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
				var boardPoint = self.clientToBoard(event.clientX, event.clientY);
				self._drag = {
					id: id,
					pointerId: event.pointerId,
					startClientX: event.clientX,
					startClientY: event.clientY,
					originX: magnet.x,
					originY: magnet.y,
					grabOffsetX: boardPoint.x - (magnet.x * self._cell),
					grabOffsetY: boardPoint.y - (magnet.y * self._cell),
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

				var point = self.clientToBoard(event.clientX, event.clientY);
				var pxX = point.x - drag.grabOffsetX;
				var pxY = point.y - drag.grabOffsetY;
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
					if (magnetEl.hasPointerCapture && magnetEl.hasPointerCapture(event.pointerId)) {
						magnetEl.releasePointerCapture(event.pointerId);
					}
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
			this.$magnets.addEventListener('lostpointercapture', endDrag);

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
				if (this.$viewport) {
					this._resizeObserver.observe(this.$viewport);
				}
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
			var configuredCols = clamp(toInt(this.getAttribute('cols'), DEFAULT_COLS), MIN_COLS, MAX_COLS);
			var configuredRows = clamp(toInt(this.getAttribute('rows'), DEFAULT_ROWS), MIN_ROWS, MAX_ROWS);
			this._cols = configuredCols;
			this._rows = configuredRows;

			var source = await this.fetchWordSource();
			this.ingestSource(source);
			this._openCategories.clear();

			this._magnets = [];
			this._nextId = 1;
			this._selectedId = null;

			if (!skipSaved) {
				await this.loadSavedState();
			}

			this._rows = Math.max(this._rows, this._minRowsFromSource);

			this.compactMagnets();
			this.renderPickers();
			this.measureBoard();
			this.renderMagnets();
			this.setStatus('Board ready. Choose words from the category pools.');
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

			this._minColsFromSource = this.computeMinimumColsFromSource();
			this._minRowsFromSource = this.computeMinimumRowsFromSource();
			this._cols = Math.max(this._cols, this._minColsFromSource);
			this._rows = Math.max(this._rows, this._minRowsFromSource);
		}

		computeMinimumColsFromSource() {
			var totalCells = 0;
			this._entryByKey.forEach(function(entry) {
				totalCells += entry.count * wordWidth(entry.word);
			});

			var estimate = Math.ceil(Math.sqrt(totalCells * 1.35));
			return clamp(Math.max(48, estimate), 12, MAX_COLS);
		}

		computeMinimumRowsFromSource() {
			var totalCells = 0;
			this._entryByKey.forEach(function(entry) {
				totalCells += entry.count * wordWidth(entry.word);
			});

			var estimate = Math.ceil(totalCells / this._cols) + 2;
			return clamp(Math.max(DEFAULT_ROWS, estimate), DEFAULT_ROWS, MAX_ROWS);
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
				var words = '';
				var total = 0;
				var remainingTotal = 0;
				for (var j = 0; j < entries.length; j++) {
					var entry = entries[j];
					var remain = this.remainingFor(entry, used);
					var disabled = remain <= 0 ? ' disabled' : '';
					total += entry.count;
					remainingTotal += remain;
					words += '<button type="button" class="word-option" data-entry-key="' + entry.key + '"' + disabled + '><span>' + entry.word + '</span><span class="word-meta">' + remain + '/' + entry.count + '</span></button>';
				}
				if (!words) {
					words = '<div class="word-bank-empty">No words available.</div>';
				}

				var open = this._openCategories.has(category) ? ' open' : '';

				html +=
					'<details class="category-card" data-category-card="' + category + '"' + open + '>' +
						'<summary class="category-summary" id="cat-summary-' + category + '">' +
							'<span class="category-summary-main">' +
								'<span class="category-title">' + category + '</span>' +
								'<span class="category-sub">' + remainingTotal + ' of ' + total + ' remaining</span>' +
							'</span>' +
						'</summary>' +
						'<div class="category-body" role="group" aria-labelledby="cat-summary-' + category + '">' +
							'<div class="category-sub">Choose words from this pool and place them on the board.</div>' +
							'<div class="word-bank">' + words + '</div>' +
						'</div>' +
					'</details>';
			}

			this.$pickers.innerHTML = html;
			this.bindCategoryDetailsEvents();
			this.syncCategoryControlState();
		}

		bindCategoryDetailsEvents() {
			var self = this;
			var cards = this.$pickers.querySelectorAll('details[data-category-card]');
			for (var i = 0; i < cards.length; i++) {
				(function(details) {
					details.addEventListener('toggle', function() {
						var category = details.getAttribute('data-category-card');
						if (!category) {
							return;
						}

						if (details.open) {
							self._openCategories.add(category);
						} else {
							self._openCategories.delete(category);
						}

						self.syncCategoryControlState();
					});
				})(cards[i]);
			}
		}

		addEntryByKey(entryKeyValue) {
			if (!entryKeyValue) {
				return;
			}

			var entry = this._entryByKey.get(entryKeyValue);
			if (!entry) {
				return;
			}

			var used = this.usedCounts();
			if (this.remainingFor(entry, used) <= 0) {
				this.setStatus('No remaining "' + entry.word + '" magnets in ' + entry.category + '.');
				this.renderPickers();
				return;
			}

			var dims = {
				w: wordWidth(entry.word),
				h: 1
			};

			var slot = this.findAvailableSlotWithGrowth(dims.w, dims.h);
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

		findAvailableSlotWithGrowth(w, h) {
			var attempts = 0;
			while (attempts < 120) {
				var slot = this.findNearestAvailable(0, 0, w, h, null, -1, -1);
				if (slot.x !== -1 && slot.y !== -1) {
					return slot;
				}

				this._rows += 1;
				attempts++;
			}

			return { x: 0, y: Math.max(0, this._rows - 1) };
		}

		expandAllCategories() {
			for (var i = 0; i < this._categoryOrder.length; i++) {
				this._openCategories.add(this._categoryOrder[i]);
			}
			this.applyCategoryOpenState();
			this.syncCategoryControlState();
			this.setStatus('All categories expanded.');
		}

		collapseAllCategories() {
			this._openCategories.clear();
			this.applyCategoryOpenState();
			this.syncCategoryControlState();
			this.setStatus('All categories collapsed.');
		}

		applyCategoryOpenState() {
			if (!this.$pickers) {
				return;
			}

			var cards = this.$pickers.querySelectorAll('details[data-category-card]');
			for (var i = 0; i < cards.length; i++) {
				var details = cards[i];
				var category = details.getAttribute('data-category-card');
				details.open = this._openCategories.has(category);
			}
		}

		syncCategoryControlState() {
			var expandBtn = this.shadowRoot.querySelector('button[data-action="expand-all"]');
			var collapseBtn = this.shadowRoot.querySelector('button[data-action="collapse-all"]');
			if (!expandBtn || !collapseBtn) {
				return;
			}

			var total = this._categoryOrder.length;
			var openCount = this._openCategories.size;
			var allOpen = total > 0 && openCount === total;
			var noneOpen = openCount === 0;

			expandBtn.setAttribute('aria-pressed', allOpen ? 'true' : 'false');
			expandBtn.setAttribute('data-pressed', allOpen ? 'true' : 'false');
			expandBtn.disabled = allOpen;

			collapseBtn.setAttribute('aria-pressed', noneOpen ? 'true' : 'false');
			collapseBtn.setAttribute('data-pressed', noneOpen ? 'true' : 'false');
			collapseBtn.disabled = noneOpen;
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

			this._cols = Math.max(
				this._cols,
				clamp(toInt(saved.cols, this._cols), MIN_COLS, MAX_COLS),
				this._minColsFromSource
			);

			this._rows = Math.max(
				this._rows,
				clamp(toInt(saved.rows, this._rows), MIN_ROWS, MAX_ROWS),
				this._minRowsFromSource
			);
			this._zoom = clamp((toInt(saved.zoom, Math.round(this._zoom * 100))) / 100, MIN_ZOOM, MAX_ZOOM);

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
			if (!this.$board || !this.$viewport) {
				return;
			}

			var viewportRect = this.$viewport.getBoundingClientRect();
			var responsiveBase = clamp(Math.floor(viewportRect.width / 10), 28, DEFAULT_CELL);
			var widthLimitedBase = clamp(Math.floor(14000 / Math.max(1, this._cols)), 20, DEFAULT_CELL);
			this._baseCell = Math.max(24, Math.min(responsiveBase, widthLimitedBase));
			this._cell = clamp(Math.round(this._baseCell * this._zoom), 16, 96);
			this._magnetGap = Math.max(2, Math.round(this._cell * 0.09));

			this.$board.style.setProperty('--cell-size', this._cell + 'px');
			this.$board.style.setProperty('--magnet-gap', this._magnetGap + 'px');
			this.$board.style.width = (this._cols * this._cell) + 'px';
			this.$board.style.height = (this._rows * this._cell) + 'px';

			this._boardRect = this.$board.getBoundingClientRect();
			this.syncZoomUi();
			this.renderMagnets();
		}

		clientToBoard(clientX, clientY) {
			if (!this.$board) {
				return { x: 0, y: 0 };
			}
			var rect = this.$board.getBoundingClientRect();
			return {
				x: clientX - rect.left,
				y: clientY - rect.top
			};
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
				return {
					x: Number.isFinite(fallbackX) ? fallbackX : 0,
					y: Number.isFinite(fallbackY) ? fallbackY : 0
				};
			}
			return best;
		}

		findNearestAvailableByPixel(pxX, pxY, w, h, ignoreId, fallbackX, fallbackY) {
			var centerX = pxX + ((w * this._cell) / 2);
			var centerY = pxY + (this._cell / 2);
			var gridX = Math.round((centerX / this._cell) - (w / 2));
			var gridY = Math.round((centerY / this._cell) - 0.5);
			this.ensureBoardCapacityForPlacement(gridX, gridY, w, h);
			return this.findNearestAvailable(gridX, gridY, w, h, ignoreId, fallbackX, fallbackY);
		}

		ensureBoardCapacityForPlacement(x, y, w, h) {
			var nextCols = this._cols;
			var nextRows = this._rows;

			if (x + w >= nextCols) {
				nextCols = Math.min(MAX_COLS, Math.max(nextCols, (x + w) + 2));
			}
			if (y + h >= nextRows) {
				nextRows = Math.min(MAX_ROWS, Math.max(nextRows, (y + h) + 2));
			}

			if (nextCols !== this._cols || nextRows !== this._rows) {
				this._cols = nextCols;
				this._rows = nextRows;
				this.measureBoard();
			}
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

		setZoom(value, quietStatus, clientX, clientY) {
			var next = clamp(value, MIN_ZOOM, MAX_ZOOM);
			if (Math.abs(next - this._zoom) < 0.001) {
				this.syncZoomUi();
				return;
			}

			var hadFocal = Number.isFinite(clientX) && Number.isFinite(clientY) && this.$viewport && this.$board;
			var focalLocalX = 0;
			var focalLocalY = 0;
			var viewportRect = null;
			var previousCell = this._cell;

			if (hadFocal) {
				viewportRect = this.$viewport.getBoundingClientRect();
				focalLocalX = (clientX - viewportRect.left) + this.$viewport.scrollLeft;
				focalLocalY = (clientY - viewportRect.top) + this.$viewport.scrollTop;
			}

			this._zoom = next;
			this.measureBoard();

			if (hadFocal && previousCell > 0 && this._cell > 0) {
				var scale = this._cell / previousCell;
				var targetLocalX = focalLocalX * scale;
				var targetLocalY = focalLocalY * scale;
				var targetLeft = targetLocalX - (clientX - viewportRect.left);
				var targetTop = targetLocalY - (clientY - viewportRect.top);
				var maxLeft = Math.max(0, this.$board.scrollWidth - this.$viewport.clientWidth);
				var maxTop = Math.max(0, this.$board.scrollHeight - this.$viewport.clientHeight);
				this.$viewport.scrollLeft = clamp(targetLeft, 0, maxLeft);
				this.$viewport.scrollTop = clamp(targetTop, 0, maxTop);
			}

			if (!quietStatus) {
				this.setStatus('Zoom set to ' + Math.round(this._zoom * 100) + '%.');
			}
			this.scheduleSave();
		}

		syncZoomUi() {
			if (this.$zoomReadout) {
				this.$zoomReadout.textContent = Math.round(this._zoom * 100) + '%';
			}
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

			var cardWidth = (magnet.w * this._cell) - (this._magnetGap * 2);
			var cardHeight = this._cell - (this._magnetGap * 2);
			var sidePad = this._cell * 0.24; // 2 * 0.12 cell padding (left + right)
			var availableTextWidth = Math.max(8, cardWidth - sidePad);
			var chars = Math.max(1, String(magnet.word || '').length);
			var widthLimitedSize = availableTextWidth / (chars * 0.66);
			var heightLimitedSize = cardHeight * 0.74;
			var fontPx = Math.max(7, Math.min(widthLimitedSize, heightLimitedSize));

			el.style.width = cardWidth + 'px';
			el.style.fontSize = fontPx + 'px';
			el.style.transform = 'translate(' + ((x * this._cell) + this._magnetGap) + 'px,' + ((y * this._cell) + this._magnetGap) + 'px)';
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
				zoom: Math.round(this._zoom * 100),
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
