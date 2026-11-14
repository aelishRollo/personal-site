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

	updateBackToTop();

	window.addEventListener('scroll', updateBackToTop, { passive: true });
	window.addEventListener('resize', updateBackToTop);

	for (var j = 0; j < viewButtons.length; j++) {
		viewButtons[j].addEventListener('click', function(event) {
			var target = event.currentTarget;
			var choice = target.getAttribute('data-favorites-view-choice');
			applyFavoritesView(choice, true);
		});
	}

	if (document.readyState === 'complete') {
		decodeAllFavoriteImages();
	} else {
		window.addEventListener(
			'load',
			function() {
				decodeAllFavoriteImages();
			},
			{ once: true }
		);
	}

	document.addEventListener('site-skin-change', function() {
		decodeAllFavoriteImages();
	});
})();
