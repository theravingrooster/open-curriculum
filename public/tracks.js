// Track cards drift slightly with the cursor while it moves over the tracks section, and hold
// still while one card is hovered (that card lifts instead, see .track:hover in styles.css).
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  var MAX = 7; // px, at the edge of the grid
  document.querySelectorAll('.tracks').forEach(function (grid) {
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.track'));
    // Each card drifts by a slightly different amount, so the grid reads as layered.
    var depth = cards.map(function (_, i) { return 0.7 + ((i * 37) % 10) / 20; });
    var hovered = false;
    var queued = false;
    var mx = 0;
    var my = 0;
    // Listen over the whole section (heading and margins too), not just the cards, so the drift
    // is visible as the cursor approaches; it freezes once the cursor settles on a card.
    var area = grid.closest('section') || grid;
    function apply() {
      queued = false;
      cards.forEach(function (card, i) {
        card.style.setProperty('--px', (mx * MAX * depth[i]).toFixed(2) + 'px');
        card.style.setProperty('--py', (my * MAX * depth[i]).toFixed(2) + 'px');
      });
    }
    area.addEventListener('pointermove', function (e) {
      if (hovered) return;
      var r = grid.getBoundingClientRect();
      mx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      my = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
      if (!queued) { queued = true; requestAnimationFrame(apply); }
    });
    area.addEventListener('pointerleave', function () { mx = 0; my = 0; hovered = false; apply(); });
    cards.forEach(function (card) {
      card.addEventListener('pointerenter', function () { hovered = true; });
      card.addEventListener('pointerleave', function () { hovered = false; });
    });
  });
})();
