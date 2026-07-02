/*
	Silly hero title data/rendering.
*/

(function(window) {
	var titles = [
		'Wizard',
		'Warlock',
		'Lisan Al Gaib',
		'Goofy Goober',
		'NASA Board Member',
		"World's Best Scrum Master",
		'Senior FORTRAN Engineer',
		'Tin Foil Hat Craftsman',
		'The Chosen One',
		'Underwater Basket Weaver',
		'Living Legend',
		'Hash Slinging Slasher',
		'Founding Member of The Ramones',
		'Paul McCartney Impersonator',
		'Grill Master',
		'Grilled Cheese Maker',
		'Lives In Your Attic',
		'Traded His House For A Magic Bean',
		'Actually Just Two Children In A Trenchcoat',
		'Nobel Prize Winner',
		'Olympic Pickleball Gold Medalist',
		'Your Best Friend',
		'20th Level Human Paladin',
		'Dungeon Master',
		'Server Admin',
		'D.B. Cooper',
		'Dog Whisperer',
		'Frog Whisperer',
		'Original Nuttah',
		'Rider On The Storm',
		'The 0th Horseman',
		'Member of Your Fraternity',
		'True Believer',
		'Drive-Time DJ',
		'Radio Personality',
		'Last Person To Climb Everest',
		'Oil Painter',
		'Mechsuit Mechanic',
		'Horse Girl',
		'Voice Of A Generation',
		'20th Level Human Wizard',
		'Eucalyptus Scented',
		'New Father',
		'Your Dad',
		'Hardest Working Programmer Alive',
		'Renaissance Man',
		'Pine-Scented',
		'100% Organic'
	];

	function pickRandom(items) {
		var index;

		if (window.crypto && window.crypto.getRandomValues) {
			var randomValues = new Uint32Array(1);
			window.crypto.getRandomValues(randomValues);
			index = randomValues[0] % items.length;
		} else {
			index = Math.floor(Math.random() * items.length);
		}

		return items[index];
	}

	function wordCount(text) {
		return text.trim().split(/\s+/).filter(Boolean).length;
	}

	function escapeHtml(text) {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	var selectedTitle = pickRandom(titles);

	window.renderAlecSillyTitle = function() {
		var title = selectedTitle;
		var classes = 'hero-title-role' + (wordCount(title) > 4 ? ' silly-title-long' : '');

		return '<span class="' + classes + '" id="hero-silly-title">' + escapeHtml(title) + '.</span>';
	};
})(window);
