// Library track filter and search.
// Track boxes filter by track id. Search input filters books by title or author text.
// Both can be active: search narrows the currently selected track (or all).
(function () {
  var boxes = Array.prototype.slice.call(document.querySelectorAll('.filter-box'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('.toc-track'));
  var search = document.getElementById('library-search');
  if (!boxes.length && !search) return;

  var currentTrack = 'all';

  function apply() {
    var q = (search && search.value || '').trim().toLowerCase();
    sections.forEach(function (section) {
      var trackId = section.id;
      var trackVisible = currentTrack === 'all' || trackId === currentTrack;
      var list = section.querySelector('.toc-list');
      var items = list ? Array.prototype.slice.call(list.children) : [];
      var anyMatch = false;
      items.forEach(function (li) {
        var text = (li.textContent || '').toLowerCase();
        var match = !q || text.indexOf(q) !== -1;
        li.hidden = !match;
        if (match) anyMatch = true;
      });
      section.hidden = !trackVisible || (q && !anyMatch);
    });
  }

  function show(id, updateUrl) {
    var known = id === 'all' || sections.some(function (s) { return s.id === id; });
    if (!known) id = 'all';
    currentTrack = id;
    boxes.forEach(function (b) {
      var on = b.getAttribute('data-track') === id;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    apply();
    if (updateUrl && window.history && history.replaceState) {
      var url = location.pathname + (id === 'all' ? '' : '?track=' + id);
      if (search && search.value) url += (id === 'all' ? '?' : '&') + 'q=' + encodeURIComponent(search.value);
      history.replaceState(null, '', url);
    }
  }

  boxes.forEach(function (b) {
    b.addEventListener('click', function () { show(b.getAttribute('data-track'), true); });
  });

  if (search) {
    search.addEventListener('input', function () { apply(); });
    // Restore q from URL if present
    var fromQ = (location.search.match(/[?&]q=([^&]+)/) || [])[1];
    if (fromQ) search.value = decodeURIComponent(fromQ);
  }

  // Former track ids, from before the tracks were renamed.
  var renamed = { judgment: 'mind', capital: 'market', power: 'state', character: 'self' };
  var fromQuery = (location.search.match(/[?&]track=([a-z0-9-]+)/) || [])[1];
  var fromHash = location.hash.replace('#', '');
  var id = fromQuery || fromHash || 'all';
  show(renamed[id] || id, renamed[id] !== undefined);
})();
