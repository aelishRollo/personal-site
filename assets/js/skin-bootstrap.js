/*
	Skin selection bootstrap.

	This file intentionally runs in the document head. It resolves the active skin
	before first paint, exposes the small runtime API used by main.js, and loads
	only the active skin stylesheet.
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
		{ id: 'psychedelic-scrapbook', name: 'Psychedelic Scrapbook', scheme: 'light', css: 'assets/css/skins/psychedelic-scrapbook.css?v=psychedelic-scrapbook-corkboard-3' },
		{ id: 'cut-and-paste-riot', name: 'Cut-and-Paste Riot', scheme: 'light', selectorId: 'psychedelic-scrapbook', css: 'assets/css/skins/cut-and-paste-riot.css?v=cut-and-paste-riot-1' },
		{ id: 'liquid-chrome-y2k', name: 'Liquid Chrome Y2K', scheme: 'light', css: 'assets/css/skins/liquid-chrome-y2k.css?v=hero-initial-fix-1' },
		{ id: 'acid-brutalist', name: 'Acid Brutalist', scheme: 'dark', css: 'assets/css/skins/acid-brutalist.css?v=hero-initial-fix-1' },
		{ id: 'botanical-dreamscape', name: 'Botanical Dreamscape', scheme: 'dark', css: 'assets/css/skins/botanical-dreamscape.css?v=hero-initial-fix-1' },
		{ id: 'cosmic-airbrush', name: 'Cosmic Airbrush', scheme: 'dark', css: 'assets/css/skins/cosmic-airbrush.css?v=hero-initial-fix-1' },
		{ id: 'riso-hallucination', name: 'Riso Hallucination', scheme: 'light', css: 'assets/css/skins/riso-hallucination.css?v=hero-initial-fix-1' },
		{ id: 'crystal-prism', name: 'Crystal Prism', scheme: 'light', css: 'assets/css/skins/crystal-prism.css?v=crystal-prism-3' }
	];
	var skinById = {};
	var activeId = '';
	var persistedId = '';
	var stylesheet = null;

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

	function apply(id, mode) {
		var skin = skinById[id];

		if (!skin) {
			id = randomId();
			skin = skinById[id];
		}

		activeId = id;
		root.setAttribute('data-skin', skin.selectorId || id);
		root.setAttribute('data-skin-id', id);
		root.setAttribute('data-theme', skin.scheme);
		root.setAttribute('data-skin-mode', mode || (persistedId === id ? 'saved' : 'random'));
		root.style.colorScheme = skin.scheme;

		var link = ensureStylesheet();
		if (skin.css) {
			link.disabled = false;
			if (link.getAttribute('href') !== skin.css) {
				link.setAttribute('href', skin.css);
			}
		} else {
			link.disabled = true;
			link.removeAttribute('href');
		}

		return id;
	}

	persistedId = read(window.localStorage, preferenceKey);
	if (persistedId && !isValid(persistedId)) {
		remove(window.localStorage, preferenceKey);
		persistedId = '';
	}

	var previousSessionId = read(window.sessionStorage, sessionKey);
	if (previousSessionId && !isValid(previousSessionId)) {
		remove(window.sessionStorage, sessionKey);
		remove(window.sessionStorage, sessionModeKey);
		previousSessionId = '';
	}

	var initialId = persistedId || randomId(previousSessionId);
	if (!persistedId) {
		write(window.sessionStorage, sessionKey, initialId);
		write(window.sessionStorage, sessionModeKey, 'random');
	}
	apply(initialId, persistedId ? 'saved' : 'random');

	window.SiteSkins = {
		all: skins.slice(),
		getActiveId: function() {
			return activeId;
		},
		getPersistedId: function() {
			return persistedId;
		},
		getMode: function() {
			return root.getAttribute('data-skin-mode') || 'random';
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
			write(window.sessionStorage, sessionModeKey, 'preview');
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
