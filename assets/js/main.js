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
