/*
	Skin selection bootstrap.

	This file intentionally runs in the document head. It resolves the active skin
	before first paint, exposes the small runtime API used by main.js, and prepares
	the inactive skin stylesheets for instant runtime switching.
*/
(function() {
	'use strict';

	var preferenceKey = 'site-skin-v2';
	var sessionKey = 'site-skin-session-v2';
	var sessionModeKey = 'site-skin-session-mode-v2';
	var root = document.documentElement;
	var skins = [
		{ id: 'portfolio-dark', name: 'Portfolio Dark', scheme: 'dark', css: '' },
		{ id: 'portfolio-light', name: 'Portfolio Light', scheme: 'light', css: '' },
		{ id: 'acid-editorial', name: 'Acid Editorial', scheme: 'light', css: 'assets/css/skins/acid-editorial.css?v=hero-initial-fix-1' },
		{ id: 'op-art-monochrome', name: 'Op Art Monochrome', scheme: 'light', css: 'assets/css/skins/op-art-monochrome.css?v=hero-initial-fix-1' },
		{ id: 'neon-glitch', name: 'Neon Glitch', scheme: 'dark', css: 'assets/css/skins/neon-glitch.css?v=hero-initial-fix-1' },
		{ id: 'liquid-dream', name: 'Liquid Dream', scheme: 'light', css: 'assets/css/skins/liquid-dream.css?v=hero-initial-fix-1' },
		{ id: 'sacred-geometry', name: 'Sacred Geometry', scheme: 'dark', css: 'assets/css/skins/sacred-geometry.css?v=hero-initial-fix-1' },
		{ id: 'terminal-vision', name: 'Terminal Vision', scheme: 'dark', css: 'assets/css/skins/terminal-vision.css?v=hero-initial-fix-1' },
		{ id: 'ms-dos-prompt', name: 'MS-DOS Prompt', scheme: 'dark', css: 'assets/css/skins/ms-dos-prompt.css?v=ms-dos-prompt-13' },
		{ id: 'psychedelic-scrapbook', name: 'Psychedelic Scrapbook', scheme: 'light', css: 'assets/css/skins/psychedelic-scrapbook.css?v=psychedelic-scrapbook-corkboard-3' },
		{ id: 'cut-and-paste-riot', name: 'Cut-and-Paste Riot', scheme: 'light', selectorId: 'psychedelic-scrapbook', css: 'assets/css/skins/cut-and-paste-riot.css?v=cut-and-paste-riot-2' },
		{ id: 'liquid-chrome-y2k', name: 'Liquid Chrome Y2K', scheme: 'light', css: 'assets/css/skins/liquid-chrome-y2k.css?v=hero-initial-fix-1' },
		{ id: 'acid-brutalist', name: 'Acid Brutalist', scheme: 'dark', css: 'assets/css/skins/acid-brutalist.css?v=hero-initial-fix-1' },
		{ id: 'botanical-dreamscape', name: 'Botanical Dreamscape', scheme: 'dark', css: 'assets/css/skins/botanical-dreamscape.css?v=hero-initial-fix-1' },
		{ id: 'cosmic-airbrush', name: 'Cosmic Airbrush', scheme: 'dark', css: 'assets/css/skins/cosmic-airbrush.css?v=hero-initial-fix-1' },
		{ id: 'riso-hallucination', name: 'Riso Hallucination', scheme: 'light', css: 'assets/css/skins/riso-hallucination.css?v=hero-initial-fix-1' },
		{ id: 'crystal-prism', name: 'Crystal Prism', scheme: 'light', css: 'assets/css/skins/crystal-prism.css?v=crystal-prism-3' },
		{ id: 'midnight-aurora-glass', name: 'Midnight Aurora Glass', scheme: 'dark', css: 'assets/css/skins/midnight-aurora-glass.css?v=midnight-aurora-glass-8' },
		{ id: 'recursive-portal', name: 'Recursive Portal', scheme: 'dark', css: 'assets/css/skins/recursive-portal.css?v=recursive-portal-3' },
		{ id: 'split-duality', name: 'Split Duality', scheme: 'dark', css: 'assets/css/skins/split-duality.css?v=split-duality-4' },
		{ id: 'card-deck-stack', name: 'Card Deck Stack', scheme: 'light', css: 'assets/css/skins/card-deck-stack.css?v=card-deck-stack-4' },
		{ id: 'type-sculpture', name: 'Type Sculpture', scheme: 'dark', css: 'assets/css/skins/type-sculpture.css?v=type-sculpture-2' },
		{ id: 'browser-archaeology', name: 'Browser Archaeology', scheme: 'light', css: 'assets/css/skins/browser-archaeology.css?v=browser-archaeology-8' },
		{ id: 'oracular-tarot', name: 'Oracular Tarot', scheme: 'dark', css: 'assets/css/skins/oracular-tarot.css?v=oracular-tarot-2' },
		{ id: 'hello-kitty', name: 'Hello Kitty', scheme: 'light', css: 'assets/css/skins/hello-kitty.css?v=hello-kitty-3' },
		{ id: 'forties-field-notes', name: '1940s Field Notes', scheme: 'light', css: 'assets/css/skins/forties-field-notes.css?v=forties-field-notes-5' },
		{ id: 'nutrition-facts', name: 'Nutrition Facts', scheme: 'light', css: 'assets/css/skins/nutrition-facts.css?v=nutrition-facts-10' }
	];
	var skinById = {};
	var activeId = '';
	var activeMode = '';
	var persistedId = '';
	var stylesheet = null;
	var stylesheetById = {};
	var stylesheetReady = {};
	var activeTransition = null;
	var transitionRequest = 0;
	var lastChangeAt = 0;
	var rapidSwitchWindow = 650;
	var themeAssets = [
		{ href: 'assets/images/corkboard-texture.webp?v=corkboard-1', as: 'image', type: 'image/webp' },
		{ href: 'assets/images/forties-writers-desk.webp?v=forties-writers-desk-1', as: 'image', type: 'image/webp' },
		{ href: 'assets/images/hello-kitty-mascot.svg?v=hello-kitty-mascot-1', as: 'image', type: 'image/svg+xml' },
		{ href: 'assets/images/midnight-aurora-glass.webp?v=midnight-aurora-glass-1', as: 'image', type: 'image/webp' },
		{ href: 'images/paper-texture-tile.webp?v=paper-texture-1', as: 'image', type: 'image/webp' }
	];

	skins.forEach(function(skin) {
		skinById[skin.id] = skin;
	});

	function read(storage, key) {
		try {
			return storage.getItem(key) || '';
		} catch (error) {
			return '';
		}
	}

	function write(storage, key, value) {
		try {
			storage.setItem(key, value);
		} catch (error) {
			// Storage can be unavailable in private or locked-down browsing modes.
		}
	}

	function remove(storage, key) {
		try {
			storage.removeItem(key);
		} catch (error) {
			// Keep the in-memory selection usable even when storage is unavailable.
		}
	}

	function isValid(id) {
		return Object.prototype.hasOwnProperty.call(skinById, id);
	}

	function randomId(excludeId) {
		var choices = skins.filter(function(skin) {
			return skin.id !== excludeId;
		});

		if (!choices.length) {
			choices = skins.slice();
		}

		return choices[Math.floor(Math.random() * choices.length)].id;
	}

	function isReloadNavigation() {
		try {
			if (window.performance && typeof window.performance.getEntriesByType === 'function') {
				var navigationEntries = window.performance.getEntriesByType('navigation');
				if (navigationEntries.length) {
					return navigationEntries[0].type === 'reload';
				}
			}

			return window.performance && window.performance.navigation && window.performance.navigation.type === 1;
		} catch (error) {
			return false;
		}
	}

	function ensureStylesheet() {
		if (!stylesheet) {
			stylesheet = document.getElementById('active-skin-stylesheet');
		}

		if (!stylesheet) {
			stylesheet = document.createElement('link');
			stylesheet.id = 'active-skin-stylesheet';
			stylesheet.rel = 'stylesheet';
			document.head.appendChild(stylesheet);
		}

		return stylesheet;
	}

	function registerStylesheet(skin, link, isActive) {
		stylesheetById[skin.id] = link;
		link.setAttribute('data-skin-stylesheet', skin.id);
		link.media = isActive ? 'all' : 'not all';

		function markReady() {
			stylesheetReady[skin.id] = true;
			link.setAttribute('data-skin-ready', '');
		}

		if (link.sheet) {
			markReady();
		} else {
			link.addEventListener('load', markReady, { once: true });
			link.addEventListener('error', markReady, { once: true });
		}
	}

	function prepareThemeResources() {
		skins.forEach(function(skin) {
			if (!skin.css) {
				return;
			}

			var isActive = skin.id === activeId && stylesheet && stylesheet.getAttribute('href') === skin.css;
			var link = isActive ? stylesheet : document.createElement('link');

			if (!isActive) {
				link.rel = 'stylesheet';
				link.media = 'not all';
				link.href = skin.css;
				document.head.appendChild(link);
			}

			registerStylesheet(skin, link, isActive);
		});

		themeAssets.forEach(function(resource) {
			var preload = document.createElement('link');
			preload.rel = 'preload';
			preload.as = resource.as;
			preload.href = resource.href;
			preload.setAttribute('data-skin-preload', '');
			if (resource.type) {
				preload.type = resource.type;
			}
			document.head.appendChild(preload);
		});
	}

	function waitForStylesheet(id) {
		var link = stylesheetById[id];

		if (!link || stylesheetReady[id] || link.sheet) {
			stylesheetReady[id] = true;
			return Promise.resolve();
		}

		return new Promise(function(resolve) {
			var settled = false;
			var timeout;

			function finish() {
				if (settled) {
					return;
				}

				settled = true;
				window.clearTimeout(timeout);
				link.removeEventListener('load', finish);
				link.removeEventListener('error', finish);
				resolve();
			}

			link.addEventListener('load', finish);
			link.addEventListener('error', finish);
			timeout = window.setTimeout(finish, 1500);
		});
	}

	function activateStylesheet(skin) {
		var nextStylesheet = skin.css ? stylesheetById[skin.id] : null;

		if (nextStylesheet) {
			if (stylesheet && stylesheet !== nextStylesheet) {
				stylesheet.media = 'not all';
				stylesheet.removeAttribute('id');
			}

			nextStylesheet.disabled = false;
			nextStylesheet.media = 'all';
			nextStylesheet.id = 'active-skin-stylesheet';
			stylesheet = nextStylesheet;
			return;
		}

		if (skin.css) {
			var fallback = ensureStylesheet();
			fallback.disabled = false;
			fallback.media = 'all';
			fallback.setAttribute('href', skin.css);
			return;
		}

		if (stylesheet) {
			stylesheet.media = 'not all';
			stylesheet.removeAttribute('id');
			stylesheet = null;
		}
	}

	function applyNow(id, mode) {
		var skin = skinById[id];

		if (!skin) {
			id = randomId();
			skin = skinById[id];
		}

		activeId = id;
		activeMode = mode || (persistedId === id ? 'saved' : 'random');
		root.setAttribute('data-skin', skin.selectorId || id);
		root.setAttribute('data-skin-id', id);
		root.setAttribute('data-theme', skin.scheme);
		root.setAttribute('data-skin-mode', activeMode);
		root.style.colorScheme = skin.scheme;

		activateStylesheet(skin);

		return id;
	}

	function apply(id, mode) {
		var skin = skinById[id];

		if (!skin) {
			id = randomId();
			skin = skinById[id];
		}

		var nextMode = mode || (persistedId === id ? 'saved' : 'random');
		var previousId = activeId;
		activeId = id;
		activeMode = nextMode;

		if (id === previousId) {
			if (activeTransition) {
				root.setAttribute('data-skin-mode', activeMode);
				return id;
			}

			return applyNow(id, nextMode);
		}

		var reduceMotion = false;
		try {
			reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		} catch (error) {
			// Treat unavailable motion preferences as the default animated mode.
		}

		if (!document.body || typeof document.startViewTransition !== 'function' || reduceMotion) {
			return applyNow(id, nextMode);
		}

		transitionRequest += 1;
		var request = transitionRequest;
		var now = Date.now();
		var isRapidSwitch = activeTransition || now - lastChangeAt < rapidSwitchWindow;
		lastChangeAt = now;

		if (isRapidSwitch) {
			if (activeTransition && typeof activeTransition.skipTransition === 'function') {
				activeTransition.skipTransition();
			}

			activeTransition = null;
			return applyNow(id, nextMode);
		}

		activeTransition = document.startViewTransition(function() {
			return waitForStylesheet(id).then(function() {
				if (request !== transitionRequest) {
					return activeId;
				}

				return applyNow(id, activeMode);
			});
		});

		var transition = activeTransition;
		transition.finished.then(function() {
			if (activeTransition === transition) {
				activeTransition = null;
			}
		}, function() {
			if (activeTransition === transition) {
				activeTransition = null;
			}
		});

		return id;
	}

	persistedId = read(window.localStorage, preferenceKey);
	if (persistedId && !isValid(persistedId)) {
		remove(window.localStorage, preferenceKey);
		persistedId = '';
	}

	var previousSessionId = read(window.sessionStorage, sessionKey);
	var previousSessionMode = read(window.sessionStorage, sessionModeKey);
	if (previousSessionId && !isValid(previousSessionId)) {
		remove(window.sessionStorage, sessionKey);
		remove(window.sessionStorage, sessionModeKey);
		previousSessionId = '';
		previousSessionMode = '';
	}

	if (previousSessionMode !== 'random' && previousSessionMode !== 'preview' && previousSessionMode !== 'saved') {
		previousSessionMode = '';
	}

	var initialId;
	var initialMode;

	if (isReloadNavigation()) {
		if (persistedId) {
			initialId = persistedId;
			initialMode = 'saved';
		} else {
			initialId = randomId(previousSessionId);
			initialMode = 'random';
		}
	} else if (previousSessionId) {
		initialId = previousSessionId;
		initialMode = persistedId === previousSessionId ? 'saved' : (previousSessionMode === 'preview' ? 'preview' : 'random');
	} else if (persistedId) {
		initialId = persistedId;
		initialMode = 'saved';
	} else {
		initialId = randomId();
		initialMode = 'random';
	}

	write(window.sessionStorage, sessionKey, initialId);
	write(window.sessionStorage, sessionModeKey, initialMode);
	apply(initialId, initialMode);
	prepareThemeResources();

	window.SiteSkins = {
		all: skins.slice(),
		getActiveId: function() {
			return activeId;
		},
		getPersistedId: function() {
			return persistedId;
		},
		getMode: function() {
			return activeMode || root.getAttribute('data-skin-mode') || 'random';
		},
		preview: function(id) {
			if (!isValid(id)) {
				return activeId;
			}
			write(window.sessionStorage, sessionKey, id);
			write(window.sessionStorage, sessionModeKey, 'preview');
			return apply(id, persistedId === id ? 'saved' : 'preview');
		},
		save: function(id) {
			if (!isValid(id)) {
				return activeId;
			}
			persistedId = id;
			write(window.localStorage, preferenceKey, id);
			write(window.sessionStorage, sessionKey, id);
			write(window.sessionStorage, sessionModeKey, 'saved');
			return apply(id, 'saved');
		},
		surprise: function() {
			var id = randomId(activeId);
			write(window.sessionStorage, sessionKey, id);
			write(window.sessionStorage, sessionModeKey, persistedId ? 'preview' : 'random');
			return apply(id, persistedId ? 'preview' : 'random');
		},
		useRandomDefault: function() {
			persistedId = '';
			remove(window.localStorage, preferenceKey);
			var id = randomId(activeId);
			write(window.sessionStorage, sessionKey, id);
			write(window.sessionStorage, sessionModeKey, 'random');
			return apply(id, 'random');
		},
		clearSaved: function() {
			persistedId = '';
			remove(window.localStorage, preferenceKey);
			var id = randomId(activeId);
			write(window.sessionStorage, sessionKey, id);
			write(window.sessionStorage, sessionModeKey, 'random');
			return apply(id, 'random');
		}
	};
})();
