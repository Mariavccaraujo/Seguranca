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
function hojeStr(){ const d = new Date(); const tz = d.getTimezoneOffset()*60000; return new Date(d - tz).toISOString().slice(0,10); }
function toast(msg){ const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(()=> t.classList.remove('show'), 2200); }

/* ---------- BANNER "ABRIR WHATSAPP" (link real, clique do usuário — nunca é bloqueado) ----------
   Em vez de tentar abrir o WhatsApp automaticamente via window.open() depois de operações
   assíncronas (o que os navegadores podem bloquear como pop-up, resultando em about:blank
   ou nada acontecendo), mostramos um botão de verdade (<a href>) para o usuário tocar.
   Um clique real do usuário em um link nunca é bloqueado, em nenhum navegador. */
function mostrarBannerWhats(url, texto){
  const banner = document.getElementById('wa-send-banner');
  const link = document.getElementById('wa-send-link');
  const span = document.getElementById('wa-send-texto');
  if(!banner || !link || !span) return;
  span.textContent = texto || '✅ Pronto! Toque para abrir o WhatsApp';
  link.href = url;
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
  const busca = (document.getElementById('loja-search').value || '').toLowerCase();
  let produtos = [];
  catalogo.forEach(cat => {
    cat.itens.forEach(item => {
      if(categoriaAtiva !== 'Todos' && cat.categoria !== categoriaAtiva) return;
      if(busca && !item.nome.toLowerCase().includes(busca)) return;
      produtos.push({ ...item, categoria: cat.categoria });
    });
  });
  const grid = document.getElementById('product-grid');
  if(produtos.length === 0){
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">🔍</div>Nenhum produto encontrado.</div>`;
    return;
  }
  grid.innerHTML = produtos.map(p => {
    const st = catStyle(p.categoria);
    return `
    <div class="product-card">
      <button class="product-remove" title="Remover do catálogo" onclick="removerProdutoCatalogo('${p.id}')">✕</button>
      <div class="product-icon" style="background:${st.bg}">${st.emoji}</div>
      <div>
        <div class="product-cat-label">${p.categoria}</div>
        <div class="product-name">${p.nome}</div>
      </div>
      <div class="product-footer">
        <div class="product-price">${fmt(p.preco)}</div>
        <button class="product-add" onclick="adicionarItem('${p.nome.replace(/'/g,"\\'")}', ${p.preco})">+</button>
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

function renderLines(){
  const body = document.getElementById('lines-body');
  const empty = document.getElementById('lines-empty');
  body.innerHTML = '';
  if(itensOrcamento.length === 0){ empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  itensOrcamento.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.nome}</td>
      <td><input type="number" min="1" class="qty-input mono" value="${item.qtd}"></td>
      <td class="mono">${fmt(item.preco)}</td>
      <td class="mono">${fmt(item.preco * item.qtd)}</td>
      <td><button class="remove-btn" title="Remover">✕</button></td>
    `;
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

  /* --- Cabeçalho: bloco escuro decorativo + título + selos --- */
  doc.setFillColor(42,42,42);
  doc.rect(140, 8, 52, 48, 'F');

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
  doc.setFillColor(58,58,58);
  doc.rect(14, boxY + 5, 20, boxH - 10, 'F');
  doc.rect(pageW - 34, boxY + 12, 20, boxH - 22, 'F');

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
