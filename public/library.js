// Library track filter: one box per track (plus All). Clicking a box shows only that track's
// books in the list below. The choice is kept in the URL (?track=mind) so it can be linked;
// #mind links and the tracks' former ids (?track=judgment) work too. Without JavaScript every
// track is listed.
(function () {
  var boxes = Array.prototype.slice.call(document.querySelectorAll('.filter-box'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('.toc-track'));
  if (!boxes.length) return;
  function show(id, updateUrl) {
    var known = id === 'all' || sections.some(function (s) { return s.id === id; });
    if (!known) id = 'all';
    boxes.forEach(function (b) {
      var on = b.getAttribute('data-track') === id;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    sections.forEach(function (s) { s.hidden = id !== 'all' && s.id !== id; });
    if (updateUrl && window.history && history.replaceState) {
      var url = location.pathname + (id === 'all' ? '' : '?track=' + id);
      history.replaceState(null, '', url);
    }
  }
  boxes.forEach(function (b) {
    b.addEventListener('click', function () { show(b.getAttribute('data-track'), true); });
  });
  // Former track ids, from before the tracks were renamed.
  var renamed = { judgment: 'mind', capital: 'market', power: 'state', character: 'self' };
  var fromQuery = (location.search.match(/[?&]track=([a-z0-9-]+)/) || [])[1];
  var fromHash = location.hash.replace('#', '');
  var id = fromQuery || fromHash || 'all';
  show(renamed[id] || id, renamed[id] !== undefined);
})();
