const menuToggle = document.querySelector(".menu-toggle");
const mobileMenu = document.getElementById("mobile-menu");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (menuToggle && mobileMenu) {
  menuToggle.addEventListener("click", () => {
    const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isExpanded));
    menuToggle.setAttribute("aria-label", isExpanded ? "Abrir menu" : "Fechar menu");
    mobileMenu.hidden = isExpanded;
    if (!isExpanded && !reducedMotion.matches) {
      mobileMenu.querySelectorAll(".mobile-nav > a, .mobile-actions").forEach((item, index) => {
        item.animate(
          [{ opacity: 0, transform: "translateY(-8px)" }, { opacity: 1, transform: "translateY(0)" }],
          { duration: 240, delay: index * 35, easing: "cubic-bezier(.16,1,.3,1)", fill: "backwards" }
        );
      });
    }
  });

  mobileMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Abrir menu");
      mobileMenu.hidden = true;
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !mobileMenu.hidden) {
      mobileMenu.hidden = true;
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Abrir menu");
      menuToggle.focus();
    }
  });
  window.matchMedia("(min-width: 961px)").addEventListener("change", (event) => {
    if (event.matches) {
      mobileMenu.hidden = true;
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Abrir menu");
    }
  });
}

// Reveal individual cards and footer columns in a short, ordered sequence.
document.querySelectorAll(".plans-grid, .footer-grid").forEach((group) => {
  group.classList.remove("reveal");
  Array.from(group.children).forEach((item, index) => {
    item.classList.add("reveal");
    item.style.setProperty("--reveal-delay", `${index * 65}ms`);
  });
});
document.querySelector(".footer-araucarias")?.classList.add("reveal");

const reveals = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window && reveals.length > 0 && !reducedMotion.matches) {
  document.documentElement.classList.add("motion-ready");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08 }
  );

  reveals.forEach((el) => observer.observe(el));
} else {
  reveals.forEach((el) => el.classList.add("is-visible"));
}

reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) {
    document.documentElement.classList.remove("motion-ready");
    document.getAnimations().forEach((animation) => animation.cancel());
  }
});

// Formulário de agendamento
const bookingForm = document.getElementById("booking-form");
const bookingFeedback = document.getElementById("booking-feedback");

if (bookingForm && bookingFeedback) {
  const phoneInput = document.getElementById("booking-phone");
  const nameInput = document.getElementById("booking-name");
  const planSelect = document.getElementById("booking-plan");
  document.querySelectorAll('a[href="#agendar"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (link.dataset.plan) planSelect.value = link.dataset.plan;
      else if (link.classList.contains("trial-cta") || link.classList.contains("about-link")) planSelect.value = "Aula Experimental Gratuita";
      history.replaceState(null, "", "#agendar");
      document.getElementById("agendar").scrollIntoView({behavior: reducedMotion.matches ? "auto" : "smooth", block: "start"});
      nameInput.focus({preventScroll: true});
    });
  });
  bookingForm.addEventListener("input", () => {
    phoneInput.setCustomValidity("");
    nameInput.setCustomValidity("");
    bookingFeedback.hidden = true;
    bookingFeedback.replaceChildren();
  });
  document.querySelectorAll("[data-plan]").forEach((link) => {
    link.addEventListener("click", () => {
      planSelect.value = link.dataset.plan;
      bookingFeedback.hidden = true;
      bookingFeedback.replaceChildren();
    });
  });
  bookingForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    const plan = planSelect.value;
    let phone = phoneInput.value.replace(/\D/g, "");
    if (phone.startsWith("55") && phone.length > 11) phone = phone.slice(2);
    if (name.length < 2) {
      nameInput.setCustomValidity("Informe seu nome para continuar.");
      nameInput.reportValidity();
      return;
    }
    if (!/^[1-9]{2}[2-9]\d{7,8}$/.test(phone)) {
      phoneInput.setCustomValidity("Informe um telefone válido com DDD.");
      phoneInput.reportValidity();
      return;
    }
    const message = `Olá, equipe Spartans! Meu nome é ${name}. Tenho interesse em: ${plan}. Meu WhatsApp é ${phoneInput.value.trim()}. Gostaria de saber mais sobre a academia e os planos.`;
    const contactLink = document.createElement("a");
    contactLink.href = `https://wa.me/5541999501754?text=${encodeURIComponent(message)}`;
    contactLink.target = "_blank";
    contactLink.rel = "noopener noreferrer";
    contactLink.textContent = "Revisar e enviar no WhatsApp ↗";
    bookingFeedback.replaceChildren(document.createTextNode("Mensagem preparada. Abra o WhatsApp para revisar e enviar."), document.createElement("br"), contactLink);
    bookingFeedback.hidden = false;
  });
}

// Carrossel centralizado infinito (Coverflow)
const slides = Array.from(document.querySelectorAll(".coverflow-slide"));
const dots = Array.from(document.querySelectorAll("#carousel-dots .dot"));
const prevBtn = document.getElementById("carousel-prev");
const nextBtn = document.getElementById("carousel-next");
const carouselTitle = document.getElementById("carousel-title");
const carouselDesc = document.getElementById("carousel-desc");
const carouselStage = document.querySelector(".coverflow-stage");

const slideInfo = [
  {
    title: "Amplo Espaço de Musculação",
    desc: "Equipamentos modernos e variados para diferentes grupos musculares, preparados para hipertrofia, força e qualidade de vida.",
  },
  {
    title: "Área de Cardio Completa",
    desc: "Esteiras convencionais, esteiras inclinadas, bicicletas de spinning e escada ergométrica para aquecimento e emagrecimento.",
  },
  {
    title: "Polias Multifuncionais & Pesos Livres",
    desc: "Polias multifuncionais, bancos, barras e aparelhos específicos para evoluir com segurança e precisão.",
  },
  {
    title: "Ambiente Organizado & Professores",
    desc: "Espaço amplo, iluminado e professores disponíveis durante todo o horário de funcionamento para orientar seu treino.",
  },
];

if (slides.length > 0) {
  let current = 0;
  const total = slides.length;

  const renderCarousel = (index) => {
    const previous = current;
    current = (index + total) % total;
    const prevIndex = (current - 1 + total) % total;
    const nextIndex = (current + 1) % total;

    slides.forEach((slide, i) => {
      slide.setAttribute("aria-hidden", String(i !== current));
      slide.classList.remove("is-active", "is-prev", "is-next");
      if (i === current) slide.classList.add("is-active");
      else if (i === prevIndex) slide.classList.add("is-prev");
      else if (i === nextIndex) slide.classList.add("is-next");
    });

    dots.forEach((dot, i) => {
      dot.classList.toggle("is-active", i === current);
      if (i === current) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });

    if (carouselTitle && carouselDesc && slideInfo[current]) {
      carouselTitle.textContent = slideInfo[current].title;
      carouselDesc.textContent = slideInfo[current].desc;
      if (current !== previous && !reducedMotion.matches) {
        [carouselTitle, carouselDesc].forEach((element, i) => {
          element.getAnimations().forEach((animation) => animation.cancel());
          element.animate(
            [{ opacity: 0, transform: "translateY(7px)" }, { opacity: 1, transform: "translateY(0)" }],
            { duration: 260, delay: i * 35, easing: "cubic-bezier(.16,1,.3,1)", fill: "backwards" }
          );
        });
      }
    }
  };

  if (prevBtn) prevBtn.addEventListener("click", () => renderCarousel(current - 1));
  if (nextBtn) nextBtn.addEventListener("click", () => renderCarousel(current + 1));
  document.querySelector("#space-carousel")?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      renderCarousel(current + (event.key === "ArrowRight" ? 1 : -1));
    }
  });

  slides.forEach((slide, i) => {
    slide.addEventListener("click", () => {
      if (slide.classList.contains("is-prev")) renderCarousel(current - 1);
      else if (slide.classList.contains("is-next")) renderCarousel(current + 1);
    });
  });

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      renderCarousel(Number(dot.dataset.index));
    });
  });

  // Suporte a swipe no mobile
  if (carouselStage) {
    let touchStartX = 0;
    carouselStage.addEventListener(
      "touchstart",
      (e) => {
        touchStartX = e.changedTouches[0].screenX;
      },
      { passive: true }
    );
    carouselStage.addEventListener("touchend", (e) => {
      const diff = e.changedTouches[0].screenX - touchStartX;
      if (diff > 40) renderCarousel(current - 1);
      else if (diff < -40) renderCarousel(current + 1);
    });
  }

  renderCarousel(0);
}

// Modal de equipamentos e estrutura
const equipmentModal = document.getElementById("equipment-modal");
const openEquipmentBtn = document.getElementById("open-equipment-modal");
const closeEquipmentBtn = document.getElementById("close-equipment-modal");

if (equipmentModal && openEquipmentBtn) {
  openEquipmentBtn.addEventListener("click", () => {
    if (typeof equipmentModal.showModal === "function") {
      equipmentModal.showModal();
    } else {
      equipmentModal.setAttribute("open", "");
    }
  });

  if (closeEquipmentBtn) {
    closeEquipmentBtn.addEventListener("click", () => {
      if (typeof equipmentModal.close === "function") equipmentModal.close();
      else equipmentModal.removeAttribute("open");
    });
  }

  equipmentModal.addEventListener("click", (event) => {
    if (event.target === equipmentModal) {
      if (typeof equipmentModal.close === "function") equipmentModal.close();
      else equipmentModal.removeAttribute("open");
    }
  });
}
