// ✅ MOCK DA BIBLIOTECA LUCIDE PARA EVITAR ERROS NO CONSOLE
window.lucide = {
  createIcons: () => {
    // Lucide foi substituído por FontAwesome nos templates, logo esta função é um mock limpo.
  }
};

// ✅ GERENCIADOR DE TOASTS E NOTIFICAÇÕES PREMIUM
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type} shadow-2xl relative overflow-hidden`;
  
  const icons = {
      'success': 'fa-solid fa-circle-check text-emerald-500',
      'error': 'fa-solid fa-circle-xmark text-rose-500',
      'info': 'fa-solid fa-circle-info text-blue-500',
      'warning': 'fa-solid fa-triangle-exclamation text-amber-500'
  };
  const icon = icons[type] || icons.info;
  
  toast.innerHTML = `
    <i class="${icon} text-lg"></i>
    <span class="text-[12px] font-black text-slate-800 dark:text-white uppercase tracking-tight">${message}</span>
    <div class="toast-progress">
      <div class="toast-progress-bar"></div>
    </div>
  `;
  
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// Carrega as views parciais de templates HTML de forma assincrona
async function loadTemplates() {
  const templates = ['dashboard', 'api', 'disparos', 'historico', 'conversas', 'config'];
  const container = document.getElementById('views-container');
  if (!container) return;
  container.innerHTML = '';
  
  const fetches = templates.map(async (name) => {
    const res = await fetch(`/views/${name}.html?v=${Date.now()}`);
    const html = await res.text();
    const section = document.createElement('section');
    section.id = `tab-${name}`;
    section.className = name === 'dashboard' ? 'tab-content' : 'tab-content hidden';
    section.innerHTML = html;
    container.appendChild(section);
  });
  
  await Promise.all(fetches);
}

async function startApp() {
  // Checar sessão local e aplicar estado imediatamente para evitar flashes antes do loadTemplates assincrono
  const loginScreen = document.getElementById('login-screen');
  const appScreen = document.getElementById('app-screen');
  const sessionUser = sessionStorage.getItem('zapflow_session');

  if (loginScreen && appScreen) {
    if (sessionUser) {
      loginScreen.classList.add('hidden');
      appScreen.classList.remove('hidden');
    } else {
      loginScreen.classList.remove('hidden');
      appScreen.classList.add('hidden');
    }
  }

  // Remover o estilo de bloqueio síncrono para que a transição e classes do Tailwind/custom funcionem livremente
  const flashStyle = document.getElementById('auth-state-style');
  if (flashStyle) flashStyle.remove();

  // 1. Carrega os templates antes de iniciar a vinculacao do DOM
  await loadTemplates();

  // --- ESTADO DA APLICAÇÃO (Sincronizado com backend) ---
  const state = {
    user: null,
    apiConfig: {
      url: '',
      key: '',
      instance: '',
      token: ''
    },
    visualConfig: {
      login_bg_desktop: '',
      login_bg_mobile: '',
      logo_sidebar: '',
      logo_login: ''
    },
    apiConnected: false,
    campaigns: [],
    logs: [],
    logsVisibleCount: 20,
    contacts: [],
    defaultCupom: localStorage.getItem('zapflow_default_cupom') || 'DESCONTO50',
    defaultLink: localStorage.getItem('zapflow_default_link') || 'https://sorteio.link/zapflow',
    activeCampaign: null,
    stats: {
      total: 0,
      sucesso: 0,
      falhas: 0,
      instancias: 0
    }
  };

  // Helper para rotas do Backend (mesma origem do FastAPI, com fallback para localhost:8000 se rodando em outro local/Live Server)
  const API_BASE = window.location.port !== "8000" ? "http://localhost:8000" : "";

  // --- CONFIGURAÇÃO VISUAL E BRANDING ---
  async function fetchVisualConfig() {
    try {
      const response = await fetch(`${API_BASE}/api/visual-config`);
      if (response.ok) {
        state.visualConfig = await response.json();
        applyVisualChanges();
      }
    } catch (e) {
      console.warn('Erro ao carregar configurações visuais:', e);
    }
  }

  function applyVisualChanges() {
    const vc = state.visualConfig;
    if (!vc) return;

    // 1. Aplicar Logos
    const loginImgEl = document.getElementById('login-logo-img');
    const loginTextEl = document.getElementById('login-logo-text');
    if (loginImgEl && loginTextEl) {
      if (vc.logo_login) {
        loginImgEl.src = vc.logo_login;
        loginImgEl.classList.remove('hidden');
        loginTextEl.classList.add('hidden');
      } else {
        loginImgEl.src = '';
        loginImgEl.classList.add('hidden');
        loginTextEl.classList.remove('hidden');
      }
    }

    const sidebarImgEl = document.getElementById('sidebar-logo-img');
    const sidebarTextEl = document.getElementById('sidebar-logo-text');
    if (sidebarImgEl && sidebarTextEl) {
      if (vc.logo_sidebar) {
        sidebarImgEl.src = vc.logo_sidebar;
        sidebarImgEl.classList.remove('hidden');
        sidebarTextEl.classList.add('hidden');
      } else {
        sidebarImgEl.src = '';
        sidebarImgEl.classList.add('hidden');
        sidebarTextEl.classList.remove('hidden');
      }
    }

    // 2. Aplicar Fundos de Tela de Login
    applyLoginBackgrounds();
  }

  function applyLoginBackgrounds() {
    const loginScreen = document.getElementById('login-screen');
    if (!loginScreen || !state.visualConfig) return;

    const vc = state.visualConfig;
    const isMobile = window.innerWidth < 768;
    const bgToUse = isMobile ? (vc.login_bg_mobile || vc.login_bg_desktop) : (vc.login_bg_desktop || vc.login_bg_mobile);

    if (bgToUse) {
      loginScreen.style.backgroundImage = `url('${bgToUse}')`;
      loginScreen.style.backgroundSize = 'cover';
      loginScreen.style.backgroundPosition = 'center';
      loginScreen.style.backgroundRepeat = 'no-repeat';
    } else {
      loginScreen.style.backgroundImage = '';
    }
  }

  // Monitorar redimensionamento de tela para trocar fundos responsivamente
  window.addEventListener('resize', applyLoginBackgrounds);

  // Carregar configurações de branding no carregamento inicial
  await fetchVisualConfig();

  // --- AUTH FLOW ---
  const loginForm = document.getElementById('login-form');
  const loginErrorContainer = document.getElementById('login-error-container');
  const loginErrorText = document.getElementById('login-error-text');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Resetar container de erro
    if (loginErrorContainer) {
      loginErrorContainer.classList.add('hidden');
    }

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (response.ok) {
        const data = await response.json();
        state.user = data.username;
        sessionStorage.setItem('zapflow_session', data.username);
        
        // Transição suave
        loginScreen.style.opacity = '0';
        loginScreen.style.transition = 'opacity 0.5s ease';
        setTimeout(() => {
          loginScreen.classList.add('hidden');
          appScreen.classList.remove('hidden');
          appScreen.style.opacity = '0';
          appScreen.style.transition = 'opacity 0.5s ease';
          setTimeout(() => {
            appScreen.style.opacity = '1';
            initApp();
            showToast(`Bem-vindo de volta, ${data.username}!`, 'success');
          }, 50);
        }, 500);
      } else {
        const err = await response.json();
        const errMsg = err.detail || 'Usuário ou senha incorretos!';
        
        if (loginErrorContainer && loginErrorText) {
          loginErrorText.textContent = errMsg;
          loginErrorContainer.classList.remove('hidden');
          
          // Reinicia animação shake
          loginErrorContainer.classList.remove('animate-shake');
          void loginErrorContainer.offsetWidth; // trigger reflow
          loginErrorContainer.classList.add('animate-shake');
        } else {
          showToast(errMsg, 'error');
        }
      }
    } catch (e) {
      const connMsg = 'Erro de conexão com o servidor backend.';
      if (loginErrorContainer && loginErrorText) {
        loginErrorText.textContent = connMsg;
        loginErrorContainer.classList.remove('hidden');
        
        // Reinicia animação shake
        loginErrorContainer.classList.remove('animate-shake');
        void loginErrorContainer.offsetWidth; // trigger reflow
        loginErrorContainer.classList.add('animate-shake');
      } else {
        showToast(connMsg, 'error');
      }
    }
  });

  document.getElementById('btn-logout').addEventListener('click', () => {
    sessionStorage.removeItem('zapflow_session');
    window.location.reload();
  });

  // --- APP INICIALIZAÇÃO ---
  async function initApp() {
    setupNavigation();
    setupThemeAndResponsive();
    setupWidgets();
    setupVisualConfig();
    updateLivePreview();
    
    // Carregar configurações iniciais e status
    await fetchApiConfig();
    await fetchCampaignsAndLogs();
    await checkEvolutionConnection(true);

    // Navegar para a rota correta baseada na URL atual
    handleUrlRoute();
  }

  // --- SPA NAVIGATION ---
  const menuItems = document.querySelectorAll('.menu-item');
  const currentTabTitle = document.getElementById('current-tab-title');

  const tabMetadata = {
    dashboard: { title: 'Painel Geral' },
    api: { title: 'Integração Evolution API' },
    disparos: { title: 'Disparador em Massa' },
    historico: { title: 'Logs & Histórico' },
    conversas: { title: 'WhatsApp Conversas' },
    config: { title: 'Personalização' }
  };

  function setupNavigation() {
    menuItems.forEach(item => {
      item.addEventListener('click', () => {
        const tabId = item.getAttribute('data-tab');
        switchTab(tabId);
      });
    });

    // Ações rápidas e botões de atalho
    document.addEventListener('click', (e) => {
      const quickBtn = e.target.closest('.quick-action');
      if (quickBtn) {
        const targetTab = quickBtn.getAttribute('data-target-tab');
        switchTab(targetTab);
      }
    });

    // Tratar cliques em voltar/avançar do navegador
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.tabId) {
        switchTab(e.state.tabId);
      } else {
        handleUrlRoute();
      }
    });
  }

  function handleUrlRoute() {
    const path = window.location.pathname.replace(/^\/|\/$/g, '');
    const validTabs = ['dashboard', 'api', 'config', 'disparos', 'historico', 'conversas'];
    if (validTabs.includes(path)) {
      switchTab(path);
    } else {
      switchTab('dashboard');
    }
  }

  function switchTab(tabId) {
    // Controla estilo único estático da tela de conversas sem poluir outras abas
    if (tabId === 'conversas') {
      document.documentElement.classList.add('conversas-active');
    } else {
      document.documentElement.classList.remove('conversas-active');
    }

    menuItems.forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

    const activeItem = document.querySelector(`.menu-item[data-tab="${tabId}"]`);
    if (activeItem) activeItem.classList.add('active');

    const activeTab = document.getElementById(`tab-${tabId}`);
    if (activeTab) activeTab.classList.remove('hidden');

    if (tabMetadata[tabId]) {
      currentTabTitle.textContent = tabMetadata[tabId].title;
      document.title = `${tabMetadata[tabId].title} | Ação dos Limas`;
    }

    // Atualiza a URL do navegador de forma limpa, sem recarregar a página
    const currentPath = window.location.pathname.replace(/^\/|\/$/g, '');
    if (currentPath !== tabId) {
      window.history.pushState({ tabId }, '', `/${tabId}`);
    }
    
    // Sincroniza dados ao transitar
    if (tabId === 'dashboard' || tabId === 'historico') {
      if (tabId === 'historico') {
        state.logsVisibleCount = 20;
      }
      fetchCampaignsAndLogs();
    } else if (tabId === 'conversas') {
      if (typeof window.loadChatsList === 'function') {
        window.loadChatsList();
      }
    } else if (tabId === 'disparos') {
      updateActiveStats();
    } else if (tabId === 'config') {
      populateVisualFields();
    }
  }

  // --- CONFIGURAÇÃO DE TEMAS E INTERFACES RESPONSIVAS ---
  function setupThemeAndResponsive() {
    // Sidebar responsive menu logic
    const sidebar = document.getElementById('sidebar');
    const btnMobile = document.getElementById('btnMobileToggle');

    if (btnMobile && sidebar) {
      btnMobile.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
      });
    }

    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 1024 && sidebar && sidebar.classList.contains('mobile-open')) {
        if (!sidebar.contains(e.target) && btnMobile && !btnMobile.contains(e.target)) {
          sidebar.classList.remove('mobile-open');
        }
      }
    });

    // Theme Switch Logic
    const btnTheme = document.getElementById("btnTheme");
    const iconTheme = document.getElementById("themeIcon");
    
    function isDark() { return document.documentElement.classList.contains("dark"); }
    function syncThemeIcon() {
      if (iconTheme) {
        iconTheme.className = isDark()
          ? "fa-solid fa-sun w-5 text-center text-amber-400"
          : "fa-solid fa-moon w-5 text-center text-slate-400";
      }
    }

    syncThemeIcon();

    if (btnTheme) {
      btnTheme.addEventListener("click", () => {
        const nextTheme = isDark() ? "light" : "dark";
        document.documentElement.classList.toggle("dark");
        localStorage.setItem("theme", nextTheme);
        syncThemeIcon();
      });
    }
  }

  // --- CLOCK & WEATHER WIDGETS ---
  function setupWidgets() {
    // CLOCK LOOPER
    function updateClock() {
      const now = new Date();
      const time = now.toLocaleTimeString('pt-BR', { hour12: false });
      const el = document.getElementById('topbar-clock');
      if (el) el.textContent = time;
      
      const phoneClock = document.getElementById('phone-clock');
      if (phoneClock) {
        phoneClock.textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      }
    }
    setInterval(updateClock, 1000);
    updateClock();

    // WEATHER CALLER (Seropédica)
    async function updateWeather() {
      try {
        const res = await fetch(`${API_BASE}/api/weather`);
        const data = await res.json();
        if (data && data.current_weather) {
          const temp = Math.round(data.current_weather.temperature);
          const code = data.current_weather.weathercode;
          
          const tempEl = document.getElementById('weather-temp');
          const tempMobileEl = document.getElementById('weather-temp-mobile');
          if (tempEl) tempEl.textContent = temp + '°C';
          if (tempMobileEl) tempMobileEl.textContent = temp + '°C';
          
          const iconEl = document.getElementById('weather-icon');
          const boxEl = document.getElementById('weather-icon-box');
          
          if (iconEl && boxEl) {
            if (code === 0) {
              iconEl.className = 'fa-solid fa-sun text-sm animate-spin';
              iconEl.style.animationDuration = '10s';
              boxEl.className = 'w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500';
            } else if (code >= 1 && code <= 3) {
              iconEl.className = 'fa-solid fa-cloud-sun text-sm';
              boxEl.className = 'w-8 h-8 rounded-lg bg-slate-500/10 flex items-center justify-center text-slate-500';
            } else if (code >= 51 && code <= 67) {
              iconEl.className = 'fa-solid fa-cloud-showers-heavy text-sm';
              boxEl.className = 'w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500';
            } else {
              iconEl.className = 'fa-solid fa-cloud text-sm';
              boxEl.className = 'w-8 h-8 rounded-lg bg-slate-500/10 flex items-center justify-center text-slate-500';
            }
          }
        }
      } catch (e) {
        console.warn('Erro ao carregar clima:', e);
      }
    }
    updateWeather();
    setInterval(updateWeather, 600000); // 10 minutos
  }

  // --- VISUAL IDENTITY CONFIGURATION ---
  function setupVisualConfig() {
    const desktopUrl = document.getElementById('visual-bg-desktop-url');
    const mobileUrl = document.getElementById('visual-bg-mobile-url');
    const loginUrl = document.getElementById('visual-logo-login-url');
    const sidebarUrl = document.getElementById('visual-logo-sidebar-url');

    const btnSave = document.getElementById('btn-save-visual');

    // Se a view de configuração não estiver ativa no DOM, abortar
    if (!btnSave) return;

    // Preencher campos e previews com dados atuais
    populateVisualFields();

    // Função auxiliar para converter arquivos locais em Base64
    function handleFileUpload(inputEl, targetUrlEl) {
      if (!inputEl) return;
      inputEl.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          if (targetUrlEl) {
            targetUrlEl.value = event.target.result;
            // Disparar preview
            updateVisualPreviews();
          }
        };
        reader.readAsDataURL(file);
      });
    }

    handleFileUpload(document.getElementById('visual-bg-desktop-file'), desktopUrl);
    handleFileUpload(document.getElementById('visual-bg-mobile-file'), mobileUrl);
    handleFileUpload(document.getElementById('visual-logo-login-file'), loginUrl);
    handleFileUpload(document.getElementById('visual-logo-sidebar-file'), sidebarUrl);

    // Adicionar Listeners nos inputs de texto para preview imediato quando digitado/colado
    [desktopUrl, mobileUrl, loginUrl, sidebarUrl].forEach(el => {
      if (el) {
        el.addEventListener('input', updateVisualPreviews);
      }
    });

    // Salvar Identidade Visual
    btnSave.addEventListener('click', async () => {
      const payload = {
        login_bg_desktop: desktopUrl ? desktopUrl.value.trim() : '',
        login_bg_mobile: mobileUrl ? mobileUrl.value.trim() : '',
        logo_login: loginUrl ? loginUrl.value.trim() : '',
        logo_sidebar: sidebarUrl ? sidebarUrl.value.trim() : ''
      };

      btnSave.disabled = true;
      btnSave.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Salvando...`;

      try {
        const response = await fetch(`${API_BASE}/api/visual-config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          state.visualConfig = payload;
          applyVisualChanges();
          showToast('Identidade visual salva e aplicada com sucesso!', 'success');
        } else {
          showToast('Erro ao salvar identidade visual.', 'error');
        }
      } catch (e) {
        showToast('Erro de conexão ao salvar identidade visual.', 'error');
      } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Salvar Identidade Visual`;
      }
    });
  }

  // Atualiza previews inline no formulário
  function updateVisualPreviews() {
    const desktopUrl = document.getElementById('visual-bg-desktop-url');
    const mobileUrl = document.getElementById('visual-bg-mobile-url');
    const loginUrl = document.getElementById('visual-logo-login-url');
    const sidebarUrl = document.getElementById('visual-logo-sidebar-url');

    function setPreview(urlVal, imgId, emptyId) {
      const img = document.getElementById(imgId);
      const empty = document.getElementById(emptyId);
      if (!img || !empty) return;

      if (urlVal) {
        img.src = urlVal;
        img.classList.remove('hidden');
        empty.classList.add('hidden');
      } else {
        img.src = '';
        img.classList.add('hidden');
        empty.classList.remove('hidden');
      }
    }

    setPreview(desktopUrl ? desktopUrl.value.trim() : '', 'preview-bg-desktop', 'preview-bg-desktop-empty');
    setPreview(mobileUrl ? mobileUrl.value.trim() : '', 'preview-bg-mobile', 'preview-bg-mobile-empty');
    setPreview(loginUrl ? loginUrl.value.trim() : '', 'preview-logo-login', 'preview-logo-login-empty');
    setPreview(sidebarUrl ? sidebarUrl.value.trim() : '', 'preview-logo-sidebar', 'preview-logo-sidebar-empty');
  }

  // Preenche dinamicamente os inputs da aba de personalização
  function populateVisualFields() {
    const desktopUrl = document.getElementById('visual-bg-desktop-url');
    const mobileUrl = document.getElementById('visual-bg-mobile-url');
    const loginUrl = document.getElementById('visual-logo-login-url');
    const sidebarUrl = document.getElementById('visual-logo-sidebar-url');

    const vc = state.visualConfig;
    if (vc) {
      if (desktopUrl) desktopUrl.value = vc.login_bg_desktop || '';
      if (mobileUrl) mobileUrl.value = vc.login_bg_mobile || '';
      if (loginUrl) loginUrl.value = vc.logo_login || '';
      if (sidebarUrl) sidebarUrl.value = vc.logo_sidebar || '';

      updateVisualPreviews();
    }
  }

  // Tornar clearVisualField visível no escopo global para onclicks
  window.clearVisualField = (fieldId) => {
    const urlInput = document.getElementById(`${fieldId}-url`);
    const fileInput = document.getElementById(`${fieldId}-file`);
    if (urlInput) urlInput.value = '';
    if (fileInput) fileInput.value = '';
    updateVisualPreviews();
  };

  // --- BACKEND API COMMUNICATIONS ---

  // Buscar configurações da API salvas no SQLite
  async function fetchApiConfig() {
    try {
      const response = await fetch(`${API_BASE}/api/instance`);
      if (response.ok) {
        state.apiConfig = await response.json();
        const urlField = document.getElementById('api-url');
        const keyField = document.getElementById('api-key');
        const instField = document.getElementById('api-instance');
        const tokenField = document.getElementById('api-instance-token');

        if (urlField) urlField.value = state.apiConfig.url || '';
        if (keyField) keyField.value = state.apiConfig.key || '';
        if (instField) instField.value = state.apiConfig.instance || '';
        if (tokenField) tokenField.value = state.apiConfig.token || '';
      }
    } catch (e) {
      console.error('Erro ao buscar credenciais:', e);
    }
  }

  // Salvar configurações no SQLite
  document.addEventListener('submit', async (e) => {
    if (e.target.id === 'api-config-form') {
      e.preventDefault();
      
      const configData = {
        url: document.getElementById('api-url').value.trim().replace(/\/$/, ""),
        key: document.getElementById('api-key').value.trim(),
        instance: document.getElementById('api-instance').value.trim(),
        token: document.getElementById('api-instance-token').value.trim()
      };

      renderStatusLoading('Salvando credenciais no banco...');

      try {
        const response = await fetch(`${API_BASE}/api/instance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configData)
        });

        if (response.ok) {
          state.apiConfig = configData;
          showToast('Configurações salvas no banco de dados SQLite!', 'success');
          await checkEvolutionConnection();
        } else {
          showToast('Erro ao salvar configurações no banco de dados.', 'error');
        }
      } catch (e) {
        showToast('Erro de conexão ao salvar configurações.', 'error');
      }
    }
  });

  // Testar conexão manualmente
  document.addEventListener('click', async (e) => {
    if (e.target.id === 'btn-test-connection' || e.target.closest('#btn-test-connection')) {
      const btn = document.getElementById('btn-test-connection');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Testando...';
      btn.disabled = true;

      try {
        const response = await fetch(`${API_BASE}/api/instance/connection-state`);
        const data = await response.json();
        btn.innerHTML = originalText;
        btn.disabled = false;

        if (data.connected) {
          showToast('Conexão ativa! O WhatsApp está pareado e pronto.', 'success');
        } else {
          showToast(`Instância desconectada. Status: ${data.state}`, 'warning');
        }
      } catch (e) {
        btn.innerHTML = originalText;
        btn.disabled = false;
        showToast('Não foi possível testar a conexão no momento.', 'error');
      }
    }
  });

  // Checar conexão do WhatsApp e atualizar telas
  async function checkEvolutionConnection(silent = false) {
    const instanceStatusBox = document.getElementById('instance-status-box');
    if (!instanceStatusBox) return;

    if (!silent) renderStatusLoading('Checando conexão com a Evolution API...');
    try {
      const response = await fetch(`${API_BASE}/api/instance/connection-state`);
      const data = await response.json();

      if (data.connected) {
        state.apiConnected = true;
        state.stats.instancias = 1;
        updateApiStatusBadge(true, `Conectado: ${state.apiConfig.instance}`);
        renderStatusConnected();
      } else {
        state.apiConnected = false;
        state.stats.instancias = 0;
        updateApiStatusBadge(false, 'Desconectada');
        
        if (state.apiConfig.url && state.apiConfig.instance) {
          renderStatusDisconnectedWithAction();
        } else {
          renderStatusInitialState();
        }
      }
      renderStats();
      updateActiveStats();
    } catch (e) {
      console.error('Erro de conexão ao checar status:', e);
    }
  }

  // Criar instância
  async function createEvolutionInstance() {
    renderStatusLoading('Instanciando canal na Evolution API...');
    try {
      const response = await fetch(`${API_BASE}/api/instance/create`, { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        if (data.hash && data.hash.apikey) {
          const tokenField = document.getElementById('api-instance-token');
          if (tokenField) tokenField.value = data.hash.apikey;
          state.apiConfig.token = data.hash.apikey;
        }
        showToast('Instância criada com sucesso! Carregando QR Code...', 'info');
        await fetchQRCode();
      }
    } catch (e) {
      showToast('Erro de conexão ao instanciar.', 'error');
    }
  }

  // Buscar QR Code
  async function fetchQRCode() {
    renderStatusLoading('Obtendo QR Code de pareamento...');
    try {
      const response = await fetch(`${API_BASE}/api/instance/connect`);
      const data = await response.json();
      if (data.code) {
        renderStatusQRCode(data.code, data.simulated);
      }
    } catch (e) {
      showToast('Erro ao carregar o QR Code.', 'error');
    }
  }

  // --- RENDERIZADORES DE STATUS DA API ---
  function renderStatusLoading(msg) {
    const box = document.getElementById('instance-status-box');
    if (!box) return;
    box.innerHTML = `
      <i class="fa-solid fa-spinner animate-spin text-4xl text-purple-500 mb-4"></i>
      <p class="text-slate-700 dark:text-slate-350 text-sm font-bold uppercase tracking-wider">${msg}</p>
    `;
  }

  function renderStatusInitialState() {
    const box = document.getElementById('instance-status-box');
    if (!box) return;
    box.innerHTML = `
      <i class="fa-solid fa-mobile-screen text-4xl text-slate-300 dark:text-slate-600 mb-4 animate-bounce" style="animation-duration: 3s;"></i>
      <p class="text-slate-500 dark:text-slate-400 text-sm font-semibold max-w-xs mb-4">Nenhuma instância ativa carregada. Insira suas credenciais e salve para autenticar o WhatsApp.</p>
    `;
  }

  function renderStatusConnected() {
    const box = document.getElementById('instance-status-box');
    if (!box) return;
    box.innerHTML = `
      <div class="flex flex-col items-center">
        <div class="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-3xl mb-4 shadow-lg shadow-emerald-500/5 animate-pulse">
          <i class="fa-solid fa-circle-check"></i>
        </div>
        <h4 class="text-lg font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">WhatsApp Conectado!</h4>
        <p class="text-slate-500 dark:text-slate-400 text-xs font-semibold mb-4 leading-relaxed">
          Instância: <strong class="text-slate-700 dark:text-white uppercase">${state.apiConfig.instance}</strong><br>
          Status: Pronto para disparar campanhas
        </p>
        <button id="btn-disconnect-api" class="flex items-center justify-center gap-2 px-5 py-2.5 border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-600 rounded-2xl font-black active:scale-[0.98] transition-all text-xs uppercase tracking-wider cursor-pointer">
          <i class="fa-solid fa-power-off"></i> Desconectar Instância
        </button>
      </div>
    `;
    
    document.getElementById('btn-disconnect-api').addEventListener('click', () => {
      state.apiConnected = false;
      state.stats.instancias = 0;
      updateApiStatusBadge(false, 'Desconectada');
      renderStatusDisconnectedWithAction();
      renderStats();
      showToast('WhatsApp desconectado com sucesso!', 'info');
    });
  }

  function renderStatusQRCode(qrSource, isSimulated = false) {
    const box = document.getElementById('instance-status-box');
    if (!box) return;

    const src = qrSource.startsWith('http') || qrSource.startsWith('data:') ? qrSource : `data:image/png;base64,${qrSource}`;
    box.innerHTML = `
      <h4 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider mb-4">Escaneie o QR Code</h4>
      <div class="w-48 h-48 bg-white p-3 rounded-2xl border border-slate-900/5 shadow-md flex items-center justify-center mb-4">
        <img src="${src}" alt="WhatsApp QR Code" class="w-full h-full object-contain">
      </div>
      <p class="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider max-w-[240px] mb-4 leading-normal">
        Abra o WhatsApp no celular > Aparelhos conectados > Conectar um aparelho.
      </p>
      ${isSimulated ? `
        <button id="btn-simulate-scan" class="flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-[0.98] transition-all text-xs uppercase tracking-wider cursor-pointer">
          <i class="fa-solid fa-qrcode"></i> Conectar (Simular Scan)
        </button>
      ` : ''}
    `;

    if (isSimulated) {
      document.getElementById('btn-simulate-scan').addEventListener('click', () => {
        renderStatusLoading('Autenticando sessão pareada...');
        setTimeout(() => {
          state.apiConnected = true;
          state.stats.instancias = 1;
          updateApiStatusBadge(true, `Conectado: ${state.apiConfig.instance}`);
          renderStatusConnected();
          renderStats();
          showToast('WhatsApp pareado com sucesso (simulado)!', 'success');
        }, 1500);
      });
    }
  }

  function renderStatusDisconnectedWithAction() {
    const box = document.getElementById('instance-status-box');
    if (!box) return;

    box.innerHTML = `
      <i class="fa-solid fa-triangle-exclamation text-4xl text-amber-500 mb-4 animate-pulse"></i>
      <h4 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider mb-1">Pareamento Pendente</h4>
      <p class="text-slate-500 dark:text-slate-400 text-xs font-semibold max-w-[260px] mb-4 leading-relaxed">
        As credenciais estão registradas, mas a instância não está conectada ao WhatsApp.
      </p>
      <button id="btn-create-inst" class="flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-2xl font-black shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20 active:scale-[0.98] transition-all text-xs uppercase tracking-wider cursor-pointer">
        <i class="fa-solid fa-plus"></i> Criar & Obter QR Code
      </button>
    `;

    document.getElementById('btn-create-inst').addEventListener('click', createEvolutionInstance);
  }

  function updateApiStatusBadge(connected, text) {
    const dot = document.getElementById('api-status-dot');
    const label = document.getElementById('api-status-text');

    if (connected) {
      if (dot) {
        dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/40 animate-pulse';
      }
      if (label) {
        label.textContent = `Evolution API: ${text}`;
      }
    } else {
      if (dot) {
        dot.className = 'w-2.5 h-2.5 rounded-full bg-red-500 shadow-md shadow-red-500/40';
      }
      if (label) {
        label.textContent = `Evolution API: Desconectada`;
      }
    }
  }

  // --- DISPARADOR & CAMPAIGNS CORE ENGINE ---
  
  // --- MODAL DE CONFIGURAÇÃO DE VARIÁVEIS ---
  window.openVariablesModal = () => {
    const modal = document.getElementById('variables-modal');
    const cupomField = document.getElementById('var-cupom');
    const linkField = document.getElementById('var-link');
    
    if (cupomField) cupomField.value = state.defaultCupom || '';
    if (linkField) linkField.value = state.defaultLink || '';
    
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  };

  window.closeVariablesModal = () => {
    const modal = document.getElementById('variables-modal');
    if (modal) {
      modal.classList.remove('flex');
      modal.classList.add('hidden');
    }
  };

  document.addEventListener('submit', (e) => {
    if (e.target.id === 'variables-config-form') {
      e.preventDefault();
      const cupomVal = document.getElementById('var-cupom').value.trim();
      const linkVal = document.getElementById('var-link').value.trim();
      
      state.defaultCupom = cupomVal;
      state.defaultLink = linkVal;
      
      localStorage.setItem('zapflow_default_cupom', cupomVal);
      localStorage.setItem('zapflow_default_link', linkVal);
      
      showToast('Variáveis salvas com sucesso!', 'success');
      window.closeVariablesModal();
      updateLivePreview();
    }
  });

  window.applyTextFormat = (formatType) => {
    const textarea = document.getElementById('message-template');
    if (!textarea) return;

    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(startPos, endPos);

    let formatCharStart = '';
    let formatCharEnd = '';

    switch (formatType) {
      case 'bold':
        formatCharStart = '*';
        formatCharEnd = '*';
        break;
      case 'italic':
        formatCharStart = '_';
        formatCharEnd = '_';
        break;
      case 'strike':
        formatCharStart = '~';
        formatCharEnd = '~';
        break;
      case 'monospace':
        formatCharStart = '```';
        formatCharEnd = '```';
        break;
    }

    const replacement = formatCharStart + selectedText + formatCharEnd;
    textarea.value = text.substring(0, startPos) + replacement + text.substring(endPos, text.length);
    
    // Recalcular posições de cursor para manter seleção ou colocar cursor no meio
    textarea.focus();
    if (startPos === endPos) {
      // Se não havia seleção, coloca o cursor entre os caracteres de formatação
      const newCursorPos = startPos + formatCharStart.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    } else {
      // Se havia seleção, mantém a nova palavra formatada selecionada
      textarea.setSelectionRange(startPos, startPos + replacement.length);
    }

    updateLivePreview();
  };
  
  // Usar escuta global delegada de eventos para os elementos das views carregadas dinamicamente
  document.addEventListener('input', (e) => {
    if (e.target.id === 'message-template') {
      updateLivePreview();
    }
  });

  function updateLivePreview() {
    const templateField = document.getElementById('message-template');
    const bubble = document.getElementById('preview-bubble');
    if (!templateField || !bubble) return;

    let text = templateField.value || 'Olá! Esta é uma demonstração do preview em tempo real. Digite sua mensagem no campo ao lado.';
    
    // Safely replace standard variables
    text = text
      .replace(/{nome}/g, 'João Silva')
      .replace(/{cupom}/g, state.defaultCupom || 'DESCONTO50')
      .replace(/{link}/g, state.defaultLink || 'https://sorteio.link/zapflow')
      .replace(/{premio}/g, 'Vale Presente')
      .replace(/{resultado}/g, 'Aprovado');

    // Escape basic HTML tags to avoid broken markup, while preserving custom codes
    text = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Handle newline breaks
    text = text.replace(/\n/g, '<br>');

    // Markdown simple replacements
    text = text.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    text = text.replace(/_(.*?)_/g, '<em>$1</em>');
    text = text.replace(/```(.*?)```/g, '<code class="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[9px]">$1</code>');
    text = text.replace(/~(.*?)~/g, '<del>$1</del>');

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    // Dynamically update the smartphone clock
    const phoneClock = document.getElementById('phone-clock');
    if (phoneClock) {
      phoneClock.textContent = timeStr;
    }

    bubble.innerHTML = `${text}<span class="flex items-center justify-end gap-1 text-[7px] text-slate-500/80 dark:text-white/40 mt-1 font-mono">${timeStr} <i class="fa-solid fa-check-double text-sky-500 text-[8px]"></i></span>`;

    // Auto-scroll phone simulator to bottom
    const chatArea = bubble.closest('.phone-chat-area');
    if (chatArea) {
      chatArea.scrollTop = chatArea.scrollHeight;
    }
  }

  // Clique em badges das variáveis
  document.addEventListener('click', (e) => {
    const badge = e.target.closest('.var-badge');
    const textarea = document.getElementById('message-template');

    if (badge && textarea) {
      const variable = badge.getAttribute('data-variable');
      const startPos = textarea.selectionStart;
      const endPos = textarea.selectionEnd;
      const text = textarea.value;
      
      textarea.value = text.substring(0, startPos) + variable + text.substring(endPos, text.length);
      textarea.focus();
      textarea.selectionStart = startPos + variable.length;
      textarea.selectionEnd = startPos + variable.length;
      
      updateLivePreview();
    }
  });

  // Clique no banner de upload de CSV
  document.addEventListener('click', (e) => {
    const uploadBox = e.target.closest('#csv-upload-box');
    if (uploadBox) {
      const input = document.getElementById('contacts-file');
      if (input) input.click();
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.id === 'contacts-file') {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(evt) {
        const text = evt.target.result;
        const manualField = document.getElementById('manual-contacts');
        if (manualField) manualField.value = text;
        
        parseContactsFromInput(text);
        const textLabel = document.querySelector('#csv-upload-box span');
        if (textLabel) {
          textLabel.textContent = `Carregado: ${file.name} (${state.contacts.length} contatos)`;
        }
        showToast(`Lista de contatos carregada (${state.contacts.length} contatos)!`, 'success');
      };
      reader.readAsText(file);
    }
  });

  function updateContactsStats() {
    const badge = document.getElementById('active-contacts-badge');
    const text = document.getElementById('contacts-badge-text');
    const clearBtn = document.getElementById('btn-clear-contacts');
    if (!badge || !text) return;

    const count = state.contacts ? state.contacts.length : 0;
    if (count > 0) {
      text.innerHTML = `<b class="font-extrabold">${count}</b> contato(s) único(s) e válidos pronto(s) para envio`;
      badge.classList.remove('opacity-60', 'bg-purple-500/5', 'border-purple-500/15', 'text-purple-700', 'dark:text-purple-300');
      badge.classList.add('bg-emerald-500/10', 'border-emerald-500/20', 'text-emerald-700', 'dark:text-emerald-400');
      if (clearBtn) clearBtn.classList.remove('hidden');
    } else {
      text.innerText = "Nenhum contato carregado";
      badge.classList.remove('bg-emerald-500/10', 'border-emerald-500/20', 'text-emerald-700', 'dark:text-emerald-400');
      badge.classList.add('opacity-60', 'bg-purple-500/5', 'border-purple-500/15', 'text-purple-700', 'dark:text-purple-300');
      if (clearBtn) clearBtn.classList.add('hidden');
    }

    updateActiveStats();
  }

  function updateActiveStats() {
    const activeStatsContacts = document.getElementById('active-stats-contacts');
    if (activeStatsContacts) {
      activeStatsContacts.textContent = state.contacts ? state.contacts.length : 0;
    }
    
    const sendDelayInput = document.getElementById('send-delay');
    const activeStatsDelay = document.getElementById('active-stats-delay');
    if (activeStatsDelay && sendDelayInput) {
      activeStatsDelay.textContent = `${sendDelayInput.value}s`;
    }
    
    const activeStatsInstance = document.getElementById('active-stats-instance');
    if (activeStatsInstance) {
      activeStatsInstance.textContent = state.apiConnected ? 'Conectado' : 'Desconectado';
      activeStatsInstance.className = state.apiConnected 
        ? 'text-[11px] font-black text-emerald-500 uppercase tracking-wider mt-1.5 block' 
        : 'text-[11px] font-black text-rose-500 uppercase tracking-wider mt-1.5 block';
    }

    // Sincronizar estado do painel de progresso e do FAB pulsante
    syncProgressPanelState();

    // Trigger preview render so that default or stored messages show correctly on tab initialization
    updateLivePreview();
  }

  function updateLiveTelemetry(campObj, delay) {
    const total = campaignRunner.contactsList.length;
    const current = campaignRunner.currentIndex;
    const sucesso = campObj.sucesso;
    const falhas = campObj.falhas;
    const batchSize = campaignRunner.batchSize;
    const batchPause = campaignRunner.batchPause;

    // Sucesso elements
    const successValEl = document.getElementById('telemetry-success-val');
    const successRateEl = document.getElementById('telemetry-success-rate');
    if (successValEl) successValEl.textContent = sucesso;
    if (successRateEl) {
      const rate = current > 0 ? Math.round((sucesso / current) * 100) : 100;
      successRateEl.textContent = `${rate}% de taxa`;
    }

    // Falhas elements
    const failValEl = document.getElementById('telemetry-fail-val');
    const failRateEl = document.getElementById('telemetry-fail-rate');
    if (failValEl) failValEl.textContent = falhas;
    if (failRateEl) {
      const rate = current > 0 ? Math.round((falhas / current) * 100) : 0;
      failRateEl.textContent = `${rate}% de taxa`;
    }

    // ETR elements
    const etrValEl = document.getElementById('telemetry-etr-val');
    if (etrValEl) {
      const remainingCount = total - current;
      let remainingPauses = 0;
      for (let i = current; i < total; i++) {
        if (i > current && i % batchSize === 0) {
          remainingPauses++;
        }
      }
      const etrSeconds = (remainingCount * delay) + (remainingPauses * batchPause);
      
      let etrText = '0s';
      if (remainingCount > 0) {
        if (etrSeconds >= 3600) {
          const hours = Math.floor(etrSeconds / 3600);
          const mins = Math.floor((etrSeconds % 3600) / 60);
          const secs = etrSeconds % 60;
          etrText = `~${hours}h ${mins}m ${secs}s`;
        } else if (etrSeconds >= 60) {
          const mins = Math.floor(etrSeconds / 60);
          const secs = etrSeconds % 60;
          etrText = `~${mins}m ${secs}s`;
        } else {
          etrText = `${etrSeconds}s`;
        }
      } else {
        etrText = '0s';
      }
      etrValEl.textContent = etrText;
    }

    // Batch elements
    const batchValEl = document.getElementById('telemetry-batch-val');
    const batchDescEl = document.getElementById('telemetry-batch-desc');
    if (batchValEl) {
      const currentBatchCount = current % batchSize;
      batchValEl.textContent = `${currentBatchCount}/${batchSize}`;
    }
    if (batchDescEl) {
      const currentBatch = Math.floor(current / batchSize) + 1;
      const totalBatches = Math.ceil(total / batchSize);
      batchDescEl.textContent = `Lote ${currentBatch}/${totalBatches} | Pausa ${batchPause}s`;
    }
  }

  function updateSimulatorPreview(name, messageText) {
    const nameEl = document.querySelector('.phone-header .contact-name');
    const bubble = document.getElementById('preview-bubble');
    if (nameEl) nameEl.textContent = name;
    if (bubble) {
      let text = messageText;
      
      // Escape HTML tags to avoid formatting issues
      text = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // Handle newlines as HTML line breaks
      text = text.replace(/\n/g, '<br>');

      // Markdown simple replacements
      text = text.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
      text = text.replace(/_(.*?)_/g, '<em>$1</em>');
      text = text.replace(/```(.*?)```/g, '<code class="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[9px]">$1</code>');
      text = text.replace(/~(.*?)~/g, '<del>$1</del>');

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      // Dynamically update the smartphone clock
      const phoneClock = document.getElementById('phone-clock');
      if (phoneClock) {
        phoneClock.textContent = timeStr;
      }

      bubble.innerHTML = `${text}<span class="flex items-center justify-end gap-1 text-[7px] text-slate-500/80 dark:text-white/40 mt-1 font-mono">${timeStr} <i class="fa-solid fa-check-double text-sky-500 text-[8px]"></i></span>`;

      // Auto-scroll phone simulator to bottom
      const chatArea = bubble.closest('.phone-chat-area');
      if (chatArea) {
        chatArea.scrollTop = chatArea.scrollHeight;
      }
    }
  }

  // Delay input change listener
  document.addEventListener('input', (e) => {
    if (e.target.id === 'send-delay') {
      updateActiveStats();
    }
  });

  function parseContactsFromInput(inputText) {
    const lines = inputText.split('\n');
    const loadedContacts = [];
    const seenPhones = new Set();
    
    lines.forEach(line => {
      if (!line.trim()) return;
      const parts = line.split(',');
      const phone = parts[0].trim().replace(/\D/g, "");
      const nome = parts[1] ? parts[1].trim() : 'Cliente';
      const cupom = parts[2] ? parts[2].trim() : 'ZAPFLOW';
      const premio = parts[3] ? parts[3].trim() : 'Prêmio';
      const resultado = parts[4] ? parts[4].trim() : '';
      const link = parts[5] ? parts[5].trim() : '';

      if (phone.length >= 8 && !seenPhones.has(phone)) {
        seenPhones.add(phone);
        loadedContacts.push({ phone, nome, cupom, premio, resultado, link });
      }
    });

    state.contacts = loadedContacts;
    updateContactsStats();
    return loadedContacts;
  }

  // MOTOR DE DISPARO (RUNNER)
  let campaignRunner = {
    isRunning: false,
    isPaused: false,
    currentIndex: 0,
    contactsList: [],
    timer: null,
    countdownInterval: null,
    campaignObject: null,
    batchSize: 40,
    batchPause: 30
  };

  // --- CONTROLE DO MODAL DE PROCESSO & FAB FLUTUANTE ---
  window.openProgressModal = () => {
    const modal = document.getElementById('progress-panel');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
    syncProgressPanelState();
  };

  window.closeProgressModal = () => {
    const modal = document.getElementById('progress-panel');
    if (modal) {
      modal.classList.remove('flex');
      modal.classList.add('hidden');
    }
    syncProgressPanelState();
  };

  function syncProgressPanelState() {
    const modal = document.getElementById('progress-panel');
    const fab = document.getElementById('active-campaign-fab');
    const fabPercent = document.getElementById('fab-percent');
    
    if (!modal || !fab) return;

    if (campaignRunner.isRunning) {
      if (modal.classList.contains('hidden')) {
        fab.classList.remove('hidden');
        if (fabPercent) {
          const total = campaignRunner.contactsList.length || 1;
          const percent = Math.round((campaignRunner.currentIndex / total) * 100) || 0;
          fabPercent.textContent = `${percent}%`;
        }
      } else {
        fab.classList.add('hidden');
      }
    } else {
      fab.classList.add('hidden');
    }
  }

  // Submissão do Formulário de Campanhas
  document.addEventListener('submit', async (e) => {
    if (e.target.id === 'campaign-form') {
      e.preventDefault();

      if (!state.apiConnected) {
        showToast('Evolution API desconectada! Conecte antes de disparar.', 'warning');
        return;
      }

      const campName = document.getElementById('camp-name').value;
      const campType = document.getElementById('camp-type').value;
      const delay = parseInt(document.getElementById('send-delay').value) || 5;
      const batchSize = parseInt(document.getElementById('batch-size').value) || 40;
      const batchPause = parseInt(document.getElementById('batch-pause').value) || 30;
      const msgTemplate = document.getElementById('message-template').value;
      
      // Salva a mensagem configurada para o painel geral
      localStorage.setItem('lastMessageTemplate', msgTemplate);
      const manualVal = document.getElementById('manual-contacts').value;

      const contatosAEnviar = parseContactsFromInput(manualVal);
      if (contatosAEnviar.length === 0) {
        showToast('Por favor, adicione contatos antes de iniciar os disparos.', 'warning');
        return;
      }

      const totalLotes = Math.ceil(contatosAEnviar.length / batchSize);
      writeConsoleLog(`Deduplicação concluída: ${contatosAEnviar.length} contatos únicos em ${totalLotes} lote(s) de ${batchSize}.`, 'info');

      // Criar campanha no SQLite
      try {
        const response = await fetch(`${API_BASE}/api/campaigns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: campName,
            type: campType,
            total: contatosAEnviar.length,
            status: 'Rodando',
            date: new Date().toLocaleDateString()
          })
        });

        if (response.ok) {
          const campaignCreated = await response.json();
          showToast('Campanha criada no banco SQLite. Iniciando disparos...', 'success');
          
          // Exibir console e painel de progresso
          window.openProgressModal();
          
          const title = document.getElementById('progress-camp-name');
          const details = document.getElementById('progress-details');
          const pct = document.getElementById('progress-percent');
          const ratio = document.getElementById('progress-ratio');
          const bar = document.getElementById('progress-bar-fill');

          if (title) title.textContent = `Campanha: ${campName}`;
          if (details) details.textContent = `Preparando mensagens...`;
          if (pct) pct.textContent = '0%';
          if (ratio) ratio.textContent = `0 / ${contatosAEnviar.length}`;
          if (bar) bar.style.width = '0%';

          const consoleLogs = document.getElementById('console-logs');
          if (consoleLogs) {
            consoleLogs.innerHTML = '';
          }
          writeConsoleLog('Inicializando campanha no SQLite...', 'info');

          // Ativar motor
          campaignRunner.isRunning = true;
          campaignRunner.isPaused = false;
          campaignRunner.currentIndex = 0;
          campaignRunner.contactsList = contatosAEnviar;
          campaignRunner.batchSize = batchSize;
          campaignRunner.batchPause = batchPause;
          campaignRunner.countdownInterval = null;
          campaignRunner.campaignObject = campaignCreated;

          // Inicializa as telemetrias
          updateLiveTelemetry(campaignCreated, delay);

          // Exibe o banner de campanha na aba de conversas
          const convBanner = document.getElementById('conversas-campaign-banner');
          if (convBanner) {
            convBanner.classList.remove('hidden');
            convBanner.classList.add('flex');
            
            const convCampName = document.getElementById('conversas-banner-camp-name');
            const convProgress = document.getElementById('conversas-banner-progress');
            const convPercent = document.getElementById('conversas-banner-percent');
            
            if (convCampName) convCampName.textContent = `Campanha: ${campName}`;
            if (convProgress) convProgress.textContent = `0 / ${contatosAEnviar.length}`;
            if (convPercent) convPercent.textContent = `0% concluído`;
          }

          runNextSend(delay, msgTemplate, campaignCreated);
        }
      } catch (err) {
        showToast('Erro de conexão ao criar a campanha.', 'error');
      }
    }
  });

  async function runNextSend(delay, template, campObj) {
    if (!campaignRunner.isRunning) return;
    
    if (campaignRunner.isPaused) {
      writeConsoleLog('Disparos pausados pelo usuário.', 'warning');
      return;
    }

    if (campaignRunner.currentIndex >= campaignRunner.contactsList.length) {
      campaignRunner.isRunning = false;
      syncProgressPanelState();
      writeConsoleLog(`Campanha finalizada! Total de mensagens enviadas: ${campaignRunner.currentIndex}`, 'success');
      
      const details = document.getElementById('progress-details');
      if (details) details.textContent = 'Campanha concluída com sucesso!';
      
      // Esconde o banner de campanha na aba de conversas
      const convBanner = document.getElementById('conversas-campaign-banner');
      if (convBanner) {
        convBanner.classList.remove('flex');
        convBanner.classList.add('hidden');
      }

      // Atualizar progresso final no SQLite
      await updateCampaignOnBackend(campObj.id, campObj.sucesso, campObj.falhas, 'Concluído');
      await fetchCampaignsAndLogs();
      showToast('Campanha de disparos concluída!', 'success');
      return;
    }

    const contact = campaignRunner.contactsList[campaignRunner.currentIndex];
    writeConsoleLog(`[${campaignRunner.currentIndex + 1}/${campaignRunner.contactsList.length}] Enviando para ${contact.nome} (${contact.phone})...`, 'info');

    const finalMsg = template
      .replace(/{nome}/g, contact.nome)
      .replace(/{cupom}/g, contact.cupom && contact.cupom !== 'ZAPFLOW' ? contact.cupom : (state.defaultCupom || ''))
      .replace(/{link}/g, contact.link ? contact.link : (state.defaultLink || ''));

    // Atualiza o simulador em tempo real
    updateSimulatorPreview(contact.nome, finalMsg);

    // Disparo REAL via proxy do backend
    let success = false;
    try {
      const response = await fetch(`${API_BASE}/api/instance/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: contact.phone, text: finalMsg })
      });
      if (response.ok) {
        success = true;
      }
    } catch (e) {
      console.warn('Falha na chamada do backend. Usando simulação.');
    }

    const nowStr = new Date().toLocaleString();
    if (success) {
      campObj.sucesso++;
      writeConsoleLog(`✓ Sucesso: Mensagem enviada para ${contact.nome}!`, 'success');
      await createLogOnBackend(nowStr, campObj.name, contact.nome, contact.phone, finalMsg, 'Sucesso');
    } else {
      campObj.falhas++;
      writeConsoleLog(`✗ Falha: Não foi possível enviar para ${contact.nome}.`, 'error');
      await createLogOnBackend(nowStr, campObj.name, contact.nome, contact.phone, finalMsg, 'Falha');
    }

    // Atualizar campanha corrente no banco a cada disparo
    await updateCampaignOnBackend(campObj.id, campObj.sucesso, campObj.falhas, 'Rodando');

    // Incrementar índice
    campaignRunner.currentIndex++;

    // Atualizar UI
    const percent = Math.round((campaignRunner.currentIndex / campaignRunner.contactsList.length) * 100);
    
    const pct = document.getElementById('progress-percent');
    const ratio = document.getElementById('progress-ratio');
    const bar = document.getElementById('progress-bar-fill');
    const details = document.getElementById('progress-details');

    if (pct) pct.textContent = `${percent}%`;
    if (ratio) ratio.textContent = `${campaignRunner.currentIndex} / ${campaignRunner.contactsList.length}`;
    if (bar) bar.style.width = `${percent}%`;
    if (details) details.textContent = `Enviados: ${campObj.sucesso} | Falhas: ${campObj.falhas}`;

    // Informação de lote na barra de progresso
    const currentBatch = Math.floor((campaignRunner.currentIndex - 1) / campaignRunner.batchSize) + 1;
    const totalBatches = Math.ceil(campaignRunner.contactsList.length / campaignRunner.batchSize);
    if (details) details.textContent = `Lote ${currentBatch}/${totalBatches} | Enviados: ${campObj.sucesso} | Falhas: ${campObj.falhas}`;

    // Atualizar o banner de campanha na aba de conversas
    const convBanner = document.getElementById('conversas-campaign-banner');
    if (convBanner) {
      if (campaignRunner.isRunning) {
        convBanner.classList.remove('hidden');
        convBanner.classList.add('flex');
        
        const convCampName = document.getElementById('conversas-banner-camp-name');
        const convProgress = document.getElementById('conversas-banner-progress');
        const convPercent = document.getElementById('conversas-banner-percent');
        
        if (convCampName) convCampName.textContent = `Campanha: ${campObj.name}`;
        if (convProgress) convProgress.textContent = `${campaignRunner.currentIndex} / ${campaignRunner.contactsList.length}`;
        if (convPercent) convPercent.textContent = `${percent}% concluído`;
      } else {
        convBanner.classList.remove('flex');
        convBanner.classList.add('hidden');
      }
    }

    // Atualizar os cartões de telemetria em tempo real
    updateLiveTelemetry(campObj, delay);

    // Sincronizar o progresso no FAB pulsante caso o modal esteja fechado/minimizado
    syncProgressPanelState();

    // RATE LIMITING: Verificar se atingiu o limite do lote atual e ainda restam contatos
    const { batchSize, batchPause } = campaignRunner;
    if (campaignRunner.currentIndex < campaignRunner.contactsList.length && campaignRunner.currentIndex % batchSize === 0) {
      const loteAtual = Math.floor(campaignRunner.currentIndex / batchSize);
      const totalLotes = Math.ceil(campaignRunner.contactsList.length / batchSize);
      writeConsoleLog(`⏸ Lote ${loteAtual}/${totalLotes} concluído (${batchSize} envios). Aguardando ${batchPause}s antes do próximo lote...`, 'warning');
      
      const details2 = document.getElementById('progress-details');
      if (details2) details2.textContent = `Pausa entre lotes — Lote ${loteAtual}/${totalLotes} (${batchPause}s restantes)`;
      
      showToast(`Lote ${loteAtual} concluído. Pausa de ${batchPause}s anti-ban...`, 'info');

      // Countdown visual no console e telemetria
      let countdown = batchPause;
      const batchValEl = document.getElementById('telemetry-batch-val');
      const batchDescEl = document.getElementById('telemetry-batch-desc');
      if (batchValEl) batchValEl.textContent = 'PAUSA';
      if (batchDescEl) batchDescEl.textContent = `Aguardando ${countdown}s...`;

      campaignRunner.countdownInterval = setInterval(() => {
        countdown--;
        const d = document.getElementById('progress-details');
        if (d && countdown > 0) d.textContent = `Pausa entre lotes — Lote ${loteAtual}/${totalLotes} (${countdown}s restantes)`;
        if (batchDescEl && countdown > 0) batchDescEl.textContent = `Retomando em ${countdown}s`;
      }, 1000);

      campaignRunner.timer = setTimeout(() => {
        if (campaignRunner.countdownInterval) {
          clearInterval(campaignRunner.countdownInterval);
          campaignRunner.countdownInterval = null;
        }
        
        // Atualiza UI de progresso imediatamente ao retomar
        const d = document.getElementById('progress-details');
        const batchDescEl = document.getElementById('telemetry-batch-desc');
        if (d) d.textContent = `Preparando mensagens — Lote ${loteAtual + 1}/${totalLotes}...`;
        if (batchDescEl) batchDescEl.textContent = `Retomando...`;

        writeConsoleLog(`▶ Retomando envios — Lote ${loteAtual + 1}/${totalLotes}...`, 'info');
        runNextSend(delay, template, campObj);
      }, batchPause * 1000);
    } else {
      // Loop normal — próximo envio individual
      campaignRunner.timer = setTimeout(() => {
        runNextSend(delay, template, campObj);
      }, delay * 1000);
    }
  }

  // Salvar LOG no backend SQLite
  async function createLogOnBackend(date, campaign, contact, phone, message, status) {
    try {
      await fetch(`${API_BASE}/api/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date, campaign, contact, phone, message: message.substring(0, 80), status
        })
      });
    } catch (e) {
      console.error('Erro ao registrar log:', e);
    }
  }

  // Atualizar Campanha no backend SQLite
  async function updateCampaignOnBackend(id, sucesso, falhas, status) {
    try {
      await fetch(`${API_BASE}/api/campaigns/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sucesso, falhas, status })
      });
    } catch (e) {
      console.error('Erro ao atualizar campanha:', e);
    }
  }

  let currentLogFilter = 'all';

  window.filterConsoleLogs = function(type) {
    currentLogFilter = type;
    
    // Update active button state
    const filterButtons = document.querySelectorAll('.terminal-filter-btn');
    filterButtons.forEach(btn => {
      btn.classList.remove('active');
    });
    
    const activeBtn = document.getElementById(`filter-log-${type}`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }
    
    applyConsoleFilters();
  };

  function applyConsoleFilters() {
    const lines = document.querySelectorAll('.console-line');
    lines.forEach(line => {
      if (currentLogFilter === 'all') {
        line.classList.remove('hidden');
      } else {
        if (line.classList.contains(`log-type-${currentLogFilter}`)) {
          line.classList.remove('hidden');
        } else {
          line.classList.add('hidden');
        }
      }
    });
  }

  function writeConsoleLog(msg, type = 'info') {
    const consoleLogs = document.getElementById('console-logs');
    if (!consoleLogs) return;

    const line = document.createElement('div');
    line.className = `console-line log-type-${type}`;
    
    const tagLabels = {
      info: 'INFO',
      success: 'SUCESSO',
      error: 'ERRO',
      warning: 'AVISO'
    };
    const tagLabel = tagLabels[type] || type.toUpperCase();

    line.innerHTML = `
      <span class="timestamp">[${new Date().toLocaleTimeString()}]</span>
      <span class="tag ${type}">${tagLabel}</span>
      <span class="msg-content">${msg}</span>
    `;
    consoleLogs.appendChild(line);
    consoleLogs.scrollTop = consoleLogs.scrollHeight;
    
    applyConsoleFilters();
  }

  // Controles de Pausa/Cancelamento de Campanha
  document.addEventListener('click', async (e) => {
    const pauseBtn = e.target.closest('#btn-pause-campaign');
    if (pauseBtn) {
      if (!campaignRunner.isRunning) return;
      
      if (campaignRunner.isPaused) {
        campaignRunner.isPaused = false;
        pauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pausar';
        writeConsoleLog('Disparos retomados pelo usuário.', 'info');
        showToast('Envios retomados!', 'info');
        
        const delay = parseInt(document.getElementById('send-delay').value) || 5;
        const msgTemplate = document.getElementById('message-template').value;
        const currentCamp = campaignRunner.campaignObject;
        runNextSend(delay, msgTemplate, currentCamp);
      } else {
        campaignRunner.isPaused = true;
        if (campaignRunner.timer) {
          clearTimeout(campaignRunner.timer);
          campaignRunner.timer = null;
        }
        if (campaignRunner.countdownInterval) {
          clearInterval(campaignRunner.countdownInterval);
          campaignRunner.countdownInterval = null;
        }
        pauseBtn.innerHTML = '<i class="fa-solid fa-play"></i> Retomar';
        writeConsoleLog('Campanha pausada pelo usuário. Aguardando...', 'warning');
        showToast('Campanha pausada.', 'warning');
      }
    }

    const cancelBtn = e.target.closest('#btn-cancel-campaign');
    if (cancelBtn) {
      if (confirm('Deseja realmente cancelar esta campanha?')) {
        if (campaignRunner.timer) {
          clearTimeout(campaignRunner.timer);
          campaignRunner.timer = null;
        }
        if (campaignRunner.countdownInterval) {
          clearInterval(campaignRunner.countdownInterval);
          campaignRunner.countdownInterval = null;
        }
        campaignRunner.isRunning = false;
        campaignRunner.isPaused = false;
        syncProgressPanelState();
        
        writeConsoleLog('🚫 Campanha cancelada.', 'error');
        const details = document.getElementById('progress-details');
        if (details) details.textContent = 'Campanha cancelada.';
        
        // Esconde o banner de campanha na aba de conversas
        const convBanner = document.getElementById('conversas-campaign-banner');
        if (convBanner) {
          convBanner.classList.remove('flex');
          convBanner.classList.add('hidden');
        }

        const currentCamp = campaignRunner.campaignObject;
        if (currentCamp) {
          await updateCampaignOnBackend(currentCamp.id, currentCamp.sucesso, currentCamp.falhas, 'Cancelado');
          await fetchCampaignsAndLogs();
        }
        showToast('Campanha cancelada com sucesso.', 'error');
      }
    }
  });



  // --- CARREGAR DADOS DO BACKEND SQLITE ---

  async function fetchCampaignsAndLogs() {
    try {
      // 1. Campanhas
      const campResponse = await fetch(`${API_BASE}/api/campaigns`);
      if (campResponse.ok) {
        state.campaigns = await campResponse.json();
        renderRecentCampaigns();
      }

      // 2. Logs
      const logResponse = await fetch(`${API_BASE}/api/logs`);
      if (logResponse.ok) {
        state.logs = await logResponse.json();
        renderLogs();
      }

      // 3. Estatísticas
      calculateStatsFromData();
    } catch (e) {
      console.error('Erro de sincronização SQLite:', e);
    }
  }

  function calculateStatsFromData() {
    state.stats.total = state.logs.length;
    state.stats.sucesso = state.logs.filter(l => l.status === 'Sucesso').length;
    state.stats.falhas = state.logs.filter(l => l.status === 'Falha').length;
    renderStats();
  }

  function renderStats() {
    const totalEl = document.getElementById('stat-total-disparos');
    const sucEl = document.getElementById('stat-sucesso');
    const falEl = document.getElementById('stat-falhas');
    const instEl = document.getElementById('stat-instancias');

    const total = state.stats.total || 0;
    const sucesso = state.stats.sucesso || 0;
    const falhas = state.stats.falhas || 0;

    if (totalEl) totalEl.textContent = total;
    if (sucEl) sucEl.textContent = sucesso;
    if (falEl) falEl.textContent = falhas;
    if (instEl) instEl.textContent = state.stats.instancias;

    // 1. Taxa de Entrega Gauge (Circular SVG com Sucesso em verde e Falha em vermelho)
    const percentEl = document.getElementById('delivery-rate-percent');
    const circleEl = document.getElementById('dashboard-delivery-circle');
    const successRate = total > 0 ? Math.round((sucesso / total) * 100) : 0;
    const failRate = total > 0 ? 100 - successRate : 0;

    if (percentEl) percentEl.textContent = `${successRate}%`;
    
    // Atualiza os badges da legenda (Sucesso e Falha)
    const successBadgeEl = document.getElementById('delivery-success-percent-badge');
    const failBadgeEl = document.getElementById('delivery-fail-percent-badge');
    if (successBadgeEl) successBadgeEl.textContent = `${successRate}%`;
    if (failBadgeEl) failBadgeEl.textContent = `${failRate}%`;

    if (circleEl) {
      const backgroundCircle = circleEl.previousElementSibling;
      if (backgroundCircle) {
        if (total > 0) {
          // O fundo do círculo representa a falha (vermelho)
          backgroundCircle.style.color = '#ef4444';
          backgroundCircle.classList.remove('text-slate-100', 'dark:text-slate-800/60');
        } else {
          // Cinza padrão se não houver disparos
          backgroundCircle.style.color = '';
          backgroundCircle.classList.add('text-slate-100', 'dark:text-slate-800/60');
        }
      }
      const offset = 251.2 - (successRate / 100) * 251.2;
      circleEl.style.strokeDashoffset = offset;
    }

    // 2. Última Mensagem Configurada
    const msgEl = document.getElementById('dashboard-last-message');
    if (msgEl) {
      const lastMsg = localStorage.getItem('lastMessageTemplate') || 'Olá! Esta é uma demonstração do preview em tempo real. Digite sua mensagem no campo ao lado.';
      msgEl.textContent = lastMsg;
    }

    // 3. Últimos 5 Disparos (Feed de logs em tempo real)
    const dispatchesBox = document.getElementById('dashboard-recent-dispatches');
    if (dispatchesBox) {
      if (state.logs.length === 0) {
        dispatchesBox.innerHTML = `
          <div class="flex items-center justify-center p-8 text-slate-400">
            <div class="text-center">
              <i class="fa-solid fa-clock-rotate-left text-3xl mb-2 opacity-50"></i>
              <p class="text-xs font-bold uppercase tracking-wider">Nenhum disparo recente</p>
            </div>
          </div>
        `;
      } else {
        dispatchesBox.innerHTML = [...state.logs.slice(0, 5)].reverse().map(log => {
          const statusColors = {
            'Sucesso': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
            'Falha': 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
          };
          const statusBadge = statusColors[log.status] || 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20';
          const icon = log.status === 'Sucesso' ? 'fa-solid fa-circle-check text-emerald-500' : 'fa-solid fa-triangle-exclamation text-rose-500';

          return `
            <div class="flex items-center justify-between p-3.5 bg-slate-900/5 dark:bg-white/5 border border-slate-900/5 dark:border-white/5 rounded-2xl group hover:border-emerald-500/30 transition-all duration-300">
              <div class="flex items-center gap-3.5 min-w-0">
                <div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-550 dark:text-slate-400 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-200/50 dark:border-white/5">
                  <i class="${icon} text-xs"></i>
                </div>
                <div class="min-w-0">
                  <div class="text-[11px] font-black text-slate-800 dark:text-white truncate uppercase tracking-tight">${log.contact} (${log.phone})</div>
                  <div class="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5 truncate max-w-[250px]">${log.message}</div>
                </div>
              </div>
              <span class="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${statusBadge} shrink-0">${log.status}</span>
            </div>
          `;
        }).join('');
      }
    }
  }

  function renderRecentCampaigns() {
    const box = document.getElementById('dashboard-recent-campaigns');
    if (!box) return;

    if (state.campaigns.length === 0) {
      box.innerHTML = `
        <div class="flex items-center justify-center p-8 text-slate-400">
          <div class="text-center">
            <i class="fa-solid fa-folder-open text-3xl mb-2 opacity-50"></i>
            <p class="text-xs font-bold uppercase tracking-wider">Nenhuma campanha cadastrada no SQLite</p>
          </div>
        </div>
      `;
      return;
    }

    box.innerHTML = state.campaigns.slice(0, 5).map(camp => {
      const badgeColors = {
        promo: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
        resultado: 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
      };
      const campBadge = badgeColors[camp.type] || 'bg-slate-500/10 text-slate-600 dark:text-slate-400';
      
      const statusColors = {
        'Concluído': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
        'Rodando': 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 animate-pulse',
        'Cancelado': 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
      };
      const statusBadge = statusColors[camp.status] || 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20';

      return `
        <div class="flex items-center justify-between p-4 bg-slate-900/5 dark:bg-white/5 border border-slate-900/5 dark:border-white/5 rounded-2xl group hover:border-purple-500/30 transition-all duration-300">
          <div class="flex items-center gap-3.5 min-w-0">
            <span class="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${campBadge} shrink-0">${camp.type}</span>
            <div class="min-w-0">
              <div class="text-[12px] font-black text-slate-800 dark:text-white truncate uppercase tracking-tight">${camp.name}</div>
              <div class="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">${camp.date} • Total: ${camp.total} | Env: ${camp.sucesso} | Falh: ${camp.falhas}</div>
            </div>
          </div>
          <span class="px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest ${statusBadge} shrink-0">${camp.status}</span>
        </div>
      `;
    }).join('');
  }

  function renderLogs() {
    const tbody = document.getElementById('logs-table-body');
    if (!tbody) return;

    if (state.logs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-10 text-slate-400">
            Nenhum disparo registrado no SQLite.
          </td>
        </tr>
      `;
      const loadMoreContainer = document.getElementById('logs-load-more-container');
      if (loadMoreContainer) {
        loadMoreContainer.classList.add('hidden');
      }
      return;
    }

    const visibleLogs = state.logs.slice(0, state.logsVisibleCount);

    tbody.innerHTML = visibleLogs.map(log => {
      const statusColors = {
        'Sucesso': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
        'Falha': 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
      };
      const statusBadge = statusColors[log.status] || 'bg-slate-500/10 text-slate-600 dark:text-slate-400';

      return `
        <tr class="hover:bg-slate-900/5 dark:hover:bg-white/5 transition-colors">
          <td class="py-4 px-5 font-mono text-[10px] uppercase tracking-wider">${log.date}</td>
          <td class="py-4 px-5 uppercase tracking-tight text-slate-800 dark:text-white">${log.campaign}</td>
          <td class="py-4 px-5 uppercase tracking-tight">${log.contact}</td>
          <td class="py-4 px-5 font-mono text-[10px]">${log.phone}</td>
          <td class="py-4 px-5 font-semibold text-slate-400 max-w-[200px] truncate" title="${log.message}">${log.message}</td>
          <td class="py-4 px-5">
            <span class="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${statusBadge}">${log.status}</span>
          </td>
        </tr>
      `;
    }).join('');

    const loadMoreContainer = document.getElementById('logs-load-more-container');
    if (loadMoreContainer) {
      if (state.logs.length > state.logsVisibleCount) {
        loadMoreContainer.classList.remove('hidden');
      } else {
        loadMoreContainer.classList.add('hidden');
      }
    }
  }

  // Limpar logs
  document.addEventListener('click', async (e) => {
    const clearBtn = e.target.closest('#btn-clear-logs');
    if (clearBtn) {
      if (confirm('Deseja realmente limpar todos os logs do banco SQLite?')) {
        try {
          const response = await fetch(`${API_BASE}/api/logs/clear`, { method: 'DELETE' });
          if (response.ok) {
            showToast('Histórico de logs deletado com sucesso!', 'success');
            await fetchCampaignsAndLogs();
          }
        } catch (e) {
          showToast('Erro ao deletar logs.', 'error');
        }
      }
    }

    // Carregar mais logs
    const loadMoreBtn = e.target.closest('#btn-load-more-logs');
    if (loadMoreBtn) {
      state.logsVisibleCount += 20;
      renderLogs();
    }
  });

  // --- WHATSAPP CHATS INTERACTIVE LOGIC ---
  let activeChatId = null;
  let activeChatName = null;
  let activeChatPhone = null;
  let chatAttachmentFile = null;
  let activeChatsData = [];

  const emojisList = {
    smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓'],
    vehicles: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🛵', '🏍️', '🛺', '🚲', '🛴', '🛹', '🛞', '🚨', '✈️', '🛫', '🛬', '🛸', '🚁', '🛶', '⛵', '🚤', '🛳️', '⛴️', '🚢', '🚂', '🚆', '🚄', '🚀', '🛸'],
    tools: ['🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪓', '🔩', '⚙️', '🧱', '⛓️', '🧲', '🔫', '💣', '🪃', '🏹', '🛡️', '🪚', '🔧', '🪛', '🪝', '🪜', '⚙️', '🗜️', '⚖️', '🔗', '⛓️', '🧰', '🧲', '🧪', '🧪', '🧬', '🔬', '🔭', '📡', '🕯️', '🪔', '🧯']
  };

  window.loadChatsList = async (showSpinner = true) => {
    const listEl = document.getElementById('contactsList');
    const countEl = document.getElementById('contactsCount');
    if (!listEl) return;

    if (showSpinner) {
      listEl.innerHTML = `
        <div class="space-y-3 animate-pulse">
          <div class="flex items-center gap-3.5 p-3.5 bg-slate-200/20 dark:bg-slate-800/10 rounded-xl">
            <div class="w-11 h-11 rounded-lg bg-slate-200 dark:bg-slate-800 shrink-0"></div>
            <div class="flex-1 space-y-2">
              <div class="h-3 bg-slate-200 dark:bg-slate-750 rounded w-1/3"></div>
              <div class="h-2.5 bg-slate-150 dark:bg-slate-800 rounded w-2/3"></div>
            </div>
          </div>
          <div class="flex items-center gap-3.5 p-3.5 bg-slate-200/20 dark:bg-slate-800/10 rounded-xl">
            <div class="w-11 h-11 rounded-lg bg-slate-200 dark:bg-slate-800 shrink-0"></div>
            <div class="flex-1 space-y-2">
              <div class="h-3 bg-slate-200 dark:bg-slate-750 rounded w-1/4"></div>
              <div class="h-2.5 bg-slate-150 dark:bg-slate-800 rounded w-3/4"></div>
            </div>
          </div>
        </div>
      `;
    }

    try {
      const response = await fetch(`${API_BASE}/api/whatsapp/chats`);
      if (response.ok) {
        const data = await response.json();
        const chats = data.chats || [];
        activeChatsData = chats;

        if (countEl) {
          countEl.innerHTML = `
            <span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 ${chats.length > 0 ? 'animate-ping' : ''}"></span>
            <span>${chats.length} ${chats.length === 1 ? 'Conversa' : 'Conversas'}</span>
          `;
        }

        if (chats.length === 0) {
          listEl.innerHTML = `
            <div class="text-center py-8 text-slate-400">
              <i class="fa-regular fa-folder-open text-2xl mb-2 opacity-50"></i>
              <p class="text-[10px] font-black uppercase tracking-wider">Nenhum chat ativo</p>
            </div>
          `;
          return;
        }

        renderChatsSidebar(chats);
      } else {
        if (countEl) countEl.innerHTML = '<span>Desconectado</span>';
        listEl.innerHTML = `
          <div class="text-center py-8 text-rose-500 bg-rose-500/5 rounded-xl border border-rose-500/10 p-4">
            <i class="fa-solid fa-circle-exclamation text-2xl mb-2"></i>
            <p class="text-[10px] font-black uppercase tracking-wider">Erro ao listar chats</p>
          </div>
        `;
      }
    } catch (e) {
      console.error(e);
      if (countEl) countEl.innerHTML = '<span>Erro de Conexão</span>';
      listEl.innerHTML = `
        <div class="text-center py-8 text-rose-500 bg-rose-500/5 rounded-xl border border-rose-500/10 p-4">
          <i class="fa-solid fa-triangle-exclamation text-2xl mb-2"></i>
          <p class="text-[10px] font-black uppercase tracking-wider">Falha de conexão com o servidor</p>
        </div>
      `;
    }
  };

  function renderChatsSidebar(chats) {
    const listEl = document.getElementById('contactsList');
    if (!listEl) return;

    listEl.innerHTML = chats.map(chat => {
      const name = chat.name || chat.pushName || chat.remoteJid || chat.id || 'Sem Nome';
      const lastMsgText = chat.lastMessage?.message?.conversation || chat.lastMessage?.message?.extendedTextMessage?.text || chat.lastMessage?.conversation || chat.conversation || '';
      const unread = chat.unreadCount || 0;
      const timestamp = chat.messageTimestamp || chat.lastMessage?.messageTimestamp || null;

      let timeStr = '';
      if (timestamp) {
        const ms = timestamp > 9999999999 ? timestamp : timestamp * 1000;
        const dateObj = new Date(ms);
        timeStr = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      }

      const avatar = chat.profilePicUrl || chat.avatar || '-';
      const phone = chat.id || chat.remoteJid;

      const isSelected = activeChatId === chat.id;
      const activeClass = isSelected 
        ? 'bg-emerald-500/10 dark:bg-emerald-500/5 border-emerald-500/30 active-chat' 
        : 'bg-white dark:bg-white/5 border-slate-200/50 dark:border-white/5';

      return `
        <div onclick="window.selectChat('${chat.id}', '${name.replace(/'/g, "\\'")}', '${avatar}', '${phone}')" 
             class="flex items-center gap-3.5 p-3.5 ${activeClass} sidebar-premium-item animate-slide-up-item hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl border cursor-pointer transition-all duration-300 group select-none">
          <div class="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-500/20 group-hover:scale-105 transition-all">
            ${avatar !== '-' ? `<img src="${avatar}" class="w-full h-full object-cover rounded-lg">` : name.substring(0, 2).toUpperCase()}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-black text-slate-800 dark:text-white truncate uppercase tracking-tight">${name}</span>
              <span class="text-[8px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest shrink-0">${timeStr}</span>
            </div>
            <div class="flex items-center justify-between mt-1">
              <p class="text-[10px] text-slate-400 dark:text-slate-500 truncate pr-2">${lastMsgText || 'Nenhuma mensagem'}</p>
              ${unread > 0 ? `
              <span class="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[8px] font-black tracking-tighter shrink-0 animate-pulse">${unread}</span>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  window.selectChat = async (chatId, chatName, chatAvatar, chatPhone, showLoading = true) => {
    activeChatId = chatId;
    activeChatName = chatName;
    activeChatPhone = chatPhone || chatId.split('@')[0];

    const chatItems = document.querySelectorAll('#contactsList > div[onclick]');
    chatItems.forEach(item => {
      if (item.getAttribute('onclick').includes(chatId)) {
        item.className = 'flex items-center gap-3.5 p-3.5 bg-emerald-500/10 dark:bg-emerald-500/5 hover:bg-emerald-500/10 rounded-xl border border-emerald-500/30 active-chat sidebar-premium-item cursor-pointer transition-all duration-300 group';
      } else {
        item.className = 'flex items-center gap-3.5 p-3.5 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl border border-slate-200/50 dark:border-white/5 sidebar-premium-item cursor-pointer transition-all duration-300 group';
      }
    });

    const titleEl = document.getElementById('chat-title');
    const numberEl = document.getElementById('chat-number');
    const avatarEl = document.getElementById('chat-avatar');
    const statusTextEl = document.getElementById('status-text');
    const statusDotEl = document.getElementById('status-dot');

    if (titleEl) titleEl.textContent = chatName;
    if (numberEl) numberEl.textContent = activeChatPhone;
    if (avatarEl) {
      if (chatAvatar && chatAvatar !== '-') {
        avatarEl.innerHTML = `<img src="${chatAvatar}" class="w-full h-full object-cover rounded-lg">`;
      } else {
        avatarEl.innerHTML = chatName.substring(0, 2).toUpperCase();
        avatarEl.className = 'w-11 h-11 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-extrabold text-sm shadow-sm shrink-0 border border-emerald-500/20';
      }
    }
    if (statusTextEl) statusTextEl.textContent = 'Conectado';
    if (statusDotEl) statusDotEl.className = 'w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block';

    const stream = document.getElementById('chatStream');
    if (!stream) return;

    if (showLoading) {
      stream.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-slate-400 space-y-3">
          <i class="fa-solid fa-spinner animate-spin text-2xl text-emerald-500"></i>
          <p class="text-xs font-bold uppercase tracking-wider">Buscando mensagens do histórico...</p>
        </div>
      `;
    }

    try {
      const response = await fetch(`${API_BASE}/api/whatsapp/messages?number=${encodeURIComponent(chatId)}`);
      if (response.ok) {
        const data = await response.json();
        const messages = [...(data.messages || [])].reverse();

        if (messages.length === 0) {
          stream.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
              <i class="fa-regular fa-message text-2xl opacity-50"></i>
              <p class="text-xs font-bold uppercase tracking-wider">Histórico Limpo</p>
              <p class="text-[9px] text-slate-400 text-center">Nenhuma mensagem recente registrada para este contato.</p>
            </div>
          `;
          return;
        }

        let htmlContent = '';
        let lastDateStr = '';

        messages.forEach(msg => {
          const isFromMe = msg.key?.fromMe === true;
          const pushName = msg.pushName || (isFromMe ? 'Admin' : chatName);
          const timestamp = msg.messageTimestamp;

          let timeStr = '';
          let dateStr = '';
          if (timestamp) {
            const ms = timestamp > 9999999999 ? timestamp : timestamp * 1000;
            const dateObj = new Date(ms);
            timeStr = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            dateStr = dateObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
          }

          if (dateStr && dateStr !== lastDateStr) {
            htmlContent += `
              <div class="flex justify-center my-3 select-none">
                <span class="px-3 py-1 bg-slate-200/50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-slate-300/10 shadow-sm">${dateStr}</span>
              </div>
            `;
            lastDateStr = dateStr;
          }

          let messageBody = '';
          const innerMsg = msg.message;

          if (innerMsg) {
            if (innerMsg.conversation) {
              messageBody = `<p>${formatMessageText(innerMsg.conversation)}</p>`;
            } else if (innerMsg.extendedTextMessage?.text) {
              messageBody = `<p>${formatMessageText(innerMsg.extendedTextMessage.text)}</p>`;
            } else if (innerMsg.documentMessage) {
              const doc = innerMsg.documentMessage;
              messageBody = renderAttachmentHtml(doc.fileName, doc.mimetype, doc.caption);
            } else if (innerMsg.imageMessage) {
              const img = innerMsg.imageMessage;
              messageBody = renderAttachmentHtml('Imagem Recebida', img.mimetype, img.caption, 'fa-solid fa-file-image text-blue-500');
            } else if (innerMsg.audioMessage) {
              const aud = innerMsg.audioMessage;
              messageBody = renderAttachmentHtml('Áudio Recebido', aud.mimetype, null, 'fa-solid fa-file-audio text-amber-500');
            } else if (innerMsg.videoMessage) {
              const vid = innerMsg.videoMessage;
              messageBody = renderAttachmentHtml('Vídeo Recebido', vid.mimetype, vid.caption, 'fa-solid fa-file-video text-rose-500');
            } else {
              const textVal = innerMsg.text || JSON.stringify(innerMsg);
              messageBody = `<p class="italic text-[10px] text-slate-400">${textVal}</p>`;
            }
          } else {
            messageBody = `<p class="italic text-[10px] text-slate-400">Mensagem sem conteúdo legível</p>`;
          }

          if (isFromMe) {
            htmlContent += `
              <div class="flex justify-end animate-slide-up-item my-1.5">
                <div class="max-w-[70%] bubble-sent-premium px-4 py-2.5 shadow-sm text-xs relative group">
                  ${messageBody}
                  <span class="flex items-center justify-end gap-1 text-[7px] text-white/70 mt-1 font-mono">${timeStr} <i class="fa-solid fa-check-double text-emerald-200 text-[8px]"></i></span>
                </div>
              </div>
            `;
          } else {
            htmlContent += `
              <div class="flex justify-start animate-slide-up-item my-1.5">
                <div class="max-w-[70%] bubble-received-premium px-4 py-2.5 shadow-sm text-xs relative">
                  <span class="text-[9px] font-bold text-emerald-500 dark:text-emerald-400 mb-1 block uppercase tracking-wide">${pushName}</span>
                  ${messageBody}
                  <span class="flex items-center justify-end gap-1 text-[7px] text-slate-400 dark:text-slate-500 mt-1 font-mono">${timeStr}</span>
                </div>
              </div>
            `;
          }
        });

        stream.innerHTML = htmlContent;
        stream.scrollTop = stream.scrollHeight;
      } else {
        showToast('Erro ao carregar histórico de mensagens.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Erro de conexão ao buscar histórico de mensagens.', 'error');
    }
  };

  function formatMessageText(text) {
    if (!text) return '';
    let formatted = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    formatted = formatted.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/_(.*?)_/g, '<em>$1</em>');
    formatted = formatted.replace(/```(.*?)```/g, '<code class="bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded font-mono text-[9.5px]">$1</code>');
    formatted = formatted.replace(/~(.*?)~/g, '<del>$1</del>');
    formatted = formatted.replace(/\n/g, '<br>');
    return formatted;
  }

  function renderAttachmentHtml(fileName, mimetype, caption, customIconClass = null) {
    let iconClass = customIconClass || 'fa-solid fa-file-pdf text-rose-500';
    if (!customIconClass) {
      const ext = fileName.split('.').pop().toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) || mimetype.startsWith('image/')) {
        iconClass = 'fa-solid fa-file-image text-blue-500';
      } else if (['xls', 'xlsx', 'csv'].includes(ext)) {
        iconClass = 'fa-solid fa-file-excel text-emerald-500';
      } else if (['doc', 'docx'].includes(ext)) {
        iconClass = 'fa-solid fa-file-word text-blue-600';
      } else if (['zip', 'rar', '7z'].includes(ext)) {
        iconClass = 'fa-solid fa-file-zipper text-amber-500';
      } else if (mimetype.startsWith('audio/')) {
        iconClass = 'fa-solid fa-file-audio text-amber-500';
      } else if (mimetype.startsWith('video/')) {
        iconClass = 'fa-solid fa-file-video text-rose-500';
      }
    }

    return `
      <div class="flex items-center gap-2.5 p-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl border border-black/10 dark:border-white/10 mb-1.5 min-w-[200px] hover:scale-[1.01] transition-all cursor-pointer select-none" onclick="window.downloadAttachment('${fileName.replace(/'/g, "\\'")}', '${mimetype}')">
        <div class="w-8 h-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm shrink-0">
          <i class="${iconClass}"></i>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-[10px] font-bold truncate">${fileName}</p>
          <p class="text-[8px] opacity-60 uppercase">${mimetype.split('/')[1] || 'Arquivo'}</p>
        </div>
        <div class="text-xs opacity-60">
          <i class="fa-solid fa-download"></i>
        </div>
      </div>
      ${caption ? `<p class="mt-1">${formatMessageText(caption)}</p>` : ''}
    `;
  }

  window.downloadAttachment = (fileName, mimetype) => {
    showToast(`Download de arquivo iniciado: ${fileName}`, 'info');
    const blob = new Blob([`Simulação de conteúdo para ${fileName}`], { type: mimetype || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  window.filterContacts = () => {
    const searchVal = document.getElementById('chatSearch').value.toLowerCase().trim();
    if (!searchVal) {
      renderChatsSidebar(activeChatsData);
      return;
    }

    const filtered = activeChatsData.filter(chat => {
      const name = (chat.name || chat.pushName || '').toLowerCase();
      const phone = (chat.id || chat.remoteJid || '').toLowerCase();
      return name.includes(searchVal) || phone.includes(searchVal);
    });

    renderChatsSidebar(filtered);
  };

  window.clearActiveChat = () => {
    if (!activeChatId) {
      showToast('Nenhuma conversa ativa para limpar!', 'warning');
      return;
    }

    if (confirm('Deseja realmente limpar as mensagens desta conversa visualmente?')) {
      const stream = document.getElementById('chatStream');
      if (stream) {
        stream.innerHTML = `
          <div class="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
            <i class="fa-regular fa-message text-2xl opacity-50"></i>
            <p class="text-xs font-bold uppercase tracking-wider">Histórico Limpo</p>
            <p class="text-[9px] text-slate-400 text-center">As mensagens foram limpas nesta exibição.</p>
          </div>
        `;
        showToast('Histórico visual limpo!', 'info');
      }
    }
  };

  window.toggleEmojiPopover = () => {
    const popover = document.getElementById('emojiPopover');
    if (!popover) return;
    popover.classList.toggle('hidden');

    if (!popover.classList.contains('hidden')) {
      window.setEmojiTab('smileys');
    }
  };

  window.setEmojiTab = (tabName) => {
    const grid = document.getElementById('emojiGrid');
    if (!grid) return;

    const buttons = document.querySelectorAll('.emoji-tab-btn');
    buttons.forEach(btn => {
      if (btn.getAttribute('onclick').includes(tabName)) {
        btn.className = 'emoji-tab-btn text-[9px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-bold';
      } else {
        btn.className = 'emoji-tab-btn text-[9px] px-2 py-0.5 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800';
      }
    });

    const list = emojisList[tabName] || emojisList.smileys;
    grid.innerHTML = list.map(emoji => `
      <button type="button" onclick="window.addEmoji('${emoji}')" class="hover:bg-slate-150 dark:hover:bg-slate-800 p-1.5 rounded text-base active:scale-90 transition-all select-none">${emoji}</button>
    `).join('');
  };

  window.addEmoji = (emoji) => {
    const input = document.getElementById('messageInput');
    if (!input) return;
    input.value += emoji;
    input.focus();
  };

  window.handleFileSelected = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const limitBytes = 20 * 1024 * 1024;
    if (file.size > limitBytes) {
      showToast('O arquivo excede o limite de tamanho de 20MB.', 'error');
      event.target.value = '';
      return;
    }

    chatAttachmentFile = file;

    const preview = document.getElementById('attachmentPreview');
    const nameEl = document.getElementById('attachmentName');
    const sizeEl = document.getElementById('attachmentSize');
    const iconEl = document.getElementById('attachmentIcon');

    if (preview && nameEl && sizeEl) {
      nameEl.textContent = file.name;
      const kb = file.size / 1024;
      const sizeStr = kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(0)} KB`;
      sizeEl.textContent = sizeStr;

      const ext = file.name.split('.').pop().toLowerCase();
      let iconClass = 'fa-solid fa-file-invoice';
      if (['pdf'].includes(ext)) iconClass = 'fa-solid fa-file-pdf text-rose-500';
      else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) iconClass = 'fa-solid fa-file-image text-blue-500';
      else if (['xls', 'xlsx', 'csv'].includes(ext)) iconClass = 'fa-solid fa-file-excel text-emerald-500';
      else if (['doc', 'docx'].includes(ext)) iconClass = 'fa-solid fa-file-word text-blue-600';
      else if (['zip', 'rar', '7z'].includes(ext)) iconClass = 'fa-solid fa-file-zipper text-amber-500';

      if (iconEl) iconEl.innerHTML = `<i class="${iconClass}"></i>`;
      preview.classList.remove('hidden');
    }
  };

  window.clearAttachment = () => {
    chatAttachmentFile = null;
    const fileInput = document.getElementById('chatFileInput');
    if (fileInput) fileInput.value = '';

    const preview = document.getElementById('attachmentPreview');
    if (preview) preview.classList.add('hidden');
  };

  window.submitChatMessage = async (event) => {
    if (event) event.preventDefault();

    if (!activeChatId) {
      showToast('Nenhuma conversa selecionada!', 'warning');
      return;
    }

    const input = document.getElementById('messageInput');
    if (!input) return;

    const text = input.value.trim();
    if (!text && !chatAttachmentFile) return;

    const chatStream = document.getElementById('chatStream');
    if (chatStream) {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const pendingDiv = document.createElement('div');
      pendingDiv.className = 'flex justify-end';
      pendingDiv.id = 'temp-pending-msg';

      let attachmentHtml = '';
      if (chatAttachmentFile) {
        attachmentHtml = `
          <div class="flex items-center gap-2.5 p-2 bg-black/10 dark:bg-white/10 rounded-xl border border-black/10 dark:border-white/10 mb-1.5 min-w-[200px]">
            <div class="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-sm shrink-0">
              <i class="fa-solid fa-file-invoice animate-bounce"></i>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-[10px] font-bold truncate">${chatAttachmentFile.name}</p>
              <p class="text-[8px] opacity-60 uppercase">${chatAttachmentFile.name.split('.').pop() || 'Arquivo'}</p>
            </div>
          </div>
        `;
      }

      pendingDiv.innerHTML = `
        <div class="max-w-[70%] bg-emerald-600/70 dark:bg-emerald-600/60 text-white rounded-2xl rounded-tr-none px-4 py-2.5 shadow-sm text-xs relative">
          ${attachmentHtml}
          ${text ? `<p>${text}</p>` : ''}
          <span class="flex items-center justify-end gap-1 text-[7px] text-white/50 mt-1 font-mono">${timeStr} <i class="fa-solid fa-spinner animate-spin text-[8px]"></i></span>
        </div>
      `;

      const emptyState = chatStream.querySelector('.text-slate-400');
      if (emptyState && emptyState.parentElement === chatStream) {
        chatStream.innerHTML = '';
      }

      chatStream.appendChild(pendingDiv);
      chatStream.scrollTop = chatStream.scrollHeight;
    }

    input.value = '';
    const tempAttachment = chatAttachmentFile;
    window.clearAttachment();

    try {
      const formData = new FormData();
      formData.append('number', activeChatId);
      if (text) formData.append('message', text);
      if (tempAttachment) {
        formData.append('file', tempAttachment);
      }

      const response = await fetch(`${API_BASE}/api/whatsapp/chat/send`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        const temp = document.getElementById('temp-pending-msg');
        if (temp) temp.remove();

        await window.selectChat(activeChatId, activeChatName, null, activeChatPhone, false);

        // Notificações de sucesso desativadas a pedido do usuário

        await window.loadChatsList(false);
      } else {
        const temp = document.getElementById('temp-pending-msg');
        if (temp) temp.remove();
        showToast('Erro ao enviar mensagem para o WhatsApp.', 'error');
      }
    } catch (e) {
      console.error(e);
      const temp = document.getElementById('temp-pending-msg');
      if (temp) temp.remove();
      showToast('Erro de conexão ao enviar mensagem.', 'error');
    }
  };

  // --- GRUPOS IMPORT LOGIC (Redesenhado inline com Abas) ---
  let groupsCache = []; // Cache local para busca rápida
  let selectedGroupId = null;

  window.switchContactsTab = (tab) => {
    const tabs = ['whatsapp', 'csv', 'manual'];
    tabs.forEach(t => {
      const btn = document.getElementById(`tab-btn-${t}`);
      const content = document.getElementById(`tab-content-${t}`);
      if (!btn || !content) return;
      
      if (t === tab) {
        btn.className = "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 text-purple-600 dark:text-purple-400 bg-white dark:bg-slate-800 shadow-sm border border-slate-900/5 dark:border-white/5";
        content.classList.remove('hidden');
        
        if (tab === 'whatsapp') {
          window.loadGroupsInline();
        }
      } else {
        btn.className = "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white";
        content.classList.add('hidden');
      }
    });
  };

  window.loadGroupsInline = async () => {
    const listEl = document.getElementById('group-importer-list-inline');
    if (!listEl) return;

    listEl.innerHTML = `
      <div class="flex items-center justify-center py-10 text-slate-400 font-medium">
        <i class="fa-solid fa-spinner animate-spin text-sm mr-2 text-purple-500"></i>
        <span class="text-[10px] font-black uppercase tracking-wider">Buscando grupos ativos...</span>
      </div>
    `;

    try {
      const response = await fetch(`${API_BASE}/api/whatsapp/groups`);
      if (response.ok) {
        const data = await response.json();
        groupsCache = data.groups || [];
        window.renderGroupsList(groupsCache);
      } else {
        const err = await response.json();
        listEl.innerHTML = `
          <div class="text-center py-6 text-rose-500 bg-rose-500/5 rounded-xl p-3 border border-rose-500/10">
            <i class="fa-solid fa-circle-exclamation text-lg mb-1"></i>
            <p class="text-[10px] font-black uppercase tracking-wider">${err.detail || 'Erro ao carregar grupos'}</p>
          </div>
        `;
      }
    } catch (e) {
      listEl.innerHTML = `
        <div class="text-center py-6 text-rose-500 bg-rose-500/5 rounded-xl p-3 border border-rose-500/10">
          <i class="fa-solid fa-triangle-exclamation text-lg mb-1"></i>
          <p class="text-[10px] font-black uppercase tracking-wider">Erro de conexão</p>
        </div>
      `;
    }
  };

  window.renderGroupsList = (groups) => {
    const listEl = document.getElementById('group-importer-list-inline');
    if (!listEl) return;

    if (groups.length === 0) {
      listEl.innerHTML = `
        <div class="text-center py-8 text-slate-400">
          <i class="fa-solid fa-users-slash text-lg mb-1 opacity-50"></i>
          <p class="text-[10px] font-black uppercase tracking-wider">Nenhum grupo encontrado</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = groups.map(g => {
      const isSelected = selectedGroupId === g.id;
      const borderClass = isSelected ? 'border-emerald-500 bg-emerald-500/5' : 'border-transparent';
      return `
        <div onclick="window.selectGroupForImport('${g.id}', '${g.subject.replace(/'/g, "\\'")}', this)" 
             class="inline-group-item flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl cursor-pointer transition-all border ${borderClass} select-none">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <i class="fa-solid fa-users text-xs"></i>
            </div>
            <div class="text-left">
              <div class="text-[11px] font-black text-slate-800 dark:text-white truncate max-w-[180px] uppercase tracking-tight">${g.subject}</div>
              <div class="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">${g.size || 0} membros sincronizados</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            ${isSelected ? '<span class="text-[8px] bg-emerald-500 text-white font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider">Ativo</span>' : ''}
            <i class="fa-solid fa-chevron-right text-slate-400 text-[10px]"></i>
          </div>
        </div>
      `;
    }).join('');
  };

  window.filterGroupsList = (query) => {
    const q = query.toLowerCase().trim();
    if (!q) {
      window.renderGroupsList(groupsCache);
      return;
    }
    const filtered = groupsCache.filter(g => 
      g.subject.toLowerCase().includes(q) || g.id.toLowerCase().includes(q)
    );
    window.renderGroupsList(filtered);
  };

  window.selectGroupForImport = async (groupId, groupSubject, element) => {
    selectedGroupId = groupId;
    
    // Highlight local element
    const items = document.querySelectorAll('.inline-group-item');
    items.forEach(el => {
      el.classList.remove('border-emerald-500', 'bg-emerald-500/5');
      el.classList.add('border-transparent');
    });
    if (element) {
      element.classList.remove('border-transparent');
      element.classList.add('border-emerald-500', 'bg-emerald-500/5');
    }

    const listEl = document.getElementById('group-importer-list-inline');
    if (listEl) {
      listEl.innerHTML = `
        <div class="flex items-center justify-center py-10 text-slate-400 dark:text-slate-500">
          <i class="fa-solid fa-spinner animate-spin text-sm mr-2 text-purple-500"></i>
          <span class="text-[10px] font-black uppercase tracking-wider">Buscando participantes do grupo...</span>
        </div>
      `;
    }

    try {
      const response = await fetch(`${API_BASE}/api/whatsapp/groups/${encodeURIComponent(groupId)}/participants`);
      if (response.ok) {
        const data = await response.json();
        const participants = data.participants || [];

        if (participants.length === 0) {
          showToast('Nenhum participante encontrado neste grupo.', 'warning');
          window.renderGroupsList(groupsCache);
          return;
        }

        const manualField = document.getElementById('manual-contacts');
        if (manualField) {
          // Formatar no formato esperado e preencher com nome real sanitizado
          const formattedText = participants.map(p => {
            const name = p.name ? p.name.replace(/,/g, '') : 'Membro';
            return `${p.phone}, ${name}`;
          }).join('\n');
          manualField.value = formattedText; // Sobrescreve para ser limpo e profissional!

          // Executar o parsing dos contatos
          parseContactsFromInput(formattedText);
          showToast(`${participants.length} contatos importados de "${groupSubject}" com sucesso!`, 'success');
        }
        
        // Recarregar os grupos para restaurar a lista
        window.renderGroupsList(groupsCache);
      } else {
        const err = await response.json();
        showToast(err.detail || 'Erro ao importar participantes.', 'error');
        window.renderGroupsList(groupsCache);
      }
    } catch (e) {
      console.error(e);
      showToast('Erro de conexão ao buscar participantes.', 'error');
      window.renderGroupsList(groupsCache);
    }
  };

  window.clearLoadedContacts = () => {
    const manualField = document.getElementById('manual-contacts');
    if (manualField) manualField.value = '';
    
    const fileLabel = document.querySelector('#csv-upload-box span');
    if (fileLabel) {
      fileLabel.textContent = 'Arraste ou clique para enviar CSV / TXT';
    }
    
    const fileInput = document.getElementById('contacts-file');
    if (fileInput) fileInput.value = '';

    const activeGroups = document.querySelectorAll('.inline-group-item');
    activeGroups.forEach(g => {
      g.classList.remove('border-emerald-500', 'bg-emerald-500/5');
      g.classList.add('border-transparent');
    });

    state.contacts = [];
    selectedGroupId = null;
    updateContactsStats();
    showToast('Lista de contatos limpa com sucesso!', 'info');
  };

  // Close emoji popover when clicking outside
  document.addEventListener('click', (e) => {
    const popover = document.getElementById('emojiPopover');
    const emojiBtn = document.getElementById('emojiBtn');
    if (popover && !popover.classList.contains('hidden') && emojiBtn && !emojiBtn.contains(e.target) && !popover.contains(e.target)) {
      popover.classList.add('hidden');
    }
  });

  // Checar sessão local (executado após todo o parsing e definição de variáveis do app)
  if (sessionUser) {
    state.user = sessionUser;
    initApp();
  }

}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
