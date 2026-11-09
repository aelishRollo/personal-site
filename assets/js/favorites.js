(function() {
	var VIEW_STORAGE_KEY = 'favorites-layout-view';
	var viewButtons = Array.prototype.slice.call(
		document.querySelectorAll('[data-favorites-view-choice]')
	);

	function normalizeView(value) {
		return value === 'two-column' ? 'two-column' : 'compact';
	}

	function readStoredView() {
		try {
			return normalizeView(window.localStorage.getItem(VIEW_STORAGE_KEY));
		} catch (err) {
			return 'compact';
		}
	}

	function writeStoredView(view) {
		try {
			window.localStorage.setItem(VIEW_STORAGE_KEY, view);
		} catch (err) {
			// Ignore storage errors in restricted browsing modes.
		}
	}

	function applyFavoritesView(view, persist) {
		var normalized = normalizeView(view);
		if (document.body) {
			document.body.setAttribute('data-favorites-view', normalized);
		}
		for (var i = 0; i < viewButtons.length; i++) {
			var btn = viewButtons[i];
			var isMatch = btn.getAttribute('data-favorites-view-choice') === normalized;
			btn.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
		}
		if (persist) {
			writeStoredView(normalized);
		}
	}

	applyFavoritesView(readStoredView(), false);

	// Pin decoded HTMLImageElement instances in memory so decoded image bitmaps
	// are retained for the lifetime of the page.
	var favoriteImages = Array.prototype.slice.call(
		document.querySelectorAll('.favorite-media img')
	);
	window.__pinnedFavoriteImages = favoriteImages;

	function decodeAllFavoriteImages() {
		var preloadLinks = Array.prototype.slice.call(
			document.querySelectorAll('link[data-skin-preload][as="image"]')
		);
		var bgPromises = preloadLinks.map(function(link) {
			var href = link.getAttribute('href');
			if (!href) {
				return Promise.resolve();
			}
			var bgImg = new Image();
			bgImg.decoding = 'sync';
			bgImg.src = href;
			favoriteImages.push(bgImg);
			if (typeof bgImg.decode === 'function') {
				return bgImg.decode().catch(function() {});
			}
			return Promise.resolve();
		});
		var cardPromises = favoriteImages.map(function(img) {
			if (typeof img.decode === 'function') {
				return img.decode().catch(function() {});
			}
			return Promise.resolve();
		});
		return Promise.all(cardPromises.concat(bgPromises));
	}

	var isPrewarming = false;
	var prewarmCancel = null;
	var prewarmTimer = null;
	var prewarmHost = null;

	function ensurePrewarmHost() {
		if (prewarmHost) {
			return prewarmHost;
		}
		if (!document.body) {
			return null;
		}
		prewarmHost = document.createElement('div');
		prewarmHost.setAttribute('aria-hidden', 'true');
		prewarmHost.setAttribute('inert', '');
		prewarmHost.style.cssText =
			'position:fixed;inset:0;z-index:9998;pointer-events:none;overflow:hidden;contain:strict;will-change:opacity;opacity:0;';
		document.body.appendChild(prewarmHost);
		return prewarmHost;
	}

	ensurePrewarmHost();

	var backToTop = document.querySelector('.favorites-back-to-top');
	var isBackToTopHidden = backToTop ? backToTop.hidden : true;

	function updateBackToTop() {
		if (!backToTop || isPrewarming) {
			return;
		}
		var nextHidden = window.scrollY < Math.max(360, window.innerHeight * 0.5);
		if (nextHidden !== isBackToTopHidden) {
			isBackToTopHidden = nextHidden;
			backToTop.hidden = nextHidden;
		}
	}

	function cancelActivePrewarm() {
		if (prewarmTimer) {
			window.clearTimeout(prewarmTimer);
			prewarmTimer = null;
		}
		if (typeof prewarmCancel === 'function') {
			prewarmCancel();
		}
	}

	var isChromium = /Chrome|Chromium|Edg/.test(navigator.userAgent || '');

	function prewarmRootTiles(allowNonZeroStart) {
		cancelActivePrewarm();
		if (!isChromium || window.location.hash) {
			return;
		}
		var startY = Math.round(window.scrollY || 0);
		if (!allowNonZeroStart && startY !== 0) {
			return;
		}
		var wrapper = document.getElementById('wrapper');
		if (!wrapper || !document.body) {
			return;
		}
		var maxScroll = Math.max(
			0,
			document.documentElement.scrollHeight - window.innerHeight
		);
		if (maxScroll <= 0) {
			return;
		}

		var cover = ensurePrewarmHost();
		if (!cover) {
			return;
		}

		isPrewarming = true;
		var aborted = false;
		var expectedY = startY;

		var bodyBg = window.getComputedStyle(document.body).backgroundColor;
		var htmlBg = window.getComputedStyle(document.documentElement).backgroundColor;
		var coverBg =
			bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)' && bodyBg !== 'transparent'
				? bodyBg
				: htmlBg && htmlBg !== 'rgba(0, 0, 0, 0)' && htmlBg !== 'transparent'
				? htmlBg
				: 'var(--bg, #111)';

		cover.textContent = '';
		cover.style.background = coverBg;
		cover.style.opacity = '0.998';

		try {
			var frame = document.createElement('iframe');
			frame.setAttribute('aria-hidden', 'true');
			frame.setAttribute('tabindex', '-1');
			frame.style.cssText =
				'width:100%;height:100%;border:0;display:block;pointer-events:none;overflow:hidden;';
			cover.appendChild(frame);
			var fdoc = frame.contentDocument;
			if (fdoc && fdoc.documentElement && fdoc.body) {
				var rootAttrs = document.documentElement.attributes;
				for (var r = 0; r < rootAttrs.length; r++) {
					fdoc.documentElement.setAttribute(rootAttrs[r].name, rootAttrs[r].value);
				}
				fdoc.documentElement.style.cssText = document.documentElement.style.cssText;
				var links = document.head.querySelectorAll('link[rel="stylesheet"]');
				for (var l = 0; l < links.length; l++) {
					fdoc.head.appendChild(links[l].cloneNode(true));
				}
				var bodyAttrs = document.body.attributes;
				for (var b = 0; b < bodyAttrs.length; b++) {
					if (bodyAttrs[b].name !== 'id') {
						fdoc.body.setAttribute(bodyAttrs[b].name, bodyAttrs[b].value);
					}
				}
				var clone = wrapper.cloneNode(true);
				if (startY > 0) {
					clone.style.transform = 'translateY(-' + startY + 'px)';
				}
				fdoc.body.style.overflow = 'hidden';
				fdoc.body.appendChild(clone);
			}
		} catch (err) {
			// Fall back to solid cover background if iframe cloning is restricted.
		}

		var observer = null;
		if (typeof window.MutationObserver === 'function') {
			observer = new MutationObserver(function() {
				aborted = true;
				cleanup(true);
			});
			observer.observe(wrapper, {
				attributes: true,
				childList: true,
				characterData: true,
				subtree: true
			});
		}

		function cleanup(restoreScroll) {
			if (!isPrewarming) {
				return;
			}
			isPrewarming = false;
			prewarmCancel = null;
			if (observer) {
				observer.disconnect();
				observer = null;
			}
			window.removeEventListener('wheel', onUserInterrupt);
			window.removeEventListener('touchstart', onUserInterrupt);
			window.removeEventListener('pointerdown', onUserInterrupt);
			window.removeEventListener('mousedown', onUserInterrupt);
			window.removeEventListener('keydown', onUserInterrupt);
			window.removeEventListener('hashchange', onExternalJump);
			if (restoreScroll && !window.location.hash) {
				window.scrollTo(0, startY);
			}
			cover.style.opacity = '0';
			cover.style.background = 'transparent';
			cover.textContent = '';
			updateBackToTop();
		}

		function onUserInterrupt() {
			aborted = true;
			cleanup(true);
		}

		function onExternalJump() {
			aborted = true;
			cleanup(false);
		}

		prewarmCancel = function() {
			aborted = true;
			cleanup(false);
		};

		window.addEventListener('wheel', onUserInterrupt, { passive: true, once: true });
		window.addEventListener('touchstart', onUserInterrupt, { passive: true, once: true });
		window.addEventListener('pointerdown', onUserInterrupt, { passive: true, once: true });
		window.addEventListener('mousedown', onUserInterrupt, { passive: true, once: true });
		window.addEventListener('keydown', onUserInterrupt, { passive: true, once: true });
		window.addEventListener('hashchange', onExternalJump, { once: true });

		var stepSize = Math.max(560, Math.floor(window.innerHeight * 0.92));
		var positions = [0];
		for (var pos = stepSize; pos < maxScroll; pos += stepSize) {
			positions.push(pos);
		}
		positions.push(maxScroll);
		positions.push(startY);

		var idx = 0;
		function stepFrame() {
			if (aborted || !isPrewarming) {
				return;
			}
			if (window.location.hash || Math.abs(window.scrollY - expectedY) > 4) {
				cleanup(false);
				return;
			}
			if (idx < positions.length) {
				expectedY = positions[idx++];
				window.scrollTo(0, expectedY);
				window.requestAnimationFrame(stepFrame);
			} else {
				cleanup(true);
			}
		}

		window.requestAnimationFrame(stepFrame);
	}

	function schedulePrewarm(delayMs, allowNonZeroStart) {
		cancelActivePrewarm();
		prewarmTimer = window.setTimeout(function() {
			prewarmTimer = null;
			decodeAllFavoriteImages().then(function() {
				if (!window.location.hash) {
					prewarmRootTiles(Boolean(allowNonZeroStart));
				}
			});
		}, typeof delayMs === 'number' ? delayMs : 180);
	}

	for (var j = 0; j < viewButtons.length; j++) {
		viewButtons[j].addEventListener('click', function(event) {
			var target = event.currentTarget;
			var choice = target.getAttribute('data-favorites-view-choice');
			applyFavoritesView(choice, true);
			schedulePrewarm(120, true);
		});
	}

	var initialPrewarmDelay = navigator.webdriver ? 550 : 120;

	if (document.readyState === 'complete') {
		schedulePrewarm(initialPrewarmDelay);
	} else {
		window.addEventListener(
			'load',
			function() {
				schedulePrewarm(initialPrewarmDelay);
			},
			{ once: true }
		);
	}

	document.addEventListener('site-skin-change', function() {
		schedulePrewarm(60, true);
	});

	document.addEventListener('site-skins-prepared', function() {
		if (window.scrollY === 0 && !window.location.hash) {
			schedulePrewarm(initialPrewarmDelay, false);
		}
	});

	if (backToTop) {
		window.addEventListener('scroll', updateBackToTop, { passive: true });
		window.addEventListener('resize', updateBackToTop);
		updateBackToTop();
	}
})();
