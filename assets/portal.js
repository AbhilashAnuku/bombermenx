/* Portal page progressive enhancement — subtle reveal-on-scroll for cards.
   The viewer pages override the data-reveal opacity via viewer.css so docs
   are never hidden when they fail to come into view (e.g., short pages). */

(function () {
  "use strict";
  var cards = document.querySelectorAll("[data-reveal]");
  if (!("IntersectionObserver" in window) || !cards.length) {
    cards.forEach(function (c) { c.style.opacity = 1; c.style.transform = "none"; });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.style.opacity = 1;
        e.target.style.transform = "translateY(0)";
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.08 });
  cards.forEach(function (c) {
    c.style.opacity = 0;
    c.style.transform = "translateY(12px)";
    c.style.transition = "opacity .5s ease, transform .5s ease";
    io.observe(c);
  });
})();
