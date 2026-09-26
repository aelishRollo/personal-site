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

	// Blend only the largest stable regions independently. Nested hero elements
	// and off-screen sections stay in the root snapshot to avoid creating a large
	// stack of compositor surfaces for every theme change.
	if ('startViewTransition' in document) {
		var skinTransitionRegions = [
			{ selector: '.site-header', name: 'skin-header' },
			{ selector: '.page-hero', name: 'skin-hero' },
			{ selector: '.site-footer', name: 'skin-footer' }
		];

		skinTransitionRegions.forEach(function(region) {
			var element = document.querySelector(region.selector);

			if (element) {
				element.style.viewTransitionName = region.name;
			}
		});
	}

	// Runtime skin picker. The head bootstrap owns selection and persistence so
	// the correct skin is already active before this interaction layer loads.
	var skinRuntime = window.SiteSkins;

	if (skinRuntime && skinRuntime.all && skinRuntime.all.length) {
		var skinContactMessages = {
			'portfolio-dark': 'Let\'s build something',
			'portfolio-light': 'Say hello',
			'acid-editorial': 'Start a conversation',
			'op-art-monochrome': 'Step into the idea',
			'neon-glitch': 'Ping me //',
			'liquid-dream': 'Dive into an idea',
			'sacred-geometry': 'Align & connect',
			'terminal-vision': '> OPEN_CHANNEL',
			'ms-dos-prompt': 'RUN CONTACT.EXE',
			'psychedelic-scrapbook': 'HELLO!',
			'cut-and-paste-riot': 'MAKE SOMETHING WEIRD',
			'liquid-chrome-y2k': 'CONNECT.EXE',
			'acid-brutalist': 'TALK TO ME',
			'botanical-dreamscape': 'Grow an idea',
			'cosmic-airbrush': 'Send a signal',
			'riso-hallucination': 'Print something wild',
			'crystal-prism': 'Refract an idea',
			'midnight-aurora-glass': 'Catch the spectrum',
			'recursive-portal': 'Enter the conversation',
			'split-duality': 'Meet in the middle',
			'card-deck-stack': 'Pick a card',
			'type-sculpture': 'Shape an idea',
			'browser-archaeology': "I\u2019VE GOT MAIL!",
			'oracular-tarot': 'Ask the oracle',
			'hello-kitty': 'Say hello!',
			'forties-field-notes': 'Drop me a line',
			'nutrition-facts': 'Contact Alec'
		};
		var randomOption = '<button type="button" class="skin-picker-option skin-picker-option-random" data-skin-random aria-pressed="false">' +
			'<span class="skin-picker-option-mark" aria-hidden="true"></span>' +
			'<span>Random Theme</span>' +
		'</button>';
		var skinOptions = skinRuntime.all.map(function(skin) {
			return '<button type="button" class="skin-picker-option" data-skin-choice="' + skin.id + '" aria-pressed="false">' +
				'<span class="skin-picker-option-mark" aria-hidden="true"></span>' +
				'<span>' + skin.name + '</span>' +
			'</button>';
		}).join('');
		var skinCountLabel = skinRuntime.all.length + ' themes';
		var $skinPicker = $(
			'<aside class="skin-picker" data-skin-ui aria-label="Theme controls">' +
				'<div class="skin-picker-controls">' +
					'<button type="button" class="skin-picker-cycle skin-picker-cycle-previous" data-skin-cycle="-1" aria-label="Previous theme">' +
						'<span aria-hidden="true">&#8249;</span>' +
					'</button>' +
					'<button type="button" class="skin-picker-toggle" aria-expanded="false" aria-controls="skin-picker-panel">' +
						'<span class="skin-picker-toggle-icon" aria-hidden="true">&#10022;</span>' +
						'<span class="skin-picker-toggle-copy">' +
							'<span class="skin-picker-toggle-kicker">' + skinCountLabel + '</span>' +
							'<span class="skin-picker-toggle-label">Change the whole look</span>' +
						'</span>' +
						'<span class="skin-picker-current"></span>' +
						'<span class="skin-picker-chevron" aria-hidden="true"></span>' +
					'</button>' +
					'<button type="button" class="skin-picker-cycle skin-picker-cycle-next" data-skin-cycle="1" aria-label="Next theme">' +
						'<span aria-hidden="true">&#8250;</span>' +
					'</button>' +
				'</div>' +
				'<div class="skin-picker-panel" id="skin-picker-panel" aria-labelledby="skin-picker-heading" hidden>' +
					'<div class="skin-picker-header">' +
						'<div>' +
							'<h2 class="skin-picker-heading" id="skin-picker-heading">Choose a theme</h2>' +
							'<p class="skin-picker-intro">Each time you visit, a random theme from below is displayed. Try some out!</p>' +
						'</div>' +
						'<button type="button" class="skin-picker-close" aria-label="Close theme picker">&times;</button>' +
					'</div>' +
					'<div class="skin-picker-scroll-shell">' +
						'<button type="button" class="skin-picker-scroll-arrow skin-picker-scroll-up" aria-label="Scroll themes up" hidden>&uarr;</button>' +
						'<div class="skin-picker-options" role="group" aria-label="Available themes">' + randomOption + skinOptions + '</div>' +
						'<div class="skin-picker-scrollbar" aria-hidden="true"><span class="skin-picker-scrollbar-thumb"></span></div>' +
						'<button type="button" class="skin-picker-scroll-arrow skin-picker-scroll-down" aria-label="Scroll themes down" hidden>&darr;</button>' +
					'</div>' +
					'<div class="skin-picker-persistence">' +
						'<input type="checkbox" class="skin-picker-keep" id="skin-picker-keep" />' +
						'<label for="skin-picker-keep">Keep using this theme every time you visit the site</label>' +
					'</div>' +
				'</div>' +
				'<p class="skin-picker-status" aria-live="polite"></p>' +
			'</aside>'
		);
		var $skinContactCharm = $('<a class="skin-contact-charm" href="contact.html"><span></span></a>');
		var $skinToggle = $skinPicker.find('.skin-picker-toggle');
		var $skinPanel = $skinPicker.find('.skin-picker-panel');
		var $skinChoices = $skinPicker.find('[data-skin-choice]');
		var $skinRandom = $skinPicker.find('[data-skin-random]');
		var $skinAllChoices = $skinChoices.add($skinRandom);
		var $skinOptions = $skinPicker.find('.skin-picker-options');
		var $skinScrollUp = $skinPicker.find('.skin-picker-scroll-up');
		var $skinScrollDown = $skinPicker.find('.skin-picker-scroll-down');
		var $skinScrollbar = $skinPicker.find('.skin-picker-scrollbar');
		var $skinScrollbarThumb = $skinPicker.find('.skin-picker-scrollbar-thumb');
		var $skinCurrent = $skinPicker.find('.skin-picker-current');
		var $skinCycleButtons = $skinPicker.find('[data-skin-cycle]');
		var $skinKeep = $skinPicker.find('.skin-picker-keep');
		var $skinStatus = $skinPicker.find('.skin-picker-status');
		var skinScrollFrame = null;
		var skinScrollTimestamp = null;
		var supportsPointerEvents = 'PointerEvent' in window;

		function skinName(id) {
			var match = skinRuntime.all.filter(function(skin) {
				return skin.id === id;
			})[0];
			return match ? match.name : id;
		}

		function skinIndex(id) {
			for (var index = 0; index < skinRuntime.all.length; index++) {
				if (skinRuntime.all[index].id === id) {
					return index;
				}
			}

			return 0;
		}

		function syncSkinPicker(announcement) {
			var activeId = skinRuntime.getActiveId();
			var activeName = skinName(activeId);
			var contactMessage = skinContactMessages[activeId] || 'Say hello';
			var isKept = skinRuntime.getPersistedId() === activeId;
			var mode = skinRuntime.getMode ? skinRuntime.getMode() : (isKept ? 'saved' : 'random');
			var modeDescription;

			if (isKept) {
				modeDescription = 'Kept for future visits.';
			} else if (mode === 'preview') {
				modeDescription = 'Preview only — not saved.';
			} else {
				modeDescription = 'Random for this visit.';
			}

			$skinAllChoices.attr('aria-pressed', 'false');
			if (mode === 'random' && !isKept) {
				$skinRandom.attr('aria-pressed', 'true');
			} else {
				$skinChoices.filter('[data-skin-choice="' + activeId + '"]').attr('aria-pressed', 'true');
			}
			$skinCurrent.text(activeName);
			$skinCycleButtons.each(function() {
				var direction = Number($(this).attr('data-skin-cycle'));
				var activeIndex = skinIndex(activeId);
				var nextIndex = (activeIndex + direction + skinRuntime.all.length) % skinRuntime.all.length;
				var directionLabel = direction < 0 ? 'Previous' : 'Next';
				$(this).attr('aria-label', directionLabel + ' theme: ' + skinRuntime.all[nextIndex].name);
			});
			$skinKeep.prop('checked', isKept);
			$skinToggle.attr('aria-label', 'Choose theme. Current theme: ' + activeName + '. ' + modeDescription);
			$skinStatus.text(announcement || activeName + '. ' + modeDescription);
			$skinContactCharm
				.attr('data-skin-contact-for', activeId)
				.attr('aria-label', contactMessage + ' — contact Alec')
				.find('span').text(contactMessage);
		}

		function closeSkinPicker() {
			stopSkinAutoScroll();
			$skinPanel.prop('hidden', true);
			$skinToggle.attr('aria-expanded', 'false');
		}

		function updateSkinScrollbar() {
			var list = $skinOptions[0];

			if (!list || list.scrollHeight <= list.clientHeight + 1) {
				$skinScrollbar.prop('hidden', true);
				return;
			}

			var thumbHeight = Math.max(28, Math.round(list.clientHeight * list.clientHeight / list.scrollHeight));
			var maxThumbTravel = Math.max(0, list.clientHeight - thumbHeight);
			var maxScroll = Math.max(1, list.scrollHeight - list.clientHeight);
			var thumbOffset = Math.round(maxThumbTravel * list.scrollTop / maxScroll);

			$skinScrollbar.prop('hidden', false);
			$skinScrollbarThumb.css({
				height: thumbHeight + 'px',
				transform: 'translateY(' + thumbOffset + 'px)'
			});
		}

		function updateSkinScrollArrows() {
			var list = $skinOptions[0];

			updateSkinScrollbar();

			if (!list || $skinPanel.prop('hidden')) {
				$skinScrollUp.prop('hidden', true);
				$skinScrollDown.prop('hidden', true);
				return;
			}

			var atTop = list.scrollTop <= 1;
			var atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
			var canScroll = list.scrollHeight > list.clientHeight + 1;

			$skinScrollUp.prop('hidden', !canScroll || atTop);
			$skinScrollDown.prop('hidden', !canScroll || atBottom);
		}

		function keepActiveSkinChoiceInView() {
			var list = $skinOptions[0];
			var activeId = skinRuntime.getActiveId();
			var $activeChoice = $skinChoices.filter('[data-skin-choice="' + activeId + '"]');

			if (!list || !$activeChoice.length) {
				return;
			}

			var listRect = list.getBoundingClientRect();
			var choiceRect = $activeChoice[0].getBoundingClientRect();
			var edgePadding = 6;

			if (choiceRect.top < listRect.top + edgePadding) {
				list.scrollTop -= listRect.top + edgePadding - choiceRect.top;
			} else if (choiceRect.bottom > listRect.bottom - edgePadding) {
				list.scrollTop += choiceRect.bottom - listRect.bottom + edgePadding;
			}

			updateSkinScrollArrows();
		}

		function stopSkinAutoScroll() {
			if (skinScrollFrame !== null) {
				window.cancelAnimationFrame(skinScrollFrame);
				skinScrollFrame = null;
			}

			skinScrollTimestamp = null;
		}

		function startSkinAutoScroll(direction) {
			var list = $skinOptions[0];

			if (!list) {
				return;
			}

			stopSkinAutoScroll();

			function step(timestamp) {
				if (skinScrollTimestamp === null) {
					skinScrollTimestamp = timestamp;
				}

				var elapsed = Math.min(timestamp - skinScrollTimestamp, 32);
				skinScrollTimestamp = timestamp;
				list.scrollTop += direction * Math.max(1, elapsed * 0.22);
				updateSkinScrollArrows();

				var atBoundary = direction < 0 ? list.scrollTop <= 1 : list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
				if (!atBoundary) {
					skinScrollFrame = window.requestAnimationFrame(step);
				} else {
					stopSkinAutoScroll();
				}
			}

			skinScrollFrame = window.requestAnimationFrame(step);
		}

		$('.page-hero').first().append($skinContactCharm);
		$('body').append($skinPicker);
		if ('startViewTransition' in document) {
			$skinContactCharm[0].style.viewTransitionName = 'skin-contact-charm';
		}
		syncSkinPicker();

		$skinToggle.on('click', function() {
			var willOpen = !$skinPanel.prop('hidden');
			$skinPanel.prop('hidden', willOpen);
			$skinToggle.attr('aria-expanded', willOpen ? 'false' : 'true');
			if (!willOpen) {
				keepActiveSkinChoiceInView();
				$skinAllChoices.filter('[aria-pressed="true"]').trigger('focus');
				window.requestAnimationFrame(updateSkinScrollArrows);
			} else {
				stopSkinAutoScroll();
			}
		});

		$skinOptions.on('scroll', updateSkinScrollArrows);

		function cycleSkin(direction) {
			var activeId = skinRuntime.getActiveId();
			var activeIndex = skinIndex(activeId);
			var nextIndex = (activeIndex + direction + skinRuntime.all.length) % skinRuntime.all.length;
			var nextSkin = skinRuntime.all[nextIndex];

			skinRuntime.preview(nextSkin.id);
			syncSkinPicker('Previewing ' + nextSkin.name + '.');
			keepActiveSkinChoiceInView();
		}

		$skinCycleButtons.on('pointerdown', function(event) {
			var pointerEvent = event.originalEvent || event;

			if (!supportsPointerEvents || pointerEvent.isPrimary === false || (pointerEvent.pointerType === 'mouse' && pointerEvent.button !== 0)) {
				return;
			}

			cycleSkin(Number($(this).attr('data-skin-cycle')));
		}).on('click', function(event) {
			var clickEvent = event.originalEvent || event;

			// Pointer input is handled on pointerdown so a transition cannot cancel
			// the synthesized click. Keep click for keyboard and assistive input.
			if (supportsPointerEvents && clickEvent.detail !== 0) {
				event.preventDefault();
				return;
			}

			cycleSkin(Number($(this).attr('data-skin-cycle')));
		});

		$skinScrollUp.on('mouseenter', function() {
			startSkinAutoScroll(-1);
		}).on('mouseleave blur', stopSkinAutoScroll).on('click', function() {
			$skinOptions[0].scrollTop -= $skinOptions[0].clientHeight * 0.75;
			updateSkinScrollArrows();
		});

		$skinScrollDown.on('mouseenter', function() {
			startSkinAutoScroll(1);
		}).on('mouseleave blur', stopSkinAutoScroll).on('click', function() {
			$skinOptions[0].scrollTop += $skinOptions[0].clientHeight * 0.75;
			updateSkinScrollArrows();
		});

		$(window).on('resize', updateSkinScrollArrows);

		$skinChoices.on('click', function() {
			skinRuntime.preview($(this).attr('data-skin-choice'));
			syncSkinPicker('Previewing ' + skinName(skinRuntime.getActiveId()) + '.');
		});

		$skinRandom.on('click', function() {
			skinRuntime.useRandomDefault();
			syncSkinPicker('Random Theme selected. ' + skinName(skinRuntime.getActiveId()) + ' is displayed for this visit.');
		});

		$skinKeep.on('change', function() {
			if (this.checked) {
				skinRuntime.save(skinRuntime.getActiveId());
				syncSkinPicker(skinName(skinRuntime.getActiveId()) + ' will be used on future visits.');
			} else {
				skinRuntime.clearSaved();
				syncSkinPicker('Random themes restored. ' + skinName(skinRuntime.getActiveId()) + ' is displayed for this visit.');
			}
		});

		$skinPicker.find('.skin-picker-close').on('click', function() {
			closeSkinPicker();
			$skinToggle.trigger('focus');
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
