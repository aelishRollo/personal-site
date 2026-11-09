(function() {
	var VIEW_STORAGE_KEY = 'favorites-layout-view';
	var PARK_MARGIN = 650;
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
	var preloadedSkinImages = {};
	window.__pinnedFavoriteImages = favoriteImages;

	function waitForImageReady(img) {
		if (img.complete) {
			return typeof img.decode === 'function'
				? img.decode().catch(function() {})
				: Promise.resolve();
		}
		return new Promise(function(resolve) {
			function done() {
				if (typeof img.decode === 'function') {
					img.decode().catch(function() {}).then(resolve);
				} else {
					resolve();
				}
			}
			img.addEventListener('load', done, { once: true });
			img.addEventListener('error', done, { once: true });
		});
	}

	function decodeAllFavoriteImages() {
		var preloadLinks = Array.prototype.slice.call(
			document.querySelectorAll('link[data-skin-preload][as="image"]')
		);
		var bgPromises = preloadLinks.map(function(link) {
			var href = link.getAttribute('href');
			if (!href) {
				return Promise.resolve();
			}
			var bgImg = preloadedSkinImages[href];
			if (!bgImg) {
				bgImg = new Image();
				bgImg.decoding = 'sync';
				bgImg.src = href;
				preloadedSkinImages[href] = bgImg;
				favoriteImages.push(bgImg);
			}
			return waitForImageReady(bgImg);
		});
		var cardPromises = favoriteImages.map(waitForImageReady);
		return Promise.all(cardPromises.concat(bgPromises));
	}

	var secEl = document.querySelector('.favorites-section');
	var shellEl = document.querySelector('.favorites-section > .site-shell');
	var fixedBg = null;
	var fixedSecBg = null;
	var shellBackdrop = null;
	var parkStyle = null;

	function isTransparentColor(value) {
		return !value || value === 'transparent' || value === 'rgba(0, 0, 0, 0)';
	}

	function ensureFavoritesBackdrops() {
		if (!document.body || !document.head) {
			return;
		}
		if (!fixedBg) {
			fixedBg = document.createElement('div');
			fixedBg.id = 'favorites-fixed-bg';
			fixedBg.setAttribute('aria-hidden', 'true');
			fixedBg.style.cssText =
				'position:fixed;inset:0;pointer-events:none;z-index:0;will-change:transform;backface-visibility:hidden;transform:translate3d(0px,0px,0px);';
			fixedSecBg = document.createElement('div');
			fixedSecBg.style.cssText = 'position:absolute;inset:0;pointer-events:none;display:none;';
			fixedBg.appendChild(fixedSecBg);
			document.body.insertBefore(fixedBg, document.body.firstChild);
		}
		if (shellEl && !shellBackdrop) {
			shellBackdrop = document.createElement('div');
			shellBackdrop.className = 'favorites-shell-backdrop';
			shellBackdrop.setAttribute('aria-hidden', 'true');
			shellBackdrop.style.cssText =
				'position:absolute;top:0;left:0;right:0;height:min(100%,1350px);pointer-events:none;z-index:0;will-change:transform;backface-visibility:hidden;opacity:0.999;transform:translate3d(0px,0px,0px);display:none;';
			shellEl.insertBefore(shellBackdrop, shellEl.firstChild);
		}
		if (!parkStyle) {
			parkStyle = document.createElement('style');
			parkStyle.id = 'favorites-gpu-park-style';
			parkStyle.textContent =
				'html body.page-favorites#page-top {' +
				'  background-image: none !important;' +
				'}' +
				'html body.page-favorites#page-top #wrapper,' +
				'html body.page-favorites#page-top #main,' +
				'html body.page-favorites#page-top .favorites-section,' +
				'html body.page-favorites#page-top .favorites-section > .site-shell {' +
				'  background: transparent !important;' +
				'  background-color: transparent !important;' +
				'  background-image: none !important;' +
				'  border: 0 !important;' +
				'  box-shadow: none !important;' +
				'  z-index: auto !important;' +
				'}';
			document.head.appendChild(parkStyle);
		}
	}

	function syncFavoritesBackdrops() {
		ensureFavoritesBackdrops();
		if (!fixedBg || !parkStyle) {
			return;
		}
		parkStyle.disabled = true;
		var bodyCS = window.getComputedStyle(document.body);
		var bodyBg = bodyCS.background;
		var secBg = '';
		var hasSecBg = false;
		if (secEl) {
			var secCS = window.getComputedStyle(secEl);
			hasSecBg =
				secCS.backgroundImage !== 'none' || !isTransparentColor(secCS.backgroundColor);
			if (hasSecBg) {
				secBg = secCS.background;
			}
		}
		var hasShellVisual = false;
		var shellBg = '';
		var shellBorder = '';
		var shellRadius = '';
		var shellShadow = '';
		if (shellEl && shellBackdrop) {
			var shellCS = window.getComputedStyle(shellEl);
			var hasShellBg =
				shellCS.backgroundImage !== 'none' || !isTransparentColor(shellCS.backgroundColor);
			var hasShellBorder =
				parseFloat(shellCS.borderTopWidth) > 0 ||
				parseFloat(shellCS.borderLeftWidth) > 0 ||
				parseFloat(shellCS.borderRightWidth) > 0 ||
				parseFloat(shellCS.borderBottomWidth) > 0;
			var hasShellShadow = Boolean(shellCS.boxShadow && shellCS.boxShadow !== 'none');
			hasShellVisual = hasShellBg || hasShellBorder || hasShellShadow;
			if (hasShellVisual) {
				shellBg = shellCS.background;
				shellBorder = shellCS.border;
				shellRadius = shellCS.borderRadius;
				shellShadow = shellCS.boxShadow;
			}
		}
		parkStyle.disabled = false;

		fixedBg.style.background = bodyBg;
		if (fixedSecBg) {
			if (hasSecBg) {
				fixedSecBg.style.display = 'block';
				fixedSecBg.style.background = secBg;
			} else {
				fixedSecBg.style.display = 'none';
				fixedSecBg.style.background = 'none';
			}
		}
		if (shellEl && shellBackdrop) {
			if (hasShellVisual) {
				shellEl.style.position = 'relative';
				shellBackdrop.style.display = 'block';
				shellBackdrop.style.background = shellBg;
				shellBackdrop.style.border = shellBorder;
				shellBackdrop.style.borderRadius = shellRadius;
				shellBackdrop.style.boxShadow = shellShadow;
			} else {
				shellBackdrop.style.display = 'none';
			}
		}
	}

	var blockSelectors = [
		'.favorites-hero',
		'.favorites-toolbar',
		'.favorites-index',
		'.favorite-card',
		'.favorites-image-credits',
		'.site-footer'
	];
	var blocks = Array.prototype.slice.call(
		document.querySelectorAll(blockSelectors.join(','))
	);
	var boxes = [];
	var boxesById = {};
	var shellTop = 0;
	var shellHeight = 0;
	var shellBackdropHeight = 0;
	var isPrewarming = false;
	var prewarmToken = 0;
	var prewarmTimer = null;

	function measureBoxes() {
		var sy = window.scrollY || 0;
		for (var i = 0; i < blocks.length; i++) {
			blocks[i].style.setProperty('transform', 'translate3d(0px, 0px, 0px)', 'important');
			if (blocks[i].style.opacity) {
				blocks[i].style.opacity = '';
			}
			if (blocks[i].style.pointerEvents) {
				blocks[i].style.pointerEvents = '';
			}
		}
		if (shellEl) {
			var sr = shellEl.getBoundingClientRect();
			shellTop = sr.top + sy;
			shellHeight = sr.height;
		}
		if (shellBackdrop && shellBackdrop.style.display !== 'none') {
			shellBackdrop.style.transform = 'translate3d(0px, 0px, 0px)';
			shellBackdropHeight = shellBackdrop.getBoundingClientRect().height;
		} else {
			shellBackdropHeight = 0;
		}
		boxes = [];
		boxesById = {};
		for (var j = 0; j < blocks.length; j++) {
			var el = blocks[j];
			var r = el.getBoundingClientRect();
			var entry = {
				el: el,
				top: r.top + sy,
				height: r.height,
				last: 'translate3d(0px, 0px, 0px)'
			};
			boxes.push(entry);
			if (el.id) {
				boxesById[el.id] = entry;
			}
		}
	}

	function updatePositions() {
		if (isPrewarming) {
			return;
		}
		var sy = window.scrollY || 0;
		var vh = window.innerHeight || 900;

		if (shellBackdrop && shellBackdropHeight > 0 && shellHeight > shellBackdropHeight) {
			var maxShift = Math.max(0, shellHeight - shellBackdropHeight);
			var desiredShift = sy - shellTop - Math.max(0, (shellBackdropHeight - vh) * 0.5);
			var shift = Math.round(Math.max(0, Math.min(maxShift, desiredShift)));
			shellBackdrop.style.transform = 'translate3d(0px, ' + shift + 'px, 0px)';
		}

		for (var i = 0; i < boxes.length; i++) {
			var b = boxes[i];
			var natTop = b.top - sy;
			var natBottom = natTop + b.height;
			var dy = 0;
			if (natTop > vh + PARK_MARGIN) {
				dy = vh + PARK_MARGIN - natTop;
			} else if (natBottom < -PARK_MARGIN) {
				dy = -PARK_MARGIN - natBottom;
			}
			var next =
				dy === 0
					? 'translate3d(0px, 0px, 0px)'
					: 'translate3d(0px, ' + Math.round(dy) + 'px, 0px)';
			if (b.last !== next) {
				b.el.style.setProperty('transform', next, 'important');
				b.last = next;
			}
			var nextPE = dy === 0 ? '' : 'none';
			if (b.el.style.pointerEvents !== nextPE) {
				b.el.style.pointerEvents = nextPE;
			}
			if (b.el.style.opacity) {
				b.el.style.opacity = '';
			}
		}
	}

	var backToTop = document.querySelector('.favorites-back-to-top');
	var isBackToTopHidden = backToTop ? backToTop.hidden : true;

	function updateBackToTop() {
		if (!backToTop) {
			return;
		}
		var nextHidden = window.scrollY < Math.max(360, window.innerHeight * 0.5);
		if (nextHidden !== isBackToTopHidden) {
			isBackToTopHidden = nextHidden;
			backToTop.hidden = nextHidden;
		}
	}

	function onScroll() {
		updatePositions();
		updateBackToTop();
	}

	function cancelPrewarm() {
		prewarmToken += 1;
		if (prewarmTimer) {
			window.clearTimeout(prewarmTimer);
			prewarmTimer = null;
		}
		if (isPrewarming) {
			isPrewarming = false;
			updatePositions();
		}
	}

	function prewarmAllBlocks() {
		cancelPrewarm();
		syncFavoritesBackdrops();
		measureBoxes();
		updatePositions();

		var token = ++prewarmToken;
		isPrewarming = true;
		var sy = window.scrollY || 0;
		var vh = window.innerHeight || 900;

		for (var i = 0; i < boxes.length; i++) {
			var b = boxes[i];
			var natTop = b.top - sy;
			if (natTop + b.height > vh || natTop < 0) {
				b.el.style.opacity = '0.001';
				b.el.style.pointerEvents = 'none';
				b.el.style.setProperty(
					'transform',
					'translate3d(0px, ' + Math.round(40 - natTop) + 'px, 0px)',
					'important'
				);
				b.last = '';
			}
		}

		var framesRemaining = 4;
		function stepPrewarm() {
			if (token !== prewarmToken) {
				return;
			}
			framesRemaining -= 1;
			if (framesRemaining > 0) {
				window.requestAnimationFrame(stepPrewarm);
				return;
			}
			isPrewarming = false;
			updatePositions();
		}

		window.requestAnimationFrame(stepPrewarm);
	}

	function schedulePrewarm(delayMs) {
		cancelPrewarm();
		syncFavoritesBackdrops();
		measureBoxes();
		updatePositions();
		prewarmTimer = window.setTimeout(
			function() {
				prewarmTimer = null;
				decodeAllFavoriteImages().then(function() {
					prewarmAllBlocks();
				});
			},
			typeof delayMs === 'number' ? delayMs : 60
		);
	}

	function initAndPrewarm(delayMs) {
		syncFavoritesBackdrops();
		measureBoxes();
		updatePositions();
		updateBackToTop();
		schedulePrewarm(delayMs);
	}

	updateBackToTop();

	window.addEventListener('scroll', onScroll, { passive: true });
	window.addEventListener('resize', function() {
		if (!fixedBg) {
			return;
		}
		syncFavoritesBackdrops();
		measureBoxes();
		updatePositions();
		updateBackToTop();
	});

	// Intercept internal #hash jumps so parked blocks resolve to their exact
	// natural document coordinates.
	document.addEventListener('click', function(event) {
		if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
			return;
		}
		var link = event.target && event.target.closest ? event.target.closest('a[href^="#"]') : null;
		if (!link) {
			return;
		}
		var hash = link.getAttribute('href');
		if (!hash || hash === '#') {
			return;
		}
		var targetId = hash.slice(1);
		var targetEl = document.getElementById(targetId);
		if (!targetEl) {
			return;
		}
		event.preventDefault();
		cancelPrewarm();

		var targetY = 0;
		if (targetId !== 'page-top') {
			var box = boxesById[targetId];
			var naturalTop = box ? box.top : targetEl.getBoundingClientRect().top + (window.scrollY || 0);
			var scrollMargin = parseFloat(window.getComputedStyle(targetEl).scrollMarginTop) || 88;
			var maxScroll = Math.max(
				0,
				document.documentElement.scrollHeight - (window.innerHeight || 900)
			);
			targetY = Math.max(0, Math.min(maxScroll, Math.round(naturalTop - scrollMargin)));
		}

		if (window.history && typeof window.history.pushState === 'function') {
			window.history.pushState(null, '', hash);
		} else {
			window.location.hash = hash;
		}
		window.scrollTo(0, targetY);
		updatePositions();
		updateBackToTop();
	});

	for (var j = 0; j < viewButtons.length; j++) {
		viewButtons[j].addEventListener('click', function(event) {
			var target = event.currentTarget;
			var choice = target.getAttribute('data-favorites-view-choice');
			applyFavoritesView(choice, true);
			schedulePrewarm(40);
		});
	}

	if (document.readyState === 'complete') {
		initAndPrewarm(40);
	} else {
		window.addEventListener(
			'load',
			function() {
				initAndPrewarm(40);
			},
			{ once: true }
		);
	}

	document.addEventListener('site-skin-change', function() {
		schedulePrewarm(40);
	});
})();
