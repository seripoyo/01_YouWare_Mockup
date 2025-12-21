const allCheckbox = document.querySelector('#all'),
      filters = gsap.utils.toArray('.filter'),
      items = gsap.utils.toArray('.item');

function updateFilters() {
  const state = Flip.getState(items), // get the current state
        classes = filters.filter(checkbox => checkbox.checked).map(checkbox => "." + checkbox.id),
        matches = classes.length ? gsap.utils.toArray(classes.join(",")) : classes;

  // adjust the display property of each item ("none" for filtered ones, "inline-flex" for matching ones)
  items.forEach(item => item.style.display = matches.indexOf(item) === -1 ? "none" : "inline-flex");
 
	// animate from the previous state
	Flip.from(state, {
		duration: 0.7,
		scale: true,
		ease: "power1.inOut",
		stagger: 0.08,
    absolute: true,
    onEnter: elements => gsap.fromTo(elements, {opacity: 0, scale: 0}, {opacity: 1, scale: 1, duration: 1}),
    onLeave: elements => gsap.to(elements, {opacity: 0, scale: 0, duration: 1})
	});
  
  // Update the all checkbox:
  allCheckbox.checked = matches.length === items.length; 
}

filters.forEach(btn => btn.addEventListener('click', updateFilters));
allCheckbox.addEventListener('click', () => {
  filters.forEach(checkbox => checkbox.checked = allCheckbox.checked);
  updateFilters();
});
