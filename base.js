// ---------- scroll ----------
const fadeElements = document.querySelectorAll('.fade-in');
function checkFade() {
  const triggerBottom = window.innerHeight * 0.8;
  fadeElements.forEach(el => {
    const boxTop = el.getBoundingClientRect().top;
    if (boxTop < triggerBottom) el.classList.add('show');
  });
}
window.addEventListener('scroll', checkFade);
checkFade();

// ---------- CHEKCUP BTNS ----------
document.querySelectorAll('.choice').forEach(btn => {
  btn.addEventListener('click', () => {
    const next = btn.dataset.next;
    if (next === "quiz") {
      alert("Launching Eclipse Mythbuster Quiz!");
    } else {
      window.location.href = next;
    }
  });
});

// ---------- OBJECTIONS BTNS ----------
document.querySelectorAll('.objection').forEach(btn => {
  btn.addEventListener('click', () => {
    const reason = btn.innerText;
    alert(`We hear you: ${reason}. Let's find a solution together!`);
  });
});


// ---------- PROGRESS TRACK ----------
document.addEventListener("DOMContentLoaded", () => {
  const navLinks = document.querySelectorAll(".chevron-nav a");
  const orbitCircles = document.querySelectorAll(".chevron-nav .orbit");
  // Load saved progress
  const progress = JSON.parse(localStorage.getItem("navProgress")) || {
    chapters: [],
    levels: []
  };
  // Apply saved progress
  navLinks.forEach((link, i) => {
    if (progress.chapters.includes(i)) {
      link.classList.add("completed");
    }
  });
  orbitCircles.forEach((circle, i) => {
    if (progress.levels.includes(i)) {
      circle.classList.add("completed");
    }
  });
  // Example: mark current page's chapter as completed
  navLinks.forEach((link, i) => {
    if (link.classList.contains("active")) {
      if (!progress.chapters.includes(i)) {
        progress.chapters.push(i);
      }
    }
  });
  // Save back to localStorage
  localStorage.setItem("navProgress", JSON.stringify(progress));
});