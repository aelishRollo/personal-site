/*
	Fridge Poetry board custom element.
	Portable, embeddable, and theme-aware.
*/
(function() {
	var DB_NAME = 'fridge-poetry-db';
	var DB_VERSION = 1;
	var STORE_NAME = 'boards';
	var dbPromise = null;
	var DEFAULT_COLS = 14;
	var DEFAULT_ROWS = 11;
	var DEFAULT_CELL = 44;

	var DEFAULT_SOURCE = {
		lines: [
			'build with care and ship with confidence',
			'music and code and coffee at midnight',
			'make it simple make it quick make it kind',
			'debugging is detective work with rhythm'
		]
	};

	function clamp(value, min, max) {
		return Math.max(min, Math.min(max, value));
	}

	function toInt(value, fallback) {
		var n = parseInt(value, 10);
		return Number.isFinite(n) ? n : fallback;
	}

	function tokenizeText(text) {
		if (!text) {
			return [];
		}

		var matches = String(text).match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g) || [];
		return matches.map(function(word) {
			return word.toLowerCase();
		});
	}

	function buildWordList(source) {
		if (!source) {
			return [];
		}

		if (Array.isArray(source.words)) {
			return source.words
				.map(function(word) { return String(word || '').trim().toLowerCase(); })
				.filter(Boolean);
		}

		if (Array.isArray(source.lines)) {
			return tokenizeText(source.lines.join(' '));
		}

		if (typeof source.text === 'string') {
			return tokenizeText(source.text);
		}

		return [];
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
				reject(new Error('IndexedDB not supported'));
				dbPromise = null;
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
			if (!raw) {
				return null;
			}
			return JSON.parse(raw);
		} catch (err) {
			return null;
		}
	}

	function storageSetLocal(key, value) {
		try {
			localStorage.setItem(key, JSON.stringify(value));
		} catch (err) {
			// Ignore quota / private mode errors.
		}
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
			this._rafRender = rafThrottle(this.renderMagnets.bind(this));
			this._rafMeasure = rafThrottle(this.measureBoard.bind(this));

			this._storageKey = this.getAttribute('storage-key') || 'fridge-poetry-state-v1';
			this._wordList = [];
			this._magnets = [];
			this._selectedId = null;
			this._drag = null;
			this._cols = clamp(toInt(this.getAttribute('cols'), DEFAULT_COLS), 8, 24);
			this._rows = clamp(toInt(this.getAttribute('rows'), DEFAULT_ROWS), 6, 40);
			this._cell = DEFAULT_CELL;
			this._status = '';
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

			this.loadSourceAndState();
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
				this._storageKey = this.getAttribute('storage-key') || 'fridge-poetry-state-v1';
				this.loadSourceAndState();
				return;
			}

			if (name === 'words-src') {
				this.loadSourceAndState(true);
				return;
			}

			if (name === 'cols' || name === 'rows') {
				this._cols = clamp(toInt(this.getAttribute('cols'), DEFAULT_COLS), 8, 24);
				this._rows = clamp(toInt(this.getAttribute('rows'), DEFAULT_ROWS), 6, 40);
				this.layoutAllMagnets(true);
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

					button.ctrl:hover {
						filter: brightness(0.95);
					}

					button.ctrl:focus-visible,
					.magnet:focus-visible,
					.board:focus-visible {
						outline: 2px solid var(--fp-focus);
						outline-offset: 2px;
					}

					.hint {
						margin: 0.72rem 0 0.82rem;
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

					.magnet:active {
						cursor: grabbing;
					}

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

					@media (max-width: 760px) {
						.board {
							height: 68vh;
							min-height: 360px;
						}

						.magnet {
							font-size: 0.72rem;
						}
					}

					@media (prefers-reduced-motion: reduce) {
						.magnet {
							transition: none;
						}
					}
				</style>
				<div class="shell">
					<div class="toolbar">
						<h3>Fridge Poetry</h3>
						<div class="actions">
							<button class="ctrl" type="button" data-action="shuffle">Shuffle</button>
							<button class="ctrl" type="button" data-action="reset">Reset</button>
						</div>
					</div>
					<p class="hint">Drag magnets, or click a magnet then tap an empty spot. Arrow keys move focused magnets one grid cell.</p>
					<div class="board" tabindex="0" aria-label="Interactive fridge poetry board">
						<div class="magnets"></div>
					</div>
					<p class="status" aria-live="polite"></p>
				</div>
			`;
		}

		cacheElements() {
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

				var action = ctrl.getAttribute('data-action');
				if (action === 'shuffle') {
					self.shuffleMagnets();
				} else if (action === 'reset') {
					self.layoutAllMagnets(true);
					self.renderMagnets();
					self.setStatus('Board reset.');
					self.scheduleSave();
				}
			});

			this.$magnets.addEventListener('pointerdown', function(event) {
				var magnet = event.target.closest('.magnet');
				if (!magnet || self.readonly) {
					return;
				}

				var id = magnet.getAttribute('data-id');
				var model = self.getMagnet(id);
				if (!model) {
					return;
				}

				event.preventDefault();
				magnet.setPointerCapture(event.pointerId);

				self._drag = {
					id: id,
					pointerId: event.pointerId,
					startClientX: event.clientX,
					startClientY: event.clientY,
					originX: model.x,
					originY: model.y,
					candidateX: model.x,
					candidateY: model.y,
					moved: false
				};

				self.selectMagnet(id);
				magnet.dataset.dragging = 'true';
				self.setStatus('Dragging "' + model.word + '".');
			});

			this.$magnets.addEventListener('pointermove', function(event) {
				if (!self._drag || event.pointerId !== self._drag.pointerId) {
					return;
				}

				event.preventDefault();
				var drag = self._drag;
				var model = self.getMagnet(drag.id);
				if (!model) {
					return;
				}

				var dx = event.clientX - drag.startClientX;
				var dy = event.clientY - drag.startClientY;
				if (!drag.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
					drag.moved = true;
				}

				var pxX = drag.originX * self._cell + dx;
				var pxY = drag.originY * self._cell + dy;
				var target = self.findNearestAvailableByPixel(pxX, pxY, model.w, model.h, drag.id, drag.originX, drag.originY);
				if (!target) {
					return;
				}

				drag.candidateX = target.x;
				drag.candidateY = target.y;
				self.placeMagnetElement(model, true);
			});

			var endDrag = function(event) {
				if (!self._drag || event.pointerId !== self._drag.pointerId) {
					return;
				}

				event.preventDefault();
				var drag = self._drag;
				self._drag = null;

				var model = self.getMagnet(drag.id);
				if (!model) {
					return;
				}

				var magnet = self.$magnets.querySelector('[data-id="' + drag.id + '"]');
				if (magnet) {
					magnet.dataset.dragging = 'false';
				}

				if (drag.moved) {
					self.moveMagnet(drag.id, drag.candidateX, drag.candidateY);
					self.setStatus('Placed "' + model.word + '".');
				} else {
					self.selectMagnet(drag.id);
					self.setStatus('Selected "' + model.word + '". Tap an empty grid spot to place it.');
				}

				self.renderMagnets();
				self.scheduleSave();
			};

			this.$magnets.addEventListener('pointerup', endDrag);
			this.$magnets.addEventListener('pointercancel', endDrag);

			this.$board.addEventListener('pointerdown', function(event) {
				if (self.readonly || self._drag) {
					return;
				}

				if (event.target.closest('.magnet')) {
					return;
				}

				if (!self._selectedId) {
					return;
				}

				event.preventDefault();
				self.moveSelectedToClientPoint(event.clientX, event.clientY);
			});

			this.$magnets.addEventListener('keydown', function(event) {
				var magnet = event.target.closest('.magnet');
				if (!magnet) {
					return;
				}

				var id = magnet.getAttribute('data-id');
				var key = event.key;

				if (key === 'Enter' || key === ' ') {
					event.preventDefault();
					self.selectMagnet(id);
					return;
				}

				if (key === 'Escape') {
					event.preventDefault();
					self.selectMagnet(null);
					return;
				}

				var delta = null;
				if (key === 'ArrowLeft') {
					delta = { x: -1, y: 0 };
				} else if (key === 'ArrowRight') {
					delta = { x: 1, y: 0 };
				} else if (key === 'ArrowUp') {
					delta = { x: 0, y: -1 };
				} else if (key === 'ArrowDown') {
					delta = { x: 0, y: 1 };
				}

				if (!delta || self.readonly) {
					return;
				}

				event.preventDefault();
				self.selectMagnet(id);
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

			var isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
			this.setAttribute('data-theme', isDark ? 'dark' : 'light');
		}

		get readonly() {
			return this.hasAttribute('readonly') && this.getAttribute('readonly') !== 'false';
		}

		async loadSourceAndState(skipSavedState) {
			var source = await this.fetchWordSource();
			this._wordList = buildWordList(source);
			this.buildMagnetsFromWords();

			if (!skipSavedState) {
				await this.loadSavedState();
			}

			this.layoutAllMagnets(false);
			this.measureBoard();
			this.renderMagnets();
			this.setStatus('Loaded ' + this._magnets.length + ' magnets.');
		}

		async fetchWordSource() {
			var src = this.getAttribute('words-src');
			if (!src) {
				return DEFAULT_SOURCE;
			}

			try {
				var response = await fetch(src);
				if (!response.ok) {
					throw new Error('Failed to load words source.');
				}

				var contentType = response.headers.get('content-type') || '';
				if (contentType.indexOf('application/json') !== -1 || src.toLowerCase().endsWith('.json')) {
					return await response.json();
				}

				var text = await response.text();
				return { text: text };
			} catch (err) {
				this.setStatus('Could not load custom source. Using fallback words.');
				return DEFAULT_SOURCE;
			}
		}

		buildMagnetsFromWords() {
			this._magnets = this._wordList.map(function(word, index) {
				return {
					id: 'm' + index,
					word: word,
					w: wordWidth(word),
					h: 1,
					x: 0,
					y: 0
				};
			});
			this._selectedId = null;
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

			var byId = new Map(saved.magnets.map(function(m) { return [m.id, m]; }));
			this._magnets.forEach(function(magnet) {
				var persisted = byId.get(magnet.id);
				if (!persisted) {
					return;
				}
				magnet.x = toInt(persisted.x, magnet.x);
				magnet.y = toInt(persisted.y, magnet.y);
			});
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
				if (magnet.id === ignoreId) {
					continue;
				}
				for (var y = magnet.y; y < magnet.y + magnet.h; y++) {
					if (y < 0 || y >= this._rows) {
						continue;
					}
					for (var x = magnet.x; x < magnet.x + magnet.w; x++) {
						if (x < 0 || x >= this._cols) {
							continue;
						}
						cells[this.cellIndex(x, y)] = magnet.id;
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
			var sx = clamp(startX, 0, this._cols - w);
			var sy = clamp(startY, 0, this._rows - h);

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
				return { x: fallbackX, y: fallbackY };
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

		layoutAllMagnets(force) {
			var cells = new Array(this._cols * this._rows).fill(null);
			var placed = 0;

			while (placed < this._magnets.length) {
				var magnet = this._magnets[placed];
				var keep = !force && this.canPlace(cells, magnet.x, magnet.y, magnet.w, magnet.h);
				if (!keep) {
					var slot = this.firstFit(cells, magnet.w, magnet.h);
					if (!slot) {
						this._rows += 1;
						cells = new Array(this._cols * this._rows).fill(null);
						placed = 0;
						continue;
					}
					magnet.x = slot.x;
					magnet.y = slot.y;
				}

				for (var y = magnet.y; y < magnet.y + magnet.h; y++) {
					for (var x = magnet.x; x < magnet.x + magnet.w; x++) {
						cells[this.cellIndex(x, y)] = magnet.id;
					}
				}

				placed++;
			}
		}

		firstFit(cells, w, h) {
			for (var y = 0; y <= this._rows - h; y++) {
				for (var x = 0; x <= this._cols - w; x++) {
					var free = true;
					for (var yy = y; yy < y + h && free; yy++) {
						for (var xx = x; xx < x + w; xx++) {
							if (cells[this.cellIndex(xx, yy)] !== null) {
								free = false;
								break;
							}
						}
					}
					if (free) {
						return { x: x, y: y };
					}
				}
			}
			return null;
		}

		moveMagnet(id, x, y) {
			var magnet = this.getMagnet(id);
			if (!magnet) {
				return;
			}
			magnet.x = x;
			magnet.y = y;
		}

		nudgeMagnet(id, dx, dy) {
			var magnet = this.getMagnet(id);
			if (!magnet) {
				return;
			}

			var target = this.findNearestAvailable(magnet.x + dx, magnet.y + dy, magnet.w, magnet.h, id, magnet.x, magnet.y);
			this.moveMagnet(id, target.x, target.y);
			this.renderMagnets();
			this.setStatus('Moved "' + magnet.word + '" to row ' + (target.y + 1) + ', column ' + (target.x + 1) + '.');
			this.scheduleSave();
		}

		moveSelectedToClientPoint(clientX, clientY) {
			if (!this._selectedId) {
				return;
			}
			var magnet = this.getMagnet(this._selectedId);
			if (!magnet) {
				return;
			}
			if (!this._boardRect) {
				this.measureBoard();
			}

			var localX = clientX - this._boardRect.left;
			var localY = clientY - this._boardRect.top;
			var target = this.findNearestAvailableByPixel(localX - ((magnet.w * this._cell) / 2), localY - (this._cell / 2), magnet.w, magnet.h, magnet.id, magnet.x, magnet.y);

			this.moveMagnet(magnet.id, target.x, target.y);
			this.renderMagnets();
			this.setStatus('Placed "' + magnet.word + '" at row ' + (target.y + 1) + ', column ' + (target.x + 1) + '.');
			this.scheduleSave();
		}

		selectMagnet(id) {
			this._selectedId = id;
			this.renderMagnets();
		}

		shuffleMagnets() {
			if (this.readonly) {
				return;
			}

			for (var i = this._magnets.length - 1; i > 0; i--) {
				var j = Math.floor(Math.random() * (i + 1));
				var tmp = this._magnets[i];
				this._magnets[i] = this._magnets[j];
				this._magnets[j] = tmp;
			}

			this.layoutAllMagnets(true);
			this.renderMagnets();
			this.setStatus('Board shuffled.');
			this.scheduleSave();
		}

		placeMagnetElement(magnet, dragging) {
			var el = this.$magnets.querySelector('[data-id="' + magnet.id + '"]');
			if (!el) {
				return;
			}

			var x = magnet.x;
			var y = magnet.y;
			if (dragging && this._drag && this._drag.id === magnet.id) {
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
			var nodes = this.$magnets.querySelectorAll('.magnet');
			for (var n = 0; n < nodes.length; n++) {
				existing.set(nodes[n].getAttribute('data-id'), nodes[n]);
			}

			var fragment = document.createDocumentFragment();
			for (var i = 0; i < this._magnets.length; i++) {
				var magnet = this._magnets[i];
				var el = existing.get(magnet.id);
				if (!el) {
					el = document.createElement('button');
					el.type = 'button';
					el.className = 'magnet';
					el.setAttribute('data-id', magnet.id);
					el.setAttribute('aria-label', 'Magnet word ' + magnet.word);
					el.textContent = magnet.word;
				}

				el.dataset.selected = this._selectedId === magnet.id ? 'true' : 'false';
				if (this.readonly) {
					el.setAttribute('disabled', 'disabled');
				} else {
					el.removeAttribute('disabled');
				}

				existing.delete(magnet.id);
				fragment.appendChild(el);
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
			this._status = message;
			if (this.$status) {
				this.$status.textContent = message;
			}
		}

		serializeState() {
			return {
				id: this._storageKey,
				cols: this._cols,
				rows: this._rows,
				magnets: this._magnets.map(function(m) {
					return {
						id: m.id,
						x: m.x,
						y: m.y
					};
				}),
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
					magnets: state.magnets,
					cols: this._cols,
					rows: this._rows
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
