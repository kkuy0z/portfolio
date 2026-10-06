const STORAGE_KEY = "eloise-portfolio-v2";
const PORTFOLIO_ROW_ID = 1;
const supabaseConfig = window.PORTFOLIO_CONFIG || {};
const supabaseConfigured = Boolean(supabaseConfig.supabaseUrl && supabaseConfig.supabaseAnonKey);
const supabaseClient = supabaseConfigured && window.supabase?.createClient
  ? window.supabase.createClient(supabaseConfig.supabaseUrl, supabaseConfig.supabaseAnonKey)
  : null;

const initialData = {
  profile: {
    name: "Eloise Arruda Borges",
    pronouns: "Ela/Dela",
    role: "Desenvolvedora Front-end & Designer UI/UX",
    location: "Betim, Minas Gerais, Brasil",
    email: "",
    linkedin: "https://www.linkedin.com/in/eloise-arruda-borges/",
    intro: "Desenvolvedora front-end e estudante de Desenvolvimento de Sistemas com foco em interfaces criativas, experiência do usuário e desenvolvimento web moderno. Tenho experiência com HTML, CSS, JavaScript e MySQL, além de interesse em UI/UX e design digital.",
    experience: "Aluna em tempo integral na E.E. Newton Amaral · fev. 2024 — atual · Betim, MG · Desenvolvimento de front-end",
    skills: "HTML, CSS, JavaScript, MySQL, Python (básico), Desenvolvimento front-end, UI/UX, Ética em Inteligência Artificial, Tecnologia e Sociedade",
    certifications: "Ética na Era da IA — Fundação Bradesco (ago. 2026)\nLinguagem de Programação Python - Básico — Fundação Bradesco (ago. 2026)",
    photo: "assets/eloise-arruda-borges.jpg"
  },
  projects: []
};

let portfolioData = loadData();
let persistedData = structuredClone(portfolioData);
let activeFilter = "Todos";
let toastTimer;
let logoClickCount = 0;
let logoClickTimer;
let revealObserver;
let scrollFrame = 0;
let currentUser = null;

const projectGrid = document.querySelector("#project-grid");
const filters = document.querySelector("#filters");
const editorDialog = document.querySelector("#editor-dialog");
const projectDialog = document.querySelector("#project-dialog");
const projectForm = document.querySelector("#project-form");
const toast = document.querySelector("#toast");

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.profile && Array.isArray(saved.projects)) {
      const profile = { ...initialData.profile, ...saved.profile };
      if (!profile.photo) profile.photo = initialData.profile.photo;
      return { profile, projects: saved.projects };
    }
  } catch (error) {
    console.warn("Não foi possível carregar os dados salvos.", error);
  }
  return structuredClone(initialData);
}

async function saveData() {
  const nextData = structuredClone(portfolioData);
  try {
    if (supabaseConfigured) {
      if (!supabaseClient) throw new Error("O serviço remoto não carregou. Recarregue a página e tente novamente.");
      if (!currentUser) throw new Error("Entre na conta autorizada antes de salvar alterações compartilhadas.");
      const { error } = await supabaseClient
        .from("portfolio_content")
        .upsert({ id: PORTFOLIO_ROW_ID, content: nextData, updated_at: new Date().toISOString() });
      if (error) throw error;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
    persistedData = nextData;
  } catch (error) {
    portfolioData = structuredClone(persistedData);
    applyProfile();
    renderProjects();
    throw error;
  }
}

async function loadRemoteData() {
  if (!supabaseConfigured || !supabaseClient) return false;
  const { data, error } = await supabaseClient
    .from("portfolio_content")
    .select("content")
    .eq("id", PORTFOLIO_ROW_ID)
    .maybeSingle();
  if (error) throw error;
  if (!data?.content?.profile || !Array.isArray(data.content.projects)) return false;
  portfolioData = {
    profile: { ...initialData.profile, ...data.content.profile },
    projects: data.content.projects
  };
  persistedData = structuredClone(portfolioData);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolioData));
  return true;
}

async function initializePortfolio() {
  const storageNote = document.querySelector("#storage-note");
  if (supabaseConfigured) {
    if (supabaseClient) {
      const { data } = await supabaseClient.auth.getSession();
      currentUser = data.session?.user || null;
      supabaseClient.auth.onAuthStateChange((_event, session) => {
        currentUser = session?.user || null;
        if (!currentUser && editorDialog.open) showEditorLogin();
      });
    }
    storageNote.textContent = "Conectando ao conteúdo publicado...";
    try {
      const hasPublishedContent = await loadRemoteData();
      storageNote.textContent = hasPublishedContent
        ? "Conteúdo compartilhado carregado. Ao salvar, suas mudanças serão publicadas para todos."
        : "Supabase conectado. Execute o SQL de inicialização para publicar o conteúdo inicial.";
    } catch (error) {
      console.error("Falha ao carregar o conteúdo compartilhado.", error);
      storageNote.textContent = "Não foi possível sincronizar com a nuvem. Confira a configuração do Supabase.";
    }
  } else {
    storageNote.textContent = "Modo local: configure o Supabase para compartilhar alterações com todos.";
  }
  applyProfile();
  renderProjects();
  updateScrollMotion();
}

function safeText(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function validImage(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function applyProfile() {
  document.querySelectorAll('[data-profile="name"]').forEach((element) => { element.textContent = portfolioData.profile.name; });
  document.querySelectorAll('[data-profile="role"]').forEach((element) => { element.textContent = portfolioData.profile.role; });
  document.querySelectorAll('[data-profile="location"]').forEach((element) => { element.textContent = portfolioData.profile.location; });
  document.querySelectorAll('[data-profile="intro"]').forEach((element) => { element.textContent = portfolioData.profile.intro; });
  document.querySelectorAll('[data-profile="pronouns"]').forEach((element) => { element.textContent = portfolioData.profile.pronouns; });
  document.querySelectorAll('[data-profile="experience"]').forEach((element) => { element.textContent = portfolioData.profile.experience; });
  const profilePhoto = document.querySelector("#profile-photo");
  const portraitWrap = document.querySelector("#portrait-wrap");
  const photoSource = portfolioData.profile.photo?.startsWith("data:image/jpeg") || portfolioData.profile.photo?.startsWith("data:image/png")
    ? portfolioData.profile.photo
    : (() => {
      try {
        const url = new URL(portfolioData.profile.photo, document.baseURI);
        return ["https:", "http:"].includes(url.protocol) || (url.protocol === "file:" && document.location.protocol === "file:") ? url.href : "";
      } catch {
        return "";
      }
    })();
  if (photoSource) {
    profilePhoto.src = photoSource;
    profilePhoto.alt = `Foto de ${portfolioData.profile.name}`;
    profilePhoto.hidden = false;
    portraitWrap.classList.add("has-photo");
  } else {
    profilePhoto.removeAttribute("src");
    profilePhoto.hidden = true;
    portraitWrap.classList.remove("has-photo");
  }
  const skills = String(portfolioData.profile.skills || "").split(/[\n,;]+/).map((skill) => skill.trim()).filter(Boolean);
  document.querySelector("#technology-list").innerHTML = skills.length
    ? skills.map((skill) => `<span class="technology-tag">${safeText(skill)}</span>`).join("")
    : '<span class="technology-empty">Adicione suas competências pelo editor.</span>';
  const certifications = String(portfolioData.profile.certifications || "").split(/[\n;]+/).map((item) => item.trim()).filter(Boolean);
  document.querySelector("#certification-list").innerHTML = certifications.length
    ? certifications.map((item) => `<span class="technology-tag">${safeText(item)}</span>`).join("")
    : '<span class="technology-empty">Certificados serão adicionados aqui.</span>';
  document.querySelectorAll('[data-profile="email"]').forEach((element) => {
    element.textContent = portfolioData.profile.email;
    element.href = `mailto:${portfolioData.profile.email}`;
  });
  document.querySelectorAll('[data-profile="email-link"]').forEach((element) => { element.href = `mailto:${portfolioData.profile.email}`; });
  document.querySelectorAll('[data-profile="linkedin"]').forEach((element) => { element.href = portfolioData.profile.linkedin; });
  document.title = `${portfolioData.profile.name} — ${portfolioData.profile.role}`;
}

function renderProjects() {
  const categories = ["Todos", ...new Set(portfolioData.projects.map((project) => project.category).filter(Boolean))];
  if (!categories.includes(activeFilter)) activeFilter = "Todos";
  filters.innerHTML = categories.map((category) => `<button class="filter-button${activeFilter === category ? " is-active" : ""}" type="button" data-filter="${safeText(category)}" aria-pressed="${activeFilter === category}">${safeText(category)}</button>`).join("");
  const visibleProjects = activeFilter === "Todos" ? portfolioData.projects : portfolioData.projects.filter((project) => project.category === activeFilter);
  projectGrid.innerHTML = visibleProjects.length ? visibleProjects.map((project) => {
    const index = portfolioData.projects.indexOf(project) + 1;
    const image = validImage(project.image);
    return `<article class="project-card" tabindex="0" role="button" data-project="${safeText(project.id)}" aria-label="Ver projeto ${safeText(project.title)}">
      <div class="project-visual tilt-card">${image ? `<img src="${safeText(image)}" alt="Imagem do projeto ${safeText(project.title)}" loading="lazy">` : ""}<span class="project-number">${String(index).padStart(2, "0")} / ${String(portfolioData.projects.length).padStart(2, "0")}</span><span class="project-open" aria-hidden="true"><span class="chrome-arrow arrow-up-right"></span></span></div>
      <div class="project-meta"><div><h3>${safeText(project.title)}</h3><p>${safeText(project.category)}</p></div><span class="project-year">${safeText(project.year)}</span></div>
    </article>`;
  }).join("") : `<p class="empty-projects">Seus projetos autorais aparecerão aqui. Adicione um pelo editor.</p>`;
  document.querySelector("#project-count").textContent = String(portfolioData.projects.length).padStart(2, "0");
  document.querySelector("#editor-project-count").textContent = String(portfolioData.projects.length).padStart(2, "0");
  renderEditorProjects();
  bindTilt();
  setupReveals();
}

function renderEditorProjects() {
  const list = document.querySelector("#editor-project-list");
  if (!portfolioData.projects.length) {
    list.innerHTML = '<p class="storage-note">Ainda não há projetos. Adicione o primeiro.</p>';
    return;
  }
  list.innerHTML = portfolioData.projects.map((project) => `<div class="editor-project-row" data-editor-project="${safeText(project.id)}">
    ${validImage(project.image) ? `<img src="${safeText(validImage(project.image))}" alt="" loading="lazy">` : '<span class="project-thumb-empty"></span>'}
    <div><strong>${safeText(project.title)}</strong><small>${safeText(project.category)} · ${safeText(project.year)}</small></div>
    <div class="row-actions"><button type="button" data-edit-project="${safeText(project.id)}">Editar</button><button type="button" data-delete-project="${safeText(project.id)}">Excluir</button></div>
  </div>`).join("");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2400);
}

function bindTilt() {
  document.querySelectorAll(".tilt-card").forEach((card) => {
    if (card.dataset.tiltBound) return;
    card.dataset.tiltBound = "true";
    card.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      const base = card.id === "id-card" ? -7 : 0;
      card.style.setProperty("--pointer-x", `${(x + 0.5) * 100}%`);
      card.style.setProperty("--pointer-y", `${(y + 0.5) * 100}%`);
      card.style.transform = `rotateX(${-y * 14}deg) rotateY(${x * 17}deg) rotateZ(${base}deg) translateZ(12px)`;
    });
    card.addEventListener("pointerleave", () => {
      card.style.transform = card.id === "id-card" ? "rotate(-7deg)" : "";
      card.style.removeProperty("--pointer-x");
      card.style.removeProperty("--pointer-y");
    });
  });
}

function showEditorLogin(errorMessage = "") {
  document.querySelector("#editor-login").classList.remove("is-hidden");
  document.querySelector("#editor-workspace").classList.add("is-hidden");
  document.querySelector("#sign-out").classList.add("is-hidden");
  document.querySelector("#login-error").textContent = errorMessage;
  document.querySelector("#login-form").elements.password.value = "";
}

function showEditorWorkspace() {
  document.querySelector("#editor-login").classList.add("is-hidden");
  document.querySelector("#editor-workspace").classList.remove("is-hidden");
  document.querySelector("#sign-out").classList.toggle("is-hidden", !supabaseConfigured);
  fillProfileForm();
  renderEditorProjects();
}

async function openEditor() {
  if (editorDialog.open) return;
  if (supabaseConfigured) {
    if (!supabaseClient) {
      editorDialog.showModal();
      showEditorLogin("O Supabase não carregou. Confira sua conexão e recarregue a página.");
      return;
    }
    const { data } = await supabaseClient.auth.getSession();
    currentUser = data.session?.user || null;
  }
  editorDialog.showModal();
  if (supabaseConfigured && !currentUser) showEditorLogin();
  else showEditorWorkspace();
}

function setupReveals() {
  document.querySelectorAll("main > section").forEach((section) => {
    section.classList.add("scroll-scene");
    if (section.id !== "inicio") section.classList.add(`scene-${section.id}`);
  });
  const revealTargets = document.querySelectorAll("main > section, .hero-copy, .id-card, .section-heading, .work-toolbar, .project-card, .about-intro, .about-object-wrap, .data-row, .contact-top, .contact-section h2, .contact-bottom");
  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -35px 0px" });
  }
  revealTargets.forEach((element, index) => {
    if (element.classList.contains("reveal-ready")) return;
    element.classList.add("reveal-ready");
    element.style.setProperty("--reveal-delay", `${Math.min(index % 4, 3) * 75}ms`);
    revealObserver.observe(element);
  });

}

function updateScrollMotion() {
  scrollFrame = 0;
  const scenes = document.querySelectorAll(".scroll-scene");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    scenes.forEach((scene) => scene.style.setProperty("--scroll-shift", "0"));
    return;
  }

  scenes.forEach((scene) => {
    const rect = scene.getBoundingClientRect();
    const distance = (rect.top + rect.height / 2 - innerHeight / 2) / (innerHeight / 2 + rect.height / 2);
    const progress = Math.max(-1, Math.min(1, distance));
    scene.style.setProperty("--scroll-shift", progress.toFixed(3));
  });
}

const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");

window.addEventListener("scroll", () => {
  if (motionPreference.matches) {
    document.querySelectorAll(".scroll-scene").forEach((scene) => scene.style.setProperty("--scroll-shift", "0"));
    return;
  }
  if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScrollMotion);
}, { passive: true });
window.addEventListener("resize", () => {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScrollMotion);
}, { passive: true });
motionPreference.addEventListener("change", (event) => {
  if (event.matches) {
    document.querySelectorAll(".scroll-scene").forEach((scene) => scene.style.setProperty("--scroll-shift", "0"));
  } else {
    updateScrollMotion();
  }
});

function openProject(projectId) {
  const project = portfolioData.projects.find((item) => item.id === projectId);
  if (!project) return;
  const image = validImage(project.image);
  document.querySelector("#project-detail").innerHTML = `${image ? `<img class="project-detail-image" src="${safeText(image)}" alt="Imagem do projeto ${safeText(project.title)}">` : ""}
    <div class="project-detail-content"><span class="project-detail-kicker">${safeText(project.category)} / ${safeText(project.year)}</span><h2 id="dialog-title">${safeText(project.title)}</h2><p>${safeText(project.description)}</p>${validImage(project.link) ? `<a class="detail-link" href="${safeText(validImage(project.link))}" target="_blank" rel="noreferrer">Visitar projeto <span class="chrome-arrow arrow-up-right" aria-hidden="true"></span></a>` : ""}</div>`;
  projectDialog.showModal();
}

function fillProfileForm() {
  const form = document.querySelector("#profile-form");
  Object.entries(portfolioData.profile).forEach(([key, value]) => { if (form.elements[key] && form.elements[key].type !== "file") form.elements[key].value = value; });
}

async function compressProfilePhoto(file) {
  if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) throw new Error("Escolha uma imagem menor que 12 MB.");
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 720 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

function resetProjectForm() {
  projectForm.reset();
  projectForm.elements.id.value = "";
  projectForm.classList.add("is-hidden");
  document.querySelector("#editor-project-list").classList.remove("is-hidden");
  document.querySelector("#project-form-title").textContent = "Novo projeto";
}

function editProject(projectId) {
  const project = portfolioData.projects.find((item) => item.id === projectId);
  if (!project) return;
  projectForm.classList.remove("is-hidden");
  document.querySelector("#editor-project-list").classList.add("is-hidden");
  document.querySelector("#project-form-title").textContent = "Editar projeto";
  Object.entries(project).forEach(([key, value]) => { if (projectForm.elements[key]) projectForm.elements[key].value = value; });
  projectForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

document.addEventListener("keydown", (event) => {
  const editorShortcut = (event.ctrlKey || event.metaKey) && ((event.shiftKey && event.code === "KeyE") || (event.altKey && event.code === "KeyE"));
  if (editorShortcut) {
    event.preventDefault();
    openEditor();
  }
});

document.querySelector("header .wordmark").addEventListener("click", (event) => {
  logoClickCount += 1;
  clearTimeout(logoClickTimer);
  if (logoClickCount >= 5) {
    event.preventDefault();
    logoClickCount = 0;
    openEditor();
    return;
  }
  logoClickTimer = setTimeout(() => { logoClickCount = 0; }, 1800);
});

document.querySelectorAll("[data-close-editor]").forEach((button) => button.addEventListener("click", () => editorDialog.close()));
document.querySelectorAll("[data-close-project]").forEach((button) => button.addEventListener("click", () => projectDialog.close()));
editorDialog.addEventListener("click", (event) => { if (event.target === editorDialog) editorDialog.close(); });
projectDialog.addEventListener("click", (event) => { if (event.target === projectDialog) projectDialog.close(); });

document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient) return showEditorLogin("Configure a URL e a chave pública do Supabase primeiro.");
  const form = event.currentTarget;
  const submitButton = form.querySelector("[type=submit]");
  submitButton.disabled = true;
  try {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: form.elements.email.value.trim(),
      password: form.elements.password.value
    });
    if (error) throw error;
    const { data } = await supabaseClient.auth.getSession();
    currentUser = data.session?.user || null;
    if (!currentUser) throw new Error("Não foi possível iniciar a sessão.");
    showEditorWorkspace();
    showToast("Sessão iniciada. Suas alterações serão publicadas para todos.");
  } catch (error) {
    showEditorLogin(error.message || "Não foi possível entrar.");
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#sign-out").addEventListener("click", async () => {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    showToast("Não foi possível encerrar a sessão.");
    return;
  }
  currentUser = null;
  showEditorLogin();
});

document.querySelectorAll(".editor-tab").forEach((tab) => tab.addEventListener("click", () => {
  document.querySelectorAll(".editor-tab").forEach((item) => { item.classList.toggle("is-active", item === tab); item.setAttribute("aria-selected", String(item === tab)); });
  document.querySelectorAll(".editor-panel").forEach((panel) => { panel.hidden = panel.id !== `${tab.dataset.tab}-panel`; panel.classList.toggle("is-hidden", panel.hidden); });
  resetProjectForm();
}));

document.querySelector("#profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form).entries());
  try {
    const [photoFile] = form.elements.photoFile.files;
    const photo = photoFile ? await compressProfilePhoto(photoFile) : portfolioData.profile.photo || "";
    portfolioData.profile = { ...portfolioData.profile, ...values, photo };
    delete portfolioData.profile.photoFile;
    await saveData();
    applyProfile();
    form.elements.photoFile.value = "";
    showToast(supabaseConfigured ? "Perfil publicado para todos." : "Perfil salvo neste navegador. Configure o Supabase para compartilhar.");
  } catch (error) {
    showToast(error.message || "Não foi possível processar a foto.");
  }
});

document.querySelector("#new-project").addEventListener("click", () => {
  resetProjectForm();
  projectForm.classList.remove("is-hidden");
  document.querySelector("#editor-project-list").classList.add("is-hidden");
  projectForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
});
document.querySelector("#cancel-project").addEventListener("click", resetProjectForm);

projectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(projectForm).entries());
  const project = { ...values, id: values.id || `p-${crypto.randomUUID()}`, year: values.year || String(new Date().getFullYear()), image: validImage(values.image), link: validImage(values.link) };
  if (values.id) portfolioData.projects = portfolioData.projects.map((item) => item.id === values.id ? project : item);
  else portfolioData.projects.unshift(project);
  try {
    await saveData();
  } catch (error) {
    showToast(error.message || "Não foi possível publicar o projeto.");
    return;
  }
  renderProjects();
  resetProjectForm();
  showToast(supabaseConfigured ? "Projeto publicado para todos." : "Projeto salvo neste navegador. Configure o Supabase para compartilhar.");
});

document.querySelector("#editor-project-list").addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-project]");
  const deleteButton = event.target.closest("[data-delete-project]");
  if (editButton) editProject(editButton.dataset.editProject);
  if (deleteButton) {
    const project = portfolioData.projects.find((item) => item.id === deleteButton.dataset.deleteProject);
    if (project && confirm(`Excluir “${project.title}”?`)) {
      portfolioData.projects = portfolioData.projects.filter((item) => item.id !== project.id);
      try {
        await saveData();
      } catch (error) {
        showToast(error.message || "Não foi possível publicar a exclusão.");
        return;
      }
      renderProjects();
      showToast(supabaseConfigured ? "Projeto removido para todos." : "Projeto removido neste navegador.");
    }
  }
});

filters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (button) { activeFilter = button.dataset.filter; renderProjects(); }
});
projectGrid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-project]");
  if (card) openProject(card.dataset.project);
});
projectGrid.addEventListener("keydown", (event) => {
  const card = event.target.closest("[data-project]");
  if (card && ["Enter", " "].includes(event.key)) { event.preventDefault(); openProject(card.dataset.project); }
});

document.querySelector("#export-data").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(portfolioData, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "alfareza-portfolio.json";
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Backup exportado.");
});

document.querySelector("#import-data").addEventListener("change", async (event) => {
  const [file] = event.target.files || [];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!imported.profile || !Array.isArray(imported.projects)) throw new Error("Formato inválido");
    portfolioData = { profile: { ...initialData.profile, ...imported.profile }, projects: imported.projects.map((project) => ({ ...project, id: String(project.id || `p-${crypto.randomUUID()}`) })) };
    await saveData();
    applyProfile();
    renderProjects();
    fillProfileForm();
    showToast("Conteúdo importado com sucesso.");
  } catch (error) {
    showToast(error.message || "Arquivo inválido. Use um backup exportado por este portfólio.");
  }
  event.target.value = "";
});

document.querySelector("#reset-data").addEventListener("click", async () => {
  if (!confirm("Restaurar o conteúdo inicial? Os dados atuais serão substituídos.")) return;
  portfolioData = structuredClone(initialData);
  try {
    await saveData();
  } catch (error) {
    showToast(error.message || "Não foi possível publicar a restauração.");
    return;
  }
  applyProfile();
  renderProjects();
  fillProfileForm();
  showToast(supabaseConfigured ? "Conteúdo inicial publicado para todos." : "Conteúdo inicial restaurado neste navegador.");
});

document.querySelector("#year").textContent = String(new Date().getFullYear());
initializePortfolio();