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
	var $themeToggle = $('<button type="button" class="theme-fab" aria-pressed="true" aria-label="Switch to light theme"><span class="theme-fab-icon" aria-hidden="true">☀</span><span class="sr-only">Toggle theme</span></button>');

	function syncThemeButton(theme) {
		var isDark = theme === 'dark';
		$themeToggle.attr('aria-pressed', isDark ? 'true' : 'false');
		$themeToggle.attr('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
		$themeToggle.find('.theme-fab-icon').text(isDark ? '☀' : '🌙');
	}

	$body.append($themeToggle);

	var currentTheme = loadTheme();
	applyTheme(currentTheme);
	syncThemeButton(currentTheme);

	$themeToggle.on('click', function() {
		currentTheme = nextTheme(currentTheme);
		applyTheme(currentTheme);
		syncThemeButton(currentTheme);
		saveTheme(currentTheme);
	});

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
