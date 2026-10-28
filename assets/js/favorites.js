(function() {
	var backToTop = document.querySelector('.favorites-back-to-top');

	if (!backToTop) {
		return;
	}

	function updateBackToTop() {
		backToTop.hidden = window.scrollY < Math.max(360, window.innerHeight * 0.5);
	}

	window.addEventListener('scroll', updateBackToTop, { passive: true });
	window.addEventListener('resize', updateBackToTop);
	updateBackToTop();
})();
