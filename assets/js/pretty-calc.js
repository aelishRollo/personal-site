/*
	Pretty Calc photo engine.

	Ported from the Pretty Calc project: random Lorem Picsum photos are fetched
	as blobs, decoded before display, and held in a ready queue so visiting the
	theme or rolling the dice displays a photo immediately. Unlike the calculator,
	a photo is shown on load without waiting for a button click.

	Changes from the original:
	- Several photos are preloaded upon site load even before Pretty Calc is
	  selected, and kept buffered across theme switches for instant display.
	- The active photo and palette are preserved in sessionStorage across page
	  navigations so moving between pages never changes the photo.
	- The decoded <img> element itself is mounted, so a swap never re-decodes.
	- Photos crossfade on reroll, while the initial photo appears immediately.
	- Failed fetches back off instead of retrying in a tight loop.
	- Unseen queued photos are handed to the next page through sessionStorage.
	  Their final Picsum URLs are immutable and HTTP-cached, so the next page
	  keeps the ready queue warm without downloading them again.
	- WebP is requested, and dimensions follow the viewport and pixel density.
*/
(function() {
	'use strict';

	var SKIN_ID = 'pretty-calc';
	var CURRENT_KEY = 'pretty-calc-current-photo-v1';
	var STASH_KEY = 'pretty-calc-unseen-photos-v1';
	var CACHED_PREFIX = 'https://fastly.picsum.photos/';
	var root = document.documentElement;
	var connection = navigator.connection;
	var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	var saveData = Boolean(connection && connection.saveData);
	var TARGET = saveData ? 1 : 5;
	var WAIT_MS = 8000;
	var FADE_MS = 700;
	var MAX_BACKOFF_MS = 30000;

	var authorById = {};
	var running = false;
	var ready = [];
	var stash = readStash();
	var inFlight = 0;
	var waiters = [];
	var failures = 0;
	var retryTimer = 0;
	var current = readCurrent();
	var busy = false;
	var stage = null;
	var controls = null;
	var credit = null;
	var dice = null;

	function isActive() {
		return root.getAttribute('data-skin-id') === SKIN_ID;
	}

	function randomToken() {
		return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
	}

	function photoSize() {
		var density = Math.min(window.devicePixelRatio || 1, saveData ? 1 : 1.5);
		var step = 64;
		var width = Math.max(800, Math.min(2560, window.innerWidth * density));
		var height = Math.max(600, Math.min(2560, window.innerHeight * density));
		return {
			width: Math.ceil(width / step) * step,
			height: Math.ceil(height / step) * step
		};
	}

	function randomPhotoUrl() {
		var size = photoSize();
		return 'https://picsum.photos/' + size.width + '/' + size.height + '.webp?random=' + randomToken();
	}

	function photoIdFrom(source, response) {
		var header = response.headers.get('Picsum-Id');
		var match = /\/id\/(\d+)\//.exec(source || '');
		return header || (match ? match[1] : '');
	}

	function readCurrent() {
		try {
			var saved = JSON.parse(window.sessionStorage.getItem(CURRENT_KEY) || 'null');
			if (!saved || typeof saved !== 'object') {
				return null;
			}
			var src = saved.dataUrl || saved.source || '';
			if (!src) {
				return null;
			}
			if (saved.id && saved.author) {
				authorById[saved.id] = saved.author;
			}
			var image = new Image();
			image.decoding = 'async';
			image.alt = '';
			image.src = src;
			return {
				image: image,
				objectUrl: '',
				dataUrl: saved.dataUrl || '',
				source: saved.source || src,
				id: saved.id || ''
			};
		} catch (error) {
			return null;
		}
	}

	function writeCurrent() {
		if (!current) {
			return;
		}
		var payload = {
			source: current.source || '',
			id: current.id || '',
			dataUrl: current.dataUrl || '',
			author: (current.id && authorById[current.id]) || null
		};
		try {
			window.sessionStorage.setItem(CURRENT_KEY, JSON.stringify(payload));
		} catch (error) {
			try {
				payload.dataUrl = '';
				window.sessionStorage.setItem(CURRENT_KEY, JSON.stringify(payload));
			} catch (fallbackError) {
				// Storage can be unavailable in locked-down browsing modes.
			}
		}
	}

	function readStash() {
		try {
			var saved = JSON.parse(window.sessionStorage.getItem(STASH_KEY) || '[]');
			window.sessionStorage.removeItem(STASH_KEY);
			return Array.isArray(saved) ? saved.filter(function(url) {
				return typeof url === 'string' && url.indexOf(CACHED_PREFIX) === 0;
			}).slice(0, TARGET) : [];
		} catch (error) {
			return [];
		}
	}

	// Keep unseen cached photo URLs in sessionStorage so navigating to another
	// page can pull them straight from the browser's HTTP disk cache.
	function writeStash() {
		var unseen = ready.map(function(photo) {
			return photo.source;
		}).concat(stash).filter(function(url) {
			return url.indexOf(CACHED_PREFIX) === 0;
		}).slice(0, TARGET);

		try {
			if (unseen.length) {
				window.sessionStorage.setItem(STASH_KEY, JSON.stringify(unseen));
			} else {
				window.sessionStorage.removeItem(STASH_KEY);
			}
		} catch (error) {
			// Storage can be unavailable; the next page simply fetches new photos.
		}
	}

	function release(photo) {
		if (photo && photo.objectUrl) {
			URL.revokeObjectURL(photo.objectUrl);
			photo.objectUrl = '';
		}
	}

	function prefetchAuthor(id) {
		if (!id || authorById[id]) {
			return;
		}
		window.fetch('https://picsum.photos/id/' + id + '/info', { mode: 'cors', credentials: 'omit', priority: 'low' })
			.then(function(response) {
				return response.ok ? response.json() : null;
			})
			.then(function(info) {
				if (info) {
					authorById[id] = info;
					if (current && current.id === id) {
						setCredit(info);
						writeCurrent();
					}
				}
			}, function() {
				// Generic credit remains if author lookup fails.
			});
	}

	function deliver(photo) {
		var waiter = waiters.shift();
		if (waiter) {
			waiter(photo);
		} else {
			ready.push(photo);
			writeStash();
		}
	}

	function decode(image) {
		if (typeof image.decode === 'function') {
			return image.decode();
		}
		return new Promise(function(resolve, reject) {
			image.onload = resolve;
			image.onerror = reject;
		});
	}

	function blobToDataUrl(blob) {
		return new Promise(function(resolve) {
			try {
				var reader = new FileReader();
				reader.onloadend = function() {
					resolve(typeof reader.result === 'string' ? reader.result : '');
				};
				reader.onerror = function() {
					resolve('');
				};
				reader.readAsDataURL(blob);
			} catch (error) {
				resolve('');
			}
		});
	}

	function loadPhoto(url, lowPriority) {
		var options = { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' };
		var objectUrl = '';
		var source = '';
		var id = '';

		if (lowPriority) {
			options.priority = 'low';
		}

		inFlight++;
		return window.fetch(url, options).then(function(response) {
			if (!response.ok) {
				throw new Error('Photo request failed');
			}
			source = response.url || url;
			id = photoIdFrom(source, response);
			prefetchAuthor(id);
			return response.blob();
		}).then(function(blob) {
			objectUrl = URL.createObjectURL(blob);
			var image = new Image();
			image.decoding = 'async';
			image.alt = '';
			image.src = objectUrl;
			return Promise.all([decode(image), blobToDataUrl(blob)]).then(function(results) {
				return {
					image: image,
					objectUrl: objectUrl,
					dataUrl: results[1],
					source: source,
					id: id
				};
			});
		}).then(function(photo) {
			failures = 0;
			deliver(photo);
		}, function() {
			if (objectUrl) {
				URL.revokeObjectURL(objectUrl);
			}
			failures++;
		}).then(function() {
			inFlight--;
			if (inFlight === 0 && !ready.length && waiters.length) {
				// Nothing else in flight can satisfy anyone waiting for a photo.
				waiters.slice().forEach(function(waiter) {
					waiter(null);
				});
			}
		});
	}

	function fill() {
		var deficit = TARGET - ready.length - inFlight;
		var pending = [];

		while (deficit-- > 0) {
			// Unseen photos from the previous page come from the HTTP cache.
			var firstForActiveTheme = isActive() && !current && !ready.length && !inFlight;
			pending.push(loadPhoto(stash.shift() || randomPhotoUrl(), !firstForActiveTheme));
		}
		if (pending.length) {
			Promise.all(pending).then(topUp);
		}
	}

	function topUp() {
		if (retryTimer || ready.length + inFlight >= TARGET) {
			return;
		}
		if (!failures) {
			fill();
			return;
		}
		// Only schedule background retry timers while Pretty Calc is active.
		if (!running) {
			return;
		}
		retryTimer = window.setTimeout(function() {
			retryTimer = 0;
			fill();
		}, Math.min(MAX_BACKOFF_MS, 1000 * Math.pow(2, failures - 1)));
	}

	function nextPhoto() {
		var photo = ready.shift();
		if (photo) {
			writeStash();
			return Promise.resolve(photo);
		}

		if (!inFlight) {
			// An explicit request skips any pending backoff and races a full batch.
			failures = 0;
			window.clearTimeout(retryTimer);
			retryTimer = 0;
			fill();
		}

		return new Promise(function(resolve) {
			var settled = false;
			var timer = window.setTimeout(function() {
				finish(null);
			}, WAIT_MS);

			function finish(result) {
				if (settled) {
					if (result) {
						ready.unshift(result);
						writeStash();
					}
					return;
				}
				settled = true;
				window.clearTimeout(timer);
				var index = waiters.indexOf(finish);
				if (index !== -1) {
					waiters.splice(index, 1);
				}
				resolve(result);
			}

			waiters.push(finish);
		});
	}

	function randomizePalette() {
		if (window.SiteSkins && typeof window.SiteSkins.randomizePrettyCalcPalette === 'function') {
			window.SiteSkins.randomizePrettyCalcPalette();
		}
	}

	function setCredit(info) {
		if (!credit) {
			return;
		}
		credit.textContent = '';
		var picsum = document.createElement('a');
		picsum.href = 'https://picsum.photos/';
		picsum.textContent = 'Lorem Picsum';

		if (info && info.author && info.url) {
			var author = document.createElement('a');
			author.href = info.url;
			author.textContent = info.author;
			credit.append('Photo by ', author, ' via ', picsum);
		} else {
			credit.append('Photo via ', picsum);
		}
	}

	function updateCredit(photo) {
		var id = photo.id;
		setCredit(authorById[id]);
		prefetchAuthor(id);
	}

	function show(photo) {
		var image = photo.image;
		var previous = current;

		current = photo;
		writeCurrent();
		image.className = 'pretty-calc-photo';
		image.setAttribute('aria-hidden', 'true');
		image.setAttribute('draggable', 'false');
		if (photo.source) {
			image.setAttribute('data-photo-source', photo.source);
		}
		root.setAttribute('data-pretty-calc-photo', 'ready');
		updateCredit(photo);

		// Show the initial or restored photo on frame 0 without fading in from blank.
		if (!previous || previous === photo || reducedMotion.matches) {
			image.classList.add('is-visible');
			stage.appendChild(image);
			if (previous && previous !== photo) {
				previous.image.remove();
				release(previous);
			}
			return;
		}

		stage.appendChild(image);
		// Commit the hidden state so dice rerolls crossfade over the previous photo.
		void image.offsetWidth;
		image.classList.add('is-visible');
		window.setTimeout(function() {
			previous.image.remove();
			release(previous);
		}, FADE_MS + 50);
	}

	function setBusy(state) {
		busy = state;
		if (dice) {
			dice.classList.toggle('is-loading', state);
			dice.setAttribute('aria-busy', state ? 'true' : 'false');
		}
	}

	function reroll(isInitial) {
		if (!running || busy) {
			return;
		}

		// When a photo is already preloaded, swap synchronously with zero delay.
		if (ready.length) {
			var readyPhoto = ready.shift();
			writeStash();
			if (!isInitial) {
				randomizePalette();
				if (stage && !reducedMotion.matches && typeof stage.animate === 'function') {
					stage.animate([{ filter: 'brightness(1.18)' }, { filter: 'brightness(1)' }], { duration: 350, easing: 'ease-out' });
				}
			}
			show(readyPhoto);
			topUp();
			return;
		}

		setBusy(true);
		nextPhoto().then(function(photo) {
			setBusy(false);
			if (!running) {
				if (photo) {
					ready.unshift(photo);
					writeStash();
				}
				return;
			}
			if (!photo) {
				if (credit && !current) {
					credit.textContent = 'Photos are unavailable right now';
				}
				topUp();
				return;
			}
			if (!isInitial) {
				randomizePalette();
				if (stage && !reducedMotion.matches && typeof stage.animate === 'function') {
					stage.animate([{ filter: 'brightness(1.18)' }, { filter: 'brightness(1)' }], { duration: 350, easing: 'ease-out' });
				}
			}
			show(photo);
			topUp();
		});
	}

	function mount() {
		stage = document.createElement('div');
		stage.className = 'pretty-calc-stage';
		stage.setAttribute('aria-hidden', 'true');
		document.body.prepend(stage);

		controls = document.createElement('div');
		controls.className = 'pretty-calc-controls';
		controls.innerHTML = '<button type="button" class="pretty-calc-dice" aria-label="Show a new random photo and palette" title="New photo and palette">' +
			'<span class="pretty-calc-dice-face" aria-hidden="true">&#127922;</span>' +
			'</button>';
		document.body.appendChild(controls);

		credit = document.createElement('p');
		credit.className = 'pretty-calc-credit';
		credit.setAttribute('aria-live', 'polite');
		credit.textContent = 'Finding a photo\u2026';
		document.body.appendChild(credit);

		dice = controls.querySelector('.pretty-calc-dice');
		dice.addEventListener('click', function() {
			reroll(false);
		});
	}

	function unmount() {
		if (stage) {
			stage.remove();
		}
		if (controls) {
			controls.remove();
		}
		if (credit) {
			credit.remove();
		}
		stage = null;
		controls = null;
		dice = null;
		credit = null;
		root.removeAttribute('data-pretty-calc-photo');
	}

	function start() {
		if (running) {
			return;
		}
		running = true;
		failures = 0;
		mount();
		if (current) {
			show(current);
			topUp();
		} else {
			reroll(true);
		}
	}

	function stop() {
		if (!running) {
			return;
		}
		running = false;
		window.clearTimeout(retryTimer);
		retryTimer = 0;
		waiters.slice().forEach(function(waiter) {
			waiter(null);
		});

		// Keep current and the preloaded ready queue warm so revisiting Pretty Calc
		// or navigating between pages preserves the active photo immediately.
		setBusy(false);
		unmount();
		topUp();
	}

	function sync() {
		if (isActive()) {
			start();
		} else {
			stop();
		}
	}

	function onKeyDown(event) {
		if (!running || event.key !== '?' || event.ctrlKey || event.metaKey || event.altKey) {
			return;
		}
		var target = event.target;
		if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/i.test(target.tagName))) {
			return;
		}
		reroll(false);
	}

	function init() {
		document.addEventListener('site-skin-change', sync);
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('pagehide', function() {
			writeCurrent();
			writeStash();
		});
		sync();
	}

	window.PrettyCalc = {
		reroll: function() {
			reroll(false);
		}
	};

	// Begin preloading several photos immediately upon script load, even before
	// Pretty Calc is visited.
	topUp();

	if (document.body) {
		init();
	} else {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	}
})();
