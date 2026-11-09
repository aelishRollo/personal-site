(function() {
	// Render favorite card images into persistent GPU-backed <canvas> textures
	// (cc::TextureLayerImpl) so Chromium's GpuImageDecodeCache never evicts
	// off-screen card bitmaps when scrolling up and down.
	var favoriteMediaItems = Array.prototype.slice.call(document.querySelectorAll('.favorite-media'));

	function renderFavoriteMediaCanvas(media) {
		var img = media.querySelector('img');
		if (!img || !img.complete || !img.naturalWidth || !img.naturalHeight) {
			return;
		}
		var rect = media.getBoundingClientRect();
		var cw = Math.round(rect.width);
		var ch = Math.round(rect.height);
		if (cw <= 0 || ch <= 0) {
			return;
		}
		var dpr = Math.min(window.devicePixelRatio || 1, 2);
		var targetW = Math.round(cw * dpr);
		var targetH = Math.round(ch * dpr);
		var canvas = media.querySelector('canvas.favorite-media-canvas');
		if (!canvas) {
			canvas = document.createElement('canvas');
			canvas.className = 'favorite-media-canvas';
			canvas.setAttribute('aria-hidden', 'true');
			media.appendChild(canvas);
		}
		if (canvas.width === targetW && canvas.height === targetH && img.style.opacity === '0') {
			return;
		}
		canvas.width = targetW;
		canvas.height = targetH;
		var ctx = canvas.getContext('2d');
		if (!ctx) {
			return;
		}
		ctx.clearRect(0, 0, targetW, targetH);
		var iw = img.naturalWidth;
		var ih = img.naturalHeight;
		if (media.classList.contains('favorite-media--logo')) {
			var widthRatio = media.classList.contains('favorite-media--fsf') ? 0.8 : 0.65;
			var maxW = targetW * widthRatio;
			var maxH = targetH * 0.78;
			var containScale = Math.min(maxW / iw, maxH / ih);
			var dw = iw * containScale;
			var dh = ih * containScale;
			var dx = (targetW - dw) * 0.5;
			var dy = (targetH - dh) * 0.5;
			ctx.drawImage(img, dx, dy, dw, dh);
		} else {
			var alignY = 0.5;
			if (media.classList.contains('favorite-media--oasis')) {
				alignY = 0.68;
			} else if (media.classList.contains('favorite-media--kitten')) {
				alignY = 0.37;
			}
			var coverScale = Math.max(targetW / iw, targetH / ih);
			var sw = targetW / coverScale;
			var sh = targetH / coverScale;
			var sx = (iw - sw) * 0.5;
			var sy = (ih - sh) * alignY;
			ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
		}
		img.style.opacity = '0';
	}

	function syncAllFavoriteMediaCanvases() {
		for (var i = 0; i < favoriteMediaItems.length; i++) {
			renderFavoriteMediaCanvas(favoriteMediaItems[i]);
		}
	}

	if (favoriteMediaItems.length) {
		favoriteMediaItems.forEach(function(media) {
			var img = media.querySelector('img');
			if (!img) {
				return;
			}
			if (img.complete && img.naturalWidth > 0) {
				renderFavoriteMediaCanvas(media);
			} else {
				img.addEventListener('load', function() {
					renderFavoriteMediaCanvas(media);
				}, { once: true });
			}
		});
		window.addEventListener('load', syncAllFavoriteMediaCanvases, { once: true });
		window.addEventListener('resize', syncAllFavoriteMediaCanvases, { passive: true });
		document.addEventListener('site-skin-change', function() {
			window.requestAnimationFrame(syncAllFavoriteMediaCanvases);
		});
	}

	var backToTop = document.querySelector('.favorites-back-to-top');

	if (!backToTop) {
		return;
	}

	var isHidden = backToTop.hidden;

	function updateBackToTop() {
		var nextHidden = window.scrollY < Math.max(360, window.innerHeight * 0.5);
		if (nextHidden !== isHidden) {
			isHidden = nextHidden;
			backToTop.hidden = nextHidden;
		}
	}

	window.addEventListener('scroll', updateBackToTop, { passive: true });
	window.addEventListener('resize', updateBackToTop);
	updateBackToTop();
})();
