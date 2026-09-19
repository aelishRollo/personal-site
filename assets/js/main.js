/*
	Portfolio navigation/runtime behavior
*/

(function($) {

	var $window = $(window);
	var $body = $('body');

	// Play initial animations on page load.
	$window.on('load', function() {
		window.setTimeout(function() {
			$body.removeClass('is-preload');
		}, 100);
	});

	// Polyfill: object-fit.
	if (!browser.canUse('object-fit')) {
		$('.image[data-position]').each(function() {
			var $this = $(this);
			var $img = $this.children('img');

			$this
				.css('background-image', 'url("' + $img.attr('src') + '")')
				.css('background-position', $this.data('position'))
				.css('background-size', 'cover')
				.css('background-repeat', 'no-repeat');

			$img.css('opacity', '0');
		});
	}

	// Ensure one current-page marker for nav accessibility.
	var path = window.location.pathname.split('/').pop() || 'index.html';
	var $navLinks = $('#site-nav a').not('.nav-cta');

	$navLinks.each(function() {
		var $link = $(this);
		var href = $link.attr('href');

		if (href === path) {
			$link.attr('aria-current', 'page');
		}
	});

	// Runtime skin picker. The head bootstrap owns selection and persistence so
	// the correct skin is already active before this interaction layer loads.
	var skinRuntime = window.SiteSkins;

	if (skinRuntime && skinRuntime.all && skinRuntime.all.length) {
		var skinOptions = skinRuntime.all.map(function(skin) {
			return '<option value="' + skin.id + '">' + skin.name + '</option>';
		}).join('');
		var $skinPicker = $(
			'<aside class="skin-picker" data-skin-ui aria-label="Visual skin controls">' +
				'<button type="button" class="skin-picker-toggle" aria-expanded="false" aria-controls="skin-picker-panel">' +
					'<span>Skin</span><span class="skin-picker-current"></span>' +
				'</button>' +
				'<div class="skin-picker-panel" id="skin-picker-panel" role="dialog" aria-label="Choose a visual skin" hidden>' +
					'<h2 class="skin-picker-heading">Change the site skin</h2>' +
					'<p class="skin-picker-status" aria-live="polite"></p>' +
					'<label for="site-skin-choice">Preview a skin</label>' +
					'<select id="site-skin-choice">' + skinOptions + '</select>' +
					'<div class="skin-picker-actions">' +
						'<button type="button" class="skin-picker-surprise">Surprise me</button>' +
						'<button type="button" class="skin-picker-save">Keep this skin</button>' +
						'<button type="button" class="skin-picker-random-default">Use surprises by default</button>' +
					'</div>' +
				'</div>' +
			'</aside>'
		);
		var $skinToggle = $skinPicker.find('.skin-picker-toggle');
		var $skinPanel = $skinPicker.find('.skin-picker-panel');
		var $skinChoice = $skinPicker.find('select');
		var $skinCurrent = $skinPicker.find('.skin-picker-current');
		var $skinStatus = $skinPicker.find('.skin-picker-status');

		function skinName(id) {
			var match = skinRuntime.all.filter(function(skin) {
				return skin.id === id;
			})[0];
			return match ? match.name : id;
		}

		function syncSkinPicker() {
			var activeId = skinRuntime.getActiveId();
			var persistedId = skinRuntime.getPersistedId();
			var mode = document.documentElement.getAttribute('data-skin-mode');
			var status = 'Random for this browsing session.';

			$skinChoice.val(activeId);
			$skinCurrent.text(skinName(activeId));

			if (mode === 'saved') {
				status = 'Saved for future visits.';
			} else if (mode === 'preview') {
				status = persistedId ?
					'Preview only. Your saved skin is ' + skinName(persistedId) + '.' :
					'Previewing for this session; not saved.';
			}

			$skinStatus.text(skinName(activeId) + ' — ' + status);
		}

		function closeSkinPicker() {
			$skinPanel.prop('hidden', true);
			$skinToggle.attr('aria-expanded', 'false');
		}

		$('body').append($skinPicker);
		syncSkinPicker();

		$skinToggle.on('click', function() {
			var willOpen = !$skinPanel.prop('hidden');
			$skinPanel.prop('hidden', willOpen);
			$skinToggle.attr('aria-expanded', willOpen ? 'false' : 'true');
			if (!willOpen) {
				$skinChoice.trigger('focus');
			}
		});

		$skinChoice.on('change', function() {
			skinRuntime.preview(this.value);
			syncSkinPicker();
		});

		$skinPicker.find('.skin-picker-surprise').on('click', function() {
			skinRuntime.surprise();
			syncSkinPicker();
		});

		$skinPicker.find('.skin-picker-save').on('click', function() {
			skinRuntime.save(skinRuntime.getActiveId());
			syncSkinPicker();
		});

		$skinPicker.find('.skin-picker-random-default').on('click', function() {
			skinRuntime.useRandomDefault();
			syncSkinPicker();
		});

		$(document).on('keydown', function(event) {
			if (event.key === 'Escape' && !$skinPanel.prop('hidden')) {
				closeSkinPicker();
				$skinToggle.trigger('focus');
			}
		});

		$(document).on('click', function(event) {
			if (!$skinPanel.prop('hidden') && !$.contains($skinPicker[0], event.target)) {
				closeSkinPicker();
			}
		});
	}

	// Home splash text: load one adapted quote and allow quick dismissal.
	var isHome = $body.hasClass('page-home');
	var splash = document.getElementById('hero-splash');
	var splashText = document.getElementById('hero-splash-text');
	var splashFitRaf = null;

	function pickRandom(items) {
		return items[Math.floor(Math.random() * items.length)];
	}

	function fitSplashText() {
		if (!splash || !splashText || splash.hidden) {
			return;
		}

		var low = 9;
		var high = 34;
		var best = low;
		var steps = 0;

		splashText.style.fontSize = low + 'px';

		while (low <= high && steps < 16) {
			var mid = Math.floor((low + high) / 2);
			splashText.style.fontSize = mid + 'px';

			var fitsWidth = splashText.scrollWidth <= splashText.clientWidth;
			var fitsHeight = splashText.scrollHeight <= splashText.clientHeight;

			if (fitsWidth && fitsHeight) {
				best = mid;
				low = mid + 1;
			} else {
				high = mid - 1;
			}

			steps++;
		}

		splashText.style.fontSize = best + 'px';
	}

	function scheduleSplashFit() {
		if (!splash || !splashText) {
			return;
		}

		if (splashFitRaf !== null) {
			window.cancelAnimationFrame(splashFitRaf);
		}

		splashFitRaf = window.requestAnimationFrame(function() {
			splashFitRaf = null;
			fitSplashText();
		});
	}

	function reloadPage() {
		window.location.reload();
	}

	function reloadPageFromKey(event) {
		if (event.key !== 'Enter' && event.key !== ' ') {
			return;
		}

		event.preventDefault();
		reloadPage();
	}

	function makeReloadTrigger(element, label) {
		if (!element) {
			return;
		}

		element.classList.add('hero-reload-trigger');
		element.setAttribute('role', 'button');
		element.setAttribute('tabindex', '0');
		element.setAttribute('aria-label', label);

		element.addEventListener('click', reloadPage);
		element.addEventListener('keydown', reloadPageFromKey);
	}

	if (isHome) {
		makeReloadTrigger(document.getElementById('hero-silly-title'), 'Reload for another silly hero title');
	}

	if (isHome && splash && splashText) {
		makeReloadTrigger(splashText, 'Reload for another splash quote');
		splash.hidden = false;
		scheduleSplashFit();

		fetch('assets/data/alec-splash-quotes.json')
			.then(function(response) {
				if (!response.ok) {
					throw new Error('Failed to load splash quotes.');
				}
				return response.json();
			})
			.then(function(data) {
				var quotes = data && Array.isArray(data.quotes) ? data.quotes : [];
				if (!quotes.length) {
					return;
				}

				splashText.textContent = pickRandom(quotes);
				splash.hidden = false;
				scheduleSplashFit();
			})
			.catch(function() {
				scheduleSplashFit();
			});

		window.addEventListener('resize', scheduleSplashFit);

		if (typeof ResizeObserver === 'function') {
			var splashObserver = new ResizeObserver(function() {
				scheduleSplashFit();
			});

			splashObserver.observe(splash);
			splashObserver.observe(splashText);
		}

		$(splash).find('.hero-splash-close').on('click', function() {
			splash.hidden = true;
		});
	}

	// Mobile nav toggle.
	var $toggle = $('.nav-toggle');
	var $nav = $('#site-nav');

	$toggle.on('click', function() {
		var isOpen = $body.hasClass('nav-open');
		$body.toggleClass('nav-open', !isOpen);
		$toggle.attr('aria-expanded', (!isOpen).toString());
	});

	// Close menu when user selects a destination.
	$nav.find('a').on('click', function() {
		$body.removeClass('nav-open');
		$toggle.attr('aria-expanded', 'false');
	});

})(jQuery);
