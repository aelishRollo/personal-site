/*
	Portfolio navigation/runtime behavior
*/

(function($) {

	var $window = $(window);
	var $body = $('body');
	var themeKey = 'site-theme-v2';

	function applyTheme(theme) {
		document.documentElement.setAttribute('data-theme', theme);
		document.documentElement.style.colorScheme = theme;
	}

	function loadTheme() {
		var stored = localStorage.getItem(themeKey);
		return stored === 'light' || stored === 'dark' ? stored : 'dark';
	}

	function saveTheme(theme) {
		localStorage.setItem(themeKey, theme);
	}

	function nextTheme(current) {
		return current === 'dark' ? 'light' : 'dark';
	}

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

	// Theme toggle button (accessible pressed state).
	var $themeToggle = $(
		'<button type="button" class="theme-fab" aria-pressed="true" aria-label="Switch to light theme">' +
			'<span class="theme-switch-track" aria-hidden="true">' +
				'<span class="theme-switch-icon theme-switch-icon-sun">☀</span>' +
				'<span class="theme-switch-icon theme-switch-icon-moon">🌙</span>' +
				'<span class="theme-switch-thumb"></span>' +
			'</span>' +
			'<span class="sr-only">Toggle theme</span>' +
		'</button>'
	);

	function syncThemeButton(theme) {
		var isDark = theme === 'dark';
		$themeToggle.attr('aria-pressed', isDark ? 'true' : 'false');
		$themeToggle.attr('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
		$themeToggle.attr('data-theme-state', theme);
	}

	$('.site-header').append($themeToggle);

	var currentTheme = loadTheme();
	applyTheme(currentTheme);
	syncThemeButton(currentTheme);

	$themeToggle.on('click', function() {
		currentTheme = nextTheme(currentTheme);
		applyTheme(currentTheme);
		syncThemeButton(currentTheme);
		saveTheme(currentTheme);
	});

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

	if (isHome && splash && splashText) {
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
