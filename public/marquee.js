// Author strip: hovering an author eases the scroll to a stop instead of halting it at once,
// and it eases back up to speed when the pointer leaves the authors. Only the authors
// themselves count, not the empty space above them. Keyboard focus still pauses via CSS.
(function () {
  var marquee = document.querySelector('.marquee');
  var track = marquee && marquee.querySelector('.marquee-track');
  if (!track || !track.getAnimations) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var anim = track.getAnimations()[0];
  if (!anim) return;
  marquee.classList.add('js-marquee');

  var rate = 1;
  var target = 1;
  var last = null;
  var raf = 0;
  var SLOW_DOWN = 0.35; // seconds to come to a stop
  var SPEED_UP = 0.6;   // seconds to get back to full speed
  function step(now) {
    var dt = last === null ? 0.016 : Math.min((now - last) / 1000, 0.1);
    last = now;
    var span = target < rate ? SLOW_DOWN : SPEED_UP;
    rate += Math.sign(target - rate) * Math.min(Math.abs(target - rate), dt / span);
    anim.playbackRate = rate;
    if (rate !== target) raf = requestAnimationFrame(step);
    else { raf = 0; last = null; }
  }
  function go(to) {
    target = to;
    if (!raf) raf = requestAnimationFrame(step);
  }
  marquee.addEventListener('pointerover', function (e) {
    if (e.target.closest && e.target.closest('.author')) go(0);
  });
  marquee.addEventListener('pointerout', function (e) {
    var to = e.relatedTarget;
    if (!to || !to.closest || !to.closest('.marquee .author')) go(1);
  });
})();
