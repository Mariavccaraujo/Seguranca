let catalogo = [];
let itensOrcamento = [];
let historico = [];
let clientes = [];
let agenda = [];
let perfilEmpresa = {};
let categoriaAtiva = 'Todos';
let diaSelecionado = hojeStr();
let mesAtual = (() => { const d = new Date(); return { ano: d.getFullYear(), mes: d.getMonth() }; })();
let filtroCategoria = 'Todas';
let filtroStatus = new Set(['pendente','concluido','cancelado']);

const CATEGORIAS_PADRAO = [
  { categoria:'Câmeras', itens:[
    { id:uid(), nome:'Câmera Dome 2MP', preco:180 },
    { id:uid(), nome:'Câmera Bullet 4MP', preco:240 },
    { id:uid(), nome:'Câmera IP Wi-Fi', preco:220 },
    { id:uid(), nome:'DVR/NVR 8 canais', preco:450 },
  ]},
  { categoria:'Alarmes', itens:[
    { id:uid(), nome:'Central de alarme 8 zonas', preco:380 },
    { id:uid(), nome:'Sensor de presença infravermelho', preco:60 },
    { id:uid(), nome:'Sirene externa', preco:90 },
    { id:uid(), nome:'Controle remoto', preco:45 },
  ]},
  { categoria:'Cercas Elétricas', itens:[
    { id:uid(), nome:'Kit cerca elétrica 60m', preco:650 },
    { id:uid(), nome:'Haste de choque (unidade)', preco:25 },
    { id:uid(), nome:'Placa de aviso', preco:15 },
  ]},
  { categoria:'Automação e Interfone', itens:[
    { id:uid(), nome:'Interfone porteiro eletrônico', preco:210 },
    { id:uid(), nome:'Motor de portão deslizante', preco:780 },
    { id:uid(), nome:'Fechadura elétrica', preco:160 },
  ]},
  { categoria:'Serviços', itens:[
    { id:uid(), nome:'Instalação e configuração', preco:250 },
    { id:uid(), nome:'Visita técnica', preco:80 },
    { id:uid(), nome:'Manutenção preventiva', preco:120 },
  ]},
];

const CAT_STYLE = {
  'Câmeras': {emoji:'📷', bg:'var(--blue-soft)', color:'var(--blue)'},
  'Alarmes': {emoji:'🚨', bg:'var(--amber-soft)', color:'var(--amber)'},
  'Cercas Elétricas': {emoji:'⚡', bg:'var(--red-soft)', color:'var(--red)'},
  'Automação e Interfone': {emoji:'🔔', bg:'var(--green-soft)', color:'var(--green)'},
  'Serviços': {emoji:'🛠️', bg:'var(--purple-soft)', color:'var(--purple)'},
};
function catStyle(cat){ return CAT_STYLE[cat] || {emoji:'🔧', bg:'var(--surface-2)', color:'var(--text-muted)'}; }

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function normalizar(s){ return (s||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim(); }
let produtoEditandoId = null;
function hojeStr(){ const d = new Date(); const tz = d.getTimezoneOffset()*60000; return new Date(d - tz).toISOString().slice(0,10); }
function toast(msg){ const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(()=> t.classList.remove('show'), 2200); }

/* ---------- BANNER "ABRIR WHATSAPP" (link real, clique do usuário — nunca é bloqueado) ----------
   Em vez de tentar abrir o WhatsApp automaticamente via window.open() depois de operações
   assíncronas (o que os navegadores podem bloquear como pop-up, resultando em about:blank
   ou nada acontecendo), mostramos um botão de verdade (<a href>) para o usuário tocar.
   Um clique real do usuário em um link nunca é bloqueado, em nenhum navegador. */
function mostrarBannerWhats(url, texto){
  const banner = document.getElementById('wa-send-banner');
  const oldLink = document.getElementById('wa-send-link');
  const span = document.getElementById('wa-send-texto');
  if(!banner || !oldLink || !span) return;
  span.textContent = texto || '✅ Pronto! Toque para abrir o WhatsApp';
  // Recria o botão do zero a cada envio. Em vários navegadores/PWAs (principalmente
  // iOS e apps "Adicionar à Tela de Início"), reaproveitar o mesmo <a target="_blank">
  // e só trocar o href faz o clique parar de funcionar depois da primeira vez.
  // Um elemento <a> novo, criado agora, sempre abre normalmente no clique.
  const newLink = oldLink.cloneNode(true);
  newLink.id = 'wa-send-link';
  newLink.href = url;
  newLink.removeAttribute('data-used');
  oldLink.parentNode.replaceChild(newLink, oldLink);
  newLink.addEventListener('click', () => { setTimeout(fecharBannerWhats, 400); });
  // Reinicia a animação de entrada mesmo se o banner já estiver visível
  banner.classList.remove('show');
  void banner.offsetWidth;
  banner.classList.add('show');
}
function fecharBannerWhats(){
  const banner = document.getElementById('wa-send-banner');
  if(banner) banner.classList.remove('show');
}
function parsePreco(v){ if(typeof v === 'number') return v; const n = parseFloat(String(v).replace(/[^\d,.-]/g,'').replace(',','.')); return isNaN(n) ? 0 : n; }
function fmt(v){ return 'R$ ' + v.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}); }
function fmtDataBR(dataStr){ const [y,m,d] = dataStr.split('-'); return `${d}/${m}/${y}`; }
function fmtDataExtenso(dataStr){ const d = new Date(dataStr + 'T12:00:00'); return d.toLocaleDateString('pt-BR', {weekday:'long', day:'2-digit', month:'long'}); }
function digitos(v){ return (v||'').replace(/\D/g,''); }

/* ---------- BANCO DE DADOS (JSON local no navegador) ----------
   Fora do ambiente Claude (ex: GitHub Pages) não existe window.storage,
   então usamos localStorage como banco — tudo fica salvo em JSON no
   próprio navegador do usuário, sem precisar de servidor. */
const DB_PREFIX = 'central-seg-db::';
const storage = (window.storage && typeof window.storage.get === 'function') ? window.storage : {
  async get(key){
    const v = localStorage.getItem(DB_PREFIX + key);
    if(v === null) throw new Error('chave não encontrada: ' + key);
    return { value: v };
  },
  async set(key, value){
    localStorage.setItem(DB_PREFIX + key, value);
    return { value };
  },
  async delete(key){
    localStorage.removeItem(DB_PREFIX + key);
    return { deleted:true };
  },
  async list(prefix){
    const keys = Object.keys(localStorage)
      .filter(k => k.startsWith(DB_PREFIX + (prefix||'')))
      .map(k => k.slice(DB_PREFIX.length));
    return { keys };
  }
};

/* ---------- INIT / STORAGE ---------- */
async function init(){
  try{ const r = await storage.get('catalogo-produtos'); catalogo = JSON.parse(r.value); }
  catch(e){ catalogo = CATEGORIAS_PADRAO; try{ await storage.set('catalogo-produtos', JSON.stringify(catalogo)); }catch(e2){} }

  try{ const r = await storage.get('orcamentos'); historico = JSON.parse(r.value); } catch(e){ historico = []; }
  try{ const r = await storage.get('clientes'); clientes = JSON.parse(r.value); } catch(e){ clientes = []; }
  try{ const r = await storage.get('agenda'); agenda = JSON.parse(r.value); } catch(e){ agenda = []; }
  try{ const r = await storage.get('perfil-empresa'); perfilEmpresa = JSON.parse(r.value); } catch(e){ perfilEmpresa = {}; }
  carregarFormEmpresa();

  renderCatPills();
  renderLoja();
  renderLines();
  renderResumo();
  renderClientDatalist();
  renderClientes();
  renderFiltroCategoria();
  renderFiltroStatus();
  renderCalendario();
  renderAgendaDia();
  renderHistorico();
  renderDashboard();
  renderNotifs();
  atualizarStatus();
  atualizarBotaoLembretes();
  checkLembretes();
  setSection('agenda');
}
async function salvarCatalogo(){ try{ await storage.set('catalogo-produtos', JSON.stringify(catalogo)); }catch(e){ toast('⚠️ Erro ao salvar catálogo'); } }
async function salvarHistorico(){ try{ await storage.set('orcamentos', JSON.stringify(historico)); }catch(e){ toast('⚠️ Erro ao salvar histórico'); } }
async function salvarClientes(){ try{ await storage.set('clientes', JSON.stringify(clientes)); }catch(e){ toast('⚠️ Erro ao salvar clientes'); } }
async function salvarAgenda(){ try{ await storage.set('agenda', JSON.stringify(agenda)); }catch(e){ toast('⚠️ Erro ao salvar agenda'); } }
async function salvarPerfilEmpresa(){ try{ await storage.set('perfil-empresa', JSON.stringify(perfilEmpresa)); }catch(e){ toast('⚠️ Erro ao salvar dados da empresa'); } }

/* ---------- BACKUP (exportar/importar tudo em um único .json) ---------- */
function exportarBackup(){
  const dados = { catalogo, historico, clientes, agenda, perfilEmpresa, exportadoEm: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `backup-central-seguranca-${hojeStr()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast('Backup exportado em .json');
}
function abrirImportarBackup(){ document.getElementById('input-importar-backup').click(); }
async function importarBackup(evento){
  const arquivo = evento.target.files[0];
  if(!arquivo) return;
  try{
    const texto = await arquivo.text();
    const dados = JSON.parse(texto);
    if(!confirm('Isso vai SUBSTITUIR todos os dados atuais (catálogo, clientes, agenda, histórico e dados da empresa) pelos dados do arquivo importado. Deseja continuar?')) return;
    catalogo = dados.catalogo || CATEGORIAS_PADRAO;
    historico = dados.historico || [];
    clientes = dados.clientes || [];
    agenda = dados.agenda || [];
    perfilEmpresa = dados.perfilEmpresa || {};
    await salvarCatalogo(); await salvarHistorico(); await salvarClientes(); await salvarAgenda(); await salvarPerfilEmpresa();
    carregarFormEmpresa();
    renderCatPills(); renderLoja(); renderClientDatalist(); renderClientes(); renderCalendario(); renderAgendaDia(); renderHistorico(); renderDashboard(); renderNotifs();
    toast('Backup importado com sucesso!');
  }catch(e){
    toast('⚠️ Arquivo inválido — não foi possível importar');
  }
  evento.target.value = '';
}

/* ---------- ZERAR BANCO DE DADOS (reset total, ação destrutiva) ---------- */
async function zerarBancoDeDados(){
  const passo1 = confirm('⚠️ ATENÇÃO: isso vai APAGAR PERMANENTEMENTE todo o catálogo, clientes, agenda, histórico de orçamentos e dados da empresa deste navegador.\n\nNão tem como desfazer. Deseja continuar?');
  if(!passo1) return;
  const passo2 = prompt('Para confirmar, digite ZERAR (em maiúsculas) na caixa abaixo:');
  if(passo2 !== 'ZERAR'){ toast('Cancelado — nada foi apagado'); return; }

  catalogo = JSON.parse(JSON.stringify(CATEGORIAS_PADRAO));
  historico = [];
  clientes = [];
  agenda = [];
  perfilEmpresa = {};

  await salvarCatalogo(); await salvarHistorico(); await salvarClientes(); await salvarAgenda(); await salvarPerfilEmpresa();

  carregarFormEmpresa();
  renderCatPills(); renderLoja(); renderFiltroCategoria();
  renderClientDatalist(); renderClientes();
  renderCalendario(); renderAgendaDia(); renderFiltroStatus();
  renderHistorico(); renderDashboard(); renderNotifs();
  itensOrcamento = [];
  renderLines(); renderResumo(); atualizarStatus();

  toast('🗑️ Banco de dados zerado — voltou ao estado inicial');
  setSection('dashboard');
}

/* ---------- NAVIGATION ---------- */
const TITLES = {
  dashboard: ['Dashboard', 'Visão geral do seu negócio'],
  orcamento: ['Novo Orçamento', 'Monte e envie um orçamento pelo WhatsApp'],
  loja: ['Catálogo', 'Seus produtos e serviços em formato de loja'],
  clientes: ['Clientes', 'Sua base de clientes (CRM)'],
  agenda: ['Planner', 'Seus atendimentos organizados por dia'],
  historico: ['Histórico', 'Orçamentos enviados anteriormente'],
  empresa: ['Dados da Empresa', 'Informações fixas usadas em toda Proposta em PDF'],
};
function toggleMenu(){ document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebar-overlay').classList.toggle('show'); }
function closeMenu(){ document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('show'); }
function setSection(sec){
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.section === sec));
  document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
  document.getElementById('section-' + sec).classList.add('active');
  document.getElementById('topbar-title').textContent = TITLES[sec][0];
  document.getElementById('topbar-sub').textContent = TITLES[sec][1];
  closeNotifs();
  closeMenu();
  if(sec === 'dashboard') renderDashboard();
}

/* ---------- NOTIFICATIONS ---------- */
function listaNotificacoes(){
  const hoje = hojeStr();
  return agenda.filter(a => a.status === 'pendente' && a.data <= hoje).sort((a,b) => (a.data+a.hora).localeCompare(b.data+b.hora));
}
function renderNotifs(){
  const notifs = listaNotificacoes();
  const badge = document.getElementById('bell-badge');
  if(notifs.length > 0){ badge.style.display = 'flex'; badge.textContent = notifs.length; }
  else{ badge.style.display = 'none'; }

  const dd = document.getElementById('notif-dropdown');
  if(notifs.length === 0){
    dd.innerHTML = `<div class="notif-empty">🔕 Nenhuma notificação pendente</div>`;
    return;
  }
  const atrasados = notifs.filter(n => n.data < hoje());
  dd.innerHTML = `<div class="notif-dropdown-title">Atendimentos pendentes</div>` + notifs.map(n => {
    const atrasado = n.data < hojeStr();
    return `<div class="notif-item">
      <div class="notif-dot" style="background:${atrasado ? 'var(--red)' : 'var(--amber)'}"></div>
      <div style="flex:1">
        <div class="notif-item-name">${n.clienteNome}</div>
        <div class="notif-item-meta">${atrasado ? 'Atrasado — ' : ''}${fmtDataBR(n.data)} às ${n.hora || '--:--'} ${n.servico ? '· ' + n.servico : ''}</div>
        ${n.lembrete2hEnviado ? `<div style="display:flex; gap:6px; margin-top:6px; flex-wrap:wrap">
          <button class="notif-mini-btn" onclick="enviarLembreteCliente('${n.id}'); event.stopPropagation();">📲 Avisar cliente</button>
          <button class="notif-mini-btn" onclick="enviarLembreteResponsavel('${n.id}'); event.stopPropagation();">📲 Avisar responsável</button>
        </div>` : ''}
        <button class="notif-mini-btn" onclick="concluirAgendamento('${n.id}'); event.stopPropagation();">Marcar concluído</button>
      </div>
    </div>`;
  }).join('');
}
function hoje(){ return hojeStr(); }
function toggleNotifs(e){ e.stopPropagation(); document.getElementById('notif-dropdown').classList.toggle('show'); }
function closeNotifs(){ document.getElementById('notif-dropdown').classList.remove('show'); }
document.addEventListener('click', (e) => { if(!e.target.closest('.topbar-actions')) closeNotifs(); });

/* ---------- DASHBOARD ---------- */
function renderDashboard(){
  const notifs = listaNotificacoes();
  const nc = document.getElementById('next-card');
  if(notifs.length === 0){
    nc.innerHTML = `<div class="next-card-empty">Nenhum atendimento agendado no momento. Use a Agenda para planejar seus próximos atendimentos.</div>`;
  }else{
    const n = notifs[0];
    const atrasado = n.data < hojeStr();
    nc.innerHTML = `
      <div class="next-card-client">${n.clienteNome}</div>
      <div class="next-card-meta">
        <div class="next-card-meta-item">📅 <b>${atrasado ? 'Atrasado — ' : ''}${fmtDataBR(n.data)}</b></div>
        <div class="next-card-meta-item">🕐 <b>${n.hora || '--:--'}</b></div>
        ${n.servico ? `<div class="next-card-meta-item">🛠️ <b>${n.servico}</b></div>` : ''}
        ${n.endereco ? `<div class="next-card-meta-item">📍 <b>${n.endereco}</b></div>` : ''}
      </div>`;
  }

  const hoje = hojeStr();
  const mesAtual = hoje.slice(0,7);
  const orcamentosMes = historico.filter(h => h.data.slice(0,7) === mesAtual);
  const totalMes = orcamentosMes.reduce((s,h) => s + h.totais.total, 0);
  const atendimentosHoje = agenda.filter(a => a.data === hoje && a.status === 'pendente').length;

  document.getElementById('stat-grid').innerHTML = `
    <div class="stat-card amber"><div class="stat-card-label">Atendimentos Hoje</div><div class="stat-card-value">${atendimentosHoje}</div></div>
    <div class="stat-card green"><div class="stat-card-label">Orçamentos no Mês</div><div class="stat-card-value">${orcamentosMes.length}</div></div>
    <div class="stat-card blue"><div class="stat-card-label">Total Orçado (mês)</div><div class="stat-card-value" style="font-size:19px">${fmt(totalMes)}</div></div>
    <div class="stat-card"><div class="stat-card-label">Clientes Cadastrados</div><div class="stat-card-value">${clientes.length}</div></div>
  `;

  const rec = document.getElementById('dashboard-recentes');
  if(historico.length === 0){
    rec.innerHTML = `<div class="empty-state" style="padding:30px 0"><div class="empty-state-icon">◌</div>Nenhum orçamento enviado ainda.</div>`;
  }else{
    rec.innerHTML = historico.slice(0,5).map(h => `
      <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border); font-size:13.5px;">
        <div>
          <div style="font-weight:600">${h.cliente.nome}</div>
          <div style="color:var(--text-faint); font-size:11.5px; font-family:'JetBrains Mono',monospace">${new Date(h.data).toLocaleDateString('pt-BR')}</div>
        </div>
        <div class="mono" style="color:var(--amber); font-weight:700">${fmt(h.totais.total)}</div>
      </div>
    `).join('');
  }
}

/* ---------- LOJA / CATÁLOGO ---------- */
function renderCatPills(){
  const cats = ['Todos', ...catalogo.map(c => c.categoria)];
  document.getElementById('cat-pills').innerHTML = cats.map(c =>
    `<button class="cat-pill ${c === categoriaAtiva ? 'active' : ''}" onclick="setCategoriaAtiva('${c.replace(/'/g,"\\'")}')">${c}</button>`
  ).join('');
  document.getElementById('cat-datalist').innerHTML = catalogo.map(c => `<option value="${c.categoria}">`).join('');
}
function setCategoriaAtiva(c){ categoriaAtiva = c; renderCatPills(); renderLoja(); }

function renderLoja(){
  const buscaEl = document.getElementById('loja-search');
  const busca = normalizar(buscaEl ? buscaEl.value : '');
  let produtos = [];
  catalogo.forEach(cat => {
    cat.itens.forEach(item => {
      if(categoriaAtiva !== 'Todos' && cat.categoria !== categoriaAtiva) return;
      if(busca && !normalizar(item.nome).includes(busca) && !normalizar(cat.categoria).includes(busca)) return;
      produtos.push({ ...item, categoria: cat.categoria });
    });
  });
  const grid = document.getElementById('product-grid');
  const contador = document.getElementById('product-count-label');
  if(contador){
    const totalCadastrados = catalogo.reduce((s,c) => s + c.itens.length, 0);
    contador.textContent = busca || categoriaAtiva !== 'Todos'
      ? `${produtos.length} de ${totalCadastrados} produtos`
      : `${totalCadastrados} ${totalCadastrados === 1 ? 'produto cadastrado' : 'produtos cadastrados'}`;
  }
  if(produtos.length === 0){
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">🔍</div>Nenhum produto encontrado.${busca ? ' Tente outro termo de busca.' : ''}</div>`;
    return;
  }
  grid.innerHTML = produtos.map(p => {
    const st = catStyle(p.categoria);
    return `
    <div class="product-card">
      <div class="product-actions">
        <button class="product-edit" title="Editar produto" onclick="editarProdutoCatalogo('${p.id}')">✎</button>
        <button class="product-remove" title="Remover do catálogo" onclick="removerProdutoCatalogo('${p.id}')">✕</button>
      </div>
      <div class="product-icon" style="background:${st.bg}">${st.emoji}</div>
      <div>
        <div class="product-cat-label">${p.categoria}</div>
        <div class="product-name">${p.nome}</div>
      </div>
      <div class="product-footer">
        <div class="product-price">${fmt(p.preco)}</div>
        <button class="product-add" title="Adicionar ao orçamento" onclick="adicionarItem('${p.nome.replace(/'/g,"\\'")}', ${p.preco})">+</button>
      </div>
    </div>`;
  }).join('');
  renderCartBar();
}

function adicionarProdutoCatalogo(){
  const nome = document.getElementById('np-nome').value.trim();
  const categoria = document.getElementById('np-categoria').value.trim() || 'Serviços';
  const preco = parsePreco(document.getElementById('np-preco').value);
  if(!nome){ toast('Digite o nome do produto'); return; }
  let cat = catalogo.find(c => c.categoria.toLowerCase() === categoria.toLowerCase());
  if(!cat){ cat = { categoria, itens: [] }; catalogo.push(cat); }
  cat.itens.push({ id: uid(), nome, preco });
  salvarCatalogo();
  document.getElementById('np-nome').value = '';
  document.getElementById('np-categoria').value = '';
  document.getElementById('np-preco').value = '';
  renderCatPills();
  renderLoja();
  renderFiltroCategoria();
  toast('Produto adicionado ao catálogo');
}
function removerProdutoCatalogo(id){
  catalogo.forEach(cat => { cat.itens = cat.itens.filter(i => i.id !== id); });
  catalogo = catalogo.filter(c => c.itens.length > 0);
  salvarCatalogo();
  renderCatPills();
  renderLoja();
  renderFiltroCategoria();
}

/* ---------- EDITAR PRODUTO DO CATÁLOGO ---------- */
function editarProdutoCatalogo(id){
  let alvo = null, catAtual = null;
  catalogo.forEach(cat => { const it = cat.itens.find(i => i.id === id); if(it){ alvo = it; catAtual = cat.categoria; } });
  if(!alvo) return;
  produtoEditandoId = id;
  document.getElementById('ep-nome').value = alvo.nome;
  document.getElementById('ep-categoria').value = catAtual;
  document.getElementById('ep-preco').value = alvo.preco;
  document.getElementById('edit-produto-overlay').classList.add('show');
  setTimeout(() => document.getElementById('ep-nome').focus(), 50);
}
function fecharEditarProduto(){
  document.getElementById('edit-produto-overlay').classList.remove('show');
  produtoEditandoId = null;
}
function salvarEdicaoProduto(){
  if(!produtoEditandoId) return;
  const nome = document.getElementById('ep-nome').value.trim();
  const categoria = document.getElementById('ep-categoria').value.trim() || 'Serviços';
  const preco = parsePreco(document.getElementById('ep-preco').value);
  if(!nome){ toast('Digite o nome do produto'); return; }
  let item = null;
  catalogo.forEach(cat => {
    const idx = cat.itens.findIndex(i => i.id === produtoEditandoId);
    if(idx > -1) item = cat.itens.splice(idx, 1)[0];
  });
  catalogo = catalogo.filter(c => c.itens.length > 0);
  if(item){
    item.nome = nome;
    item.preco = preco;
    let cat = catalogo.find(c => c.categoria.toLowerCase() === categoria.toLowerCase());
    if(!cat){ cat = { categoria, itens: [] }; catalogo.push(cat); }
    cat.itens.push(item);
  }
  salvarCatalogo();
  renderCatPills();
  renderLoja();
  renderFiltroCategoria();
  fecharEditarProduto();
  toast('Produto atualizado');
}

function renderCartBar(){
  let bar = document.getElementById('cart-bar');
  if(itensOrcamento.length === 0){ if(bar) bar.remove(); return; }
  const totais = calcularTotais();
  const html = `
    <div class="cart-bar-info">🛒 <b>${itensOrcamento.length}</b> ${itensOrcamento.length === 1 ? 'item' : 'itens'} no orçamento · <b>${fmt(totais.subtotal)}</b></div>
    <button class="btn btn-amber btn-sm" onclick="setSection('orcamento')">Ver orçamento →</button>
  `;
  if(!bar){
    bar = document.createElement('div');
    bar.id = 'cart-bar';
    bar.className = 'cart-bar';
    document.getElementById('section-loja').appendChild(bar);
  }
  bar.innerHTML = html;
}

/* ---------- ORÇAMENTO ---------- */
function renderClientDatalist(){
  const opts = clientes.map(c => `<option value="${c.nome}">`).join('');
  document.getElementById('clientes-datalist').innerHTML = opts;
  document.getElementById('clientes-datalist2').innerHTML = opts;
}
function onClienteNomeChange(){
  const nome = document.getElementById('cli-nome').value.trim();
  const c = clientes.find(cl => cl.nome.toLowerCase() === nome.toLowerCase());
  if(c){
    document.getElementById('cli-whats').value = c.whats;
    document.getElementById('cli-endereco').value = c.endereco || '';
  }
  atualizarStatus();
}

function adicionarItem(nome, preco){
  const existente = itensOrcamento.find(i => i.nome === nome);
  if(existente){ existente.qtd += 1; } else{ itensOrcamento.push({ id: uid(), nome, preco, qtd: 1 }); }
  renderLines(); renderResumo(); atualizarStatus(); renderCartBar();
  toast(nome + ' adicionado');
}
function removerItem(id){ itensOrcamento = itensOrcamento.filter(i => i.id !== id); renderLines(); renderResumo(); atualizarStatus(); renderCartBar(); }
function atualizarQtd(id, qtd){ const item = itensOrcamento.find(i => i.id === id); if(item){ item.qtd = Math.max(1, parseInt(qtd) || 1); } renderResumo(); renderCartBar(); }
function moverItemOrcamento(id, direcao){
  const idx = itensOrcamento.findIndex(i => i.id === id);
  if(idx === -1) return;
  const novoIdx = idx + direcao;
  if(novoIdx < 0 || novoIdx >= itensOrcamento.length) return;
  const [item] = itensOrcamento.splice(idx, 1);
  itensOrcamento.splice(novoIdx, 0, item);
  renderLines();
}
function duplicarItemOrcamento(id){
  const idx = itensOrcamento.findIndex(i => i.id === id);
  if(idx === -1) return;
  const copia = { ...itensOrcamento[idx], id: uid() };
  itensOrcamento.splice(idx + 1, 0, copia);
  renderLines(); renderResumo(); atualizarStatus(); renderCartBar();
  toast('Item duplicado');
}

function renderLines(){
  const body = document.getElementById('lines-body');
  const empty = document.getElementById('lines-empty');
  const countLabel = document.getElementById('itens-count-label');
  body.innerHTML = '';
  if(countLabel) countLabel.textContent = itensOrcamento.length > 0 ? `(${itensOrcamento.length} ${itensOrcamento.length === 1 ? 'item' : 'itens'})` : '';
  if(itensOrcamento.length === 0){ empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  itensOrcamento.forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="line-reorder">
          <button class="line-move-btn" title="Mover para cima" ${idx === 0 ? 'disabled' : ''}>▲</button>
          <button class="line-move-btn" title="Mover para baixo" ${idx === itensOrcamento.length - 1 ? 'disabled' : ''}>▼</button>
        </div>
      </td>
      <td>${item.nome}</td>
      <td><input type="number" min="1" class="qty-input mono" value="${item.qtd}"></td>
      <td class="mono">${fmt(item.preco)}</td>
      <td class="mono">${fmt(item.preco * item.qtd)}</td>
      <td class="line-actions-cell">
        <button class="line-dup-btn" title="Duplicar item">⧉</button>
        <button class="remove-btn" title="Remover">✕</button>
      </td>
    `;
    const moveBtns = tr.querySelectorAll('.line-move-btn');
    moveBtns[0].onclick = () => moverItemOrcamento(item.id, -1);
    moveBtns[1].onclick = () => moverItemOrcamento(item.id, 1);
    tr.querySelector('.line-dup-btn').onclick = () => duplicarItemOrcamento(item.id);
    tr.querySelector('.qty-input').oninput = (e) => { atualizarQtd(item.id, e.target.value); renderLines(); };
    tr.querySelector('.remove-btn').onclick = () => removerItem(item.id);
    body.appendChild(tr);
  });
}
function calcularTotais(){
  const subtotal = itensOrcamento.reduce((s,i) => s + i.preco * i.qtd, 0);
  const desconto = parsePreco(document.getElementById('desconto').value);
  const total = Math.max(0, subtotal - desconto);
  return { subtotal, desconto, total };
}
function renderResumo(){
  const { subtotal, desconto, total } = calcularTotais();
  document.getElementById('sub-subtotal').textContent = fmt(subtotal);
  document.getElementById('sub-desconto').textContent = fmt(desconto);
  document.getElementById('sub-total').textContent = fmt(total);
  atualizarStatus();
}
function atualizarStatus(){
  const nome = document.getElementById('cli-nome').value.trim();
  const whats = document.getElementById('cli-whats').value.trim();
  const clienteOk = nome && whats;
  const itensOk = itensOrcamento.length > 0;
  document.getElementById('dot-cliente').className = 'status-dot' + (clienteOk ? ' on done' : '');
  document.getElementById('dot-itens').className = 'status-dot' + (itensOk ? ' on done' : '');
  document.getElementById('dot-envio').className = 'status-dot' + ((clienteOk && itensOk) ? ' on' : '');
  document.getElementById('btn-enviar').disabled = !(clienteOk && itensOk);
}
function toggleAgendarFields(){
  const on = document.getElementById('chk-agendar').checked;
  document.getElementById('agendar-fields').style.display = on ? 'block' : 'none';
  if(on){
    document.getElementById('ag-data').value = document.getElementById('ag-data').value || hojeStr();
    document.getElementById('ag-servico').value = document.getElementById('ag-servico').value || itensOrcamento.map(i=>i.nome).join(', ');
  }
}

function toggleProposta(){
  const on = document.getElementById('chk-proposta').checked;
  document.getElementById('proposta-fields').style.display = on ? 'block' : 'none';
  if(on){
    document.getElementById('pp-previsao').value = document.getElementById('pp-previsao').value || perfilEmpresa.previsaoEntrega || '';
    document.getElementById('pp-pagamento').value = document.getElementById('pp-pagamento').value || perfilEmpresa.condicoesPagamento || '';
    document.getElementById('pp-imposto').value = document.getElementById('pp-imposto').value || perfilEmpresa.impostoPerc || '';
    const faltaDados = !perfilEmpresa.nomeEmpresa && !perfilEmpresa.sobreNos;
    document.getElementById('proposta-aviso-empresa').style.display = faltaDados ? 'block' : 'none';
  }
}
function coletarCamposProposta(){
  return {
    nomeEmpresa: perfilEmpresa.nomeEmpresa || '',
    responsavel: perfilEmpresa.responsavel || '',
    sobreNos: perfilEmpresa.sobreNos || '',
    telefoneContato: perfilEmpresa.telefoneContato || '',
    emailContato: perfilEmpresa.emailContato || '',
    condicoesPagamento: document.getElementById('pp-pagamento').value.trim() || perfilEmpresa.condicoesPagamento || '',
    previsaoEntrega: document.getElementById('pp-previsao').value.trim() || perfilEmpresa.previsaoEntrega || '',
    impostoPerc: document.getElementById('pp-imposto').value.trim() || perfilEmpresa.impostoPerc || '',
  };
}

/* ---------- EMPRESA (dados fixos) ---------- */
function carregarFormEmpresa(){
  document.getElementById('emp-nome').value = perfilEmpresa.nomeEmpresa || '';
  document.getElementById('emp-responsavel').value = perfilEmpresa.responsavel || '';
  document.getElementById('emp-sobre').value = perfilEmpresa.sobreNos || '';
  document.getElementById('emp-telefone').value = perfilEmpresa.telefoneContato || '';
  document.getElementById('emp-email').value = perfilEmpresa.emailContato || '';
  document.getElementById('emp-pagamento').value = perfilEmpresa.condicoesPagamento || '';
  document.getElementById('emp-previsao').value = perfilEmpresa.previsaoEntrega || '';
  document.getElementById('emp-imposto').value = perfilEmpresa.impostoPerc || '';
}
async function salvarDadosEmpresa(){
  perfilEmpresa = {
    nomeEmpresa: document.getElementById('emp-nome').value.trim(),
    responsavel: document.getElementById('emp-responsavel').value.trim(),
    sobreNos: document.getElementById('emp-sobre').value.trim(),
    telefoneContato: document.getElementById('emp-telefone').value.trim(),
    emailContato: document.getElementById('emp-email').value.trim(),
    condicoesPagamento: document.getElementById('emp-pagamento').value.trim(),
    previsaoEntrega: document.getElementById('emp-previsao').value.trim(),
    impostoPerc: document.getElementById('emp-imposto').value.trim(),
  };
  await salvarPerfilEmpresa();
  toast('Dados da empresa salvos! Serão usados em toda Proposta em PDF.');
}

/* ---------- LOGO DA EMPRESA (embutido em base64 para uso direto no PDF) ---------- */
const LOGO_EMPRESA_BASE64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAJYAlgDASIAAhEBAxEB/8QAHQAAAAcBAQEAAAAAAAAAAAAAAAECBAUGBwgDCf/EAGEQAAEDAwIDAwcGCQcGCwUHBQEAAgMEBREGIQcSMRNBUQgiMmFxgZEUI1KhscEVM0JicoKSstEWJENTY6LhJTRzs8LwFyY1NlR0k6O00vFEZHWDlBg3RUZVZYQJKFbD8v/EABoBAAMBAQEBAAAAAAAAAAAAAAABAgMEBQb/xAAvEQACAgEEAQMEAgICAwEBAAAAAQIRAwQSITEFEzJBIlFhcTOBI5EUoRVCsdFS/9oADAMBAAIRAxEAPwDqi5fjwmk/oJ3cvx6aT+hhcr7NYkxZ/wAS1SKjrP8AimqSIXXHowl2Eid0KNE70SqEUHiRStnt8kZGcrCNQWQwu52t29i6E1mMwO9qzm9ULJacnGdlzZ47mbYnSMtoY3Us2W7DO6u1irw9oaXKvV9MIp3NAXnQzuppwD0WKjRs3ZoQwRkbhAhMLVVtmiAz3KQHVX2SyT1MeXQlq/08v3LPp5O/Kv8Aqt2NB2r/AKxJ9yzipO/vK64vg52jyfJuf9+5eHa7dSkzO3xnwXhzDlJyeqokcuk3BRNfsd02MmXhue5Bj+7KaEyShd5ydN3B3UbC7fYp/CdjjKskWc8xyixuUojZF3FAqPNwXm8Zx7U4x5qQW/agQ2IPevKRvVOXNz3JDm7IAalvX2ryc3dO3N6leT2oAaPb6u9eL259qdvbjK8XtOfYpGNHs2TeVm3RPXtyvCVuyBkfIwAJrKzrspCVucptKzqkNEdIzbPqTaRux2T+Rm3uTeRnX2BBRGytTaRu+FIyty1NpWboAZP9iSemV7Pbt715EbYSYHmeqSeiUdiknopAQ7wRHqEeO9E4boAI9MJPTuSnd2/ek42QAXcggAjxukAX8EBjbKHR2Elw84FFgKOOiI7dyJw6IOxsix0AFEknYb+KGUWOg0Z33Se9H1BQTQrwQyjHRJGcIsBfejyiPRKAznxRY6DG2EecowNgiSKPGrP81lH5pWkaeOLHRf6ELNqvemk/RK0awn/IlGP7IKJDRI59aSXBIJ3SMqChbnb4SSUkkJL3ADPcmAmpmEcZcVRNS3B9XOYIySOhwpXU105GmNh3PgVGWGgNRKZ5B1TEyBt9uMFb2zhufFaJZj/NWqu3iIRVAa0Ywp+zH+aM9iZJI5XnNvE5GfevOY/NuQBT6n/lf9ZBCp/5V/WQVID6AXIfPplN6BT66f5wmM3ormfZrHombR+KapNRdnHzQ9ik+7C6o9HPLsIpJ6FGiPQqxFR1h+Jd7VTamPtIA3xVy1ltC72qo52j/SCyn7jWLpFZvGmKicOli9LGQFSK+J8b3Me3lezYjwXR9voYpaYO5BuN1l/FLTToJX19NHsfTaB9aqeJVaJjld8lKsVx7OQMcSCFdKSdssYcCsrqpXU8zZBt4q16XuzZGtaXdVzdHQX7WB/4hWsD/pMn3LOKk+cd1omqTz8PrU4d9RJ9yzqp6npldSOeQxmcQ4+1NHvw4ju/wTioJwThMJnEPIz0VokW1+XjfGy9I3HJyU0D8E79yXG85zlMCTgcM+pSdO4YGVC0rgSM9yk4H9O9UmS0Pz1RYQY7O6GQmIPG2yTylLB2KHNudkEnlheRanDtx0715H70AeMjV4vHVOX7LxcNyUgGso6rxcO5OXjqvGTqUANnjYlN5QU7kGxTeUbJMaGkjfFNZBlPpBnZNpGgJDQxkbsm8rdjhPZgmsg6oKQykam8zU9kA5SScDxKYz1VI1/KamEE9MuSsY2e3ZeEg69U8eAW8zcEeI3Xi9u5SbAZPG6S4bL3kavJ6QHj7SiJRuCS7qEwCJy3fZAdyBGAgFNDQQ6I+/3IsYBAQP3IHwB3XKS5GRgBEe5IYR3wi6gFKSTsEAEfD1pJ6pWeuyIeKAAOqMBAdUvCAAOgSmjvRAdyUNkAHj1od+SgEEAHlDvRHuQygDxq9qWT9ErRLIcWekH9kFnVZ/m0n6JWgWlwFqph/ZBRJDQ/c7wwkly8jIF5ukUlHs5+FGXmvbBA7fuXtVVLYoy5zsKkXu5fKavsWOzkoEwQskuNfzHJblXK3UzKeAAAZworTtI2OASEb43U1zgNVAV6+DmrPerJYKCeakZyNPRQFQWOuje0ALQVqmlpKRtEwkNGyTYkiBFkqMZIK857PKGH2K9y1lGBgFqZVtVSmB5HLnCVg0YvdKZ0F1876SCkNVSxy3dojI9JBapOibO5rof5wmUx80p3dD/OAmMx81cr7N49E5ZfxDVJlRdk/EtUp3rqXRzTEd6J3QpTkl3oqyLKfrL8Q4nxVSado/0grZrP/N3e1VIH8X+kFnL3Gq6ND0/j5KwHwXlqO2R1lO9jmBwI8F7af/zZnsUnI0PBBGV0WYHLPEzTslpqXyMaeweSRt0PgqJZLq6lrORzsed4rqDiXY4q+1TxuYDkEjbouRb/AEc9FcZm5OWPIXJnhTtHThlfDOkKuX5Rwuscuc88kh+xUisZucK02lxk4K6We45Ja8n6lWqrBJWq6JZEVLThR04w85ClqgAg5wouqGBt4qiRk44IOSlxuK85PSQYfO2KYEjTu3G6kadw696iYHDCfQPVIklI5PNSzIB3JnG/plL58BMQ5Em3VH2m5TTtBhF2iLEOXSetIMngvAv6pPaIEe73/FILhuvF79+qS6T7Uh9C3FeT+vuRGTfGUgvznvTAKTCbvAKTW11JSt/nFRHGfAnc+7qoqpvjC0/JaWWQfTk+bb9e/wBSVjokJQAmdXJFC0OlkYweLnYUHW3eolJD6wMH0aZv+0VGvqAXc0cQ5vpyEvcfip3pFbSYnucLiewZJP62jDfiVHVNwmdkGSKL1M893x6JlIZZj57nEeHcjZTE42KhzRaQiacPOS18h8ZHZ+rom80Qn/GMB8NsKRbRuxkjA9a9GUrXg8jg4eIWLzRvsdMgPkZhPNTTSwn812B8Er5TcYtniOob7OU/V/BS89G8HJacJrJE4KlJMBm24wk/OskhPfzDI+IXu17JG5jc148WkFJkhDtnNBTSSgj5uZmWOHeCq3CocPHRJcN8ps5lbGfNkErR3OGfr6ohWcpAnhfH6xuP4p7xUOQMo8JMM0Mp+bka4+AO/wAF6kKrFR54REepemERG6As88FEeq9Dt1RHBUlHmkkJZHgkuBToExGN/BDCUAcpYHfhIYkBGAlADGUeEAEOnrQOECiJ6IAUSAi6JDj60kuPigD0Jyk8yQXDxSebcoAFa7+ayfolXq3vDbfTtz0ib9iz+scfk0v6JU7UXJ0DxD9FjR/dCiT4KirZaDKO4heb5QGknuVX/C5+kvCrveIyA87rO7KaoeahuJOYmO+CrFvge+4GV+cZ70pk76qp5iSV7yTNgOARlWmQ+S52x4FMMYTgybHdVeguBbABzJ0LlkdUrHTPO7SObVZaehVitFzqW0bWiQjZUe5VnNOTlSNvuBbTgcyZJcvwhOd+2PxRS19QYnDtDjCq7bkQepS23AuBG59SBjeWR0lz3JJLtkFcuH2j57jcGV9UzDc5a0oLZdGbOyLof5yPYmc581OLq7FUmU581cb7OmPRYLGcwtKlT1URYjmFvuUudl1Lo5pdiXJLvRKNE7orIRTtZ/5u72qoN/o/0grZrU/Mu9qqLT+L/SCiXuNI9Gkae/zZvsUsonT5/mzfYpZasxIDVDA6keCAchcx66sTZKmpe1mCXnuXT+odqd/sWK3umbNPPkZy4oyK0VB07HtAww8GtMxnq0PH2KqVJ3KvF0i7DhvZogMcksox8FRarYlR0WR9SdvWo6qd1Cf1PQlRlSUANn4yks33RPd6u5CMnfZUgHEJwnsDjlMYc5T2JMl9jxjjgIy4968+4JTfRTEKByCiyjx6kg95Ow8SgBRcclJJJICZTXSjjfyRyGok+hA0vP1bJrU11by7RQUTT31D+Z/7DUWNIlSTn3pjWXOipyWyVDC/PoM893wChKqeOTPb1VVWH6Oeyj+A3TM1MjAW08cdO3wiaB9fVLcOiXqLxPguipRE3+sqX8gPsaN1FVVyklGJq6aQfQgHZt+PUpm9jnuLjkk9STkoMp3HoFnKdDUTzM/ISYIY4s/lAczviU3f2kpzI9zj+ccp45kMRAklYCejQcuPuCl7dpy9VsYmgtUkMB6T1jhBH7ubc+5cuXV48fukaKDZXmwOJ6JZgDBmRzWDxccLT9N8LbpcuVz5KuraeraGDs4/fLJgfAFaXpfgzTUhbNPBQUjh+UW/K5v2n+aD7GrzMnl49QVmixV2c72myXO5Dmt1sqqhg6y8nJGPa92Arbp7hxdri8NfUAnO8VBCah/vfswfFdMUWitO0YbLVQurns3D62Tna32N9EfBe1fqnTtng5DVwtazYMiAwPuXnZfIZp9tI1UY/CMq05wW5OWSpoKeMj+kuMxqJB7I2YYPeSrqeF9CaMQG5u6ej8jh7L9jH3qI1Bxkt1MHMoImucNuYnm/wVRi4y3P5d2jnPMefR2x8MLk+qfKTZVMltQcG5OVz6alp5h40knZO/Yflp9xCzXUPDeuonluDE7uZVRmBx9hOWH4rarDxftFUGtrOWMnrnzf8Fc6HUlgu0JY2qhe14wWSAYP3LWGqyYnUZNfslxvtHGF30xcreeaqop4m9zizLT7HDYqGlo3jcDPsXb1dorTta10lNCaJz/y6STkafa3dp+CompuDkNTzSU8dFVE9+Pk0vxblh94XoYvKzXvV/oj00zlKSEgnZeT4QRgtGPWtj1PwprrfzOAqaYdwq4cs90seW/HCo1z0peKNrpX0EkkQ/pYMSs+LfvXo4fI4cnz/szeJopU9BC/fkwfELzbT1kI+ZqC8fRfv9v8VOupjkjw7l4vhI2wu1ST5RNMiPlUse1RTEethz9RXtHUwy4DZBnwOx+BTx0WxBCaz0UL+rMH1KrYhZGySRt4JoaSoi/ETux9Enb4HZGaioj2mhBHiNv8PrVJiaHDtihy7rwZVQOIDn8h8HjH19E42I23B71Vh0FgIwDjogEY2SCwdySdkpESMIGJJ2KQ9G4rzd1QAROySSicdkgnfKAFEpPNuQiJSSd9kAJq3fzWX9AqRujM1zz6mfuhRVWT8mk/RKmrkQKuQ+DW/uhY5faaY+yMqQI2Z2Ch5HmSXGT1Ty71HmENTS2N53hxB6qIriypO2SVFCI2c2F5Ve8hyn7RgdExqBmQprsUuj2p/wAWF7t2GV5QACIFKLmp0K+BpVjMvvT6kaOxBUdVPHbFP6KQdkAqaaRF8jgN326q+cPdIy187KmojIbnLWkJvoDSs1zqGVM8R7POWghb/pmyxUNMzDAMDZVCF9g5Htp6zxUNMwBgBwgpsAADZBbLgzLZdzirTOZ3zZXvenYrMepM5neYVxPs6V0WWwn5hqlyVDWA/MN9gUwuyPRyyAkyeiSlJMnolMgpetfxDuvVU9vWP9IK3622pz7VT27mP9IKZe41j0aXp/8AzZnsUuojTv8AmrD+apfuWjMSD1J/mz/Yserd6uXP01sOpP8AN3/orHqw/wA8k/TTkVEmtUAN0bQMHQVEv3LPKvr6loerNtJ0P/WJfuWd1h3US7LRGVJ6qNqMZT+pPVR9QTukA0kG6OIEbnog8nvRsLWjznBo9ZxlMBxH0TqI7LzpKOvqW5pqGeRn9Y4cjP2nJ1+DnM/zy6xQf2dJH2r/ANo7BNCoNz2Rs53uaxo73HAXlFXMlcWUcM9Y/PSFhI97uiMstsDuaGg+USD+lrHmQ58cdAvKqraudnI+Yhg6MZ5rR7giwFVLq0H5+ekt4+jntpfgNgo6pdRk5eyorn/SqX8rf2G7IFu/eidDtzOw0DvJwFLnRVHhLVVDmckbmwR/QhaGA/BM3Rk5PVPIHMqZuwoYqivm/q6WMyfWNgpai0rqCskEb4qW3k9GPcZ5z/8ALZn61xZtfixe6RpHFJldbA535JwkfMdsIYyZpT0jhBe4+4LXdP8ABmsq+WS4U9ZUDrzV03YR+6JmXH3kLStO8L7Zbomsln7NnfDQxCnYfUXDLz8V5mTzF8Y42aLEl2c4Umlr9Uubmgjt0buj66TkcfZGMuPwV00/wfuNw5X1Ar6pp7+UUcHxdl59wXQNLQaZ083mgp6Kjd3vIBkPtccuKhr7xI0/bQ4Nm7Z49eB/H6l5uXW58jpyr8I0UUukQOmOENBbOVz5KWjd3iig+cPtlky74AK5UWm9MWfFQ6lgMo/p6t/aP+L849yynUXGeeTmjoGdmPFox9Z3WdXzXV5uL3Olq3gH1n7Vnj02XK7Uf7ZT47Z0letd6dtbTz1QlI6BnT4lZ/qLjVGwPjt0LW+B9I/Xt9S56vWpqanaZK64Mae/mfuqdcNf0heWW+mqKx/iBhq74eNnL+SX+iHOK6RtuoeJV8ub3c9TIAe7mJwqTdtROwZa2uDQOpkkwskumrb1UZbJV09Aw/ks856rlXWRyvL5HVFZIfypn4Hw6ruxePw4+okvI2afdde2uFxZTukrJPCMbfFQ7de3ET8xtbey+jznmVCNRUuHKwiJvhGOX/FJbEebOTnx712xxpdEORrFu15apyGVD5aN/hKNviFbbRqeVmJqCu5x9KOTP2LABJOwcpeJG+DxlLp6pkMnaME9K/6cD/uUZNPCfuVgptdHWmneKt8tzm/PmRvfkkZ+C0rTvG2km5WXGINJ6u6fZ/BcQW3Vd3pyGsrIa5n0Jhyv+Ox+1WCh11TZDa6nno3HvxzN/ivOyeJxt3Dhmnq/c+gFl1zp66sHZ1TWF3UEgj6l71umtM3jNQ2kgEh/p6V3Zv8Aizr71xFZ9SxTYkoLgx5G/mP84e7qrtYOI98tr2llY92PFxz8eq4Mvj88ftIpSi+jddScIqG4czoZKepJ6NrIsO90keD8QVmGpeDdbRh74qeupmjfmaPlUXxbh497VZdNccHAMjuTC7uLjv8A4rR7FxJ03dA0CpEbj68/4rmjky4H8xG1f5OVLlom90/MYaZlc1vU0r+Zw9rNnD4KtT0z4ZTHKx8bwcFrwWkfFd01VBpnUTeaamoax3UOAAkHvGHBVnUHC21XCMtgqCQRtFWRioYPYTh49xXfi8plj7lZDxxf4ONXweorzdCN9iugNR8EZoS99PRTxjqJKCTtme+N+HD3ErO7vw+vVHK5lOYKwj+jyYZR+o/BPuyu/F5bDLiXH7IeJrozuWkjdnLME+Gyaut5YeaCQsP5u3+H1KyXG31NDMYa+lnpJB+RNGWlNHQ7bbr0IZYy5TIcWiDDquL0wJB4kYPxG31JYq48ee10fiSMj4hSUkWNsJvJTsJJLd/HoVrZNHmx7XsDmuDh4g5SXLzfSNDuZmM+PQ/EJB7Ru3aOA/PbzD4jcfBPcOj0djdeTjhAukcCRGXgd8RD8e4b/UvLtGu2a4E947x7k1JMVBuIx1SCfDZB3QJBTABdlETsESLKAEVTiad/6KktR1Ajq5Gjrhv7oUXUZNO/9EpxqQF98mYO4sH9xqjIuC4PkY9k6due5OqKEMe0Y707jhEdKNhnCTSjMo9qxvgtjosACjapp7Q4U05myjKtnzqcewl0FHkQ9E3eSSU9Y0CLC8HMG+FojKRGzA8xz1V+4a6TqLpPFUTxuEQOwPevDQ+j57zXsmljPYA5AI6ro7R+noLfSsDYwMDwWyXBFnvpaxQ0NOzEYGAMKyNGAAAg0AbAYSwNkxWGgh1QQBYb67+ej2JlKTylOL+7FeEzkd5pXG+zpj0WvT3+bsU0RhQ2nR/NmexTeBhdcejml2JSX+iUohJf6JTMyla5/wA3d7VTWdY/aFcNdH+bn2qnM3dEO/mCmXuNIdGnad3pWexS6idPNxSsx4KXwtWZEFqP/N3+xY9WZFZJt+Wtj1EP5u/HTl3WLVtVT/hCSNsnayc/4uIF7uvgEMaLDq3/AJpUW3/tMv2NWb1v3rQLkbndbTBR/g5tvhilfJ21bMGucHY6Rtye7xUX+BbTAOaqqKiuf9GICGP47uPxUM0RQpmEuxg5PQd59ycRaYu1S3tTTimhO/aVLhE369z7griayOiaW26kp6IfSiZ55/WOSoetnkmeXyPc93eXOJKXAEYLBaqUA1lwkqnj8ilZyt/bdv8AAJbJaOl/5PtlNA7+seO0k+Lkp7C71hM62opaMc1VUxQ+Ac7c+7qlLIoq2wSbFVNRU1JzNM+T2nKbGM+CXFJXVbOe32iplj/rqgiCL9p259wUvZtG6jvThieUsPVltg833zSYHwXDm8ngx/JqsMmV2pEcLOeeSOJo73uwE2pzNXuLLXQVdwPe6KMiMe17sALZdO8G4ontnrI6SGTqZJiaub4uwwH2Aq92/Q+nqNrX1UT65zOhqpMsHsYMNHwXmZvLZJL6I0vyaLHFdnO1q0hqC6yiNskMHjFRxmqlHtIwxvxV60/wWlle2a40zXHrz3Gcyu/7JmGj3la3W6g0/ZoOz7eCNrP6OEDA+Gypl84uUNOHMoYOcjo5xyvNlq8ubuTf6NFGukTto4dWajhbHVSzVLB/RMxBD+wzGfeSpoVGnNPwdnD8iomgehE0An24WFX7ihe64OayXs2HuB2+AVGvGoqybL62uIb3hz8BaY9Fmn1GvywbXyzoa/cU7JQhzaYtmcO8n7h/FZ7qDi7dakuZSO7Jh+j5v+KwS868slG5zDWCeQfkx7qr3DX10qWk2+g7KPulmPKAu2Hik/5JWT6iXSNmvOrbnV8zqiteGnr52FSL5rG1URPyiuYX/RaclZJdb5W1bnGtu8sn9nTdPion5S1pJp6RgP05fPd/Behi0mLF7YkuTfZolw1/LUZbarfLL/aSbNCrVy1HdKnPyy8tgb3x0w5nfV/FV2Z9VUfj5nuHcCdvh0RNhAAyuhRIbPaSqgLy6OmfO/8ArKl5cfgNl5ST1czeV8pYz6DByt+AXo2MY6Iy0KlEVjZkPiF6CMeC9MIK6JsTyowEZRZwjsAykkZ8ECQk5T2gE+NpO4QjdURDEUpDfoncfApXvQSHYYnYDzSQcrh+XCeU/Dopm3ahuFPyinuglA6RVQ+//FQpwkOY09ynaFl9pNaOj5RcaGWEf1kR5m/7+9WazampKkj5HXxuf9EP5Xj3HdY5GZYiTDK5nsO3wXp8oLj8/TRyfnN8x31bKJYYy7Q1Jo6Rs2ur1bnN7KukwOjXnK0fTXG24wBrK7MjehPpfbv9a47t18qqfDae5zRNHSOqHOz474+pWGj1bVRNDqui7Rn9bTO5m/D/ABXnZfFYZ8pUzRZX8nd+m+K9guQa2aRkbz4HH1H+KtjqjT9+h7Ob5HWNd0ZK0H4Z+5cA2vV1umcBHXNjf9GQ8h+vb61crRrO50PK6nrZA3qBzZC8/J4zND2u1+SlOLOsbvw5sdbC6OndNStP9GSJov2H5x7sLNNTcD888tJQxyd/PQTdk7/s35afcQq7pjjRdaPlZUOMjB13+47LTtNcYrNcOVlUWxvPr5f8FxOOTC+U4/ovswe/cNLvb5CyOQc2doq2J1O8+wnzD7iqhd7FdLZn8I26ppm9z3Myw+xw2K7gpb3YrvBydvBKx49CUAg/HYqOuOhdP1rHGmikoS/cmlfhjvaw5afgurF5HNH5TJcV8nDL4c7twR6ivB8R8F1XqfghS1ZfJBBQ1Lj+XF/NZvqywn2gLKdT8Jbla5Hcss9OM7Nr4CGn2Ssy344XoYvLY3xNUQ8X2MglhBdkt3Hf3pLzJsHlkzR3TN5/rO49xVsu+k75bozLU2yYw9e2h+dj/ablV+SDPTBPgvSx6jHk5iyHFoYn5I702T057zGe1b8Hb/WgLe+X/M6qmqj9Br+R/wCy/H1Er0khOeibSxAg5C1TJPGqhnppOSpglgd4SMLftXiSn1PX3Ckb2cFU/su+J/nsP6pyEsVlumdiutLYz3yUbzGf2Tlv1BXufyFEZJvBJ7CpK8xg6iqva39xq9xbLZWRubb7zG17hgRVbOzd+0Mt+sL2vlDVx3aerkp5G08hbyy9WHzQPSGR3KZyTRUU7PCRuKZN6MfPD2p7IwGmz12TejZ86Pasl0WyQxkKMrBmUhSh6YUbUgmYqo9il0Bg+ZCsGi9Mz3mra+RhEAPh1Xro/Tk15mZljuyBHvW+6M01T0FMwdmBgeC2grMpC9GacgoKZgEQGBtsre1oaMAAAJMbAxoaAAF6N6rUgDeqUi70aYg296CNoQQMltQn/KAHqTOR3mJzqM4uITF7stXE+zpj0XjTQzSMPqU0RsofTP8AmbPYFNLpT4MGjzcF5v8ARK9yF5TABjjnGBkqkyHEomuj8w72qo04zJET0Dhk9wVz1PSS1cnJPNFTxE5AaOd5H1AfWoqK32yIN/mzqpzejqh3MP2Rshrmyo8InaLU9ppIGxQmavnA3jpIjJg+t3oj4pvW6kvlRkU1LR2th/KqX9tL+w3Ye8lMpJnuZyAhjB0awcoHuCaSbItCqzwuEDa7e611dcz9CWTsof8As2Y+tNxyU0fZUcMNLGPyYWBn2br1mkaxvM9waB1JOAFXbjqqywzGCKrNZP8A1NIwzPz+rsFnPNGPudFKF9D2oJJJJ38VHVGSCo2ou1+rZOxobZDRc3Q1bzJIfZFHk/FPbfw71NeiJLlJXSxnflnf8kh/Ybl5HtwvOy+Www4i7NVhfyQd0u1tpXmOasj7XujZ57z7hkpg6a6VODS2o08buk1fIIQfYzdx+C2DTvCy20DQaipbH4x0UQiB9rzl5+IVrpLTpuwjtYqWjp3j+lf50h/WOSvOy+Vyy9q2lrHFfkwy06C1He8GZ9fLE7up4xSQ/tv84+4K86c4Q0lERJM+lpH9T8nj7WU+2WTJ+AVru+u7JQZDZTM8dw2VMvPE+seC2jjbC3xxuuJzy6h/Mv8ApGnX4L3RaV01agJ30kUsjf6arf2jvi7Ye4JN01lYLa0tNS2QtGzWDYfcsOu+q7tXvcZquQjvwVTL9qu124OdcLnCxw6t5+Zy3xeNzyfNRJco/s3K88V2jmbb6cDHRzt/tVFvmu7zcCQ+qeAegB6LDbxxXtzHmO2Uk9Y/uJGAqnduIOoa0lrqiC3RnuB5nfBehj8ZiXM+SXN/Bs96vjIg6WurQ0DqXvyqJeeJFmpXFlO6Ssk8GDb4rLLhcTVPL6maprn/ANo7DfgmMklQ8YiDYG+DBj6+q7YYYQVRRLbLtduIN8qmkU0cNBGejnu85VK4XOWseXVtwqqwnuB5W/7+5MW0rieZ7i4nqc5Xs2Bo6Ba7SbPMVUrRimgih/ODeZ3xK8ntnqHc08r5D+ccp2I8dyXy+rCtRJbGjIAO5egjwvU58EWCnQWIwB3IAJRRFUkII9URRoimkAkokZRJgEUTkopDgcoAJBBBAAQBQQSoAZRZRHqgigDygeiJBSARAKJgdE7mie6N3i04KXhEkOxbqqV208cc/rc3B+I3TmhuT6V+aarqqPxGedh93+CZORYyEnEEXK2anuLADLDDWsHV0DsO/Z/wU/btW0Erg01Rp5OnJOOQ59vT61lnLg5BwfEdV7/LKrlDJHNnZ9GVvN9fVZyxp8Mqzd7Vqy5UPLJT1csbe5zXbH39Cr9pfjBeqFzRJOZGjrvj/Bcq2+4CldzU8lXQv7+wk5mH2tP+KnqPU9ezAIpa4D6PzUnw6fUuHN4zDk+C1la4O3dOcbbfUhrK5jWuPUnY/EfwWg2jWNgu0Q7OqYA7uduD7xsvnzRauonPDKgzUT/CZp5f2h/BWq0ajqo2iaiqy5g/Lhk5h9XT3rzcnjJw9kv9milF9nbtfpPTlzDp4qZkErv6ajf2bj7eXY+8Kiap4NUdw53sFDXE7/ziLsZf+0j6+8LE9N8WL7bXtxVmVo8Tv8QtQ0xx2hkLWXFgHiSM/WFwzxZMfMo1+UV+mUXVfBWsoeZ8La6ib/ax/KIv22bj3hZ5d9Cago2OkZRNrYh1ko3iUD2gbj3hdj2HiFp67saY6kMJ/OyPq3+pSVXZNNXxvavpaSaT+uhPJIP1m4K1w67NDqV/sTivlHz8qaJzHFjmlrgd2uGCEzmpy09F3FqXhPbrkx3ZywVO2zK+ESH3SNw8fWsp1XwLfEHyU9FV0oG/NTOFVF+zs8D4r0cfl0v5I0Z+mn0zmiWM5zhLpayvonE0tVLF4hrjgrRbxwyv1O94pWQ3AN6iB2Hj2sdhw+Cp1xs9XRSuiqaaWGQdWSMLSPivSxazDl9rIcHE84L5nIrqGCYnq+Mdm4/DY+8J5S1NolcDFO+B30Zh94/goWSncD6KbvjPgujhitlvdC8tL2+cz6TTkfUvWwafqbtcWhsZ7LO58VTqeeppnc0M0kZ9TlM2nVl0tsomilc2Qflxu5D7+4+9NKmDdnTGitNw0NJG3ka3lA7lc4mBjQ0DACwPQvGuqbXU1FeKYVcMsjYzIxgZLHk45tvNcB37A+tb/wCxdEWmjJgRhEAlqqEBKaib1SkgAglAIIAd6nd/lMD1Ji9w5F76pfi6t37kzefMyuJ9nTHo0XS4/mMZP0QplQuljmgj/RCml0roxYE3uJAopj+bj47Jwmd2dil5fpSMb/eCYFRvjy+4SjOzTyhRUz2xsLnuDWt3JJwAE8r389VM497yVSeJLBWUlvtbnkQ1VVmcA45442l5b7DgBY58qw43N/A4x3SSPao1naO0dBQCoukzdiyjj52g+t/oj4pgbnqi8SGG301PRZ/Jjaauf+75g95V50Xoa2Q2qmq7pEJ5ZGB4g9GGEEZDQwbHHiVZpbrZLVF2LHwRNbt2cLRj4BfOz8lmyfO1f9nQoRXSsyuj4YXq7PEl6nmlGc/z6cuA9kUeG/Eq52ThvZqCJsc8ks7R1ijAhi/ZZjPvK9rjrRoBbRUpPg56rF01JdqrIkq3RtP5LNlzrDmzPhOX7Hur8GgxHT9hhMcDKOjAHSNoDj8N1D3PXdvgy2lidO4d5OAszuVwhgidNV1LI2DcvlkAH1qgal4q6TtZfGK810o25KZvMPidl24/GZH75UvwTvX7NcvOvbtNzNie2Bvgwf7lU26XqrqC6SoqXkd5c7A96w/UHGa61XM2z2yKlZ0Esx5nfwWeX7VV6u7ibneaiUE/i43ENHuGy7cegwQ5q/2G+RvmoNc6dtQeKq6wueOrITzu+pUG8cWzIXMstrfJ4STHYe4LJe1GfmaYE/SkPMf4IzHVTDEsrsfRzgfBdcYpcRRm2WO+az1DceZtbduwjP8ARQbfYqzJPG5/MInzP+lK7P1L1io4x1GV7sga3YNAVqLFYxcKqTYO7Nv0WDlH1Kx8OuHWo9dXk2zT1AZ3sw6ed7uWGBp/Kkf3eobk9wKGmbHW6g1BQWS2xCSsrqhlPC09OZxxk+obk+oFfQHh9o60aG0pSafs8Y7KEc00xb59TKR50rz4nu8BgDotIwJ3GK6Q8lXTtPTMdqfUNwr6jq6Kga2CIHwDnBzj9SstV5NPC+WDs46e9wuxjtG3Ik/AtI+pevGfjlaNCVMltpIoq24RHlldI4iOJ30MDd7h3gYA7yslo/KxvEdUDVWWiqYM7hsLozj1HmP1hX9KJ5JfW3ktGno5qvSWpu2dG0v+S3SMMyAM4ErNh72+9czzMdFK+J4w9ji1w8CF1dqvyhNM6h4T3mSzyTUl4dD2TqObZ7Wu9JzXd4xt3Hdcg080jpXF5y5xJJ9fek2mxof57l0dwJ4A6e1lw7ptTalqrvBPWTyGmjpZmRt7Fp5Q48zCSS4O92Fz5Y7dVXm8UVpoWF1XWzx08IH03uDR9uV9JdOWujsVgt9kowGUtvpo6aP9FjQM+/BPvVJCZi8nkt8PXMLIrnqKN5BDXuq4yGnuJHZ7hcf3631NmvVfZ65nJVUNRJTTN8HscWn7M+9fQ7hpq6l1rYam50oY35Pcamie1pzjs34afewtd71yV5aumHWLipFqCCPlpb/TCVxHQVEeGSfEcjveUwRiyt/BvStFrXiRZ9MXGoqaalrnyNklp+XtG8sT3jHMCOrR1CpsbsgLU/JX/wDv40z/AKWf/wAPIkM3QeSnobA5tQ6kP60H/kWT+UhwWtnDayWu9WO5XGupqiqdTVIrOQ9m4t5oyOQDY8rgc+pdo3CrpqChkrKuVsMEQBkkd0aCQMn3kKm8e9Lfyu4SahszIw+rbSmppR1ImhPO0D28pb+sqJs+eGd0eMlNoZQ/BHQjIU7pGyVWpNT2vT9GD8ouVXHTMPhzuALvcMn3KSjoHg75OFi1Xw6tWpb/AHm80dXcWOnZBSiIMbFzERnzmk5IGfeFb2+Sfodzmt/lJqQZIH9B/wCRbk78F6csMcYe2lttvgjhYT0ZG0Bjf9n4qRaC2VrT1DgD7cqqJbPlzXwtpq+qpmuLhDPJECepDXEAn4La/Jt4N6f4m2G8XG83W60clDWMp42UfZ4cHR8xJ5mnfPgsTvhP8oLkM/8Ats3+scutfIL30Zqg5/8AxWH/AFClDHv/ANk/Qw//ADHqU/rQf+Rec3kn6LLD2WptRxu7iWwOHw5AtL4664qOHmgpdTU9LFVOjqoYDHICRh5IzsR4LEtO+VgyeujjvFjhjgccOfGHsLR7SXD4p2Lkr/EHyXNS2iilrtKXaLUEcYLjSPh7CpIH0Nyx59WQT3Ln2aKSCZ8M0b45Y3Fr2PaQ5rgcEEHcEHuX07sdzo71Z6S60Ena0tXEJY3eLSuQvLd0nTWfXFs1NRRNhbe4HiqDRs6oiIy/2uY5ufEhFDs5/Ws8H+BOq+INLHdXujstjefMralhc6cZ37KMYLx+cSG+spt5NPDyHiFxBbDcoy+y2yMVVeOglGcRw5/Od1/Na5d6N+T0tMBiKCnhjwAAGMjY0erYNAHsACVBZhtl8lvh3RwgXGsv10lA857qpsDSfU1jdviV73HyYuGNTC5tKL7QvPR8dw58e57SCqtxK8qSit91mt+kqGOsihcWGrlaXdoR3tGQAPbk+xR2iPKkqam5xU99t9IYZHBpIjMLhnwcCW59qNy+wclX4p+TVqXTNFNddMVZ1HQRAvkgEXJVxtHU8gyJAPzd/UsIdhfTyz3Kku1sp7lQSdpTzsD2Oxgj1HwIK5E8szh5Taev1LrO0U7YKG7yuirYmNw2OqA5ucDuEgBJ/OaT3pNAmc/Bq2/hF5Ot/wBY0EF7v9YdP2mcB8AMPPVVDD0c1hwGNPcXbnqBjdVzyaNIUus+LNtoLjGJbfSNdW1UZG0jY8FrD6nOLQfVld7VssdNTTVMzgyKGN0rzjZrWjJPuA6ISCzFqDyYeGEFOGVH4erJO+R9fyH4MaAofUPkpaPqYnOseoLxbJsea2o5KmPPr2a761S7z5WN2fdZfwPZKWC3hx7LtozJI5udi7zgAT4BW3QflOWm61DafUFHFS56ywEt5R3ksd1HsKTcRo574saJ1Fwv1DDZrrX0NWKiEzwPgf2jJI+Yty5jxlm4Ox9xKqUNwgbIJDTSUso/paKQxn9k7fAhT/GzWf8ALvibd9QxOeaOSQQ0TX7FtPGOVm3dnd3tcVUGkFQ4pjTotNFqKvaQGV9LXj6FWzspf2hjPxKmqbVMEWBXUtXQOPRxHaR+5w3+orPC1pXrBUVNPtBPIwd4zsfd0WcsSZalRsFo1I5zg+grmS43+akyR7uv1K76f4n322yNxWOeG9z9z/Fc3Ctjcc1FHG53dJCezePht9Sk6K/1cOGw3IyNH9HWsz/e/wAQuLNoMWTuJayNHZumuPUgDGV8fN4k7j+K0zT3FLTd1a0OnbG8+Dgfq6r5/wBLqhzADV0UsY/rYHdoz/f3qftOpYZXA0tdG930ebld8DuvOy+LlH+NlqafZ9A5odN6hjHbQ0NbkbF7Rzj2HqFXr/wytNwhLIJnMb3RVTBURfB3nD3Fcp2LiDd7c5oZVSNDfyXHIWn6W461kHLHWjnaMd+fqK8/Jp8uP3Q/tFfpjvVXAmN3M+G2Oaf6y3Tcw98Um/wKyy/8JbpSzGOjnhqHj+hmaaeb9l+x9xK6Z05xd09cw1s8giefE4+o/wAVb212nr7T9lI6lqo3D0Jmg/ani1eXH7Z/0xOP3R8/b/pu6WeXsrhb6imd3dowjPsPQqBkYWkrubifoSiisFRX2phEMI5qiikPPC+P8otDs8rh1222XJfFWxQ2PV1RR0w5YHRRTxjwa9gdj3ZI9y93Q62WduMlyjKUUlaKrY5fk92gl7skfUu2LPK2ptNHODkSU8b8+1oK4hhPJWQnweF2PwyqhW8PrBUg556GMH2gcv3L2MbMZIsWEYCASu9aEACUAiSgEAKwggOqCdgV2e+R19a14eHD2qR5w6LmBCyair5KeUOBOArbbL+x8QBcM94K82GS+zulCujddJn/ACfF+iFOKu6LmZLbYnNIOWgqwkrtj0cgajr2/lbTt8Zs/Brj9yfKK1A/D4PAMld8G4+9MCmzOJe4+JyqXq+QyaotdOD6NNUSY9Z5WD7VcHnuVNrWCp4kwQ9eSjib+3OPuC83ysq07NcPuNf1Afk+npmt83lYGDHuCy+41MNLFJUVEjI42NLpHvOA0AZJJWlazfyWKQfSeB96wjjTVfJ9AXZwOC6MR/Ej+C87x2OEpyk10kVJ8JFd1Lxp0vbnvioRUXSYbfNjkZ+0fuCzXUvGTVNfzNoGUtrhd0cBl/xP3BZjUc7BE2I8rnjJPed0ptvc/wA6V5cV6ycpCaSFXi911znMtxudXWyH6TyR9aj2vlcfmYAweOMn61KMooo+jBlLMbQNgtVAncRHySWU5leT7TlerKONoyW5PiU/LQElwVqJO6xu2IDoAEA0eC9CkO3VKIhOMIDqjJRAqkhG1+RvaY6/itNcpW834Lt0k0e3SSRzYwfbhzl1vqa5C06buV12zSUskzc+IacfXhcw+Q+5v8sNTMPpm2QkD1Cbf7Quh+LETpeGepWRglwtsxGPUM/cqJPnXri6TXzUtXWTyul+dc1hceu+59pOSVGxQeaMrzZ507jnq4n60+iGyziijwFO09QEqKANJK9yPEJUY3wroLNu8jfSpvPE199mj5qaw05mBI27eTLIx7QOd3uC6e4y6ibpbhperuX9m9lM6KI/nvHKPqJPuVV8kzTA0/whpa6WPlq73Ka+Qkb9n6MQ9nKOb9dQ3lf2vWOo9LW7T2lNOXO6xySmaqfSxhwaBs0Hfwz8U30SZ75Buq3/AId1HpWpkP8APo23OBrj/SMPLIB+q5p/VWp+V/pL+UvB6sroYuesscrbhFgZPZjzZR+wc/qrAeCGgeKejeKNgv8ANoS/x00FWGVZ7AY7CQFkmd+5rifcu3K2lp6ulnoqtjZqaeN0MzDuHscC1w94JQugs+XMJ6Bat5LH/wB/OmP9JP8A+HkVB13p6o0fri76Yqcl9uq3wtcfy4+rHe9hafer75KxB476Y/0k/wD4eRMG+Ds3i/GZuFWqomuLXGzVXK4dQRE4g+4gFHwp1I3V3DXT+pGuD3V1DG+ceErRyyD9trl78TGh/DjUzT32irH/AHL1h/kH6mFZoW8aTlkBltdU2qp2k79jOMOx6hIw/toEjnDjRpU6M4ragsLWctPFWOlpdtjDJ84z4B2PctQ8ijTJu3Eup1FNHmCx0hcwkbdvNljPeG9ofgpzy79NmO66e1fBFtPG63VTgPymZfET7i8e4LS/I603+A+DlPcpY+WovlQ+tccb9kPm4vqa536yBj/ykdQNt1s0rYGSYmvmpKCAtzuYY52Pf7shg961t2TU798v+0uP+PupPw55VekbHFJzU9luFDDyg7dq+Zj3+/cD3LsAj+cj/SfegGfLa/f84bn/ANdn/wBY5da+QX/zL1T/APFYf9QuSr//AM4Ln/12f/WOXWfkGHOi9U//ABWH/UJJDLT5aODwKqgf/wBTo/33LhaOMvlZGxpc95DWsaMlxPcANyfUvqDf7LZ7/bjbr7bKO5UZe15gqohIwub0ODtkJlYtGaQsdQKmyaWslvqB6MtNQxsePY4DIRQJkFwBsl009wc01aLzG+G4QUeZon+lGXvc8MPrDXAEdxGFinl9V9P2OkLaHg1AfVVBb3hmI2A+8g/BdEa41bYNGWiW5aguMVHExpLWFwMsh8Gs6k/V4lfPjjTryq4i6+q9QzNdFTcogo4Cc9lC3OB7SSSfWUWKjqLyGrTFS8Lrld+Qdrcbq9nNjcshY1oH7Tn/ABVj8rnUVRp3glc/kcphqLlLFb2vadw2Qkvx+q1w96beRk9juA9va3HM24VnN7TJn7MKI8ueB8nCChmB82K9Ql/vjlA+tAfJxLG3fv39fRerWDPiktGMr3YBkKWijtbyMdRTXjhvVW6plMk1sqhFknctc3LT8MD3K0+U/Zo7zwK1K1zA6SjgbXRHvDonh37vMPesz8g2Nwternn0O1pQPbyv+4BbLxymjg4M6ykk9EWaoHvLCB9ZCr4JOSPJI1LR6d4rxvrZBHDV0j6cuPd5zXfYCfcu55hHLG9jgyWORpa4HdrmkY94IK+WtHVT0tTHU08roponBzHtOC0jvXTXBbyiRRU8Fn1TgxsAayRzsAD81x6fou9xSuh0R3FjyXL3QVVRcuH8zbpQucXttszwyohHXlY4+bIB3ZId7Vz7d7TX2mvlt12oamhq4TiSCoiMb2n1tO6+lmm9UWDUUDZLTcoaglvMYycSAfo9/tGQmHETQumNe2h1v1HbIqoBpENS0Bs9OfGOTqPZuD3gpUn0Kz5ruZug0YVw4vaFuHDzW9Vp2tk+URtaJqSpDeUVEDvRfjuOxBHcQfUqgk1RQeUCUSCQCu5EQChlF3pUAcbpInc0L3MPi04XsKovP84hil9eOV3xC8cohlKrGmTFBd54MNp6+aEf1c/ns+P+CnaPUkzQDU0nO3+tpn5H7J/wVLAS2AtPM1xafEHBWUsaZSZqNq1HBOQ2lrCX/wBW8crvh3+5aXwy1HXi8UrRVy9m6Roc3n2IyO5YNpphkY6vldzyUVTA4Ejq0uOc+8D4rY7HGyg1vWQRjkZFXSBg8BznH1YXma/SweJyo1xz5o7VkZ8s0lLC7zu1pHsP7JC4y8oCI/h61VI/prRDn2tLm/cu0NOOE+n6cHcOZhcgeUJByx2GbGCIKiAn9Cbb7Vw+LdZF+hzXZi0jsStd4OB+tdZ8A5u34WWpucmF88P7Mrv4hck1XQ+pdSeTTP2vD2oiznsblMPc4Md95X1GPs5pdGnBKARYSgtkQDdK7kkkNGTsou63aGnYfPAwhgP6mrjgYeZwCCzDUmqHyPdFTuyeme5BQ8iLUGVvnRiZzN2kg+1eFVI1kpGQvMSA968nk9A2XhfryCNkVvr39lKNmuJ2ctmoK+GqjDmuBz03XG7JeV2QVd9F8Qa6zSshq3vnpc4z1c3/AAXVizfEjnni+UdOetQWp34eBn0aaQ/FzQmeltV0N3pWywTskaR3Hol6mlbJJK5pyBSj63/4LrTvo52qKtIfWqpZfn+LUg6hho4/33/crRI7qq3oMdvxWr39eWsY39inJ+9eV5h1gr8m2Hs0rXz8WhjfGT7lzt5Qs5i0DVDP4yZrftXQXEN2KKnaT1cT9i5o8pWYt0dBH/WVPT3f4rn8auJscu0c8ykG4Qt+jG37M/en7fRwo1xzdiPotx9QUiw4bletiXBE3yB2AvF57t0t5Xi49VvRFiXJBKNx2SD0TEJd1SCjLj4JJKBWEUbeqHciyU6Gax5K2o4dPcX6FlVII6a6wvtz3E7B78GMn9drR+su1a+nirKOekqG80M8bopG+LXAgj4FfNNkj45GyRvcx7HBzXNOC0g5BB8QV2vwB4w27XdpgtN2qIqXU8DA2aJ5wKzG3ax+JPVzeoPTITJZxhxP0Zc9B69uGnrjDI0RyukpZcebUQE5Y9p79tj4EEKJhadtu5fSTV2lNN6soRQalslFdIGEljamPJjPi13pNPsIVLg4C8JoZhINJRvxvyyVk72/AvSSHZwtDDLOXiGKSUsYXvDGF3K0dXHHQDxOyk9F2Co1Pqy1adpGntbjVx0+R+S1x853uaHH3LufWthsGmeE2p6exWa32unNrma9tLA2PmBbjziBk9e8lc9eQ3p/8K6xumrJ4x2Fpp/k8BP9fNkZ9ojDv2k/kDryhpoKKjgoqSIR08EbYoWAeixoDWj4AKCn15oaOV8MurLKySNxY9jqpuWuBwQfelcRr9FpjQt4vsjg35JSPez1vIw36yF8zp62pq62aqfNIXzSF5PMe85ScqFR9Kxr/QucDV1jz/1tqnbXcKC6ULK221lPWUsmQyaB4ex2Dg4I8F8ugZz/AEsmf0yuufIT1IZ9O33SNTKXSUVQ2vpw45+blw14Hse1p/XRbYUVLy6tKGh1dZ9Y08XzNyg+R1LgP6aLdufbGcfqKk+Sgc8d9M/6Sf8A8PIusvKP0n/LDhBerfDF2lbSxivowOvaw5dgfpN52+9cjeSdIP8Ah40vg7GScg//AMeRMDt/iUQOHGpMf/pFV/qXLiDyRdSnT3GizMll5KW7Rm2z5O3zgBjPukaz4rt7iQAeHWpBn/8ACar/AFLl8zrTV1FDUU1XSvLKiBzJYnDqHtILT8QEMD6J8e9Ey6+4YXLT9IGfLy6Kejc845ZWPHf3eaXj3q0Btt0lpANYBHbrNQcrQdh2cMeB8Q360NG32DU2krTqGAjs7lRx1IA7i5oLh7nZHuWV+WVqk6e4N1NDBJy1N6nbRswd+z9J/wBQA96AOS9HXaov/Hyy32pcXS12pKed5P507Tj7F9IAc1A/0g+1fNDhER/wo6TJPS9Uf+uYvpcf84G/9J96AZ8t9QH/AIxXMf8Av0/+scus/IK/5l6p/wDisP8AqFyVfjnUNy/67P8A6xy628gv/mVqj/4pD/qEhl78qnUd50pwkmvNhrpqKtZX00bZYnlp5XFwIyO44XIVTxx4m1EZjk1NX8pG/wDOX/cQup/LWI/4Cqnf/wDE6T95y4TYEMEP73erve5jNda+eqeepe8nPx6pixuThegaPBKb1SGdfeQrf4ZdI3nTMkg7ekq/lcbT3skADvrC1vjhpB+u+F9503T8vyyaIS0ZccDt4zzMBPdkgt/WXCfCzWlw0HrGlv8AQEkM8yeLukjPUEd6744e64sGuLNFcLLVxve5gdJT8wL4z37d49fxwUxUfNyopKqirZ6Ktppaapp5DHNDIwtfG4HBa4HoQlsb39y+i+tuGWgtaVPyzUemqOsq8Y+VNLopiB0Bewgn35THSvB7hppmtjr7VpSjFXEeaOepe+ofGR0Le0JAPrAygLIHyUdHVukOFzH3SnfT3C8VHy2WJ4w+OPlDYmuHceUcxHdzYTDyzNSw2Tg3UWlsoFXfKiOkjZnfs2kSSn2Ya0frBanrDU9j0lZJrzqG4w0NHEC4vkPnPPgxvVzj4BfP/jpxKreJut5Ls+N9NbaZpgt1MTkxxZzzO/Pcdz7h3IYUVnTOmtQalnqYbBZ6y6SU0BqJo6WPncyMEAuwNzueg3TKSOSOV8MkbmSsPK9j24c094IO4966I8g7kbra/FzmtLrexjcnGTzk4Hidl09rDQOi9WknUmmbbcZcY7aWHlmH/wAxuHfWkuQPnrpHVN701XxVNtq5WtieHdjzkNPs+ifWPrX0R4fXSW+aJs94mJL62kZNlwwXBwyCfXhUek8nnhJT1bakaZkl5XZEU1fM+I+1pduPUVpVVUW+z2p89RLTUFvo4vOe8iOKGNo+AAA6J1QPk5c8vyOnbW6OnAHyl8NWwkdTGHRkfWXfErlwElaP5SPEaPiNxEfX0Bf+CKGP5Jb+YYL2AkukI7i9xzjwDVmzCkM9EESCVABGiQQwDBRhJRjwUgKHVLYTlefelsO6Q0WfS2TbbyzO/wAlZIP1ZW/xWuySAa0qJQfxpim/biY771kWjcvdcYvp2+X6i0/ctT5j+GbfP/XW2jfn/wCS0f7K5NZG8LNMXuO2dATdvpekf+YPsC5h8pCnDLbRnvhudbD7iWuXR/CWbtdFUbv7Nv2BYJ5TUAFtrdvxV9ef24s/cvnvGussf7NZ/JzVVdSukPJUn59L3qH6FbE/9qFv/lXN9V6R9q3/AMkqYGDUEBP5FJJ9UjfuX1mPs5pG6pE0zImkuI2Tavr46ZhJKo2pdUhuY4XZd6ltKSRCVk3qHUUdOxwDx8Vnd2vVTXSO84hnt6plV1M1VIXzPJyeiblYSm2axjQO/fKCLqgoKsVrG3Vloub6ecZxkhw7woenrDnBJWz8YLOya6sLWjPKVlFysj4ZC5rSuaeJp8G8Mia5Cie6QZAyvQPIOCpKyW9z4gSx2MdcL1udqy0lgOUKDDejwst+r7PViooah0bgdxnZ3tC3DROoZdSaYqrhOzkexzICO7IJOfrXPE0E0LyHg4ytq4Njl4d1L/pVn8V0YG7oxypdlklI5SoLhSBJxBuMmOtfU7/oxMb96mJXZ2UXwXbz6rrpcbmprXf32N+5cHmX9EV+RYX2XPiS/ljpm+0/YuX/ACmpj+BLbED6VQ4/urpnia7D6dv5p+9cseUtL5lli+lI4/WFn41f4pP8jn2jE2HN1mPgSFIN9FRlMeavqHeLnfaVJNOy9fF7TOXYT15POV6PI3Xi7ZakiCclJcg5EeiYrElJd0S0l3RAISTthJJRPKSmMUd+9Bj5IntlikfHIwhzXtcQWkd4I6JIKJx2QJmjWHj7xPsNO2nbezcYGDDRWMbI4D9IjJUjVeVFxIdGWsjt8TvpNpmZ+sFZFIM5Xi6IHuwpYItWr+L3EHVEElPcr3O6F/WMPPL+yMN+pePDvijrbQllmtOm7maSlmnNQ9rY25c8gNySWknYD2KsGJvcAgI8dyKGXPWXGXiFqvT1RYr1d3VFFUY52crRnByOjQs9gZ5w26J86ME9EQYPBJIAmexWHQ+r7/oq8uvGnK11JWOhdA5wAIcx2CQQQR1APuUCBhAqgNMm8o3iufNN7yOhHZs3/urOtJ6ku+mtSwais0/yW4U8j3wvaAQ3mBBGCMYw4jomj2AjoCvMMGeiVAaRcuPvFCuoKigqr658FRE+GRvIzzmuBBHo+BKy6naW4HgMJ0WBJ5cHZAGhaU418Q9KaepbBZruY6ClDhDG5rTyBzi4jJBOMkqC4k8SNW8QPkTdT1vyltFz9gAAAObGTsB4KuHC83AE9E6A9bJXVNqutHdaJ/JU0c7KiF3g9jg5p+IWoN8pDisHEm+HOc+gz/yrKcepEWgpAImlkqKmSolPNJLI6R58S45P1lXTh9xQ1joCiq6PTNf8mhq5WzTN5WnLmt5R1B7lTg0DuR7d6dAXrXvGTXOt9POsN/uPyiidKyZ0fI0Zcw5b0aPFZ43qvcsz0CLlHgkAQSgUWMBBACgVJWC/3nT9WKuz3CaklacgseRv47d/rCjERSaA2S0eUvxIt8LYp6mGt5duaaNrz8SM/Wl3LynuI1VEY6eSkpCfyo4WAj6lixCLlHgigJbWGrdR6srvlmobtVV8mdhLIS1vsHcoRo8F6hm6GMJpAP7Jd7lZ6j5RbaySmkyCeU7HHTIWnWHyiuI1piZE6v8AlcbR0mIf++CfrWR4RJNWFm7VPlT69fCWQ01vjfjZ/YM/gsw17xK1rrh3LqG+1NTTg5bTNdyxD9UbfUquWZ7kXIO/qhRoDyaF6BuErlwi9oTAAQRlEgAIII8IAJGEOiJQAoJTepKSjaSgaLRoM5uszP6yiqG/92T9y05r8s05L9O0QD9l8jfuWYaABOo6do/Ljlb8YnrSac5tGlZPG3uZ+zUS/wAVz6nnGyoe47H4HSmbRNMO8MA+0LJvKfhxbr3t6NzppP2oXBaZ5PkvPo5g8B/tFUPyn4c26/n86ik+st+9fMaHjLH9s6J9s5HrfTK1vya7q231V453ACShi/uyv/isjuH4wq58JZC2qlaDjmpXA+vEv+K+si6SZzpW6Nkv2oZqp7o4XHl8VXXFxcXOOSe9G442CSUm7NEq6CKI9coyiKQmJ70EEEBRuvESMPure/zVSblb2P8AyeqvWtjm8YPgoCriBHRU0ZrouukNJ0YtcfzTTzNBJwo/VXD5r+aaixG7qRjYq+6Ob/kuD9AKckiY8YcAVtSaIVo5Zv8AYZ6Rzo6qAtPccbFXXhrD8m0HJENh8sP3rUNRadpbhC9r4muBHeFTqe2Ns9qrKBvosrGke9mfvURgk7HKTaobPOCEy4E+fd6x/rq3fGoA+5OJHbj2pt5PwBqql+c5ZOfjUH+C8jzLpQX5NcPTLHxRdiqhH9n/ABXKflJPzcbIz1E/3iupuKTv59GP7P8AiuUvKOf/AJdszf7Mn+8UvG/wy/ZU+0Y/bzmomd+cftKlM7dVEW7d8h/O+9SWThevj6MX2KecLxcfWlSOXm52y0EJchlEXBEHKhJG0cA+DEevLdPqG+3GegssUphjbAG9rUPaMv8AOdsxgyN8Ek+GMq6ycGeCt8fJQ6e1zIyuYDns7rDUEY6kxkDOPUUfkra2sFboqo4dXapjpqsyT9gySTsxVRTDzmsd9MEu264IIzus/wCLHk0X/S8U990pVPvdvgzK+Es5a2Bo3zgbSY7y3B/NQBkVzihp7pVUcFSKlkEzo2yhvLzgHY47sjuTYEbnI5R352WueSVw8tmttX19wv0QrLbaY2SvgefNqJpHHkD/ABaA1ziO/AHQlbXd+KooOIB0bBwkuM+m4qoUU1cy2uEfXlL2RiPkMYJ8dwMpILOOHnBwvMvBJbzDI6jwW+8eOFNmtHGvStqtAbQWnVNUyJ0MZw2neJA2Ts89GkOBA7jnuwr5xy4hW3gUywWLSui7TLBWRSTPEjORojYQ3HMN3PPUudlMRyGXR/1jD+sETi0HBcAfDK7W8onU9Pp7gvHfrfpm0TG8sipntqKdrXwMqIS7maWt3c3p9ar2kaSiqPIkmqJKGlM34DrHCQwtLwRNJg82M528UrBHI7ixoy5wHtOEQc0jmBBb452WzeRUyGt4s1sVVTwzsFmndyyxteAe0i3w4EZ3UlqWGlj8uaioW0tO2lddqPMIibyHMIz5uMfUgdmDgtO4Ix0zlE4AdcfFdx8Trrwt4W6gbra/WmOW93KBlNSxU1Kxzw2IHmexpw1hPMA5/U4aAubaziTpK6eUK/XNfpv5fp6Z7GuoKimY57cRBgcGZ5XPDgCO4oAylz2YyHtx452RhdmaD4t/yr1fRaZfweulvsle/sWVk9FmJmxwXs7IMDTjB32z3rDvKx0bZ9FcTKdlip2UlDdaMVYpWbMhkDy14aO5pwCB3ZIGyYWZGCwgkPaQOpDghsemD3rvPjLJw/0Tp63a91DpajuNTaw2mt0EcLGh0soafRxykjkJ5iDy743KY6Rumi/KB4ZXET6cio3RSOpXMexhkpZuTmZJHI0A94Pd0IISA4YPqSctIzkYHflbL5LHDe3641tcZb/EKm12RjTNT7htRM5xaxjvzPNc4jvwB0JWras8obQWjdW1mjqfRTqqgt0ppp56aOCOMPbs4MjLfOAO25GcFMDkPrjG6SXM5c8zceOdlejq/S0nHB+rp9M0lRpp10M34K7BrWGA+aPmweXm/Lx0LvUV0hpfjNHetT2+yUHBm8U+n6udtOKx1AA2NrjgPdGI+QNHf52wykM4127sIwBkD1rdfLL0PY9I6ttN1sVHDQQ3iGXt6aFobGJY3NBe0DZvMHDIG2RnvWEsOSD60COo+H3ADh3d+Fdk1fqC9XigdV0DKqrlNZFFBGXEjq5mw6dT3qL4gcJOC9n0Pe7rZNdyVlzo6KSalpzdqeTtJAPNbytbk58Atd0lpf8Alt5KVj0qK0UJuVhhi+UGPtBGQ/mzy5GfR8e9YVxN8mT+RGgbvqo6xirjbYRL8n/B3Z9pl7W45u0OPSz07kwLJ5JHD7ReruGl3uWpNNUF1rIro+KOacOLmsELHBowRtkk+9cvF3zj2jYBxA+K7H8huTl4RX0DG14k/wDDxrJPJH4a2rX2sLjdb/Ttq7TZ+Umlf6FRPI53I1/iwBpcR37A7ZSYIxXLeXm5m48c7IwBnfYDr6l2qeK9MOIzdDjhLW/yZNX+D/l5tpEeebk5+y7Lk7LPrzjf1LLuNNg0fwf45Wu+SaUgu2n7jSyVEVpc/lihqAeQ4yCOQO5Xhp23x0CQGea54UXfSPDOxa5ulyo+xvDohHRNjeJYRIxz2lxPm+i3oPFZ1zsxnnbjxyvoLx44g2/h7o233q4adjvUNVVspm07ixojJjc4O85pGwbjp3+5YT5N93tutvKb1BqEWSmpKWut080VFJGyRsP4puw5eXuO4A6oGc4EjrzDfpurrwesWlL1qpr9a6jo7LYaMCapMshbJVAHaKPAJye93cOm5C6k1VrbhDwZ1hcKaaySVd9uk5uFb8lo45HRtkdzNj5nYDG46Mb45PVUjyV+G2nNQ0954m6ot9PV05r5/wAH01SwGGJrSXvlezo4jOADsOVxwdsAHlWay8njXBvujm2O16QhMYba7+KJsfO9v5fmjmZhwGzvSbnODsuartSsoLlVUXyulqxBK6MVFNJzwygHHMx3e09QuxNC8Z+HfEzWB0LLoqCOjqg9lE+qpoXx1AaCcFgaDGSASME+5ZFrXh7b9C+U7pyzUcPa2W419LV0kM3nhrHScrojn0g1zTjPcRlAGHgtLchzSPHOyAx3EFd3ccLxw84a1VDrW7aUpbjepwaCgiihjbhrSXvdgjlbjmALsF24ATDXFBpTjF5P1Xqmls8FJUx0M9XRS9k0TU80PMXM5mgczTykEdCDnqEWBhHk4x8GRRXefifJRGs52tpI610nZiLl84tDOryfgAMLI76ba6/XD8Cdr+C/lUnyLtfT7HnPZ59fLhdP+Qhb7dXWPU09Xb6Oof8ALadrXTwMkIbyE484HHVUPhBw6oNecetSw3SEGyWqvqqipgZ5gk/nD2xxbdGk5zjGzSNsoAxDY5wQcdd+iAwQMb58N12Vr/jloXhnq6XRNFoxlRFQhsdW6kihhjicWg8jW8vnkAjOcb7brnzUOsNG3zjz/KmXTlMNKvrIy+gMQgEkTWAFzwzbmJy442PRKwM1L2YPnDbrujAyMg5HqXYtn402qpvVJadM8HbpJYJZmQ/LIre1jQ1xA5wxsZbgZzu5U3y2NB2DT0ln1PY6Cnt76+okpayKnYGRyOa0ObIGjYOxkHHXA70wObcBEizlBABokEFABhLb0SAltSGWTQJxqq3+uQt+LSFpNLvpjS7/AAhqWfCfP+0sz0Icartf/WWBaVTbaU06PoyVjf8AvGH71lmV42OPuOtfJycDpQb/AEv3v8VV/KaZm137wNHSv+EoCsPk1v5tLEeDnfaFC+Uy3/Jd99dshPwnC+W0r/yr9nVLtnGdx9M+1W3hQ/FxAz1p5fqe3+KqVx/GH2q08K8i6R+uGcf3mL6pe0512aYeqI9EkuKLmKk0oUM9coE7dUUbXySNjjGXOOAFoVh4Yz19I2eouIiLhnlZHnCYGeEoK56t0HNZoDNDW9uG9Q5mEEAaHrdwF6HsURIcgZUlrp2L0APBRLnDAz4havswXRsmkf8AkyH9EKdA8QoLSH/JkJ/MCnc7LQQTvBZ/q7Day4gf9Ji/1IWgO6LOdZPxcrkO/wCUQ/6kJoTK7I7zh7Ujyeh50zv7KX/xD0lzvOHtSvJ5O8o/sZf/ABD14Xmv/T9m+H2smOKh/wAoRj+zXKHlGHGorP8A6L/aK6t4q/8AKUf+jXJ/lGH/AIwWc/2Z/eKfjP4H+xz9yMithGZP0lJ52UVbP6T9JSOfNXsQ6MX2G87rzc71I3FeTirJYZKST6kRKQXKhI0vT3BjWWptCUOq9Oso7jDVOkHyVs4jnjLHluRz4a7cZGDn1Lo7yZ7XxPs1jr6LXpnZSxujFsjqqhstRHjPOOYE4Z6OATnrjAXLOieLGv8ARdA23WC+clAxznMpKiBk0TSTk4DhkZO+xTrV3Hzilf7XLbKm601LTTNLJRR07Yi9p6gkb49STYzaPJmv+n6TjbxG03QTQxw3GrFXbmNIAkEb5OdjPY14cAO4HwT3iJrDymLNrKutmntNUl2s5nd8gqoKDtA+InLQ4h4w4DYggbhcc0M1dSV8VdS1U9PVxSCWOeOQtkY8HIcHDcH1havb/KI4tUFK2nN7o63lbgS1VBG6X3uAGfeErCj3493vivWan0rScQIrXaLrBy1VvfR8rXQc8gAc8tcQC1zAe/GF1DxNgurILFBW8L4OJc9PF2kta11PC2KoGAXNjkzgPxzbEjbHs5c4WXWfixx4sP8AwnXBtygcJGRwygMike1pdHDgYAa53d39O9blxnrvKHt2s3UvDuzQSacbDE2kNPTQSEEMAcH85BYQcgDAGAMJoDH/ACptUcUL4yih1Voit0vYYZswRu+dY+Qjq6Vvm82Og29Q6rZeCNE7VXkgx2G2yRPq57dXUIDnYDZu1kIa493pN9xyvbiLcb3R+S7eGcWTbW36uo5YhDThoBkLgYQANi9uOYluwwuT+F/E3WWge2/k1dfk8VTh09NLE2WGRwGA4td0d3ZGCgDoXyQ+FOsdJaoumo9U2iS0x/InUUEMzmmSVzntc5wDScNAZ17ydlU9Wj/+/W346C70I/7kKh3XjzxTrr/Q3mTUDYZKAuNPBBTtZAC5pa7mj6OyCRvlVe4681TX8Qm6+qKuIX9k0c7KhkDWtD2NDWnk6dBjCVhRtPl+OxqXSDe75BUH/vGr38gyzWSuveorzWU8M9zt0dOykMjQ4wNkL+eRgPRx5Wtz3b4xlYVxG17qziBWUVTqmshqpaGN0cDo4Gx4a4gkHl67hNtDar1Hou9NvOmblLb60MMbnNAc2Rh6se05Dm7DY+CAOy9PXvj3d+ObqK5Ws2vRFJWSdq807Ozmpmh3JyynLnud5p83GMnOMLKPL2YRxA0we82p+f8Atys81Zx34o6joG0FbfIqamEjXuZRUzYOctcHN5iNyMgHHTboq1xH1/qviDc6W46prY6uppIjFE+OBsWGl3Mcho333TsKZ1J5dMnLwfsbPG7Q/wCoemvkDEHQepz/APu0WP8AsAucuIXFXXevrLT2jU1xp6qjp52zxsZSsjIeGloOWjPQlI4c8UNc8P7dV0GlblBSU9XMJpmyUzJMvDeUEFwyNkBRtvkNXylp9Y6ysEsrWVVW5tZTtPV4ikka8DxwHg+zKqHFXgLxGquKF8qLJp6a5224V0tVTVccsbY+WRxdh5c4cpBJBz4bZWMWq43O3XmO8UFZPR3CKUzR1EDyx8byScgjp1P2LuzSt413fOCdZNUPuumdVW2jLpa68W+LlqntjMjntb07MjzebAIOOu6AMc8k3QVHaeN2p7VqaCiqrvpylHYM2kjZKXtDpG5G5aCADjbmyO5ahctScfK/juyx0FqNv0ZT17A+rdTNdFLRjBc8zOzlzgD5rcEE47srju1a61dbtaP1tRXyqjv0z3Sy1ZwXSl484OGMOaRtgjGwVq1fx54o6mtElorLzDSUszeWb5DTNgdIPAuG+PUMZQgNb/8A6gQ+d0W4DbFZ/wD6ly9TnICs/ETiPrDX0duZqm4Mrfwe1wpy2nZGRzBocTygZJ5R1VViyAEBR3PbbNdtR+RxbbJYYjLc6vT0MdMwSiMucJAfSJAGwPUrmfUnBTi/aLHX3S7WidtvpIXT1LjdY5AI2jLjyh5z7MLzsPHfidp6wUFitF5poaCghbBTsdRRuLWDoCSMnr1Sb9x94pXyyVtmuV5pJKOugfT1DG0MTS5jhgjIGRshgb95C7M8IL8dt7xL/wCHjVV8gy/UVNddT6YqJGsq6wxVlOwkZlbHzNkaPEgOB9mT3LFuHvFnXGg7HUWXTVygpqOomM8jH0rJCXloaTlw22AVPtVwuFruMFyttZPR11PJ2kM8Lyx7HeII6IsKOwtfay8pyy6qrbbZtL0d3tfbu+Q1dLbjKySEnzOYh/muAwCCBuFgvlIXziNctRWWi4l0VtoblS0XbwQ0bWjkjlfnzy1zhzZZ0zsn9L5SvFqnpBTuuVsqHAY7aa3sMh9ZIwCfcs31pqvUOtL86+amr3V1cY2xB5Y1oYxucNa1oAAGTt60hnZ3lV6T1DrrhHZ6fSlufdKiGtp6sxQuHM6IwOHM3JGfSCyLyQLDd9M+UDdLDf6J1DcqWyzdtA5zXFhcYnAEtJHQjvVK0jx+4m6Z09BY6C60lRR0zBHT/K6Vsz4mDo0OO+B3A9FA2rirri28QLhrunuUJv1fCYaid9MwtLCGjAZjA2Y0e5FgWHyt8/8A2hNR79GUv+oYugPJEuNBf+BFXpVs7Y6mndVU84z5zWzB2H48PO+pcf6z1LedX6mqtRX+oZUXCq5BLIyMMB5WhrdhsNgF7aN1XqHR91bddOXKWhqgMEt3Dx4OB2IQBuPk98ENf6c40W666gsxorbZpZJHVfasdHOQ1zWdng5dkkHoMDr4Ka48XmkuXlYaEtdLKySS0T0sNTynPLI+cyFh9Yby59qzi5+UlxWrLc6jjutHQlzeV09LRsZNj1OOcH1hZhZb7c7VqWm1FTzGS401SKpks3zmZQc8zs+kc7nPVK2B0r5fzzyaNA6c9b9kSuPk/wDn+SRUg/8A6fdP3ZFypxL4kau4hvoTqaqgnbQ85gEVO2PBfjmJx19EKS05xg1zp/Q7tHWqrpILS6KaItNK17y2XPP5x33yfYgDe/IBI/k1qQD/AKdS/wCrKY+SpdKSDjRxFtMsjWVFbVzPhBPpclRLkD14OfcsJ4acUdYcO6GrpdL1dNTMq5GySmWnbKSWjDfS6Kt0WoL1SakfqKkrZILo+d1Q6eM8pMjnFzjt4k9EWM3PyiOCuv7txdu1805YZrvbrtM2ojmgezETi0BzH8xHLgg7nYgjdOPJz4ZQ2XjpXWbWVPQ1dxtNsjrIafIliZLIGkE5GHOa0+sZOd8Aqrw+UtxSjoBTmqtTpA3HbvoWuk9vhn3KgwcQ9Yw63k1qL3USX2U/OVLsecAAA0tAxygAADGMItio651/qHjtJxfptO6StbqXSwfB/lD5M18b4yGmVz5HZDSMuAaN9h1yoHy92Z0Fp2RueX8MSAZ/0JwsP1J5Q3FG+WiW1SXSlooZmGOWSjpmxSvaRgjn6jPqwVXdccTtZ61sNuseorjHU0NucH07GwNa4ODOQEuAyfN23QgKbGThei82jdegTAHegggpfYBhLHVICWEhosGhsHVdq/63H+8tKpRnSVkHhVVg+uJZroUf8bLV/wBbj/eWk0uRpGy+usrftiWeX2McfcjqnyZXZ03IPBzv9lMPKWwbXfP/AIQw/wDfhPfJiGNOSZ+k7/ZTDylnYtt9H/7PH9c7V8npv5l+zql2cYXH8a72q18L2/5Qjd/Zz/axVS4fjT7VeuDFNHU3injm9BzZs/3V9Uvac67LsXAdThAEHotps2mLA6gBNvp3Et6uGSs/4iWuitswfSxsjBOMN2SNCtUk5pqlk4GeR2cLW9O8RrLS0TG1RmY8DdojysX7UZ6ojKM9UAaZrnX1DdKZ0FBFIeb8p4wAgsxfKPFBKwN5168fhxvsUQ523wXvq+cyXgE9Uyc7AXR8mBt+jT/kyL9AKeJVW0RVxvtkOD+SFZg9pGxCsQpZprZ2LxdR4TU5/wC5WlAjPULL9fP5b5dh66V3xY8fcmhMrvP5437wvfyeyRNM3winHwqXKObJl7fan3k/uxcaln/W2/Coz968PzP/AKP8m2HhMm+LO1fCfGNcneUX/wAt2Z3iwj6yus+L4xUU7vzP4rk3yix/PrJJ3ZcPrR43+F/sqfaMftxw6QfnqQBUZQnE0w/PP2p/zL2IdGL7DeSvNxRuOei8ycq0QwEpOdkCUklUIBK83jKMlFnKQ7PMtCBA8EpxRFFFCBzNcHMcWuByCDgg+IKudPxg4rUVM2mptd3kwtHK0SyCQgfpOBP1qmlE4BFAeuqdQak1PVCp1Beq65yjo6olL8ezPRR0LC0BOHNGURGEAE7dFgYRoIASWgouXCWiO6KAQRlEWhGeqGE6J3CSAhgpSJBQkNBGMK4al4q8SL9ZTZbpq+4z250YjfBzNYJGgYDXFoBcPUVUD1REZQB4MBB3C9MbYRkIDqkAWAgAUpEmJhEbJJaM9EoI0CTPPA8EAAEZQUlBEZ6ouUJYRO8UwCAAREbo0SQAwgEeEMIAJDAwlIIASAEEpElYCSAUOXwSsdUAgAseKLG6WiKYCCBlFgJRRIAGEO9GQgeiAAUCi2RlSwAClgJDeq9B0UjLBoLfVlq/60z7VpFP/wA0bAO81Fa7+/GPuWc8PhnVtsB7pwfgCVo8A/4r6ZHi2qf8ZgP9lZ5n/jY4+46q8mZuNMvPiXfaFD+Uy/8Aybf/AFWyBvxnCsHk2x8ukubHXm/eVX8px+LdqD/qtGz4y5+5fLaX+Zfs6Z9s48r/AMafWrjw3qTRRMq2u5Xsc8NPtIVQuA+cd7VLWyZ9NYonM2LpXfaf4L6he0wj7jZqbiXeqaEQxyU/KPpR5P2qAvWpaq6zdrW1HOe4AYAWeCunO5OV4y3CYbbrPcjbay8fhFn00PwjHj0lRBX1HiV6Nrag77p2h7WXU3GPPpIKiS184d1KCLDazrLVD83fqm0jvmyc9yVqh3+WOq8ZT80V1SXJyoveiK+aKmY1p2AVxZdZR1CoOjj8wxW0K0iWT1BcjLIAeqonEd+NQXEfSpKST+9I1We2/j/eqjxOcW6imH9ZaInfs1Dh/tJtElWZL5w3UnwIeG6iq4/CprW/32O+9V+OXdS/BJ3JrSsZ/wC/VI/aijd9y8PzC+iL/J04fkuHGJvmUr/Vj7Vyd5Rg/m9ok8JnDPwXW/GNv+Tad/gfv/xXJvlEs5rBQy/QqsfEBT413CS/IT7RiVMcVc4P0z9pTzuTFu1fOPzyfrTwdF7EOjJoMlIPVKKQThaEsBwkEoE7pJKomgHdJJQyiKCkApJRlEUDCJRZQSSkKwykO6oyi2TGEi70ZRJAGSkI8lEmAERQJ7kR6pWKge1AdEW6NMYRRIZ3wi70CYCiCMhAFAqASk7I3IggdgyERO6NJPVAB7IbIiggYeUlxRokrAAQxujQSACPZEEYCTYAIQwlI8eClsKEYQwl8pSg3xS3IdHlyoYXqWbbJPIUWKjzIREJZaQiPToiwEFFjCWRsk9FSYBFDuQKJMAIIIKQQbUsJDe9LHckyiy8Ph/xopHfR53fCNxWjRDFh0sw99FI/wCNRJ/BZ3w+GL6ZP6ukqH/CJ38VpBbim03EerLRCf2pJXfesc7rExw9x1x5PMfLoqI95BP94qg+VDJi33/B/pKGP95y0rgTH2eh6Y9Mxj7Ssi8qGfNFeAT6d1p2D9SBxXzOi5zR/bOiXbOXq3BkUtAz/IdKPF7j9qi6oZkU3EzFrpG47ifqH8V9M39JlBfUN4mHdeMzPO6J9EzrsvKaM8y5zqGrY+nVOI49iEbGdE4ij2QBFVMfnIJ1VR+cUEwOntTyZvGV5yu+aKRqF2bv70mU/NlehI85Mu+jN4GK3YI6qm6Jf8wzfuVuL1quhMe27eX3qocVxi/UZ/rbRUs97JY3ferXbnfOqr8W24uOnpO6RtbT/tQhwH91KQkZ3E/fqpvhA/s+IFU07Zrmn9umI/2VW6d52ypbhtN2PEZ2TgOko3/HtGfevE8wv8N/k6MPZq3FxnNYmO8CfuXJnH9nPo0ux+LqGlde8UIu00y846OP2FcncaYu20PX/mcr/gsPFunNFT6Rz04/5RkPiAfqCdA7Jk8/z5h+lE37E8avaj0YvsPKQ7wSyQkOK1JYkoijJSXFMEEURQRZwUxgSSc7oydkRPggQRKLKBOElAwyd0klBAoAJEUSCAB3IZRZRIJbDJSe9KCPCAsQTkpSAb4I2tJIaASScADfJQIQR35KIdcq26d0HfbuBL8nNNTn8uXZXm18M7PStDqx81ZJ3jPK3+P2IoLMZO+wGUYjkLeYRuIA3OF0DBpa2wPDKW0wNd3ZjyficpF1tPJQ1MBpmNJhe3Zg280ooZz85jw0O5TynocbJOVsunIae8aYaaa1UtLFA6FgjjhxkmBpc45JLiSCc+zoo25aZoZA7tKBgI6lg5T9SqcVF0KLtGWBEeqtly0pG0E0kzmHPoyDI+KrdbR1VE8tqIi3wPUH2FRZY3KCIHKCVgBBGggAIAboYSgkwAAjwjSmNyVDYADDsnEcJPQJVPFzEDC1Hgjw1qeIGqo7Qyf5JTtjdNU1PJz9kweA2ySSAN+/1Llz6mOKNtmkYtmZtpHEdClfI3+C7FHkq2cbfyurP/oWf+ZKHksWcdNW1f8A9Cz/AMy8h+bwfc2WI44NG7w+pJNG/wAF2UfJZtB//NlV/wDQs/8AOknyV7R//ltX/wDQs/8AMp/83g+4ekcZupHAZwV4yU7h1BXaB8lWzkf87qsf/wAFn/mUNqvyZdM2OwV15umuaqmo6KF00zzQMOAB0A59yTgAd5IWuLzeCUlGyXiOQJG8pXmRuntxaxk72szy5PLnrjuz60zIXuxdqzBoQUSUiWi6EEgggobGgwF6NGSvNejO5Ay06DHLPcpc/i7bMfjyt+9aZUM/yrboenY2yjj9/YtJ+tyzXRjcW6+SAb/I2Rj2ulb/AAK1OePm1hUxAbROjhH6kTG/7K5tW6wsrH7jsPhDB2OiKNoH9G393/FYB5Ts+aeUZ/G3yc+5kQb966P4ew9jpakZjHmN+poC5Z8oqpM0VtB6y1lfOf22tH2L53x6vKn+zeXyYdOBzKwMjxRU7e8M+/H3KClbk4x1OFZZWYbG3wYPtK+kftM8fuPCNnVeMzd8J5CzOcLzkhLnbBYHSNWMwnULNjsveno3OxsVK0luJbu1TvSK2srNVGebogp6sth5ieVBLeh7GbRfn/5W3RTOzEV534/5WQmPzLt+5eszykqLxoojsGb9wVvVJ0ST2DFcQ4+K0Ex7QH53qq/xhAFBYKnH4q7xsJ9UkcjP4KboCe1BUHxmyNCSVHfS1lLUZ8OWZoP1EqZAZTGSx5Z3tJCdaYn+T63jl6ZpI3/9nO0/Y5Nawdncqho7pXfakUbizU1A/P4ynqYh7eQOH7q8nysb08jfC/qOjdeR9tpuob4b/aFyhxKg7fSl0iIz8yT8F1rciKzSbpOolp2v+oFcu61p+akuVMR1ZI36ivO8ZL/JJfdIuftOUJHYfSP8Y8fAlPmnZMqlpYyEHrHI9h+KdQnIXvR6MWLJSSUbtkglaoQCT0SUaIqgCOyT3o3FJcUwCJRZQREoABRI0R6IACSShkokABEUaIoAB6osbhGh1QQHjwRgbIAKX0tYbhqO8wWq2x880p3cRlsbe9x9Q+s4CAE6bsNxv9zZb7ZA6WR2C44PKwZxkn7up7lvuiuF1psMTJauIV1eRu54yAfAD7vjlaFwv4dUGmrZFRUUHaVTvxszhlznEYJP+GwGw2669ZtCU0EIqKpodMRkNPcmqQGKyWKURB8jORgGwATIwigj7eqEFNDnzZJzjm/RHV3uBVk4m65s1rfPS2WSnnkgyJq+TBghx1DAdnkfSO3hlc06q4jVNdVyyWzmrJHHDrhWOPJ+qOrvsVuSEk2a5cbvQl5fAZ5XfT5RG37z9iql21FQQtm7eso43uY4APqRnOD61iVyu9XcHk3K7VlZ+Y1/Zxj3BRvaUA9CkiPrOXKCjXuEt/oZdLVMc7qGmmbUwRMjE3ZlzWQEF+CdySdz0z4K2ulDX9sxjJWnueeYH3hc6OmoD6dJCPWAR9ye26ukpHCS2XOronDuZJzM94zhOf1dijwbRqCKmrY2GO3/ACaUnHMw5aVXNQaZraOm7SaDtIHDd4GW+wqJsmu6+mDWX2mbU0x2+VUzdwPFzeh9y1LT+oGy2l7aV1NcLdUsIwfO+B7seB6LmlCUfaaJp9mA3azmIulpeg6xnu9ihw7fC0vUFCPlEro4yzlJy3wCpd5t+XOqIG4eN3ADqqU7CiKHrStl5g569UoKxChuEpqSNkpQ2AYG694mHK82DdPaZmXBZzlRSQ+tdOZJWgDOT4LtzyR9LttGhZ79NFy1F1lxGSNxCzIHxdzH4Lkvh/Yam936htdIwunq52wxjHe44z7uvuX0RsdtprPZ6K00jQ2no4GQxgeDRhfK+Z1NLajpxxHqJAlEvmjag0ZKII1LCglyH5YHE0Xe4HRloqc2+gkzWPY7aecfk+trP3s+C2bykOJLNDaU+R0E4be7ixzKfB3gj6Ol9vc31+xcE3qsfNK57nEknck5XueG0TnP1ZLhdGc5UiKrH5ecJuCfFKlOSSvMr7aHRyMUThJQGEFdkgQQQ70qBBhejeuUgZXq3fCGUXbQUBmtdTEBk1Vwo6cevJcT9y06yD5ZrareBkS3CTHs7QhUfhZCO0sTXbtlvJnd+jExp/itA4QQurdTULnbmScPPvOSuHyEtuBl4vcdn2ICl03EegZG53wz/Bcc8d5jJWWWHO4oHzEeuSZx+4LsG8S/ItE1Up27OheffyH+K4x40Sc+r20+f82t9NFj19mHH95eP46N5P6NWzPIY+apjB+mPtVgmaS4eprf3R/ioilYTVswNwc/UrJJFmVxx+UR8Dj7l7mR1EWJXIb0UJJxj6k9joy5w836k4tsALlMU1LuNj8FxzmdsIjeht42y1T1Fbm8vojovWjpgGjYfBT9vpQWZwsHJm6RVK63N+iB7kFZq+mAPRBK2NI99SgNvOAvKU/NH2JOopRJdycopj82fYvfjzE8EveiA35Mwq4YYqPohz+wZ4K2ue8eKtTRLRI0QaZdio3inAanh5fIWjLvkUjh7WjmH7qd2yQmbB2TrUMIqLPUU7hlssT4z+s0j71TBIwOqmE07agb9tEyTPtaEgvDLrZpj0bXsYT6ngsP2pnbnl9ntxd6TYOyd7WEtRXmXsrYahvWnkjnH6jwfuXFrY7sMl+DSDqSOn9LSfLNCUWdyaMMPtA5fuXPGuIQy7VcRHpPP1rfeGMol0wYgciGplYPYXcw+pyxLilB8n1JOOmT9m33L57xsqyx/KN8i4ZxtqGIwVlZERgxVZ+slFA7IUtxFpvk+pbxFjYuEjfioOkdzRj2L6aJg+hy4pJQKSStUSAoFJyhlUAXREUEkpgAlEjRIAIoiUCUR6JADuRJOUEWApBEOiB6oEwZRhEOu6W3cpkhgf7hdWeT9olmnNONudZEPwnXAPdnrG3uaPZ9pPqWD8HNO/yg1pSskZmnpnCaTPTI6Z+BPuXbGgLSyvrmMc3EEAGR7OgVRQWXTh/booonVNQG9r+Q09wWa+UdxQittNV6fttYKeGFh/CdU13T+yaf3sezxV84p36LSGlpK6lw2vmPYUY8Hkel+qMn24XB3Ee+i53KenLzJRUEnzvMc/KKk74PiG9T68eKlrmxkJqzUc98l7Sr5oaBpzT0X0h3Pk8Se5v+5i7TaLzqe4x0Vso5qqeXZkULOYkeoeHrOAEnT1vl1FqOmoZaunpflM4jM9VJyxx5O5cfAd/idl2noTSFp0ZZmWuzQc8z2j5RVuHzlQfEnub4NGw9fVd+n0sXHfkOXPn2/TE5svPBG+WLSct+uc1GZIS0zUzXl742E4Li70diRkDPtVP/AATTCJ7w9p5OoZG45967mqrDDXUE1PXEOhqI3Rycw83BGCPauZL1ZLdaZqm21FbK6SCR0bwxp6g433aPtXp4tMsqe2JwS1Ti+WZRLSW93mGcRn8+JwH1ZXjUWB3KZoXslYP6WB/MB7cbj3qz3ahomSnsnzEZPUf4nuwoowGB4npZXRSN35mbH3jw2/ivPy6eUHU4ndiy7lcWMrdQ3TsaiSOEzx07OeUM3eGd7uX8oDvI3GQvex3WrslSa+1Hngdg1FJzeZIPpN8D4H/0U1py/vorjHUCGNlXG7mG2GTfm4HTPTbr6immqY7ZFXx3m0SBtDXyuMlNIR2lHMTktI72HuP3rinFLo6YyvsvEb6S/wBuhulA4SNc32E+LHeBH+/VROq9ONp6OO40XnQPAJHgofSFzbY74xjvNtlxcI5QTtDN0a71DOx9Rz3K9XiqdSQupJmc9NK47H8k94+9cuSNKzWLsxC90pp5u1YPMd1HgUyY7IV91FZZXQlzYXthmyYnOGxVBex0Mro3jlLT0KxxZVNUmVKNHs0JbQvJpXtHuFq2TR6xjJ6KUt0fNI1MKZmSFYLFTl87fN2G5XHnybYtmkFZ0h5HmlBU6iqtRzxZitsPJESNu2kGPqbn9pdUH1Ki8C9NfyY4bW2kkj5Kupb8rqRjcPfuB7m8o9yvS+E1uZ5crZ1pUEeqCBQC4ygworVt+t2mdPVt7usvZ0lJGXvx1ce5o9ZOAPapV3TbOfUuO/Ks4nDUF6Om7RUc1qtzyJHtdtPONi71tbuB68nwXTpNO9RkUV0JujJ+LGs6/WGq6y917/PndhkYPmxMGzWN9QH3nvWeVMhc7dO66fnecqPkOSvvNNhWOCSOSbtnk7r0SD1XoehXmeq7UjMGEeEB0QT6JsCHegjHRAIU3vXqwdMdV5NXrHtk+CGyjVtAs7CmoZRgGltFdWexzw5jf9laf5P9GZdU0gxtGCfgMLO7ND8ktl2A/oLbQ0A9r3Nkd+65bX5MVAJ7+ZS3IY0D4kfwXk+WlWKjbCu2b5xNk7DQldEw+dIxkDfa5wC4x4qTip19e3tOWtq3RN9jAGD91dh8VpQLbbKYnAnuMRd+iwF5+xcR3upNZcqqrJ3nnklP6zifvXL46P1Sf9DfQ1trM10ffgj7QrNHFmNpI3IyffuoC0MzVg+37D/grbyADAHRenmfCNdOrbZ62qHzuinKeINITG0My5TDRgjIXFM7Ij2lYOVqm6AANwoil9EKXojsVkW+jzrmZdhBHVkF2yCCl0Qt3cfwmSfFesh+ZOfBeF5cDc9vFLmPzJ9i9+HtPni/6DkZ8lYDjoFczy46hZfoqs5GBpKvLa7zevcvPeRxkyyboGjt9k5vTuWgcfAZUXZ6oSTYTy+yj8Hv3HRd+Oe6NiOeuXsZK+k/6NcZmgfmuPMF51cfb0NRTjftInN+IXreD2Wq7tH0E7IqhvtHmn7F5RPw4boyLdBoEzeOA9d8rsMgLt5IKef3ujDXfW1UnjnSGG/ulxgOJ/j96kPJ0qyyRtG53SKemx645eZv916kPKAovmoqkDuGT8R/BfI4Jenlj+HR1y5s4u4wUvJqpsmMCppiPacKh0B+bG61XjbAG/gyuxsyQsJ9qymEdnPLF9F5H1r6uD5OZjslJcUfcku6LZMkBOCiyURRFUAZKIlF3IFABd6BRZREpgAnHeizlE45Q6ITAGyJA7oBIA87IuqLKGVQqD70tnVJCPJAJB3QJ8HQvk2WttPYam6Ob85USFrTj8n/ANAPiuueG9D8j0+ydwHPOecnvx3Lmbg5EKXR1tgzgu3+vH3Lqu1Sxw26mgaQA2NrfqVknO3lYatNNdKlokzFaKTzW52M0mD8ccgXI9W6Ts4KIv5pfTlJ75HnmcT9n6q2Lyl7g6tu1QC7mFwvbg71sY4/cAsdslO+6aogpWnL6moEY/XeG/eU8a3TSCTqLZ0twm0BZrbwl57zboqqpvzRM8SN85kQ/FAHq09X5G+XDwVs0fHeOH9vZBWS1F9sHNtIG5qaFnhgenGPV07sdFL1ckbq+kt8TeWCBoYxoGwa0YA+ACe19whtlsqa+d3LFTxOe49NgMn+C9/TrfJ2uDxs8nFL8i9Q62tVHRwy08zbhLUx81LDTuB5m/Sz+S36/UuZuJtwrqq/1VfKWxSVDucx00JeBtjr7loHCd0OpdZyGsEccczXVlWWAAMZnIYB3bYVu8pbT9ANFCst0EMPyXlkfyODAGHbGPyj09fVdUXFfRF9/JxSzOGRWjk6e5TGUt+Vgv8AoTRlmfenFFUmV/IQY5hglp+oj1KFuAcyU8ru0aTu124Ke2trpWsjiJLg0vgLjuCPSYfUvGeWcZ1LlHtqMXHgkKuhcYwWtId1Dh3/AOPj7R4rzroRUW5tYG+dnsqgH6eMg+8fWCrXa6WOst8byHcpxuASQDsftz7vUoAwvZPXUZbtJETjwc0833O+KrU6dY3+GLDm3r8oiqACuts1DIeZ2DHn1gZafh9i0CzVUl90TTVUhzUxt5Js9e0jPKT7xg+9UCwtMd3ezudHze9pH3Eq+8NYxGNQ0DscsNZHK0eqRjgfrYF5U1w0dsWaVpWyx6p4VV1vcxprrU8zwHG5YdyFzdryh+R3pxDeUSDP+/1rqbgbWxU+oRSOxy1cBjePErDvKJtItmp6iJrcCOd7R7Mgj7V8to8jxa+eJ9M75/Vjsy+PuTmIZTWIJ7TjOF7zZypD6jZkrX/J/wBJHU2vLbRPj5qZrxPU7bdmzcj3nA96yu0xc8oC7P8AJF0sKHS9XqSeMCWud2EBI/o2Hc+92f2V4XldR6eN0dGNfJujQGgAbDuR9yLqgvjN1m4B1R9EQUPrPUVBpbTVZfLk/lgpmZDQfOkd+SxvrJ2+vuQvqdIDOfKW4jt0jph9mt1QG3m4xloLT51PCcgv9RO4b7z3Lhm7VRllcc/WrZxH1TctU6jrrzcZeeepk5iB6LG9Gtb+aBgBUidpcSV9j4zSLDDnsymxjMSTnvXg5OZGHK8XNIXuRZzM8Xd6QV6uC88LZMQW6CCPCZISNvRBGBuEximhPbVTmquFNSt3M0zIwPa4D70zb6wrDoaMP1LSzO9GmD6l3sjYXfaApGaWHB9jqZgf8+vUhb+hDHyj65F0X5LNBy009SR1dsfYP8VzkIjFZ9N0R9L5G6qkH500riP7rGrrbyc6D5NpBkxGOcZ+J/wXheWnbjH8m+PiLD4614poWHmx8kt1XU+8s5G/WVx1OMbeAwumPKSuHLTXwB/SClom+17+0cPg1czTHL/ar8dGsd/dgx/p6PnroR4knHqyP4FW2SLA2Ve0lFz3IEj8XFn3n/8A6VwkiAZnC6875o306+mwWcEOKlXnGFH24cryE6nfjGD3rkZ1IkaaTzQpWjk81QFNJsN1KUsnmHdQW+j2qJPOQTOol89BTTKI6veTX59acTH5h3sTKodmqz35Tuc/zc+xfRR9p8+x7peo5Zg0+K0Ck+cYDlZhYI5PlWR0yr5RVTomNaSvKzNKbGi1Wr5mTPcV7X2qBo3j1KDgrzjqF4Xeu/m7gXdyuGVpUDM11ewRaio6gDaaOWnd+8PvUax3nBO9czl1I2oZu6nmbIPZnBTBxHOSOmcj2LsxT3wEuS+8Fa4UerZIi7AFbFJ+rNGYz/eaPitX4yUXyrTDngZLA7+P3FYBpSrdSanie07z0rwP04nNlb9TXLp3UTY7npaWRnnMkhErfYRn7CvlNZDZmmv7OyLtJnD3GKj+UaSneGgugkD/AGLD5dq0uHSRjXfVuulte0HaUdzoHDOWPaPaFzPUgtbA7vY50Z9xyPvX02nlvipfc55LkdNOyDkiM7YSiupEhIsIZKIlWICIoiiQACk5Rk7YSUABAlDPrRFAB5REoDoiymAEYRZ2QBQAoHHcj7wkZ9aBOxTF2dRcP6hsdjtZB80RtP1krYKbV8nNG3m2Dmjr61z9oCvEumbc4O9GPlPuJWhQTN7MODt8ZVN8E1ZjHG1zn3K1Pd0/CE+fbusst9RJSXVlTBI+KWNwex7DhzXBxII9a2DjtTFtrFYwZFLXtnyPou6/asZrPma477cx39u6IOpJoGuC/wBPqC8VNdSz1F0rXu7EnJqHHxz3qf1Dfrn+DLnQGve+HmlbytkBBHMfAkH4lUS3tkbQ09U5j+xEhjLw08uHDpnx6q03kmaBlWXF4qo+Z+5PzjcNkG/rAPsePYvc0eV1JHmaiCbiyCg1LcLTU1b6Grkgc8RhxY7GWFvT2KVvHFHVN1tU9qrrh8op52CN3aty5re/lPdkbKo1cD5X8gZzSxNLXM75I+4j1hM2Uk7j8x8+zPd6Q9Rb1XPi1M4NxbNZ4ISqTRPUVhqLlE2aBpl80ucGDPKPWpew6enjr6XMZGJnPO3cGbqY4U3W4WeSaBpFNT1cfZVHaNHnsznAHU9O5blT6at9z+T0ltgLa+rj7Nkbhuxh9J7vDbdem8GKeNSPMzaueGbT6My0vpyX+SrZ3xbPZI4bd2Tj7FVa22uF+lcGnAEpPs85dXX/AEfTWXTTKWHD2sjEY23IA/w+tY9WaawLnVdmCI4OwBH03nf4AOKvLGGohFQ+Dl0eqlGc3PgwygpSNQMAH9BMT7mK5aJAF21VIOjRRN95dJ9wTKjt/LqOsfjzYIRF73uyf7rHJ/owNi07ebm8EG4XgtZnvZTRYJHq5pT8F85qYbJtH02GW6KZovCymczUNnrWuPnS9PUXFVbyvqNkV9kl5cF4Ds+4/wAFc+DLzV6jtVKNxE0OOPUMlVvy0JGC5QMB84x7/Z96+JzV/wCUjR6kV/iZzXFnKf0gzhR8eVK25vM4AeK9+bpGES2aKtNRc7vS0NLGXz1ErYowO9ziAPtX0W0paKew6ct9npQBFSQMib68Dc+85PvXKvkg6TFz1c++VEYdT2tnM0kdZXZDfgOY/BdehfE+Y1G/LtXwdcVSAPYiKCC8ZMYFzh5R8et9VXdtstmm7y6z0JPI5lK5zZ5Ohk27sbD1ZPeuj0Frhy+nLdVjPnpX8PtXNce10zeG799DJ/BQ9RovUMZIfZLk3HjSSD7l9I+Y+J+KPmd9I/FerDzeSPwQ42fMyfTNyjPztvqmfpQOH3KLrbPUwtJdA9vtaQvqMcH0t/asw8oDiTbOHmmSY4KWpvdY0tooHxtcG9xlePot8O87eK7NN5rJlmoKJDxo+d08fISD1Td3VSd8qpKuvnqp3mSWaR0j3Hq5xOSfiVGk75X12NtxTZyvhiO9HnbCJBWSwBKHUJPelhMYpnVWzRcLm0N4qmtJd8mZTR+t0rwMfstcqpH1Wo8KaGOU2WGUfN1d3NTN/oaZnM7/AG1HyDLXdoP+Ok1FGMsomxUTf/lRtYf7wd8V2XwsoRQaNpIsYPIAfcB/iuPeHtPLetVwzSNLn1VT2r/a5xcftXabHttGj3TO835PSukPt5SV8zr57s9fZHSlUTmvyh7l8ojADs/LbpPN7WRNEbfrc5Ym/Ln4HU7BaFxnq+a90NBnekt8Zf8A6SUmV37zVn0JAm7Q9GAvPuGV62ihtxJEyZadGMDn1cw6c4Y0+of7hWqQDkVc0dGYrLA53WQuefjj7lYHuyzqpyu5M7MSqCBSHEhS6h+4XlCcOKRO/wA5YtGyH0EmMKRppPNKhIn7BP45eWMu9SiirF1tSyM5e4BBUPXFfXs5hAxx69EFrHC5KxeokXGf/O/ensp+ZKYyuBqcg96ezbwkjwXtR9p4RM6VhY4BxAzlWCuYGYI2VR03XtifyEgKw1dYx7Bv3Lyc0XvY9yA2qDHYLkmun7aPladyq3cK0xynBPVPbXXRSgc53HrU2S5DS92t81tqW9eeNw9+FVLdMZaCCQnziwB3tGx+xX2619PDTk5HxWeUL2iaqgaRysl52/ou/wAQV1aR8tCiSlLUtpa2grXHzKerjc/9Bx5X/U4rqfQEvy/RNNBK7mfC19K/Piwlv2YXJ0rBUUs1OT+MYW/UuiuAd3NwsDw93nTRQ1WPBzm8kn99h+K8jykNuaL+/B2Y3cTHeKNH8j1HVMIwHHOPb1+9cpaso/kV3udIRjs5u0b7P/Qrtnyg7Z2N4FU1vmyD7d/4rkvirQiLUUVQBhlXEWH2jb+C7vGZN2FL7E5FzZS6d2WAr1Ka0ZIZykbgpwTleqjJhFEUCiKtCCKIkdEaS7qmASIlBAoAJBBEgAZQQQQAEEWUCUAGgeiTnxRhUKjVOE9wL7I6mLvOhk+o/wDotSppJ5KFkzCcDYrAeHF0bQ3sQSOxHUeYfDPd9f2rcLVqC1WizVU15qY6enY3ma5/Vzvogd5PghsSGesKA3ayVVDMMNniMefA/kn3H7Fz5UwyOpAHgCogd2Mu/RzehW7Vkeo+IWkay5aXqKKgo2yGCOB0w+VTEFvMXHpCwB3Nk9RncLNtVaNbpikhqqWufdIgOS5SMZyxtcTs6MHzi0dOY4J64AWk8bgk2Z48im2l8Asl5dcrDBa6gEspojG1reuMkh3tG3tx604o6l8LpbZWHlPpNcPOwcbPbvuCPNPi3GNwqoRLQzdvTuJY4ZJaeo+kPv8AipihrIKmmjgnb0PNHOw+ezboN8Fvfjx3BW+PM07XZE8ad2Sr7MaxnMxr+Zo5g6M5IH0ge8evolwWCsncC6lpasj8twLHD2kLypqysomZcG1FPn8YzJaD49xa74H2qbotTt5+YzNJJ6PDXEe84Pj1JXpYsmmyV6ipnDljnj7Cb0TpW6/LWGGK327feUAyyAerPT4rozQUFq0rT/KJJnSVMmz5pTzSSHw/wC58t+r5ImAsqYYu/LeRv/mKlrdqWsqZBLGXTtGzpZXFsQHrcTk9OnwC9BzwbNkDxc2m1OXJuyOkjovUd1ludJFLHTvcx/mta3fmd3f+v3LLNe3ehtNplhjlYYoQ580nc9/efWB0H+KdDiV8m066nNQ2ScR8hn5Q1oG+Q0dQMbZ6n1LI7hXy6jrDcJ3NitcR7SMSdJiPyz/ZtP7RAA2BSxyhpoOUvjorHpJ5cnHRF1VTJbdO1NdJE59fVPPZwgZc6aTAawDvIbyj2vKk7/QssVkoNOxyh7rdAKaZ7TkPqHEyVDh4+e5zfY0JjpC6UN21JUXplRG/8C+ba6R+731Ds5qnDvDNyPF5b9FMbpWGprBHGSWM80b5yc7lfMavLubmz6rBCkkjTuBVSKCa6ahmHzNDTOdnxKyjykNZU+q77T1FKHNjMTctPUHqR9QWj6yn/kbwip7WDyXC7Htph3iPuXMl4q3VVaXk5A6f7+xfKaHCs+qlqH8dHpZHthtPOIqXswBmbnp3qFidjGVJ26rMErZG4y0gjIXsZYvbSOeLR9DvJv0ydNcL7eJ4+Srrx8rnyNxzDzR7m4WlZHiFwezyjOJb2NjbeqeFrQABFRRNAHwK8peO3EioPnasrWZ7owxn2NXxWbw+pnkcm1ydamjvXmHduhv4ED2LgCXitrqr/HasvLs+FW4fYtD8nW533UPE+iFddrhVRQRSTPbLUveCccoyCcdXLmy+MyYoOUn0NOzrzKCGwRLzV0MCCCYagvFvsNmqrvdahtNR0sZklkd3DwHiSdgO8lNJydICI4la0tWhtMTXq6PBx5lPADh88pGzB9pPcN/BfP3ibrC6av1HV3q61Pazzu6D0Y2j0WNHc0DYfxKtHHLiVX691O+tlLoKGDMdFTc20Ueep8XHqT7ugWTVcxc5fYeI8csMd8lyzDJMb1D+ZxK8TulPIOV5lfSxRzAQBQQCsAx1wljqkNG6W0b5SA9ohvlbDpWN1BbayTHK63WJtM0+E9Y/zvfyOf8ABZZp2hNyvVFQD/2idkZ9QJ3PwytYdIDp0zNGDeLtLUgf2MA7OP3Ze/8AZUSdRbBK2aZ5O1qNXqWKXlyI2kj1E7D7V0nxNlMek3UUZw+sljpW/rOGfqCyzyXLRy08lc9ngAfYP4lW7jjdxQRwuzgUFHUVzv0g3kj/ALzl8pL/AC5W/u6Op8UjlXiFcW3PWF3ro3Zjkq3iL9Bp5G/U0KsSPLYJCOrsMHvO/wBQK953HOCcnvKKhg+VXa30uMiSbtH/AKLf/Ry+lxrbEyfLov8ARw/JqOngAx2cbWn243TwP80Lwldk+soufbC4nyz0F0O4upTeqdgr1hd5pTerOCpaGLik2GVIU7wWgOUOx+wT6mdliVF2el1pKeeJxLQdkF41E4DXAu7kFonSNOCk0OrOaq89xAz3q5Ul/p56b8YMkeKw6umEAJwWlMaS/wBdBKBG9zm5x1Xowk0jxZ40ujoq1HtZe0Y7YnuVmpc7Auz7Vm2gruZaOPtM82BlXSOuLiC04WE1bOVkpX0DZ4znGfUqdd6iptUhLclit1BVSTSiLdxJ2XrfdMPq6Rznt6jwWOSKRDRmdVfZKhvLzFedBKW10bnf07Cw+0bj70q52Z1FVFmPqTWqk7KOMj0onB493X6srPSyrKEHyT8T+V4IWseTzc2012bQudytbPJT4/NlAlZ/eDwsfjfnDmnY7hWfQNxkt+qGSxHzpafnYPGSBwkHxbzhT5bHeLcvjk7cL5o27j5bPlOnhVtbl0Y+w/wK464t0JmsLqkNzJSyh+cdx2K7z1XTxXvScpZh0csIkYfFpH8CuOtb2wuZXW6VuOZr4z7Vx+MyVklD78mk19NnOziG1kmPReA8e9e2RheVXG6EtDwQ+J5iePft96W3cL6KPRgwyko8oloiQHZISicpJ2TAIokfciKACKCGEEAA7dyLZAokwAgUEEwCCNBDOEAKY90cjXtJBacqzW211mrattbc7uWUsR5X5blw/NjYDufFxwPb0VVJUhYrpJbKwSDJids9oPd4+1AjpfTFLaaCxQ26w0zaegdgkZ5pJHd5kd1cfAdB3AL0vtgJpnTsjEsbx86w75B67d6oui9Sso3xuLu1pJQCQD09YWqU97pp6JoZI2Rjh5rx3rP1JbqkCiq4Od9Waams731FuhkqbUTzOibkyUx8W95b9irLIeZvyihlDmnc49E+0dx9nwXRF4paaaV0sWGPPXHQqiXrRltrKl9TTvfbat25kgALXn85nQ/UVqmSzN4LnPTvDpDLA4bB4O37QUtT3aKbBkFJP4l0bSfiMJ/V6Y1BSPJFFBc2f1lLJySH2sd/FRk1H2TsVWnrix359v5vrAWkZkOJKwXikh84RUUR8RGPvyvb+Uc9W/FMyorC0bFnoN/WPmtCi6Gnb2o+Saaucz/CO1n7SFZaWy6oq+Vv4NprTH3TXKoBc32RM5nfUFutQ49Gbwp9njGXvi+WX+riZSM3MPMey/WPWT2bN9vRTtBSSajhhq7lHPQ6ZJ54os9nUXUjoGj8iHuL8dBhuT6PjDY7HZpW192nN7r2HLJq5gEER8Y4Nw4+t+f0Uyv2qKmvlk5ZJHF/pyvPnu7vcMbY+xZZdROfZpDFGPROaVtfD/nudgr6f8FSzymooL9T8zjb34x2Moyeen9fUZ3P5Sj9ExWuj4jG06orqWAUHNJJ2coeyblGW8jhs5rhgg9e4pnpK31lfVGeKT5NDAOeaods2Jo7z/DvVB4gU9shvktfYHPhia/ePOAD9JngD3t7s7bdODPmhqIvD8/cvFiljnvvh/BY+M2t5dSXupqs8sZPJCz6EY2AWYZyc95S6meWolL5XZKQFnp8EcEFCJtObm7FtO6943d/RNx1Xow7hatWJD2OYgpxFK7ITCM7JzCTzBYSiUmS9E8l43711R5F1s7S53e6ubtFFHC0+skuP2Bcq2wc0rR4ldv+SFbBScO5q0tw6rq3uB8Q3DR+6V855ye3DX3OjGbSeqJBBfImoiaaKGF8ssjY42NLnuccBoG5JPcB4ri7ylOLZ1jdXWi0TPbYaNx7PG3ymQbdq4eH0R4ZPUq6+VPxcjlZU6IsFVmFjuW5VEbtpHD+hafog+ke87dxXKNwqzI9xJ6r6bxHjefVyIznOjxragvccFMHuylSvyeq8XFfWwhSo5W7E+tEeqPPXCJbJEgQ7kEAmMWBsvRi8t+5esfVICz6CaYKquumD/M6R5j/ANJJ82394n3LS7rS/J7vQ2Vo/wCS6KGlcAP6THaS/wB+Rw9yrXC23RSm1RVQ+Zqq41tSf/dqZpc7PqOHq7aHpZb9q5k8wzJWVJlk9Rc7mP2rk1mT08TZeJXI6v4G2r8G6Mp+ZuHPYM+07n7Qsr8pK9A011DH/wCc1cVAz9CIdpJ/e5Qt6oTHZdKiaQBrKendK4ewZXH3G25vnuFvonuJfFTmpmH9rO4vP93kXz3j4OWRX+zaT7ZnU0m6ltFRCbUFRP8Ak0sIjH6R6/7Sgi9vPzO9Fo5j7BurRw/hdFaHVEnp1MpefYNvtyvopuoE4lcyzzHfZeefWlP3KSRj2Lko7ExzTOPLv1TetPnL2pzsm1cTzJFI82nbqn1K48pUcDtuncLsQl3qSoZ6xwCrqHR8wAA3QUHa7nMdTxUbGl3aHBQXZi026NnPk1Li6ILWOkzTgjs+9VJljax4Dm9/gtX1veqeWrmhOOZjiCFU6ankq5S8Mw3K5MEsj4O/URxpWTujqDs4Ge5XGKLl7l46LtUlQ6OCNpLnepXt2kqmJoc4ZHfsu/Y12fO5OZNoZaQijjqhLIN8bZVsutfTRULucjp0yoY2800WWbEDuVK1XXzxFw7Rxx4lcuZ0RupDXVQZPM6RoB3ys+ukroa2Iu9APHN7O/6lcqSodWR5ecqualoTJKQwbnwWGP3Jkp8jmkfyU4hJyYnGP3DofhhSNHWGimprgwZdRztnx4tGzx72khQcDJ4Z2xzghz4mk+stGPswpGnc3djt2uGCPEL0c8FkxtP5OmDppnXnDKsZcNIR0xcH/JXOpic9WDdh97SFgPGi0G3alndyYEm/vHVX3ybb059O23zPyXwmF2evaQbD4xuafcvfyjbN2tHFcY25I9Ige4/cvldPJ4csW/h0zrau0cL69oPkuoaxjW4ZUN7Znt7/ALD8VX4XZY3daVxToSaOKuY3z6d+Hfon/FZoAGTvj7s5HsK+thK0c0kexRHoizug7otUyAubHckkoFEVYAJRIIIACIoFEgAIIE4RZTAGfAZQKLKIlMA84RFBDCAAggggCUsN4ltknI7L6dx3b9H1haFp/UrqdokglEsL+rM7f4FZThetJVT0cnPC7Azu3uKiUU+wOh6C5U9yp+allHaD0o3HB9ybVbnBxDwQR3FZlpPUdK25U76lrW8rwXMeSGuHt7lvsmlr1qG1i8W+0U9JQObkTOnDmke0JwxSq7JcuSgPrJYnYa/I8DujiudSPRDfc4he98sdytwdJK2lkYDjmZImum4HXW4to4qaZ0pBOIwHbDclbYsU8klFEZMsIRcmxdVe6xrcFrD+lI4qNqL5XOYWtlZEP7NuD8ULu+lp6uWGR8oax2M9nkqPbW6cjBlqqirlA/IYwDJ9qwzyeOTi1yXCpxUkM6qSWeUkl0jyepOSVIUenKo2uou1aW09LB15zjJ7h/h1UdW6zpYWGO0W+Kkb0Msh5nn3np7lVdQasra6mFK6pklY05DQcMB8fWpxScuZqkVK10T961nUm1C1smbBRMJPJGMc58T4lUCvq31cvMTho6BNpHvleXSOyUApjijF2kNybAjGyJG3cK6AWEtq80tuyQHsw7p1Du5M2FPKc5csZlInbKzM7DjbK+hXAu2m18LLFTObyvNK2R4x3u84/vLgnRNEa+50tIxpLppWxj2uIH3r6R2amZR2qmpYxhkUTWNHqAwPqC+N89k+qMTrxr6RyOqxXyluK7NI2l+nbJUgXurj+dkY7ekiI6+p7h08Bv4KzccuJNHw800ZYyya8VYLaKncdh4yOH0W/WdvFcF6ovtZd7jPX11TJUVNRI6SWWQ5c9xO5K5/FeOeeW+XQ5yoZXWsdK9xLs5PioWV5JKVPKS4puTsV9tixqKpHJKTbCJyUkndAlJ3zuulIkPvQQRjvTEEjagUG96AQpvpJxTRuke1jAXPcQGgd5JwF4sG6sWhoWm9CtlbmKgjdUuz0Lm+gPe8tSGaPaYG261XeVhHLDHDYqZw7yfnKhw9zSP11rnk3WH5fqH5S9mWRDrjvP8AhlZPVwPpbfYrK7Pax05ravPUz1GH7+sRiIe8rqvyb7F+D9NfLZGYdL53Tx6fV9q8Ly2W6h9zfEqVlt4pVDWaeitbXhjrhOyA79IweZ5/ZH1riPXV3/DOpbjc2+hUVDnRjwZ0aPc0BdN+UVqH5HT3J8cmHUVF8lh3/p6jYn2iMOK5DqZN0/G4+HP7hLo8KhzjGWN3dI4MA8e8/wC/rW9cPtNU09FBTuYHCJjWe0gb/XlYrpem+XalpmEZjpwZn+7cfXy/Fbrw0r3Q1ronO/KBC9W05qLEk1BtFwGgKEtB7ELzk4e0RH4oq/UVSHxA56r2kmaGrq9GD+DD1JfcxzUek47dTPfC0tIGVn1WcyLdNbOE1I8Y7lhtewsqXt8CVw6nEovg7NNNy7PED7V7g4pn+xeA3SpnclK8+pctHS3wHw5tzanVctZIMtjAa32oI9DXaCjfLzPAcXHvQXs4lUEeTkdyYd7sMdVdH1Jb6TslO6S2Q08GeXfCsVRT82+FH1MZawhZwika5JyfyajwVtVG+L5ZI1rnnYepaHqCCmio5H4Aw1UThDQ1VJb2OGXNd5wV1vlJUV0RgOQxw3wk+TKuChvlZNE4N3BWd67tsji4xjPMtautmjt9GXM25Qs7vdbDI1wcQSCss2JSXBnsZnVu7WleYnjcJ/DEyrq4mvbnLwkXCaP5SSMBJpKtkVTG8kYDgsceFxY4womuItlbSWukucLAOyPK/Hh/6F3wVOa7D9jstiqOwvmmJ6TlDi+PLR6x3e/ce9Yrh9O91PIcvhcYyT346H3jBXZXBZoPCe9utGpOYE4JZVtGepj82Qe+N2f1V0nr+3RXnSc7G8rwY+drvUR/6FcdWy4uoK6lrwOb5NMJHNH5TOj2+9pK684Y3Fl00hHTSSCV1Lmncc+kzGWO97CF8r5DFsztf/1/9OqLuKf2OONbWrnbWUEzccwdGfUf/VYPVxvhkAeDzxOMbx79vvXX/HDTzrZqOZ4aQyUl2fWOv3H3rmTXtu+TXyRzW4jqm5/XC9jQZvVxKRnkVMrYKNecbiRvnI6r07l6RkxB370SU7okhWmICIo0kndMAIIIJoAikpRRBFAEgggmAYwiygggAII8IdyQBIyMjZEEpo9SYm6PMt36qwab1TqyyQyxWW53CKAj52OJ7uzI/OA2+IUxp7RNxhqqO4X61uitcrefmme5rHZHmte5gJjzt6QHrW7ac0NbLqwUNribTVjY+0ZQSBodIz6cLh5szO/Ld8dypJkOSMkt151Xqu2B9ZVPMMMb3B8VCahrQ0/0nY+czPcSDlRmm9e3bSV4fWUDrdUSdm6PJkcBhwwTggELWKjTsWmLjJLT0EFPUuY5hkDSDh3XoRv6+oWVa8oa2kJrZqyaohkkIJLecs7/AMonb3rbFknCVwfJnPHDJHbNcFcrtZXOSqlqXGLmkO4bJlQ1bfKypDh5rA45IAUzf9LVlJV5qKiCdphY+N8Jyx7XNyHA+/4gqBq7c+JvMwEgdQsMjcpNy7NoRUYpR6GUj5JDl73O96LHqQHVKwpooTgo0YCGEgCA3S8Y70MIYQAYSwiCMKKAU3Yp3THzwmg8V6xP5XBRNWikbT5N1vbceJ1hgLAQ2pEzvYwF33BdscRdY2nQmlJ71dZOZsY5IIGnD55MbMb9pPcMlcY+SjqPT1g1vWXnUVxgoaa32yaVrpHbvcS1vKwdXOIJw0blQ3G7itceIWpJK2Qvp7fCTHQ0vNtFHnqfF7ti4+7oF8pq/H5NTq+V9KOpTSiRHE7Wt11hqOqvV0nL5pzs1uzY2joxo7mgfeepVEmlJ70dROXHqmxd4r6LT4FjiopGE52AnI3KQUCUS6kqICwUEaAVADCHsR5QSJYXvSgElejfYmMWwd60bhnZ2Vr6GjnPJFcKgz1b/oUkALnn6n/AKgUNNLV1kVLA3Mkrwxg9ZOFrtmbHb9OXCuhOBWFtnoT/AGEeHzvH6Xzbf13KG6TYya05FPqjWD6t8eH11UZOTuYCdm+wNwPcu2NN00Fk0rEH4jjhh7R58ABn7AubvJv02a++NrJI8siwM48ev1LfuKNWIdPstccgjkuMggznHJGN5HewNBXymryPLmbXxwdKVJI5f4/X+WsmpKV7sPqnyXKdueheeWJvuY0n9ZYzO4nfPerJxGvYvmqbhcYyRDJLiAfRib5rB+yB8VU5HOczkaCXPPIB7V9BpseyCj9jKbtly4Y0jhSVdye3BqH8jM/RG5+sge5X/TM5p7s05IyqzaR+D7bBRtGOyYAfb1J+KkLTUulu8ETTu54HuTtvJZvwoUb/AGOqc+la7uwn0lWC3HMMrws0MUNnb0zyD7FVKm9NF0khB2acdV6iPPbJe+ES0ztwVjOoo+yuUg6AnIWtPqWzU7twVl+tI+WuDh0JXLq43Gzo00qkQgPRN7vKY6N2/cvcb4UBq2vbDTObnoF50FbO6TpFGqb1U0tfKInHlygoWd/azPk8SgvaiqVHlS5Z1nByviBOOijLs0Na7dN6a4Hla3BQq5XSxnYrFGrN24ZVNObNT7jIYArfPPACTkLmKyavulij7NkfaMHTzlJM4pXaZ5aaZrQe/mWbmropYpNXRpnEm8RQW2VjCOYjAWL1bnGNztzsve76gqbpIHVDsDOcZXrbI4qmI5IISnLarHCNlDuD3CpOThEx+W9d1M6toWU8nMzBCrsLyHYKnFNTQskHEvuir0YGiOR+OU7Kva9pmQ3p1TT7Qz+HcQMj6iR+qmlHKA7Z2Cn1bHJXULody/GYz+cNx8dx+suiuDMrsUuCAd10D5NWocPjt00mzh8kdk/lMHNEfewlv6q52DtwRtlXPhjd5LfqCFrJOQ1PKxhz0maeaI/HLf1l4/lcG7HvXaNcT5o6C8oGwNuFhFfEzMkfU+wfw+xca8Rbaai2vexvzsB52+O3X6l9AXOp9T6QbKwAsq4A4A9zu8fHIXHXEayPtt7q6ORnm8xLcjqCvP8AG51HI4Xw+TSSbX6OcJTiXnHoyDmHt70oEqQ1DbjRV9RSgbNd2sXrae7/AH8FGtORkL6SLOdoUTsko+9EtEyQnbhEhnPeUO9UAEEROEWUABEUZKJOwAgEEEgD6oIdESYBlEgjxsmKw2hXHhVZrfdNT05ulRTx08Lg5sUjwDPJ+SwDvG2T7Md6t3Cngbf9Z2j8Lvc6mp5I+eCMDzpB3Ek7AHu71cdCcI7TdLDXTBr6W6UdLMQ8PJLKmmlY7PsdG/BHi3IWmOG4xyZFBWzonhtpqIWxtRJBHK6qHIGvaHNc09cg7ELz1lwhobbRS1mlqXniDhPLajOY284356WTrTy+zLT0wFa+DzjJpGjnkOXNZyDPjndWS8VHaSw04OA45d7AjlSG0mjlO93iO6wujvNQDUxydgy6TRdiTL3QVrP6KXYhsvovxv3kVB9oknu1NTSsmjkbVxhzB2geDnH5AL+/8kEra/KA03RVVcy92/sqW7CLspXFvzdXEdjHM0ekCPN5h5wB2KyOxMrTWU4oaZ1UKN0bp7bM8GqhazlLnRnpJCXENjaSXd3cuzBjUppx7OPPkcINMgta6ait1AyJwJNHWTUh9PPZnllZ+MAdsHuHnAHZUfiLabNbNNw1NsrnVNTVML3QuZyvp2A4Ln9252bjqtY4u/K4blXxSW11popKlk8tVVhrMFrC1wZHzHneWtcQObcsI8As9sEVHQ3631N5pHzU0dWyf5JUHLpXjDe3lGAQCBlsRzy5OfXxeSw+nL1L4+xvoM3qY0jHKmklpmMdK0tLurSNwvHda1xz0qbdq+thpInyMqHtnpmtBJeJNwAO874WUSMcx5a8FpBIIO2Fz4Mnq41P7nZJbXQTd0pJBwlxtdJI1jGlznHAA6lWxACNWa06WkmaH1Jfv+QzbHtKnHaBfPSSy0tHVF0Y5ts8pHfue/HT3IAz4oD2Ka1Lpu42J4+VQvaw4I5hgjO49x8VCAhSmpK0NqhbeqUp3ROno79cZBWXCK3W6lZ21ZUvI5o2ZAHI3q9xJDQB3nuT3iLDpynnomafoaihaIy2Rk9R2r5APRld3NLt9htsMeJlvmhFYD3AYR85I3SqKmmq52U8LC6R55WhXvXelNO6Z0pTwOmrX6iZh1U/tG9gHE/iQzGeYDqc7HbGyl0NFBLspJSQ7ZHn1qkhAQRZQPtTHYEESCAAlhJHTdLGMJMTCAXrGMnC829V7RjwCQy0aGopC+ouMcRfJGBT0rQN3zyeaAPWBn3kLSrvSMjvNJp+mIfT2eIUfM3o+bPNO/3yFw9jQmPD6kbZWPuEoBbp+AT4PR9xm2ib6+THMf8ARFW/g3p+S8ajp2ODpGtcHvJ35t/tJXFrs3pYmzTFG5HSnAXTosulY5pGYkkGTkeO5+4KkeUbqgU1FdpYZcGNgtVLg/0kgzM4exgI94Wy3Sph0zpKWfAPyWHzR9J56D3lcZ8fL1JNfIbL2vP+DmE1Bz6VTJ58p93mt/VK8LQYXPIr+OTWT+TMa2TmeT3J/oWh/COpIg9uYaYdq/PQkdB8cKFmkzk+AWk8MrSaSw/LXgiWrdzA/mDIHxOT8F9TjijmkywyUMbh0QoKJtNXR1A6tOU7AON0Hg8p6rb04k75Fvk1vDTW3snvw4DHVUubUdMa183atyTnqqLreWVnovc3fxVRM839a/4q9xO2ze6TWFMIy10reniqvqjUdLO/LXgnKyszTY/Gv+KQ57yd3uPtKzyLeqLx3B2XsXuL6QUBfZ463mbscqC5nfTci5nfScsI4FF2bSzOSoWLfAPyAgkczvpFBdKMjpqmp6JoJIjGFAakudHSktD2dcbFZBNxEqnDlje52VHyXysrZO1ncfYSpeJyXA45FF2ajJWQ1LQecJlU1lPTMLuf61n02oqiCMtja33lQNyv9wqAQZWtH5oULSKLtm8tW5KkXe8awjhcWMf08ErS3EJza4QSE8r+hKyt8rnOJe4uPrR085iqGSDuITyYVKLRjCbUrOgblc23GDmz3KClPI3mynGg4JbnStcyMyNI6q1fybZI7llgLV5+BShKjrzVJWUWG4EThjcuOegV/wBN0VTWwgdk9ocPSx08Cp7TeibQwiV1O0u9a0G1W630jGhrWNAXpblRwpHOurKCS3XeZjo+z5yX8uNmnOHD3Oz7iFHU072kBjyx2QWvB3aRuD7jgrVeOlqhkbHcqTlO2ZA3xAAd/d5T+qVj0TiDjvBWOSKnFopcM674A6obdbb8jkcGmdhqY2/ReDyzM9zvO9jlAeUZpXmxd6eP1vwO49fr+1ZnwUv8tqvkbWOPM1/yiFufSc0YkZ+tHk+1gXU+pqGl1Fpd4jxLHLF2kRHeCP4L4+eJ4MrS7jz/AEdd3z9z538RraeybXRty+nPnetqz2ZojnLW+g7zm+wroHiBZjQ3KroJ48tBLSCOoWFXuifSVU9I7JdAeaM/SYf98r6jTZVkgpI55RoZlEibuAjOwXYZsTjCCDuqB6KkISSiQQTACCCCAAggggAIIYQITQAVj4f6adqbUlDbZ5pqKlqpXRfLPk7pIo38uRzEdG5xzEZ5Qc4wq/BH2kzGFryCRkMbl2O/A7yukqVtNwv4XiibXSXia6Smphhe8wS0jw3Z8IweSZuR2kbjk+BBBLRLZNWfVcnC2yt0PHcJ55qaRz2iTrGc5MeehAJ27iDkbHA9+HOpJZLVq26Oc1v81qpicbczxCz7Sub7zcTV1JuFZUn5RgOG3LzY2G3iPDw26dLppXXFvj0Fd7BSOmN3uksNPCzkw0x85kec927Y249RPRdenSvk4tUpuFROoeEWuI6LR9qppXY54nSEn1vcR9SuI1jQ1N2ae1AAb4rENK2etrLdSx0QzDFC2NjvHlAGfv8Ael3WhuNtrGMlkLS7vBWMn9TOmK+nksvFG/Q19RLySAtZtsVnVs5Kq8UEjKR9VUxVUZhbFEyR+7twGvIa7bOxIHvTbUgqIpTzyl3N614aWh+XXqjozTMqg+QvdG+3PrWkNaTl0LCHEZI3B267rbA/rRz6n+JnrxTZBBeKus+QvprlHVx07DUUYp3wgRh5Ii53NDiXNIf1x0wq9c7JS09rjr3VHNI/ziCcklOuIfZF7o6ZkEcbqueUNgjkjjHnBg5WyEvb6B2duN1Wo31tcYKLnL+Z4a1vrJwsda029xeijtgqLNq+eW+s/DjpoY2WSnpYWAnD5HB7enrBP1Kj8Q9H00nE+9UcFRR0sbr/AFFO0PfyhjXAyNJ8GjJGfFe18m7XV8lip6hrKee4RU5LnYb6bWkk+A3Vd19qOmr+It7vET3SQzXaeWMgf0WXNa4evGEadQjp0kVkUnmsiqfTEjqKjqpKqlb21wFKWmTdrS1jud3g3z+vt8FYLPoITahuFsfc7eTTylsZ7X8YA5m7T4EPOD6lT/wiz5CY8P7R1Rzkd3Ly4HvUxb73Sx3arq2ySNGD2WfSfs0D7PrWdKzbk6+8mbhvpy4aNdf9TNp6yZhfTsYXea10bi0yHxJxsofUcH8ndVw22mrf5hV1Eb+wZLlrgXgNyPEKo8Nxd6fQkIhuboGNaWvZznznHd31lMZ6maTVFqdUT9pishBJPQB4cT8Gn4K4K5IifEWxGvLi286cfZr3QsquztrW0dbHhskL42kcrj+Uw8h67jPXuWca30dpmGnoarTk11poZXxsqG17G80fMQMgt2cN8931hT2pK+s+RVUzXOEUNuijeMbGSVuQ32kyH4FRlabm632uyVUkjPldUx0UcrTsxg3fjrjoPcfBcLxKOR7GbxncUmjyvtJNTv8AwZRUtAI7Y58cDqdnIZZB5pc9zwS4EjmwT6gAqvb9K3S53KWS519PRj05J53l7nfogde4dwGR0Wu363UdXeayW2SxPL6iQmPn269W5AJaeo9qrt6payGmkY2FzHkY86MuGO/bv239yndOPDKW1g03No6y6Bhr7XJPFqZr2Pmq6sAfIpWOzhrehaR7yD0ys91PeJ9QXCPkY9zebDGNy4ve47kd5z3d6tertFRQ2uS93DUrKl5fGGxtYI2ObnBAdk7gZwrnUjRegprPedP0jRLRTtmmmqJGySTNLD5pHQt5iMhu+AcLWNdokxm/WC9WEwtvFrrKAzs54hURFhe3xGVGDortxU15VazrWuqZZ6sRv5hUVDjzO26Nb0YzfoAqQDlXG6BikEQzlGmICCCCTAMDZHlDCMBSNC2BWLRlG19ZJcp2B1Pb2iZwI2e/oxvvdv7GlV9i2Xh7aKe3RMkuEAkprPGLlcI3DaapdgU9OfeWgjw7TwS/IDm5U8tvoaHTb3E1TD8vuh7zVSgEMP8Ao4+Vv6TnrpbyadLCjtf4Unjw5/nDP1fefgsC4e2Wr1Jqhr6hzppqiYzVEhHpEnLj7ySuzrVBSaY0rmXEUVND2kvuHT7l8x5LUepl2fCOqMdsfyUzjVqSC3Qu7VwNPaoTXVDSdnyejBH73EH2LiG/Vs1bXVFTUSGSaaR0kjz+U4nJPxK2LyhdVTTxxWp78VNZJ+Ea4fRyMQR/qsy7H5wWF1EmXHJXp+Pw7YW+2ZzfwOLHbZrxeqS2QenPIG58Bnr9p9y399DFSQRU0LeWKJgYweAAwFS+AFgM1RWX+aPzYh2EGfpEZcfc3A/WK0m4xef0Xpp0zJoiWU3M3OF5yUxAKnKSDLfRRy02QdvqV7w22YxxAjLM58VSyFovE2AtBIHes8cFSdk1QhEUZRJgEggggAicIIHqggCI7IQOAe3CN9ZyAgHCmtR0eAXAezAVNnbUhxHZSEeoLVZUQ4juorC7qUylqMnqm0zphsY3D2hIjbI93olDnYLge0+ZHddk4kjDW570KOmkDQSEqfIJBOEx2dL+Tx8hn09D5w5+jh4LRdUUsUID4sBc3cA9QyUNzfQueQ1x5gF0Jca5tVRg82dly5OzSFkS67VVNGREQMKrXjWV6imLI5PgrFT0rq2fsWjOeqmoNDQPZ2j4QSfEJQjuKm6Msffr7Wvj7dpli5wS0jY+r37hQN0pm0tSRHnszuzPXlPTPr7j6wVusulIIGgNY3A9SoXEvT5pWsqom/NyZIIHQj0h9jve5W41wRZULJXS0lXFPA/kmie2SN3g4HI/h7F1zwR1PBdrL8ga7HKzt6ZpO4jJw5ntY/I+C4xjeWvI7wtP4L6pms97iaxxc5khnhbn09sSx/rMHMPW31rwfLad0sse13+jfE7+ll/8o7SRjqPwrTxeY70sDuP8D9oXK2vrW7s218TfnIDh+3Vq+iOorfR6o0sRHyzRzxdpCfpAj7wVxzxE0862XKeklZlhJAyNiP8A0XN4zUbH6T6fRU1as52nYIpcM9B45mezw9yLuUrqG3Ooq2SkwcA9pCT3jw/38FEMdkL6ODtHOwz7ERRnKSeq0TJEoIFABUAEEeEEAEgglxjJ3QAcbC7ZOYbZXzxmSnoqmaMEDnZE4t3264wtu8nXhPT6oqW1V2p3y1D4mVFJRyNAjfC7PLOT+U3IIx0GN+oW0690NHbrPLbpaTtIC0RkxDlY092D4g9MK1+SLMG4A6T+T3Gpv1yvUNtjo4ntq6aemLixzXAhszDh3ISBl7POjPKTjqq/xT1DPqLUdXcLgWve1w7R8eMStbsHHlwHep+B7lpvG/VVdcNN0dFX0lM2viiDaqvpz+Pc0YY6ZuByyAZHOOoJ3A81c8X6SopYGxea2ObJIBBH+B9eAlaGMbhUmonLuYlrdmk948VPcPa2OmuckTmxiSRvzchaOYeIB7shVYOS4pHxSNljcWvYQ5pHcUKVA0dSaP1rUW6gpYIngtbIMjPTxVo1VUz1tO2qe4ADzm471zbZNTU5gbJUTxwyN9IOON/UrvRcQaCWnZSSXHnbgYIY4hvvwicnYJE/dqrtX4J6DC9NLxsFTW3F0DahtupHTOb8niqOUnfJY+Rjxsz048kZKhxV0NVktrqbpnJlaNvemNo1VZJKKW1TCft6uuL3tqqKB0L42+iI5XN7RjyGNGxx5x6Lo0k1ubfFHLrISlDbH5PG91cnNHDOfPjia1wyThxHM7+84r1tzhZbVNqaqABjBjoo3f0kpHX2N6r0r6a12xz7rqOvile9xeKSleHvkcTncjZoys911q2ovdU18rWwU8LeSmpo/Rjb4D7yvMz5XqZ7Y9HZigscSu32tfPI4ukLnvdzOOdz4qKz60b3Oe4ucckol1xVRol8sIhetPK+GZk0eOZpyMjZeW6WOiQ0aHpbXT6ZnYTPeI3Y5mF31hTdz1TZnVMBgkqWkwyFxkx5vOOzJBHgwyY9Zb61kWECCeu/tQnUrBpNUWzXGtJrzUNhoIhSUUUxmawHJc/uc495AAA7gBgKtTXK4VFd8vnrqiWqzntXyEu+KbloRYUKKQy52ziJdYWsiuVPT3FjcDmlbiT9obqfqeIlvq7LPTxOrqSokb2bQ49o1udiQ7q3AJKy3CAG+UONgbdddQ6BrKq0NZaLDHQ0zXtnMD+R8wa1gbztII35fDOXOKzzinddOXe/NqNOWunt0TW8rmUwIjd0wd+p65IAB2VXGfFEQhRodiQSltOyLGEbeioQoJQSR0Sm9UmAEY6o0Q6qQD3XoxpykpzSQSTyshiY6SR7g1jW9XE7ABJjJ3RNEx9Y+6VTOeloMScpGe0l/o2fEZPqaVqtzjlt9vptMuOaztPl13d3mqePNiP+jYcH857000hbKayUpuErI5qWwuBw7dlZc3jzG+trOUuP5sf5ym+GWn6vUepIxM6Sd8kna1Ejt3OJOXE+sk/WuPW51gxt2aY47mbt5N2jm01GLtUR+c8Bzcju7vr39yt/GO+U9PR/IJ34o6eE11xIPWJnox+17sD4K1UMdHpbSpfOWxQ00PPKR6h0+wBct+UJqyd1O21PfituT219wbn8WzHzEPub55HravndLi9eav8Ab/8Aw2lL5MW1heaq93ysudY7M9TM6R+OgydgPUBgD1BRFBTTV1dFS08ZklleGMYPyiTgD3nZIqncziVqHk86d+W3ea/1LMw0Xmw5HWZw2/Zac+1wX1MFtXBz9s17StlisGnaS1RYJgj+ccPy3ndzveSfdhIrmDtFOOGyia4fOoTKYVFF5ucL2ki26BelC3zE4dHtuhspGN8U4gGOOO9ZnIxaxxYZiI48VmT2DCuLM2RjmELyIUjJHtlN3sWqZI1QSntxukpiCKCBQQBY54GTPDZAMKVprTb/AJMeYMyo/LCMk9U3q5SwYE5A8AVADG9WmkdI4Ma33KHdaoY+jQrRa7TX3SYMpoJJM9+NlebFwurqhzX1jTyjcgBNRbBtGU0dskqB2cELnuPQAKG1Daa23yZqYHsa7oSNl1lpnQVFRSAGBo83HRVvjjo+mOlKl8EY7VjedpA7wto8Es5u0rWutt4iqGktwcFb/p7UbKqjYC/ORvuub6bnMrQ1pLs9FdbNXXCgiaXRScnjhc2bhnRhVo6f0FDDPJ2pIJcVo5bFHCBgLnrhHqipmk7HkcA09SFsMlyndTgnPRaY1aMcjqVD2v7NzuoURe7RHebDU0DOTtyO0p3O6CQdPcfRPqKiLneZ48+aSmtr1FMZsFrk1F2KzCb7SvoLi9vI5sbiS0O6juwfWDkH2FLslbNTVkU9PIY5Ynh8b/ouByD8fqyrdrmiNzuVyIB7R9VNLE0DfIPnNHtAz7R61n8bnRS47wVhmxqScWVF1ydocCdVQ3S0x0BcGtkaZaZhPoEH5yL9V249RCg/KG0eKqkN1pIvOGScD4j7/isY4R6nmtd1igZOIzLK10LidmTjZufU8eYf1V1xSz0Wq9LslaByVEe7TuYnjYg+sHZfIZoS0+Tau1yv0daafJ89tdWh1TTOfGD28J5mY6nxCzWZvK/tQMNfsR4OXTvF3Sc1jv08fZFsTnEtHcPEf79ywbV9q+RVLpwwimnPn4HoO8fvX0ek1CzY1JGM40ys9yIIEOZI6N/pA49vrQ713rkyaCIRIzuiytExAJRIFBAAUtpGhbctTWy3vGWT1UbHjxbzZP1AqJU1omd9Lq+0VEcbpHMq48NYMk5ONh39UAdv6TtMtptcOpbUw8nPIZaanaO2pXEjmlp27B7XY8+A7O6twdkridrqO6aZgo4eyM857RksL8w1DWjd0TjucH0mHD2dCO8wNrbT1tBO6W4y08bHY7MEgg9+3jlZtquZlLc6h9PPFMydwdVQVLXPp6ojo57QQWyAdJWEPHiei2i1LiRhKMou4kPV1FTJNUTUuDNEwv5n77DrjPXKyvioy3S3EVVFQto8wsJawFrXEjchvQA+paZPQ0VcP8l3R1FPLsaC5VLQ53qhqTiKYep5Y/xz1WXcUaiqF4NDVU01M+na2IRSjDgxo2Pgc+okKHBwVVwVHIpv8lPYV6NO68m7JYO6g1PTJByCQR3q58OKGS9XD5HyV8kh2a2gpmSy47zyczXOx6lXdN0lDcLrHRV9U+lZMCxkzW83K/8AJyO8d22+/uWq6G0fdtNXNlfU0cN5skkje0qaSGOthaB3uhcA9p9vIfWmhMgdbWmqs1a6nE9TPy9Y6ygfBK0+DmPBP1lVcNMweX0jfMaXDla9o29wWl8ZayyT3Ett13jnia0DsiamnEfq5JnygfqnCy2KeCKSRgkjJcxzcRyB5JPcOVmU5WTGmRVbWTyzk9oRjYFryfrTYuc45cST4kqcbp25T009yfA+moYuUSTVB5Tk9AAdyTg7DwUG8N53chJbnYnqQojXwWEUBuggFVgDvS2jZEAjSAV3IdEAggAsIYRoIASjwUeEEADHqQxsghlABFGAhlGAgAwNkY6oNRhS2AaABQSmjKkaQpgyr3w1s9U+eGup4DLX1UvyW1RY3dK7YyexucA+Jz+Sqxpu0vu1xbT83ZQNBkqJsZEUY9J33Ad5IC12hkFmswuscRp62407qS0w53pKEZa+b9J/nMB9cjvBJtJbmHfA6vRp5JqPTtokE9utnMxsrelVO7Haz+xxADfBjW+JXTHk/aJZZ7S24VUIE78O3HwHu6+1Y9wC0bJfLzFVSw/zeFw6jYnuHs711Pe6+m0zpx0zWc7mNEcMY6yyH0W+0lfLa/P/AMjI4/COpLbGii8adT0lHDNDUuDrda4xV17c/jpP6GD2udjPq37lxTqm+Vt6vNVcq+XtKmpldLI7uyT0Hq7gPALT/KB1M+a4HTkdQJnU0zp7lK05E1Y70hnvEY8wevmWK1Dy45Xq+P03pQt9sznL4PWni7eoDTjl6u9i6d4VUcVBoeghiaBvI6RwGC9xeck/ALlyab5MaelaT2ksjHSfmtyMD3rqzh4f+J9B7H/vuXoy6Jj2WAkKJrvxqlHdFE1x+dSXYSQ8oPRCduGQUzoPRT13ehjRk3Fr8U7A71mIGe5afxZ/FH2rMgnETQh7AR0Xg+PKc95ROComiOki3xheMjCM7KSezK8XxdVSlQmiOIIQTiSIjfCCqxUWO36au9ZUCEZa0bZx1V4sPDVvmvqsvPrVlswNPWuEsIbvsrbFXhpAbHj3K4ktj7RGjqKkjYBE0e5aBBaII4iGtaNvBV3T1zDWDIwrALvGGLQiiBusYp62PAwMqv6+oo6uzyxuwQ5hCmr7coHztydweqrms7pFHaXuDvyVDfBSjycvWnTkNHq6SGUAx9oeXI6brZKHS1uqKNo7Nh2WS194jkv8kjH+jId1pek7099O0c+dlxbnJ8ndKCjFNFn05YKS2z8zA1u/cFcHyQ9hy8wVFfcZgdiUH3OrcMAldOOLo45SVlmnghlJyQUmlt8DX5GAqyy4VmehUlbairkcM5wVfpu+xblRTNbzGlvk72HHJWTYx+kFTtV0LGysuVK0Cnn3IHRru8fePUVZ+IDj+FKjPU1U2f2goW2TRTRyWyrdiCf0XH8h/cf9+4lKSGiv0M4a7BJ5Tsd101wA12JQ2mrpxiZzYqrJ2bNjDJvY8DB/OBXL9bTzUFc+mmbyvY7BVi0Ve32m6R1Ia6SPBZPEDjtYz1b7dgR4EBeN5LSerHfHtG2KfNM6/wCMWj4tR2KSaNg+URtznHh0P+/cuONY2QsNTQVcRG5Y4HqD4rtHhZqeG/WRlJLUNqJ4omuZIR/nEJ9F/t7nDuIWV+ULoMxvdd6GLzHDL8Du/wAPsXj6PU+hNP4ff4Zq1ao4judFLTVD6WRvz0O7D/WMTFpyAVpWr7I6rgc6MctVDvGfH1FZzUMw4yBpbviRuPRcvqcclJWjnaPMoijzlF3LVMlhIIIK7EAKw8PbnS2fWVquNYPmIJwXn6Ocjm9xVfbuVeuBukmay4j22zTU4npnvzMx2eVwJwAce3PuQBuHEjU0VdcX362Pjjq6podUsa7mgqdgOY49F/5zc57wszuGqbXE4/hikuFO57OeNrCwiQZxkOd1Gx3GVZPKDilp9Z3aqstQwWyirPwdBE9gy/sWNMjuYY5sEgecCTkbrn693evvNc6uudQ+eZwwC47NaOjQBsAPAKckb4BFo1PrQVUPyO3QNpqbmyWtPM6Q+L3Hr7OnqVKlkdK8ueGjuAAwAEQSsJxW1UAhGOqVhFhMBTXEEEEgjvHctI0DxAntr+yqX55wGyNJwJB4jwcs3ajHgk+QN+qb1BdmB9PVQTNIzyTOaHD3P+5Q9TLS07XSV1wpKCEdeRzHSEeDWM3J9uB61j7KiojbysnkaPDK8ppJZPxkrne0qHCT+R2ixa41K26ubQ25j4bdAT2bXOy55PV7z3uPwA2CqwSuXHRDlwqjFRVIQSUBsgGo1QAAwgjARgYQAEEEEwAh3oBBIAIII8IAJKACLdKKAAiRoYSYAalDqiASsbqQAB4L2gjdI9rGNc5ziA0NG5J6BIY09MK/8PNP1hqKSopoBLd693LbInHAjG/NUvJ2a1oB5SemHO6AI7GyyaM03R0tLNTXFzmUFCG1F9njOHSSZ+ao4z9InI9vO7oxSttpbhq7VQkdEwS1D2tZHGMRwxtAayNo7mNaAB6h7V5XOWlfDS6cscpmtlE8uM+CDW1BGH1B9RxysB6MA73OXRfk+cP2UVIy7V8PzrgDhw3A6ge/qfUvI8nrPTjsh2zbFD5ZonC7S8GmtPQxNYGvLBuepHeT7VnPGjiAygo5r1TytIge+kszT/ST4+cqMd7WA7fnEetX/ihf2UdC6zw1TaV8sLpaypJ2paZo8959ZGwHfn1hcVcUtXu1LfXTQNdBbqZgp6CnJ/FQtO2fzicucfErzPHaZznufS/7ZcpVyVS51bp6h73vLiTkuJySfEppCWMD6mb8VEMkfSPcPikDmkeA3qSml3qA5zaWI/NxdSPyn9/w6L6aCpHO3Z4Me6avbO85c+QE/HouuuHbv+J9B7H/AL7lyLS/joz+cPtXZXDe1VEnD61Vcbch7HnH/wAxyWRpVZeNWSX5KiK38Ypp7HMJa5pB71EVzR2qlMqSHVv9BPD0OfBNKAeYnhHXKYIybiz+LP6SzMYWncWR82e7zlmWCAnETCwERARobp2ITy5SXNXs0esIEIsBlJHlBOXtzsgnuRNHTVVb6U1+cAHKefI6VpHT4qHuM8rbgSzfdRt0udYx3mtcFolyQ2aDQQwcoDXD4p1NAwNOH/WqBY7rVvIDwVPyXCXsTv3Lb4M7InVTzHNhsmN1WdSufPaXsc/ILUrVFZM+q6nqoe61UnyEgnuWb/BSZk9Rpx8dVLM3m3cSpTSl6+R1App3YLTgKbdO0sc1wBJVYntJqLh2jCQc9yxWO2berUaNgsc1PXMacg571ZYLdByZwCs40m2ppGNbnICuMdyqA3GFuscjHeibbb6cEbBSNHT08eMAbKrMuFQSNk7irak95TUJfcW+JnvE0tbf6sDp8rmx+0FUS7fPQhWLiFI511lLieYzzE/tBVYuOd06CyXuELb1aRUNx8tpW4eB+WzuPu+z2KBpnmN+OhBT+31klHVNqIz0PnD6Q8Eq/wBExvLcKQfzabfA/JPgsZxLTND4P6wqLRdKelEwYRJzUjnHDQ93pRH8x/1Owe8rquCS3av00JGYMUzSC1w3ieNi0jxB2K4GpJ+XbK6E4FcRH08phr5i4YArM9Xt6CcDxGwf7j44+Y8lo/Tk8iX0vs6cc9yr5KVxg0RPp+7SlsJED3HG2zT4fwWDaxs7o5X3CnjyMHt48bOHj/H4r6La/wBNUWqrC9oa2SQx5jc38sdRg/WFx3r3TNTZLlNSzxuABJa4jYhbeO1m3/FN/oJx3K0c+SsEbgWkujd6LsfUfWiwrFqizfIZ3TQsc6jld840f0bvEer/ANFXpWuif2byD3tcOjh4r34uznYlDKCBCpBQB0XS3kW0tPaf5Q62rGNEVroppw53TzGbD4l3wXNQB7gt+0ff6CweTlUW1svZ1t7qGQyte0szTtcXyEOI5SD6OxO+ypOxM8+J9LO3RlI+oz8pFA6rqSepnqXmZ5PucwfqrnUdAukrvc5+Imlr/XWNtNFDRFjK75TntGl+zQyMdwxguJwOmCucZ4ZIJ3wyN5XxuLHD1gpvsSEjuS0lqWOiBhYQwjQQAAjwgEaAASER6II0AIIQwlIIAThGEZRIAGyCCHtQAEeEO9BAAQPRGi3wgAYRoIwgAsJR6IkPUk2AMZRgboBKCkKAAjaCg0HKnNMWN92qJHyyGnoacB9VUYzyN7gB3vd0aO/2ApDHujrJFU891uUbnW6ndyiMbOqpeoib9riOg9ZC025NqLBS1NvmLTqC4sDbo5gwKKDA5aNmPRJAHPjoAGfSR2ss07QUV6fTNhrjFjT9A7zvkcRP+eSA9Xk5LM+k7z+jWgzPC7RlXqi9M7QSOiD+aZ5y4uyfHvcSuXV6mGnx2y8cdzLVwB4eyXm5R3GqhzTxuy0EbOPj7AuoLxX0WltPmQsL+QckMTfSmkPQD1krz01aaDS9gDD2cEcMeZHdzGgeKxLjZxHdbqYXSJ5ZcKljmWWA9aeLo6rcPpHcM9e/5O/y+NT1OW/l/wDSN21/Rn/lA6zmdJUaeiqhLVzSiW8zNOQZR6NO0/Rj7/F36KwaokLndeqdXCqdPI5znOcSckk5JPj7U1byRxvqJfQZ0HifBfU4MKxxUUYSlZ51Mwo6bY/PyjzfzR3n7gokdQlzzPnmdLIcuPd3AeASWjJC6USe9L+NZ+kPtXffBMRycLbE1wGexf8A6xy4Hph84zA/KH2rvDgrn/gxsbmn+if/AKxy5tT0jXB2WW62OGoBcGAHuICo1+slTSyF4YXsHeButNin5dnhKmp4KphBA38VzRm4m8opmTUWwxjGE8PQq2XTTUbiXwjld4hVyrop6UlsrD7cLpjkUjJxaMf4st+ZP6QWZY9S1Tiu3NOf0ll5atIsg8iN0Mbr05UOUphR5o8JRafWhhKxoThBLQSA3OS705qSHObse8rwuF0o3Dd7PiszvFVILkSyR2PUU3lqZHdXu+K2WN32ZbrNVtl0pWnAeFJzXWn7L0wsotczwR57vipk1Luz9M/FaKHBm5ElfLjA6QnIJyoO41PaQENTOqkL5Op6r0LcwkFChQbiC5HmcjHerJp+xOnIcT19SjI4fn84Vw0/U9gGjlWm1pcC3J9kzbdOFoaclTEOnxyjKOhugwByqTiuBI6IW8X0jSKxRtPTKfR2eEN9FGK0+CW2sJb1SamNbTCeKLRDqOrYOjaqcD9oKpc3RWvio7n1HUv+lVT/ALwVP5uiAPbmCf2iuij56Ory6lm2d+YfEKLJ2SScpNWCHV2opLfVcvpRu3Y8dCE8sVznoauKrpZezmidzMdjPqwR3gjII7wcIW6pirKb8GVrgM/iJD+SfD2KPlhlo6l0ErS17Thc+XEppxl0ap1yjrXgjxApquigt9VIGU0jhHFzOz8mlP8AREn8k9WH3eKsHGHQlNqO0y1MMWKlrS44G/t/iO9ckaTv1TZ68TxgSxvbyTQudhsrOvL6j3g9x38V1lwi15TXqhp7fU1Rlc9uKSd+zpQOsb/CRveO8bhfJ6vTS006+Ph/Y6Yy3K0cj6rsU1BVz0VVDgjLXNcNiP4FZbqCzfIJC1wcaN7vMk6mF3gfV9vtC764zcNqe80slxoImsmaCSAOn+B+pcp6msk1HUzUlZT5xlr43jYjwK9bQa5ZFsn2jOcPlGKSsfDKYpMBw7+4jxHqRKx6hsfyPcc76PPzcnV8BP5J8R9vt2VeljfDJ2cowcZB7nDxBXsWZAZtut7urmQ8ANL21r/mXUk9U9odgFz3Dr8FgYOFq+k6duqeGApzV1D7jYnuigY+UlsURJexzWYx1Lhk5Ox6dE4iZA+T3drhSaprbHSSUbG32gkpX/K+bs+Zo52nDdy8cp5egyVVNcUM1DqCYTyCR8vnlwZyA7kdO7orBU2uawVFu1bZXyTx0tQHyiQ+fHI124d7dwVBa3v41Fd3VraNtI3LsMD+Y7nO5wP9ynutE0QDUoIgEoAYSTGBAIBAdVYBhKCLCA6IAPCJH1QCACwh7kZCGfUgAiEkpYQQAhH1R4QwfUgAuiM79yPHiiKADARepGggABBBGEm6AIlGiwlDp0UhQAEoAlBje8qY07ZKm71TmMLYYIm89RUSehC3xPj6h1J2SGFpyzVF3qzHG5sUETeeoqJPQhZndzvsA6k7BatZ6G2W2y01zrKT/JTHONpt0uzrlKNnVE+P6IEYPjjkbsHFJtFqttvstPX11M9lkDy6goHO5ZrtKNjLIRu2IHYn9Vu5JD20UF51jqMSSDt6mbDQGtDWRsAw1rWjZjGjYAbALHPmjgjukyoxcnwe2lrJd9ZamdNM99RU1EnPNK4dPXtsABgADYAABdicMtG0Wl7NCxkQEvLnJG+cdT6z9QUZwi0BRaZtMcr4w6d+HFxG7j3H2eA96LifrCmpqOsooq4UlFTMzc65u/ZtOwiZ9KR3TA/jj5TNmnqct/6R00oqkQvF7XNup7dUTVMnNZKKTkMbHYdcagbiFp+gOrj3D3LjzW2o7hqO9VN1uMofUTuyeUYa0DZrWjua0YAHgFMcT9ZT6muoexnya30zTFQ0gdkQx5zv4uJ3c7vPqAVIIdI4dSV7+i0iwx57fZhOViY2GR+5AA3JPQKOuNWKiTkj2hZ6PrPeV7XapDGmjicP7Vw8fo/xUYCvSSMxfU4XpGDkJDOq94wMetUkI94QA9n6QXbfBivEXD+zxE+jG/8AfcuJY8c7faF11wwlLdEWvB6Md3/nuXPqY2kbYXTNjhmjmb1XoOdhy3cKoW65OjcA52ysturo5mjJ3XG4tHUS1NUNcAHpNdboKqIgtBz6l5cjT5zSvWKZ7Dhx2SXAmZbr3hoLuHdlK+IddhlZbc+FdTST8rqpxB6HlC6u54pGHmA6LPeItRFRsbIGgnm8FnkyZIq0y4Ri3TRhrOGczt/lT/2Qjdwwn/6W74BaBFqCFvVq9Hahp8egPiuf/k5fudPoQ+xnX/BhP/0t/wAAgOF85/8Aan/shaINQw/QHxRjUUX0Ql/ycv3D0IfYzv8A4Lpv+lP+AQWi/wAoYT+S1BP/AJOX7h6EPsYIYppZud4K9vkr3HotM/kcz6I+C9odIRZBcz6l9EskUeJsZntDTluOqkDGeTvWgQ6WhaAAwfBe7dMxdOQfBUssRemzMHwEvzyr3jicW45T8FpH8moc7sHwTmHTtO0Y5B8E/VihemzMYKR7pB8274KettJJkYjPwV3ZYqcfkD4J5DbYWDoPgmsyF6ZX6GmcMZZhTEMOAMhSDaaNo2CU6IAbLROzNxojnt22Xg9xAIUhJFv0XmKMvPQpt0FGD8THH8OS5/6RP+8FUC4Zzgq4cV2GLUdTHv5tTOP74VOJWT7NPgPPgEWd+qSEGHzuiGB6Ncc+vxUvDM2707aaZwbXRtxE8/0jfon1qEDtsd6HMRgtyCDkEdxUMpMeM543uY9pa5pwQVatFakmstZk9pJTSOaZ4muw7I9F7D3Pb3Hv6FV6KZt1j5XYbXsHsEzR968o3ljsHII6rl1Gnjmg4yRpGW12jtzhlremv9FDR1dRHLUvj5oJwMNqmd5A7njo5vUFVvjLwxprvTPuNujDJWgkgd3+H2LnXQuqJrLUtje6R1I94e5rDh8bx0kjPc4fBw2PcR1hw51xS32kp6OtqIn1MjMwzN9Cqb4jwd4tO+V8nnwT009r/pnSnatHGuo7NUUFVLTVMHK4Za9jm5BHeCO8LN9SWcUwLo2vfR5zyjd8B8Qe9v8AufFd58XuGNJfKaSut8YZO0E4aOn8R9i5Z1Pp2ptlXJTVUJa5pIII2I/gvZ0PkFP6J8MynDi0YZMwxOAcQWndrh0IVg0BqOTTOoY60gvpJW9jVxj8uM9/tB3Hs9ae6h0+acOlpIg+I7vh8PW1VSaIsaXsJdHnGe8eoheupGVF2umsKOiv10Fqp4qy110eJIpAWhzj+V6iPEd3sWfzAOkcWsDWkkhoOcDwXqOqQ4b7hNIDyx6kYSiPBBUJicZR9EOiAAViDQwgjQKwkEEEDAggggAIBBHhABIIyiQAEEEOqVgBBGBlDCVgEAlYQASgPUUhoSAlgI2s7la9OaZbLHDX3YSx00h+Yp4x89VHO3KO5udubv7gUuwI/TdhluZdUzP+S2+E/PVDhkZ+i0flPPcPecBapQ2222e1UtVd6Hs6Jw7W22UuIkrCdhUVDhuIz3dC7o3Ay5eskFNpsROulLTTXiIYpLOGg01tHUOnH5cnf2Z793n8le2mNP3nV99dLI6arqah/PPPKSST3ucfu9wWGfUQwQuRUYOQi1W286xv/aSc1RUzYbkNDWRsGwa0DZrGjYAbALq3hDw3otOW2Oeoia+d4DnFw9I+Ps9XevfhVw3oNM0DJZo2vnIDnFw3cfX6vAfFSOvNYRULKm32+qhhlhYX1tbI75qij73E97vAdc+vZfL6jPPVz56+F9zoVR4QjiDq1lCyot1BVRU74oi+urXn5ujj7yT9I9AOuSO9cf8AFXXJ1DUsoLcJYLNSPJp4nnz5XnYzSeL3eH5I2HeU74qa+N8f+CbU6aGzwyc4D/xlVJ/XS+vwb+SPXkrM5Hl7l7Gh0XpLdL3f/DOc/sIlJe7dNLhVijYYIj/OHDzj9AH7/sXrXVjaNnKzDqhwy0dzfWfuCgnlzi5ziS4nJJ6kr1oqjIQN0po85ABejG960SFYbG969mAE9ETQEoDByExHs0YIx4rqnhs5/wDIu2cuccjv33LlVpHm+0LrbhREx+gbU4gZLH/vuWOZF4+ycZJIOpT+hrZ43A5OMouwZ4I2xgdAudxs3Uiz2u6ucAHlTcc7JWqjQucwhSNHXuYQM7LJwo0UrLQ972g8pVC1zDJWjs8E4Kt8NY2SPcj4qGubI3ylxHestt9lJ0ZjPZpATgJnNa6gdxK0mWlhI6AqNqoIwTsPgk8aNI5GUL5BUA9CjFDP4FWuVkQPckNEPfj4KHBfYtSZWW0FR0wgrU3sR3tQU7EG5jw1cfc1GKludmpyLbGvRtvjA6FexSPNtjQVQ+ivRtQcdPqTltDH4FL+SxNHop8BYxNSfAfBebqtw7k/kihaOiY1JiaDsE0iWxHy05xlLFUCc5UXPMznwACvakw8hbxgYymSsLy8p01pcvOiizgBTFNTAgeatbSRn2RZgJOcL2ji5R0Uv8nb4I/k4x0WE52aqJy1xkONXVox/wC1zj+8FR85V742t5daXAD/AKbUfvBUPv8AcgTDJ6ImncpOQd0XMN0wFflAoZwEhpOxRZygEegcQeYEtcDkEdQpOnqBccteWsrWj2CYer1qHcUOoBGQRu0g9CpaKTJmN5jfg5BGytej9VT2efkdzy0j3B0kQfykOHSRh/JePHv6HuxTqSrbWkRTlrasDzXnZsv+KXlzH4OxB3BXHqNPHNHbJGkJuLs7R4acRaS7UlPS3CrbKZPMp6w+aJD9CQfkSe3Y9yccS+HNv1LSSSwRNZUYzgDv9X8FyJpnUNVaKoyQlr434bNC/dko8HD7CNwumOFnE+mqqNlPWzvmpGAAvkOZqXwEn0mdwePevl9RpZ6Z89fDOhNS5Rz1rnR1wsNY+GpgcGgnleBscLM79p5s7nT0gEVR3jo1/qK+iGq9L2fVdtPaMheZGZbKMEOHduPtC5l4n8LLjYZpJaaF8lP16ZIH3j1r0NL5FxqGX/ZMoJ8o5VqaGSOV7OyMUrTvE7b4Jmdzg7EbEHuWq3yyw1LDHUxYc30Xt2c1Ue8WmopHfzlvaQjZtQwbj2r24ZFJWjBpogCERCcTwvjHNs9h6Pb0/wAF49y1TEIwgAlEIdVSYqCSSlIiMp9gEgggmAEYRIIAPoh3IkEABBHjKGAk2ASMI8eGEYU2AAgjwlNBKQxIGe5OKOlnqqhlPTQvmlkOGsY3JJUnZrDUVsXyuoe2joQcGokGzvUwdXn2e8haJp7TcEFsZW1Uj7DZpm4FQ9ofXXEd7YmfR9ezB3lx2QBDaO0lI+4NpoKWO63UAvdHzD5LSNHV8rz5px3knkHeSri+vp7JK8WSr/CN5ky2ovJBxH3FtMDuBjbtTg/RDRuW1ZXyVdGLNZaFtrs/MD8lY7mfO4dHzybGR3q2aO4Bafwm4SVt5niqrjA+On2cGdC4eJPcPrXBq9fDBHjs0hjb7Klw44d3LU1YxzY3tg5/PkIJ3Ph4n/crrLh5oS2aWoGNZAztgM7jOD4nxP2KXsFktWmbYAxsMLImedIQGtYO/HgFQOJHEKkZaZJnVctBZclnbM2qK5w6shB6N8XHYd/gfnck8mpnb5f2N7SVImdea5p6amqoKCvipKamGK65O3ZAPoM+nIegA/8ATk/idr+S/O/BltbJSWaF/PHC52ZJ3/1sx/Kee4dG9B3kseIOt63Uc7YgxlHbacn5LRRE8kWfyj9J573Hc+obKjvcXknK9rR6JYvqlyzGUrBI8vf1KaV1UyjaAAHzuGWtI2aPE/wQr6xlLmJmHVHh1DPb6/V8VCuJc4ucS5zjkkncletGNGYTy573Pe4ue45cSdyUnqlYSg0+CtEiWNJwvVrdkpje9egbgbKgENCV3owMDCMBMTYGjce1dacJZmDh/agT0Y//AFjlya0EEE+IXTPDt8rdF21rM4DH/vuWWUvGaN8oj+kERqI/EKsc9SfFSlooayoeJJmuZEN9+rvYsas1snZQI6eKY9JPqXl8qYO8J1NC6opzE7LQeh8FBVlNVU7uSRpx3OHQocR2S0d1bGPSTSquzHHPOoCqZMT1KYyQ1BOQSstisvcyzG6Mx6SbT17XA7/WoFtNUnvKV8kqO/KNgbmOaqoB3BUXU1b2k4JT1tHKdjlCS1OeN2kpOCKUyElucrfyign81lJ6tPwQU+mh+oaSAUYyvJ1dAD6QSRXQ9zgu7azlscdF5SPwOq8zWwn8oJvNUNPQ5VRg2Q5UedZNyglQlbM52QCpCpfzJg9ocd10xgkYudjSOMueM5U3backApvSQDm6BT1viAxsE5OhRVj6204GCQpqKMBqaUYAGMJ/Gsm7LSE4AQOMFHIQ3qvB8nVZtGiOV+OR/wCOtwx/02o/eCoBJV/44HOsq4+NbUH+8FnziVRDCOwyCk5JR5JbhJ96YqACcYSuZJG4QSGkGSiBOUESLGkE7BPU7KRpLg2Xlp61/LJsI5z0d6n/AMVHd/UInNDgQQDnqFLQyccHxP5XAg/apOz3Wpt9VHU0074ZYzlr2nB/xHiOhVboq50DBBUtdLTD0XDd8fs8R6lIOaOQSxvEkTvRe3of8fUsMmKM1TXBalR0Nwl4qS00jKV5Zl586kc7ljkPjET6Dvzeh7vBb1QV1l1XayYnNmZ0kjeMSRHwI6grgWCdzCMFaNoXiLcLTVwvnqZuZg5WVLDmRo+i4HaRvqO/gV85q/HzxW8auP2N4yUuzUuKvBuORktwtDQO8tA2PtHd9nsXPOoNP1dsqZKeqp3McNi1w2I+8LsjRHEW23qnhZXSQwySDlZMx2YZT4An0Xfmu3Xvrbh9ZNSUzswRxykZBAwPdjp7lhptVPD7eV9vlFNX7j573XTrC90tA4QSHrE70Hfw+xVWvoXQzGKaI0s30Xeg71grqPiJwnutknkkhp3zQgk5DcnH3+0LKbvaA5roKmnD2/RcOns8Pcvf0+tx5lw+TGUGjJJY3xO5ZGlp9fekkbK4XPTksQPyJwlj6mCU7+4/7lVyoouSQsAfDIOscux9xXapIzaGOCEClyMdG7lkaWn1pOPcrTFQj3o0MepDCdhQWEAgjwiwoLCGEeEYRYUFhHsjwj5VAUJwlYTqgoaqtmEVJBJM/wAGDOPWfAesqx2jTDX1kdM9styrHnDKOh88k+tw/wBnPtCYyvWy3Vlxm7KjgdIQMuPRrB4uJ2A9quOltKGqqjBQUovFZGOeR582jph9J73YBA8XEN9qsUVkt9uhbHf6lj3MOW2a2PADT/bTDLWnxA53/op3JPcbrAy3wwxUdua7MdDSMLIQe5xG5e785xJUZMkMauTGk30HGLRapRI18eo7y0YFTKw/Iab1RRkDtceLgGeDXdU9tVivmqryZZPlFdVy455ZDnAHTJ6ADuA2Hcr/AMN+EF0u8sc1ZE6nhOCW488j7B710no/Q9m05RMjhp4i5u/TbPifE+srwtV5VzuOI2jjUeWZpwp4NU1CyKvuwEkuxGW7D9EHr7T8FrVzuNm0tag+ZzYWdI42DMkrvADqSoTVmu6WhbPTWgwVM8IzNUSPDaamHi9/T3LnHiFxXkFVMLJWSVlwflsl2lbgtH0adh9Bv5xGfABedg0+XUStf7//AApuuy/8V+JUVICLwO0n2dT2RkmAzwfUuHT1MG59XVc56w1Tc9RXJ9dcqkyyY5WNA5WRsHRjGjZrR4BQ1bWzVMr5JZHPe8lznOOSSepJ7ymj3Nax0kr2sY0Zc5xwAvodNo4YVSMpSsJxMjsb5J6KOrq9sWYaVwdJ0dIDkN9nifWvKtr5Jw6ODMUJ2JOz3j7gmPL4bBd6VGYjG+dyfX3o8ZR8pyvRrOioBDW7r0DfUlNaO5egCpIkS1uEeMhKd06I8KkJicIEd4R4QCZIZHTfqusOFEEcugbU4jJLH/vuXKDu71FdY8JM/wDB9acfQf8AvuWGU1x9lrgjZBJzsYwkfSGVNUVRBUYaRySeHioQk5KDHOa4OacEHIKzTo1LOGMHcAPFMK6ri5THCxru4lwyEmrqzJQxtaQHPHne5MMY70NgkR1XDkl2BvvgBNA1oO4wpabBBzhMpImk7EKKKPJvIO4L0a1h7gvMx47sJbPNQMUYwO5KYWg4ISo3tPVehbGe8JUAQZG8dEEYLWjqEEUBCTwVIO73JuWTg7yO+KeyTueeiS0F7t16yR5zYUAlPV7k/ha/AQp4Rtsn8UIATENewLuoRto91IcoAXlI4jKBoOlpGtIyVK0sUbe8KBdUvaV701ZISNys3Fsvei0Qco8E8Y5oHUKApp3nvKeNkdy9TlLYLeh3USM+kExqKmNoJ5l4zOcUwnjkcDsUnDgrec7canc+q6twPWsqD/eCoDhnZX3i+0jUlQD3VdR+8FRnDf1KaoDxAOEOX1r2x5u+6LlHUIGmeQB32QLV7hgRchUso8SDhFy+pOOUd6GBhTYDflz3IYK9g0ZSS3BQ2B54KVTzT0jy+nILT6UTvRd/A+tKwiI22QwJClmhrATTlzZW+nC/0h7PEL3ilczooZ8YJa4Etc30XNOCE8p7h0jr9j0E7Rsf0h96lxsaZatOajrrTUF9NMA12BJG4ZZIPBw7/tW68NuLvI2KjlkBHT5LUSdP9FIf3Xe4lc2Oa5mHAhzTu1zTkH2JcU7mkecV5er8bDL9UeGaxyVwzvu1XeyampDEwskcB85TytxIz2g7+8Kh8QOD1rvMck9AwRznJ22P8D9q510lr+6WmWFs0klTDGRyHnLZY/0X9fccj1LoDQHF+muETIax5qtty0Bs7fa3o/2t+C8HLgy4JfWq/KNlyriYHrThveLHPJ2tM58bScva0nHt8Fn91tDJWGOpgDwOnMNx7D3L6DRPsOpqHnjdBWR4wSPSb6j3j3rM9d8FaC5CSothEchGQAMH4dD9S69P5GeNfXyvuiXFM4euGnZmNPyR4mZ/UzbH3H/0VdqqHspHMeySmlH5EjTj4rovV/Da+WWR4lpHSRtPpsafrHUKhXC0nlMVRA2RnTlkbke7w9y9rBrMeVfSzOWNoyaWGSL02EDuI3B968yFeK3TUfMXUcz6cnqyTLmfHqPgVAXG0VNMSaikexvdLF5zD932LqjIzaIUg52QAKcupJNzERKPzevwXnFBNLIImQyOkO3KGkn4K7sDzwjAz3KbptO1IAfXzQ0TO8SO5n/sjf44VpsOjppqYVlHanPph1uFze2CmHs5sB3sHMfUkBSbdaq6uyaanc5g9KQ+axvtcdlYLJpltVWMpIoam8VrtxTUbHEe9wGcesAD1q5CgstOQbhV1V/maPNhps0tIw/pEc7h+i1ntTs1Vzq6Y0FKyKgoHdaOij7KJ36ePOefW8uUTywhzJjSbGUVjpKCPsL3XxRNac/gu0lr3Z8JJd2NPvefUnoqqqSmdQWmkitVC8YfDS55pR/aSnz5PYSB6lbdFcLr3e5I+SldDE7GHPaRkeodSt80HwXtdp7OouLRNK3fzhk/DoPrXk6jy0Yvbj5ZqsVcyMC0JwxvV9mj5KV0ULiMPe3r7B3rorh/witFhYyeqYJJ8ZLnYLv4N92/rV9mksmmqLtJZIKOID0nHd3qHefYFn+uOJzKKjdJHOy0UjvRqJ28083+ji6+8/UvGy5MuolUnb+yNF+C93a8WTTNI1kzmROd+Kp4hmSQ+odT7VknEzifHTMkgudS6jjI8210jwamQd3bP6RtPh19RWP6v4qVk754rE2WjEuRLWzP56uX9b8gepu/rWY1VXLNI573ucXEkkk5J8T4r0dN4xvnJ/ohyros+t9cXPUPLTvMdLQRnMNFBlsTPWe97vznb+GFTZpC8kk5RvOxc4gAdSTsFFVVyLsx0AB7jO4bD9Ed/tXt48agqRk3Y5rKmGkA7XLpHejG30nfwHrUTUyzVTg6cjDd2Rt9Fv8AE+tJawNJdkue7dz3HJd7Sjxla0IQQfBFgnp0XoQUrlPXCpCZ5tZ7ksN9SWBsjATATjHcglY3QwnZIQGdkMblKCCaYmJxsUY6JWMoiMBWSF3hdT8KqpsegrW0kAhj/wB9y5ZAyFuejbo+DTVHC3OGB37xWU47ui4OjV3V8eT5yDa6MkecFQW3WQ7pTbnNnr9aj02ab0aEK1gGxCN1cwj0gqG26zY6on3OcN2clsGpItlbcWMJw8Jkby1p3cqTcbrPk7qFnutQSd0ljDeaa+9RH8oLwfe4x1kCzL8K1GccyUK6Z/V5VrDZLyGiSagjb/SJP8pWDbnCzp8srvyykF8ne4prCHqM0h2poyMdoPigs0L5c7OKCPQF6jNpEa9oWeclGM5yE5pIXOIyF3HKh1RxF2NlKU9I5w6FHb6fYHCmYIsDoocilEjRbz1KTJbsgqa5Xdy83gnOVDkylFEC61tzuF6wW1oI2Uk4bpcTTnoo3uy9iPOChDQnIpRjovePovXOE9zJcUR0tK0FN3QN32Ck5TkprJ3pNlKJy3xoaBqusHhW1H7wVDLStC41NzqusP8A79U/vBULkUoKPFre4oBuDlepb4IAJthR54CGF6EFGQPBRbKPHlQIxsCF6kbJJb6kBR5liQ4AhezgfBebgQAkhUeZCSvQhJcNkwoT70MZ6oEboBAAp5Z6Rx+TuBjPpRP3af4J5BU09U7lYexl74nnGfYe9NOi8ZY2u2LQR3JATDS5jsHIITykrJIXh7JHMcDkOBwQoGnrZqcBkv8AOIvBxw9vsPf70/gmhqcmnfzEdWO2ePd3+5ZzxqSplJmnaU4lXK21DH1T5ZS3AFRE/kmaPWejh6nZ9q3fRHF2juMbI6mVlYMenEOSZv6UZ6+1pXIDJC3r1TmnrZIXh8by1wOQ4HBC8bUeKi3uxumbLLfEjvenqbDqSl5oZKesbjcD02e0dQqPrPg/Zbwx8tI1sUp6YHKfiNj71zvpriJdKCVhnkdUcvoyB5bM32PG/wAcraNE8ZG1IZDUVEdV3GOciKb3O9F3vwV5GXBlwu5r+0aLnpmYaw4PXy1yOMNP27B0wMO/gfcs3uVkrKGVzJIZIng4ILcH3hdzWvVdgu7RA6dkMrv6CqbyOPszsfcU21DoPT97Ye2pWNcem2R/Ee5b4fIZYdPcv+yXFPs+f1xsdFO4ulpAyT+sh8x3w6H4L2sVio4e1NXe62KA4Aigp+aWT1ZLg0e059i6g1hwKd58trdkdQ0ecP4/aqBFwnvrq75MYGjfBOfu6r0YeXx19XDF6V9Gb0z6C3yB1msdPFKPRqq3FVPnxHMOzafYz3p5Db7xfq1slTJVV1Qdg6RxkcPUPAeoLoTSfAuINZJdMnvPN5o+HX7Fqtg0PYbLE0Q0sbi0fRAH+/tK58vlZz/jQLHFdnNejeDN6ukjH1EXyeM9cjLvh0HvW2aN4QWOzBstQxsko3y4Bx/gPcrhdNVWG0D5OJmzTDpBTN53D242HvWda14riia5kldT2tv9VF89UkfY1efKWTPKm239l0Xf24NNqqqx6cpOaeWno2Y2B9N/sHUqjaw4nxUNK6SB8Nrpz0qKz8Y/9CIbk+1YBqjinVTTSG0RGGR3WqqT2s7vYTs33ZWcXS61twqX1FXVTVEzvSkkeXOPvK7sHjJz9/C+yJckahq/izLNO+S0iWWpOxr63D5B+gz0We/PsWXXe7VtyqpKqsqZaid/pSSPLnH3lMHOJKa1lbT0oxK/Lz0jZu4+5e1h0mPEqijOUrPZ2SfuTGtr6emcYwTNP/Vs7vae5Mamtq6nLc/Joj1aw+efae73LwjY1gw0AD1LqqiA6mWarw6peOQHaJnoD2+KT3bDCUWk9/ej5U6sBOEGhLx6kYGO5NIBIacocuEvCGExCcIHolYQx4oAThDolgIEepBIkDp1R4S90MFACMIFqXhDGVe4VCA3ce1azpkn8D0/sd9pWVBvnBatpjazU5/S/eKUeWMmGE4CWHEdyQ14xvhHztVMD1bIQlGR3KvHnb4o+0apoYyrnZKjJGA5UlVuaXJoWNJ6qkJjNzMbpGSDsnr4wQvB0WO5UQHGS4dUpzTjdeHaFnRGasY8SgA3cyC8nVGe5BAHRDYAT0T+ihAI2Xuym3T+mga1U5CjE9KSPGNk/YNtgk08e+yeMjwNypspo8g0kLymaAMd6cvPLsvCQZykwQ0LcbpTNiluaElrd+qVFWOIiMJfOAF5tbtjKDm+b1QB5yyZPReD9wV7PaF4vHVIZzPxnaDqmsP/AL9U/vBUIhX/AIy/86Kv/r1R+8FQyCoA8i0eCAblehaUMbdEWMTy7dyIt8EsBHgYCQUeRb4pJbgYXqQid0OEWB4kYwvNw3Xs70QvIhAHm8YSXDovQ+vqkOTASUWEspI6IEEQiIwEZzlDO6QmebmbE4XjKwHDsEEdCDghOXdCi5QWoAEFwnjAbOPlLPE4Eg9h7/entPNDUDFPKHO743ea8e7v9yjHsOdgvJzWu9IZx0SoaJ1khaSDkEJ1FUuaQcqAhrKuIcpc2oYPyZfSHsd1+KdQ11LI4Nc51O89Gy9Pc7os3jUuyk6LzZNY3e3tETKgTQj+hmHOz3Z6e5aZpDjDPRtZE+pnpGj8h3z0Pwd5zfcVgpc5nXIHce4+9ekdQ4d5yvNz+KxZOap/g1WV/J2npnijQ3FjTUxMlGN5aN/OB7WHzh9as7tXaYbB8pN0ph6sHn9nLjK4RpLlPTPEkE0kTh0c12MKxw8QNQR0vYitBd3SuYHPHvK86Xi80XUZWvyVuizqm/cSIKaFz6GkDYx/7RWyCGP3DqfqWT6v4usnD45LhPcT/U03zMHvPV31rD7nea2vlMtZVzTvPfI8n4Z6KNfUE95K6sXil3N2Jz+xc79r+91zXQ08rKCnO3Z0w5cj1u6lUyoqpJHFznkk9ST1Td8h3J6d5UbUXOnYS2LmncO6PoP1jsvUxaaONVFUZuVkg9xcfFM6ytgpTyyPzJ3Rs3cf4KMqKyrny10nYsP5Me3xK8WMa3PKMZ+JW9JCPWorayoJa0/JYz3NOXn39ybxxsYCWjc+kTuT7SvTdAN2VCEd6UG+CUG4SgPWgBAajwF6YCLATQmI5coyMJSI+CYCUAOqPohsgAIIH1I8fBABJQ6IgN0oIJE9eiWRsibnPRKHVA6EgHKVjKVhHj1oAQBgj2rTdOvIs8AH537xWaEfatN00AbNB+t+8VUewY/D3HvKWzJOSUYAR5DVYj3jbzBCWMgZXiyblOEt04I6pUAznaRvuvAbYXvO/ITJ8mMhAHvk+CJwyN02M4CI1CZNHsYmnrhNpacZ2C9BPv1S+1Ye9VYUNWQDG6C93SMzsgkI6lDm5TmJ7UEE2gHsMgAXu2ZBBKgYh8i8pJQBlBBFANJqgNK8W1XndUEE6Q7PeOqCWaoHvCCCKQWeMlU3PVNpaxu+6CClpDTOdeMHzmoql4PpVtR+8FRuXdBBYvssBx3oiPBBBSMGN0RAQQQigjnoEg5wcoIJiZ5vOAMJBOyCCCWeb0glBBABdSi7kEE0AkndEggmIGd90Y8EEEmMBAXm5gI2QQSJPF2Qkkg5BGR4IIIGgonSQn+bTOi/NG7T7jsnMdxcNp4M/nwn/ZP3IIIGh3T1MUwPYytf6ujh7juvUSHpnfwQQSoY1qa6mgOJZmh30W+c4+4JhPdZX5FPByD6Up3/AGQgglYDKUyTkGomfL6icNHuGyGMABqCCoAEEoxsgggA8ZSmhBBAAwjQQQAkBKwggqEEeiJBBJgEeiCCCEAY3R47soIJiDwh3IIIKDx60pnrQQSYg0aCCEAT+hPgtI07MG2iBp/O/eKCCqAmSXbD1JTZGlBBaCCdynoUgnHRBBAHlIC7vTSaJ2ThBBADd0TykmF47kEEAAxu79kbWOQQQAbmYKCCCYH/2Q==";

/* ---------- GERAÇÃO DO PDF DA PROPOSTA ----------
   Layout inspirado no modelo "Proposta de Orçamento — Monocromático Elegante":
   bloco escuro decorativo no topo, selos em pílula "Preparado por/para"
   e caixa cinza com a mensagem de abertura. */
function gerarPDFProposta(cliente, itens, totais, obs, campos){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'mm', format:'a4' });
  const pageW = 210, pageH = 297, marginX = 18, marginBottom = 24;
  let y = 22;

  function checkBreak(min){ if(y + min > pageH - marginBottom){ doc.addPage(); y = 22; } }
  function sectionTitle(title){
    checkBreak(16); y += 5;
    doc.setFont('times','bold'); doc.setFontSize(15); doc.setTextColor(20,20,20);
    doc.text(title, marginX, y); y += 2.5;
    doc.setDrawColor(190); doc.setLineWidth(0.3);
    doc.line(marginX, y, pageW - marginX, y); y += 7;
  }
  function bodyText(txt, size){
    doc.setFont('helvetica','normal'); doc.setFontSize(size || 10); doc.setTextColor(50,50,50);
    const lines = doc.splitTextToSize(txt, pageW - marginX*2);
    lines.forEach(l => { checkBreak(6); doc.text(l, marginX, y); y += 5.2; });
  }
  function pill(text, x, py, w, h){
    doc.setFillColor(255,255,255); doc.setDrawColor(25,25,25); doc.setLineWidth(0.35);
    doc.roundedRect(x, py, w, h, h/2, h/2, 'FD');
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(35,35,35);
    const linha = doc.splitTextToSize(text, w - 8)[0];
    doc.text(linha, x + 4, py + h/2 + 1.3);
  }

  const dataAtual = new Date().toLocaleDateString('pt-BR');

  /* --- Cabeçalho: logo da empresa no lugar do bloco escuro + título + selos --- */
  try{
    const logoBoxX = 140, logoBoxY = 8, logoBoxW = 52, logoBoxH = 48;
    const logoSize = Math.min(logoBoxW, logoBoxH) - 4;
    const logoX = logoBoxX + (logoBoxW - logoSize) / 2;
    const logoY = logoBoxY + (logoBoxH - logoSize) / 2;
    doc.addImage(LOGO_EMPRESA_BASE64, 'JPEG', logoX, logoY, logoSize, logoSize);
  }catch(e){
    // Se a logo falhar por algum motivo, volta ao bloco escuro original
    doc.setFillColor(42,42,42);
    doc.rect(140, 8, 52, 48, 'F');
  }

  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(120);
  doc.text('Data: ' + dataAtual, marginX, 18);

  doc.setFont('times','bold'); doc.setFontSize(27); doc.setTextColor(20,20,20);
  doc.text('Proposta de', marginX, 34);
  doc.text('Orçamento', marginX, 46);

  pill(`Preparado por: ${campos.responsavel || '—'}${campos.nomeEmpresa ? ', ' + campos.nomeEmpresa : ''}`, 82, 38, 112, 8);
  pill(`Preparado para: ${cliente.nome}`, 82, 49, 112, 8);

  /* --- Caixa cinza com a mensagem de abertura --- */
  const boxY = 64, boxH = 40;
  doc.setFillColor(242,241,238);
  doc.rect(0, boxY, pageW, boxH, 'F');

  doc.setFont('times','italic'); doc.setFontSize(11); doc.setTextColor(30,30,30);
  doc.text('Querido(a) ' + cliente.nome + ',', pageW/2, boxY + 12, {align:'center'});
  doc.setFont('helvetica','normal'); doc.setFontSize(9.3); doc.setTextColor(60,60,60);
  const introLinhas = doc.splitTextToSize('Obrigado pelo interesse em nossos serviços. Temos o prazer de compartilhar esta proposta com os detalhes do que podemos oferecer. Esperamos colaborar em breve!', 108);
  introLinhas.forEach((l, idx) => doc.text(l, pageW/2, boxY + 19 + idx*4.6, {align:'center'}));

  y = boxY + boxH + 14;

  if(campos.sobreNos){
    sectionTitle('Sobre Nós');
    bodyText(campos.sobreNos);
    y += 3;
  }

  sectionTitle('Escopo do Trabalho');
  doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(50,50,50);
  itens.forEach(i => {
    const linhas = doc.splitTextToSize('•  ' + i.nome, pageW - marginX*2);
    linhas.forEach(l => { checkBreak(6); doc.text(l, marginX, y); y += 5.5; });
  });
  y += 3;

  sectionTitle('Orçamento');
  const colX = [marginX, marginX + 92, marginX + 122, marginX + 157];
  const rightEdge = pageW - marginX;
  function tableHeader(){
    checkBreak(12);
    doc.setFont('helvetica','bold'); doc.setFontSize(9.5); doc.setTextColor(20,20,20);
    doc.text('Produto/Serviço', colX[0], y);
    doc.text('Qtd', colX[1], y);
    doc.text('Preço Unit.', colX[2], y);
    doc.text('Total', colX[3], y);
    y += 2.5;
    doc.setDrawColor(20,20,20); doc.setLineWidth(0.5);
    doc.line(marginX, y, rightEdge, y); y += 6;
  }
  tableHeader();
  doc.setFont('helvetica','normal'); doc.setFontSize(9.8); doc.setTextColor(50,50,50);
  itens.forEach(i => {
    const nomeLinhas = doc.splitTextToSize(i.nome, 86);
    const rowH = Math.max(nomeLinhas.length * 5, 5) + 2.5;
    checkBreak(rowH + 2);
    const startY = y;
    nomeLinhas.forEach((l, idx) => doc.text(l, colX[0], startY + idx*5));
    doc.text(String(i.qtd), colX[1], startY);
    doc.text(fmt(i.preco), colX[2], startY);
    doc.text(fmt(i.preco * i.qtd), colX[3], startY);
    y = startY + rowH;
    doc.setDrawColor(225); doc.setLineWidth(0.2);
    doc.line(marginX, y - 1.5, rightEdge, y - 1.5);
  });
  y += 4;

  const impostoPerc = parseFloat(campos.impostoPerc) || 0;
  const imposto = totais.subtotal * impostoPerc / 100;
  const totalFinal = totais.subtotal + imposto - totais.desconto;
  checkBreak(30);
  const totBoxX = rightEdge - 70;
  doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(60);
  doc.text('Subtotal', totBoxX, y); doc.text(fmt(totais.subtotal), rightEdge, y, {align:'right'}); y += 6;
  if(impostoPerc > 0){ doc.text(`Impostos (${impostoPerc}%)`, totBoxX, y); doc.text(fmt(imposto), rightEdge, y, {align:'right'}); y += 6; }
  if(totais.desconto > 0){ doc.text('Desconto', totBoxX, y); doc.text('-' + fmt(totais.desconto), rightEdge, y, {align:'right'}); y += 6; }
  doc.setDrawColor(20,20,20); doc.setLineWidth(0.5); doc.line(totBoxX, y, rightEdge, y); y += 6;
  doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(20,20,20);
  doc.text('Total', totBoxX, y); doc.text(fmt(totalFinal), rightEdge, y, {align:'right'}); y += 12;

  if(campos.previsaoEntrega || campos.condicoesPagamento || obs){
    sectionTitle('Detalhes Adicionais');
    if(campos.previsaoEntrega) bodyText('Previsão de entrega: ' + campos.previsaoEntrega);
    if(campos.condicoesPagamento) bodyText('Condições de pagamento: ' + campos.condicoesPagamento);
    if(obs) bodyText('Observações: ' + obs);
    y += 3;
  }

  sectionTitle('Contato');
  const contatoTxt = [campos.responsavel, campos.telefoneContato, campos.emailContato].filter(Boolean).join('  ·  ');
  bodyText(contatoTxt || '—');

  return doc;
}

async function enviarPDFWhatsApp(file, mensagem, whatsRaw){
  const numeroLimpo = digitos(whatsRaw);
  const numeroFinal = numeroLimpo.length <= 11 ? '55' + numeroLimpo : numeroLimpo;
  if(navigator.canShare && navigator.canShare({ files:[file] })){
    try{
      await navigator.share({ files:[file], text: mensagem, title:'Orçamento' });
      return true;
    }catch(e){ /* usuário cancelou ou o navegador não conseguiu compartilhar — segue para o fallback abaixo */ }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  const waUrl = `https://wa.me/${numeroFinal}?text=${encodeURIComponent(mensagem)}`;
  mostrarBannerWhats(waUrl, '📄 PDF baixado! Toque para abrir o WhatsApp e anexar o arquivo');
  return false;
}

function montarPropostaHTML(cliente, itens, desconto, camposProposta){
  const subtotal = itens.reduce((s,i) => s + i.preco * i.qtd, 0);
  const impostoPerc = parseFloat(camposProposta.impostoPerc) || 0;
  const imposto = subtotal * impostoPerc / 100;
  const total = subtotal + imposto - desconto;
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  const itensHtml = itens.map(i => `<tr><td>${i.nome}</td><td>${i.qtd}</td><td>${fmt(i.preco)}</td><td>${fmt(i.preco*i.qtd)}</td></tr>`).join('');
  const escopoHtml = itens.map(i => `<li>${i.nome}</li>`).join('');
  return `
    <div class="pp-date">Data: ${dataAtual}</div>
    <h1 class="pp-title">Proposta de<br>Orçamento</h1>
    <div class="pp-meta">
      <span>Preparado por: ${camposProposta.responsavel || '—'}${camposProposta.nomeEmpresa ? ', ' + camposProposta.nomeEmpresa : ''}</span>
      <span>Preparado para: ${cliente.nome}</span>
    </div>
    <div class="pp-intro"><p>Querido(a) ${cliente.nome},<br>Obrigado pelo interesse em nossos serviços. Temos o prazer de compartilhar esta proposta com os detalhes do que podemos oferecer. Esperamos colaborar em breve!</p></div>
    ${camposProposta.sobreNos ? `<h2>Sobre Nós</h2><p>${camposProposta.sobreNos}</p>` : ''}
    <h2>Escopo do Trabalho</h2>
    <h3>Produtos e Serviços</h3>
    <ul>${escopoHtml}</ul>
    <h2>Orçamento</h2>
    <table>
      <thead><tr><th>Produto/Serviço</th><th>Qtd</th><th>Preço Unit.</th><th>Total</th></tr></thead>
      <tbody>${itensHtml}</tbody>
    </table>
    <div class="pp-totais">
      <div><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
      ${impostoPerc > 0 ? `<div><span>Impostos (${impostoPerc}%)</span><span>${fmt(imposto)}</span></div>` : ''}
      ${desconto > 0 ? `<div><span>Desconto</span><span>-${fmt(desconto)}</span></div>` : ''}
      <div class="pp-total-final"><span>Total</span><span>${fmt(total)}</span></div>
    </div>
    <h2>Detalhes Adicionais</h2>
    ${camposProposta.previsaoEntrega ? `<p><b>Previsão de entrega:</b> ${camposProposta.previsaoEntrega}</p>` : ''}
    ${camposProposta.condicoesPagamento ? `<p><b>Condições de pagamento:</b> ${camposProposta.condicoesPagamento}</p>` : ''}
    <div class="pp-contato">
      <h3>Contato</h3>
      <p>${camposProposta.responsavel || ''} ${camposProposta.telefoneContato ? '· ' + camposProposta.telefoneContato : ''} ${camposProposta.emailContato ? '· ' + camposProposta.emailContato : ''}</p>
    </div>
  `;
}

function montarMensagem(cliente, itens, totais, obs){
  let msg = `*ORÇAMENTO — SEGURANÇA ELETRÔNICA*\n`;
  msg += `Cliente: ${cliente.nome}\n`;
  if(cliente.endereco) msg += `Endereço: ${cliente.endereco}\n`;
  msg += `\n*ITENS*\n`;
  itens.forEach(i => { msg += `• ${i.nome} (x${i.qtd}) — ${fmt(i.preco * i.qtd)}\n`; });
  msg += `\nSubtotal: ${fmt(totais.subtotal)}\n`;
  if(totais.desconto > 0) msg += `Desconto: ${fmt(totais.desconto)}\n`;
  msg += `*Total: ${fmt(totais.total)}*\n`;
  if(obs) msg += `\nObs: ${obs}\n`;
  msg += `\n_Orçamento gerado automaticamente._`;
  return msg;
}

function upsertCliente(nome, whats, endereco){
  const d = digitos(whats);
  let c = clientes.find(cl => digitos(cl.whats) === d);
  if(c){ c.nome = nome; if(endereco) c.endereco = endereco; c.ultimoOrcamento = hojeStr(); c.qtdOrcamentos = (c.qtdOrcamentos||0) + 1; }
  else{ c = { id: uid(), nome, whats, endereco, notas:'', criadoEm: hojeStr(), ultimoOrcamento: hojeStr(), qtdOrcamentos: 1 }; clientes.push(c); }
  return c;
}

async function finalizarOrcamento(){
  const nome = document.getElementById('cli-nome').value.trim();
  const whatsRaw = document.getElementById('cli-whats').value.trim();
  const endereco = document.getElementById('cli-endereco').value.trim();
  const obs = document.getElementById('observacoes').value.trim();
  if(!nome || !whatsRaw || itensOrcamento.length === 0) return;

  const gerarProposta = document.getElementById('chk-proposta').checked;

  // Se for gerar PDF, garante que a biblioteca jsPDF está carregada ANTES de
  // mexer em qualquer dado. Se o CDN falhou (rede lenta, bloqueio, ad-block),
  // avisamos o usuário em vez de travar silenciosamente.
  if(gerarProposta){
    const ok = await garantirJsPDF();
    if(!ok){
      toast('⚠️ Não consegui carregar o gerador de PDF. Verifique sua internet e recarregue a página.');
      return;
    }
  }

  const btn = document.getElementById('btn-enviar');
  const textoOriginalBtn = btn.textContent;
  btn.disabled = true;
  btn.textContent = gerarProposta ? '⏳ Gerando PDF...' : '⏳ Enviando...';

  try{
    const totais = calcularTotais();
    const cliente = { nome, whats: whatsRaw, endereco };
    const mensagem = montarMensagem(cliente, itensOrcamento, totais, obs);
    const camposProposta = gerarProposta ? coletarCamposProposta() : null;

    const registro = { id: uid(), data: new Date().toISOString(), cliente, itens: itensOrcamento.map(i => ({ nome:i.nome, preco:i.preco, qtd:i.qtd })), totais, observacoes: obs, proposta: camposProposta };
    historico.unshift(registro);
    upsertCliente(nome, whatsRaw, endereco);

    if(document.getElementById('chk-agendar').checked){
      const data = document.getElementById('ag-data').value || hojeStr();
      const hora = document.getElementById('ag-hora').value;
      const servico = document.getElementById('ag-servico').value.trim();
      agenda.push({ id: uid(), clienteNome: nome, whats: whatsRaw, data, hora, servico, categoria: null, endereco, observacao: '', status:'pendente', criadoEm: hojeStr(), lembreteEnviado:false, lembrete2hEnviado:false });
      await salvarAgenda();
    }

    await salvarHistorico();
    await salvarClientes();

    if(gerarProposta){
      const doc = gerarPDFProposta(cliente, itensOrcamento, totais, obs, camposProposta);
      const blob = doc.output('blob');
      const nomeArquivo = `Orcamento-${nome.replace(/[^\w]+/g,'-')}.pdf`;
      const file = new File([blob], nomeArquivo, { type:'application/pdf' });
      const enviouDireto = await enviarPDFWhatsApp(file, mensagem, whatsRaw);
      if(enviouDireto) toast('Compartilhamento aberto — escolha o WhatsApp do cliente');
      // se não foi direto, o botão "Abrir WhatsApp" já apareceu na tela (mostrarBannerWhats)
    }else{
      const numeroLimpo = digitos(whatsRaw);
      const numeroFinal = numeroLimpo.length <= 11 ? '55' + numeroLimpo : numeroLimpo;
      const url = `https://wa.me/${numeroFinal}?text=${encodeURIComponent(mensagem)}`;
      mostrarBannerWhats(url, '✅ Orçamento salvo! Toque para abrir o WhatsApp e enviar');
    }

    renderHistorico(); renderClientes(); renderClientDatalist(); renderCalendario(); renderAgendaDia(); renderNotifs(); renderDashboard();
    limparFormulario();
  }catch(erro){
    console.error('Erro ao finalizar orçamento:', erro);
    toast('⚠️ Deu um erro ao gerar/enviar. Veja o console (F12) ou tente novamente.');
  }finally{
    btn.disabled = false;
    btn.textContent = textoOriginalBtn;
    atualizarStatus();
  }
}

/* ---------- CARREGAMENTO DO jsPDF COM FALLBACK ----------
   Se o <script> do jsPDF no <head> falhar (CDN bloqueado, rede instável),
   tentamos carregar de um segundo CDN antes de desistir. Isso evita que
   o botão "Salvar e enviar" pareça travado sem explicação. */
let jsPDFCarregando = null;
function garantirJsPDF(){
  if(window.jspdf && window.jspdf.jsPDF) return Promise.resolve(true);
  if(jsPDFCarregando) return jsPDFCarregando;
  jsPDFCarregando = new Promise((resolve) => {
    const urls = [
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js',
      'https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js'
    ];
    let i = 0;
    function tentar(){
      if(window.jspdf && window.jspdf.jsPDF){ resolve(true); return; }
      if(i >= urls.length){ resolve(false); return; }
      const src = urls[i++];
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve(!!(window.jspdf && window.jspdf.jsPDF));
      script.onerror = tentar;
      document.head.appendChild(script);
    }
    tentar();
  });
  return jsPDFCarregando;
}

function limparFormulario(){
  document.getElementById('cli-nome').value = '';
  document.getElementById('cli-whats').value = '';
  document.getElementById('cli-endereco').value = '';
  document.getElementById('desconto').value = '';
  document.getElementById('observacoes').value = '';
  document.getElementById('chk-agendar').checked = false;
  document.getElementById('agendar-fields').style.display = 'none';
  document.getElementById('chk-proposta').checked = false;
  document.getElementById('proposta-fields').style.display = 'none';
  document.getElementById('pp-previsao').value = '';
  document.getElementById('pp-pagamento').value = '';
  document.getElementById('pp-imposto').value = '';
  itensOrcamento = [];
  renderLines(); renderResumo(); atualizarStatus(); renderCartBar();
}

/* ---------- CLIENTES / CRM ---------- */
function toggleNovoCliente(){
  const el = document.getElementById('novo-cliente-form');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}
function salvarNovoCliente(){
  const nome = document.getElementById('nc-nome').value.trim();
  const whats = document.getElementById('nc-whats').value.trim();
  const endereco = document.getElementById('nc-endereco').value.trim();
  if(!nome || !whats){ toast('Preencha nome e WhatsApp'); return; }
  clientes.push({ id: uid(), nome, whats, endereco, notas:'', criadoEm: hojeStr(), ultimoOrcamento: null, qtdOrcamentos: 0 });
  salvarClientes();
  document.getElementById('nc-nome').value = '';
  document.getElementById('nc-whats').value = '';
  document.getElementById('nc-endereco').value = '';
  document.getElementById('novo-cliente-form').style.display = 'none';
  renderClientes(); renderClientDatalist(); renderDashboard();
  toast('Cliente cadastrado');
}

/* ---------- EDITAR CLIENTE JÁ CADASTRADO ---------- */
let clienteEditandoId = null;
function editarCliente(id){
  const c = clientes.find(cl => cl.id === id);
  if(!c) return;
  clienteEditandoId = id;
  document.getElementById('ec-nome').value = c.nome;
  document.getElementById('ec-whats').value = c.whats;
  document.getElementById('ec-endereco').value = c.endereco || '';
  document.getElementById('edit-cliente-overlay').classList.add('show');
  setTimeout(() => document.getElementById('ec-nome').focus(), 50);
}
function fecharEditarCliente(){
  document.getElementById('edit-cliente-overlay').classList.remove('show');
  clienteEditandoId = null;
}
async function salvarEdicaoCliente(){
  if(!clienteEditandoId) return;
  const nome = document.getElementById('ec-nome').value.trim();
  const whats = document.getElementById('ec-whats').value.trim();
  const endereco = document.getElementById('ec-endereco').value.trim();
  if(!nome || !whats){ toast('Preencha nome e WhatsApp'); return; }
  const c = clientes.find(cl => cl.id === clienteEditandoId);
  if(!c) return;
  c.nome = nome; c.whats = whats; c.endereco = endereco;
  await salvarClientes();
  renderClientes(); renderClientDatalist(); renderDashboard();
  fecharEditarCliente();
  toast('Cliente atualizado');
}

/* ---------- LIMPAR APENAS OS CLIENTES CADASTRADOS ----------
   Diferente de zerarBancoDeDados(): aqui só o CRM de clientes é apagado.
   Catálogo, agenda, histórico de orçamentos e dados da empresa continuam intactos. */
async function limparClientes(){
  if(clientes.length === 0){ toast('Não há clientes cadastrados'); return; }
  const ok = confirm(`Isso vai apagar permanentemente os ${clientes.length} cliente(s) cadastrados no CRM.\n\nO catálogo, a agenda, o histórico de orçamentos e os dados da empresa NÃO serão afetados.\n\nDeseja continuar?`);
  if(!ok) return;
  clientes = [];
  await salvarClientes();
  renderClientes(); renderClientDatalist(); renderDashboard();
  toast('🗑️ Clientes cadastrados foram apagados');
}
function renderClientes(){
  const busca = (document.getElementById('client-search').value || '').toLowerCase();
  const grid = document.getElementById('client-grid');
  const filtrados = clientes.filter(c => c.nome.toLowerCase().includes(busca) || digitos(c.whats).includes(busca.replace(/\D/g,'')));
  if(filtrados.length === 0){
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">👤</div>Nenhum cliente cadastrado ainda. Clientes aparecem aqui automaticamente quando você envia um orçamento.</div>`;
    return;
  }
  grid.innerHTML = filtrados.map(c => `
    <div class="client-card">
      <div class="client-name">${c.nome}</div>
      <div class="client-meta">${c.whats}</div>
      ${c.endereco ? `<div class="client-meta" style="margin-top:2px">📍 ${c.endereco}</div>` : ''}
      <div class="client-stats">
        <div><div class="client-stat-label">Orçamentos</div><div class="client-stat-value">${c.qtdOrcamentos || 0}</div></div>
        <div><div class="client-stat-label">Último</div><div class="client-stat-value">${c.ultimoOrcamento ? fmtDataBR(c.ultimoOrcamento) : '—'}</div></div>
      </div>
      <div class="client-actions">
        <button class="btn btn-amber btn-sm" onclick="novoOrcamentoPara('${c.id}')">Novo orçamento</button>
        <button class="btn btn-secondary btn-sm" onclick="agendarPara('${c.id}')">Agendar</button>
        <button class="btn btn-secondary btn-sm" onclick="editarCliente('${c.id}')">✏️ Editar</button>
      </div>
    </div>
  `).join('');
}
function novoOrcamentoPara(id){
  const c = clientes.find(cl => cl.id === id);
  if(!c) return;
  setSection('orcamento');
  document.getElementById('cli-nome').value = c.nome;
  document.getElementById('cli-whats').value = c.whats;
  document.getElementById('cli-endereco').value = c.endereco || '';
  atualizarStatus();
}
function agendarPara(id){
  const c = clientes.find(cl => cl.id === id);
  if(!c) return;
  setSection('agenda');
  document.getElementById('pl-cliente').value = c.nome;
  document.getElementById('pl-whats').value = c.whats;
  document.getElementById('pl-endereco').value = c.endereco || '';
}

/* ---------- AGENDA / PLANNER (calendário) ---------- */
const NOMES_MES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function mudarMes(delta){
  let { ano, mes } = mesAtual;
  mes += delta;
  if(mes < 0){ mes = 11; ano--; } else if(mes > 11){ mes = 0; ano++; }
  mesAtual = { ano, mes };
  renderCalendario();
}
function irParaMesDe(dataStr){
  const [ano, mes] = dataStr.split('-').map(Number);
  mesAtual = { ano, mes: mes - 1 };
}

function renderFiltroCategoria(){
  const cats = ['Todas', ...catalogo.map(c => c.categoria)];
  document.getElementById('filtro-categoria-list').innerHTML = cats.map(c =>
    `<div class="filter-item ${c === filtroCategoria ? 'active' : ''}" onclick="setFiltroCategoria('${c.replace(/'/g,"\\'")}')">${c}</div>`
  ).join('');
}
function setFiltroCategoria(c){ filtroCategoria = c; renderFiltroCategoria(); renderCalendario(); }

function renderFiltroStatus(){
  const opts = [['pendente','Pendente'],['concluido','Concluído'],['cancelado','Cancelado']];
  document.getElementById('filtro-status-buttons').innerHTML = opts.map(([k,label]) =>
    `<div class="filter-status-btn ${filtroStatus.has(k) ? 'active' : ''}" onclick="toggleFiltroStatus('${k}')">${label}</div>`
  ).join('');
}
function toggleFiltroStatus(k){
  if(filtroStatus.has(k)) filtroStatus.delete(k); else filtroStatus.add(k);
  renderFiltroStatus(); renderCalendario();
}

function renderCalendario(){
  const { ano, mes } = mesAtual;
  document.getElementById('mes-display').textContent = `${NOMES_MES[mes]} ${ano}`;
  const primeiroDia = new Date(ano, mes, 1);
  const ultimoDia = new Date(ano, mes + 1, 0);
  const diasNoMes = ultimoDia.getDate();
  const offset = primeiroDia.getDay();
  const hoje = hojeStr();

  let cells = [];
  for(let i = 0; i < offset; i++) cells.push(null);
  for(let d = 1; d <= diasNoMes; d++) cells.push(d);

  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = cells.map(d => {
    if(d === null) return `<div class="cal-cell empty"></div>`;
    const dataStr = `${ano}-${String(mes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    let itens = agenda.filter(a => a.data === dataStr && filtroStatus.has(a.status));
    if(filtroCategoria !== 'Todas'){ itens = itens.filter(a => a.categoria === filtroCategoria); }
    itens = itens.sort((a,b) => (a.hora||'').localeCompare(b.hora||''));
    const visiveis = itens.slice(0,3);
    const resto = itens.length - visiveis.length;
    const tagsHtml = visiveis.map(a => `<div class="cal-tag ${a.status}" title="${a.clienteNome}${a.hora ? ' - '+a.hora : ''}">${a.hora ? a.hora+' ' : ''}${a.clienteNome}</div>`).join('');
    const isToday = dataStr === hoje;
    const isSelected = dataStr === diaSelecionado;
    return `<div class="cal-cell ${isToday?'today':''} ${isSelected?'selected':''}" onclick="selecionarDiaCalendario('${dataStr}')">
      <div class="cal-daynum">${d}</div>
      ${tagsHtml}
      ${resto > 0 ? `<div class="cal-more">+${resto}</div>` : ''}
    </div>`;
  }).join('');
}

function selecionarDiaCalendario(dataStr){
  diaSelecionado = dataStr;
  renderCalendario();
  renderAgendaDia();
}

function mudarDia(delta){
  const d = new Date(diaSelecionado + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  diaSelecionado = d.toISOString().slice(0,10);
  irParaMesDe(diaSelecionado);
  renderCalendario();
  renderAgendaDia();
}
function irParaHoje(){
  diaSelecionado = hojeStr();
  irParaMesDe(diaSelecionado);
  renderCalendario();
  renderAgendaDia();
}

function adicionarAgendamento(){
  const clienteNome = document.getElementById('pl-cliente').value.trim();
  const whats = document.getElementById('pl-whats').value.trim();
  const hora = document.getElementById('pl-hora').value;
  const servico = document.getElementById('pl-servico').value.trim();
  const categoria = document.getElementById('pl-categoria').value.trim() || null;
  const endereco = document.getElementById('pl-endereco').value.trim();
  if(!clienteNome){ toast('Digite o nome do cliente'); return; }
  agenda.push({ id: uid(), clienteNome, whats, data: diaSelecionado, hora, servico, categoria, endereco, observacao:'', status:'pendente', criadoEm: hojeStr(), lembreteEnviado:false, lembrete2hEnviado:false });
  salvarAgenda();
  document.getElementById('pl-cliente').value = '';
  document.getElementById('pl-whats').value = '';
  document.getElementById('pl-hora').value = '';
  document.getElementById('pl-servico').value = '';
  document.getElementById('pl-categoria').value = '';
  document.getElementById('pl-endereco').value = '';
  renderCalendario(); renderAgendaDia(); renderNotifs(); renderDashboard();
  toast('Atendimento adicionado ao planner');
}
function concluirAgendamento(id){
  const a = agenda.find(x => x.id === id);
  if(a){ a.status = 'concluido'; salvarAgenda(); renderCalendario(); renderAgendaDia(); renderNotifs(); renderDashboard(); toast('Atendimento concluído'); }
}
function cancelarAgendamento(id){
  const a = agenda.find(x => x.id === id);
  if(a){ a.status = 'cancelado'; salvarAgenda(); renderCalendario(); renderAgendaDia(); renderNotifs(); renderDashboard(); }
}
function excluirAgendamento(id){
  agenda = agenda.filter(x => x.id !== id);
  salvarAgenda(); renderCalendario(); renderAgendaDia(); renderNotifs(); renderDashboard();
}

/* ---------- LEMBRETES (1 hora de antecedência) ---------- */
function atualizarBotaoLembretes(){
  const btn = document.getElementById('btn-lembretes');
  if(!btn) return;
  if(typeof Notification !== 'undefined' && Notification.permission === 'granted'){ btn.textContent = '🔔 Lembretes ativados'; }
  else{ btn.textContent = '🔔 Ativar lembretes'; }
}
function solicitarPermissaoNotificacao(){
  if(typeof Notification === 'undefined'){ toast('Este navegador não suporta avisos automáticos'); return; }
  if(Notification.permission === 'granted'){ toast('Os lembretes já estão ativados'); atualizarBotaoLembretes(); return; }
  Notification.requestPermission().then(perm => {
    atualizarBotaoLembretes();
    if(perm === 'granted'){ toast('Lembretes ativados — você será avisado 1h antes de cada atendimento'); }
  });
}
function dispararLembrete(a){
  const texto = `Daqui a 1 hora: ${a.clienteNome}${a.hora ? ' às ' + a.hora : ''}${a.servico ? ' — ' + a.servico : ''}`;
  toast('⏰ ' + texto);
  if(typeof Notification !== 'undefined' && Notification.permission === 'granted'){
    try{ new Notification('Atendimento em 1 hora', { body: texto }); }catch(e){}
  }
}
function dispararLembrete2h(a){
  const texto = `Faltam 2 horas: ${a.clienteNome}${a.hora ? ' às ' + a.hora : ''}${a.servico ? ' — ' + a.servico : ''}. Abra o sininho para avisar cliente e responsável no WhatsApp.`;
  toast('⏰ ' + texto);
  if(typeof Notification !== 'undefined' && Notification.permission === 'granted'){
    try{ new Notification('Atendimento em 2 horas — enviar avisos', { body: texto }); }catch(e){}
  }
}
function checkLembretes(){
  const agora = new Date();
  let mudou = false;
  agenda.forEach(a => {
    if(a.status !== 'pendente' || !a.hora) return;
    const alvo = new Date(a.data + 'T' + a.hora + ':00');
    const diffMin = (alvo - agora) / 60000;
    if(!a.lembrete2hEnviado && diffMin <= 120 && diffMin > -15){
      dispararLembrete2h(a);
      a.lembrete2hEnviado = true;
      mudou = true;
    }
    if(!a.lembreteEnviado && diffMin <= 60 && diffMin > -15){
      dispararLembrete(a);
      a.lembreteEnviado = true;
      mudou = true;
    }
  });
  if(mudou){ salvarAgenda(); renderNotifs(); }
}

/* ---------- ENVIO DE LEMBRETE PELO WHATSAPP (cliente + responsável) ---------- */
function abrirWhatsAppNumero(numeroRaw, mensagem){
  const numeroLimpo = digitos(numeroRaw);
  if(!numeroLimpo){ toast('⚠️ Número de WhatsApp não cadastrado'); return; }
  const numeroFinal = numeroLimpo.length <= 11 ? '55' + numeroLimpo : numeroLimpo;
  const url = `https://wa.me/${numeroFinal}?text=${encodeURIComponent(mensagem)}`;
  window.open(url, '_blank');
}
function montarMsgLembreteCliente(a){
  const partes = [`Olá ${a.clienteNome}! Passando para lembrar do seu atendimento hoje às ${a.hora || '--:--'}${a.servico ? ' — ' + a.servico : ''}.`];
  if(a.endereco) partes.push(`Endereço: ${a.endereco}.`);
  partes.push(`Qualquer dúvida, estamos à disposição!${perfilEmpresa.nomeEmpresa ? ' - ' + perfilEmpresa.nomeEmpresa : ''}`);
  return partes.join(' ');
}
function montarMsgLembreteResponsavel(a){
  const partes = [`Lembrete: atendimento com ${a.clienteNome} hoje às ${a.hora || '--:--'}${a.servico ? ' — ' + a.servico : ''}.`];
  if(a.endereco) partes.push(`Endereço: ${a.endereco}.`);
  if(a.whats) partes.push(`Contato do cliente: ${a.whats}.`);
  return partes.join(' ');
}
function enviarLembreteCliente(id){
  const a = agenda.find(x => x.id === id);
  if(!a) return;
  if(!a.whats){ toast('⚠️ Cliente sem WhatsApp cadastrado'); return; }
  abrirWhatsAppNumero(a.whats, montarMsgLembreteCliente(a));
}
function enviarLembreteResponsavel(id){
  const a = agenda.find(x => x.id === id);
  if(!a) return;
  if(!perfilEmpresa.telefoneContato){ toast('⚠️ Cadastre o telefone do responsável em Dados da Empresa'); return; }
  abrirWhatsAppNumero(perfilEmpresa.telefoneContato, montarMsgLembreteResponsavel(a));
}
setInterval(checkLembretes, 60000);
function renderAgendaDia(){
  document.getElementById('agenda-date-display').textContent = fmtDataExtenso(diaSelecionado);
  const lista = agenda.filter(a => a.data === diaSelecionado).sort((a,b) => (a.hora||'').localeCompare(b.hora||''));
  const el = document.getElementById('agenda-list');
  if(lista.length === 0){
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🗓️</div>Nenhum atendimento neste dia.</div>`;
    return;
  }
  el.innerHTML = lista.map(a => `
    <div class="appt-card ${a.status}">
      <div>
        <div class="appt-hora">${a.hora || '--:--'}</div>
        <div class="appt-client">${a.clienteNome}</div>
        <div class="appt-meta">${[a.servico, a.endereco].filter(Boolean).join(' · ') || 'Sem detalhes adicionais'}</div>
        <span class="badge ${a.status}" style="margin-top:6px; display:inline-block">${a.status}</span>
      </div>
      <div class="appt-actions">
        ${a.status === 'pendente' ? `<button class="btn btn-primary btn-sm" onclick="concluirAgendamento('${a.id}')">Concluir</button>
        <button class="btn btn-secondary btn-sm" onclick="cancelarAgendamento('${a.id}')">Cancelar</button>` : ''}
        <button class="btn btn-secondary btn-sm" onclick="excluirAgendamento('${a.id}')">✕</button>
      </div>
    </div>
  `).join('');
}

/* ---------- HISTÓRICO ---------- */
function renderHistorico(){
  const container = document.getElementById('historico-container');
  if(historico.length === 0){
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">◌</div>Nenhum orçamento registrado ainda.</div>`;
    return;
  }
  container.innerHTML = historico.map(reg => {
    const dataFmt = new Date(reg.data).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
    const itensTexto = reg.itens.map(i => `${i.nome} (x${i.qtd})`).join(' · ');
    return `
    <div class="history-card">
      <div class="history-top">
        <div>
          <div class="history-name">${reg.cliente.nome}</div>
          <div class="history-date">${dataFmt}</div>
        </div>
        <div class="history-total">${fmt(reg.totais.total)}</div>
      </div>
      <div class="history-items">${itensTexto}</div>
      <div class="history-actions">
        <button class="btn btn-secondary btn-sm" onclick='reenviar(${JSON.stringify(reg).replace(/'/g,"&#39;")})'>↻ Reenviar via WhatsApp</button>
      </div>
    </div>`;
  }).join('');
}
async function reenviar(reg){
  const mensagem = montarMensagem(reg.cliente, reg.itens, reg.totais, reg.observacoes);
  if(reg.proposta){
    const doc = gerarPDFProposta(reg.cliente, reg.itens, reg.totais, reg.observacoes, reg.proposta);
    const blob = doc.output('blob');
    const nomeArquivo = `Orcamento-${reg.cliente.nome.replace(/[^\w]+/g,'-')}.pdf`;
    const file = new File([blob], nomeArquivo, { type:'application/pdf' });
    const enviouDireto = await enviarPDFWhatsApp(file, mensagem, reg.cliente.whats);
    if(enviouDireto) toast('Compartilhamento aberto — escolha o WhatsApp do cliente');
  }else{
    const numeroLimpo = digitos(reg.cliente.whats);
    const numeroFinal = numeroLimpo.length <= 11 ? '55' + numeroLimpo : numeroLimpo;
    const url = `https://wa.me/${numeroFinal}?text=${encodeURIComponent(mensagem)}`;
    mostrarBannerWhats(url, '✅ Toque para abrir o WhatsApp e reenviar');
  }
}

init();
