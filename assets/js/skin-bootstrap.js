/*
	Skin selection bootstrap.

	This file intentionally runs in the document head. It resolves the active skin
	before first paint, exposes the small runtime API used by main.js, and loads
	only the active skin stylesheet.
*/
(function() {
	'use strict';

	var preferenceKey = 'site-skin-v1';
	var sessionKey = 'site-skin-session-v1';
	var sessionModeKey = 'site-skin-session-mode-v1';
	var root = document.documentElement;
	var skins = [
		{ id: 'portfolio-dark', name: 'Portfolio Dark', scheme: 'dark', css: '' },
		{ id: 'portfolio-light', name: 'Portfolio Light', scheme: 'light', css: '' },
		{ id: 'acid-editorial', name: 'Acid Editorial', scheme: 'light', css: 'assets/css/skins/acid-editorial.css' },
		{ id: 'op-art-monochrome', name: 'Op Art Monochrome', scheme: 'light', css: 'assets/css/skins/op-art-monochrome.css' },
		{ id: 'neon-glitch', name: 'Neon Glitch', scheme: 'dark', css: 'assets/css/skins/neon-glitch.css' },
		{ id: 'liquid-dream', name: 'Liquid Dream', scheme: 'light', css: 'assets/css/skins/liquid-dream.css' },
		{ id: 'sacred-geometry', name: 'Sacred Geometry', scheme: 'dark', css: 'assets/css/skins/sacred-geometry.css' }
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
		root.setAttribute('data-skin', id);
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

	var sessionId = read(window.sessionStorage, sessionKey);
	if (sessionId && !isValid(sessionId)) {
		remove(window.sessionStorage, sessionKey);
		remove(window.sessionStorage, sessionModeKey);
		sessionId = '';
	}
	var sessionMode = read(window.sessionStorage, sessionModeKey);
	if (sessionMode !== 'preview' && sessionMode !== 'random') {
		sessionMode = 'random';
	}

	var initialId = persistedId || sessionId || randomId();
	if (!persistedId && !sessionId) {
		write(window.sessionStorage, sessionKey, initialId);
		write(window.sessionStorage, sessionModeKey, 'random');
	}
	apply(initialId, persistedId ? 'saved' : sessionMode);

	window.SiteSkins = {
		all: skins.slice(),
		getActiveId: function() {
			return activeId;
		},
		getPersistedId: function() {
			return persistedId;
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
		}
	};
})();
