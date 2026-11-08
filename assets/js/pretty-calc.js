/*
	Pretty Calc photo engine.

	Ported from the Pretty Calc project: random Lorem Picsum photos are fetched
	as blobs, decoded before display, and held in a small ready queue so a
	reroll swaps instantly. Unlike the calculator, a photo is shown on load.

	Changes from the original:
	- The decoded <img> element itself is mounted, so a swap never re-decodes.
	- Photos crossfade over the palette gradient instead of a hard swap.
	- Failed fetches back off instead of retrying in a tight loop.
	- Unseen queued photos are handed to the next page through sessionStorage.
	  Their final Picsum URLs are immutable and HTTP-cached, so the next page
	  shows a new photo almost immediately without downloading it again.
	- The queue is smaller (1 with Save-Data), WebP is requested, and the size
	  follows the viewport and pixel density.

	skin-bootstrap.js loads this file only while Pretty Calc is active, after
	it has already applied a random palette and preconnected to Picsum.
*/
(function() {
	'use strict';

	var SKIN_ID = 'pretty-calc';
	var STASH_KEY = 'pretty-calc-unseen-photos-v1';
	var CACHED_PREFIX = 'https://fastly.picsum.photos/';
	var root = document.documentElement;
	var connection = navigator.connection;
	var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	var saveData = Boolean(connection && connection.saveData);
	var TARGET = saveData ? 1 : 3;
	var WAIT_MS = 8000;
	var FADE_MS = 700;
	var MAX_BACKOFF_MS = 30000;

	var running = false;
	var ready = [];
	var stash = readStash();
	var inFlight = 0;
	var waiters = [];
	var controllers = [];
	var failures = 0;
	var retryTimer = 0;
	var current = null;
	var busy = false;
	var stage = null;
	var controls = null;
	var credit = null;
	var dice = null;
	var authorById = {};

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

	// Hand unseen photos to the next page. Each is shown at most once.
	function writeStash() {
		var unseen = ready.map(function(photo) {
			return photo.source;
		}).concat(stash).filter(function(url) {
			return url.indexOf(CACHED_PREFIX) === 0;
		}).slice(0, TARGET);

		if (!unseen.length) {
			return;
		}
		try {
			window.sessionStorage.setItem(STASH_KEY, JSON.stringify(unseen));
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

	function deliver(photo) {
		var waiter = waiters.shift();
		if (waiter) {
			waiter(photo);
		} else {
			ready.push(photo);
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

	function loadPhoto(url, lowPriority) {
		var controller = typeof AbortController === 'function' ? new AbortController() : null;
		var options = { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' };
		var objectUrl = '';
		var source = '';
		var id = '';

		if (controller) {
			options.signal = controller.signal;
			controllers.push(controller);
		}
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
			return response.blob();
		}).then(function(blob) {
			objectUrl = URL.createObjectURL(blob);
			var image = new Image();
			image.decoding = 'async';
			image.alt = '';
			image.src = objectUrl;
			return decode(image).then(function() {
				return { image: image, objectUrl: objectUrl, source: source, id: id };
			});
		}).then(function(photo) {
			failures = 0;
			if (running) {
				deliver(photo);
			} else {
				release(photo);
			}
		}, function() {
			if (objectUrl) {
				URL.revokeObjectURL(objectUrl);
			}
			failures++;
		}).then(function() {
			inFlight--;
			if (controller) {
				controllers.splice(controllers.indexOf(controller), 1);
			}
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

		while (running && deficit-- > 0) {
			// Unseen photos from the previous page come from the HTTP cache.
			pending.push(loadPhoto(stash.shift() || randomPhotoUrl(), true));
		}
		if (pending.length) {
			Promise.all(pending).then(topUp);
		}
	}

	function topUp() {
		if (!running || retryTimer || ready.length + inFlight >= TARGET) {
			return;
		}
		if (!failures) {
			fill();
			return;
		}
		// Back off while offline, blocked, or rate limited.
		retryTimer = window.setTimeout(function() {
			retryTimer = 0;
			fill();
		}, Math.min(MAX_BACKOFF_MS, 1000 * Math.pow(2, failures - 1)));
	}

	function nextPhoto() {
		var photo = ready.shift();
		if (photo) {
			return Promise.resolve(photo);
		}

		if (!inFlight) {
			// An explicit request skips any pending backoff.
			window.clearTimeout(retryTimer);
			retryTimer = 0;
			loadPhoto(stash.shift() || randomPhotoUrl(), false);
		}

		return new Promise(function(resolve) {
			var settled = false;
			var timer = window.setTimeout(function() {
				finish(null);
			}, WAIT_MS);

			function finish(result) {
				if (settled) {
					// A late photo still belongs at the front of the queue.
					if (result) {
						ready.unshift(result);
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
					if (current === photo) {
						setCredit(info);
					}
				}
			}, function() {
				// The generic credit stays in place.
			});
	}

	function show(photo) {
		var image = photo.image;
		var previous = current;

		current = photo;
		image.className = 'pretty-calc-photo';
		image.setAttribute('aria-hidden', 'true');
		image.setAttribute('draggable', 'false');
		stage.appendChild(image);
		root.setAttribute('data-pretty-calc-photo', 'ready');
		updateCredit(photo);

		if (!reducedMotion.matches) {
			// Commit the hidden state so the fade runs, including for the first photo.
			void image.offsetWidth;
		}
		image.classList.add('is-visible');

		if (previous) {
			window.setTimeout(function() {
				previous.image.remove();
				release(previous);
			}, reducedMotion.matches ? 0 : FADE_MS + 50);
		}
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

		setBusy(true);
		nextPhoto().then(function(photo) {
			setBusy(false);
			if (!running) {
				release(photo);
				return;
			}
			if (!photo) {
				if (credit && !current) {
					credit.textContent = 'Photos are unavailable right now';
				}
				topUp();
				return;
			}
			// The bootstrap already chose a palette for the first photo.
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
		reroll(true);
	}

	function stop() {
		if (!running) {
			return;
		}
		running = false;
		window.clearTimeout(retryTimer);
		retryTimer = 0;

		// Keep unseen cached photos for a later return to Pretty Calc.
		stash = ready.map(function(photo) {
			return photo.source;
		}).concat(stash).slice(0, TARGET);
		ready.splice(0).forEach(release);
		controllers.slice().forEach(function(controller) {
			controller.abort();
		});
		waiters.slice().forEach(function(waiter) {
			waiter(null);
		});

		if (current) {
			release(current);
			current = null;
		}
		setBusy(false);
		unmount();
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
		window.addEventListener('pagehide', writeStash);
		sync();
	}

	window.PrettyCalc = {
		reroll: function() {
			reroll(false);
		}
	};

	if (document.body) {
		init();
	} else {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	}
})();
