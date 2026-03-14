let tarefas = [];
let dragId  = null;

(async () => {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (!res.ok) return window.location.href = '/login.html';
  const { user } = await res.json();
  document.getElementById('topbar-user').textContent = user.nome.split(' ')[0];

  if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light');
    document.getElementById('btn-theme').textContent = '☀️';
  }

  await loadTarefas();
  verificarNotificacoes();
  setInterval(async () => {
    await loadTarefas();
    verificarNotificacoes();
  }, 60 * 1000);
})();

async function loadTarefas() {
  const res = await fetch('/api/tarefas', { credentials: 'include' });
  if (!res.ok) return;
  tarefas = await res.json();
  await atualizarStatusAutomatico();
  renderBoard();
}

async function atualizarStatusAutomatico() {
  const agora = new Date();

  for (const t of tarefas) {
    if (!t.prazo) continue;

    const prazo  = new Date(t.prazo);
    const venceu = prazo < agora;

    if (venceu && t.status !== 'done') {
      await fetch(`/api/tarefas/${t.id}/status`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' })
      });
      t.status = 'done';
    } else if (!venceu && t.status === 'todo') {
      await fetch(`/api/tarefas/${t.id}/status`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'doing' })
      });
      t.status = 'doing';
    }
  }
}

function renderBoard() {
  ['todo', 'doing', 'done'].forEach(status => {
    const lista = tarefas.filter(t => t.status === status);
    document.getElementById('col-' + status).innerHTML = lista.map(cardHTML).join('');
    document.getElementById('count-' + status).textContent = lista.length;
  });

  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('dragstart', () => {
      dragId = card.dataset.id;
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });
}

function cardHTML(t) {
  const data = new Date(t.criado_em).toLocaleDateString('pt-BR');

  let prazoHTML = '';
  if (t.prazo) {
    const prazo   = new Date(t.prazo);
    const agora   = new Date();
    const diffMin = (prazo - agora) / 60000;
    const fmtPrazo = prazo.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });

    let prazoClass = 'prazo-normal';
    if (diffMin < 0)    prazoClass = 'prazo-vencido';
    else if (diffMin < 60)   prazoClass = 'prazo-urgente';
    else if (diffMin < 1440) prazoClass = 'prazo-hoje';

    prazoHTML = `<span class="badge-prazo ${prazoClass}">⏰ ${fmtPrazo}</span>`;
  }

  return `
    <div class="card" draggable="true" data-id="${t.id}">
      <div class="card-top">
        <div class="card-title">${escHtml(t.titulo)}</div>
        <div class="card-actions">
          <button class="card-btn" onclick="editTask(${t.id})">✏️</button>
          <button class="card-btn del" onclick="deleteTask(${t.id})">🗑️</button>
        </div>
      </div>
      ${t.descricao ? `<div class="card-desc">${escHtml(t.descricao)}</div>` : ''}
      ${prazoHTML}
      <div class="card-footer">
        <span class="badge-priority prio-${t.prioridade}">${t.prioridade}</span>
        <span class="card-date">${data}</span>
      </div>
    </div>
  `;
}

function verificarNotificacoes() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') { Notification.requestPermission(); return; }
  if (Notification.permission !== 'granted') return;

  const agora = new Date();

  tarefas.forEach(t => {
    if (!t.prazo || t.status === 'done') return;

    const prazo   = new Date(t.prazo);
    const diffMin = (prazo - agora) / 60000;
    const chave   = `notif_${t.id}_${prazo.toISOString()}`;

    if (diffMin > 0 && diffMin <= 60 && !sessionStorage.getItem(chave)) {
      new Notification('⏰ Tarefa se aproximando do prazo!', {
        body: `"${t.titulo}" vence em ${Math.round(diffMin)} minuto(s).`,
      });
      sessionStorage.setItem(chave, '1');
    }

    const chaveVencida = `vencida_${t.id}`;
    if (diffMin < 0 && !sessionStorage.getItem(chaveVencida)) {
      new Notification('🔴 Tarefa vencida!', { body: `"${t.titulo}" passou do prazo.` });
      sessionStorage.setItem(chaveVencida, '1');
    }
  });
}

function onDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

async function onDrop(e, novoStatus) {
  e.preventDefault();
  document.querySelectorAll('.column').forEach(c => c.classList.remove('drag-over'));
  if (!dragId) return;

  const tarefa = tarefas.find(t => t.id == dragId);
  if (!tarefa || tarefa.status === novoStatus) return;

  tarefa.status = novoStatus;
  renderBoard();

  const res = await fetch(`/api/tarefas/${dragId}/status`, {
    method: 'PATCH', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: novoStatus })
  });

  if (!res.ok) { toast('Erro ao mover tarefa', true); await loadTarefas(); }
  dragId = null;
}

function openModal(statusOrId = 'todo') {
  const isEdit = typeof statusOrId === 'number';

  document.getElementById('modal-id').value         = isEdit ? statusOrId : '';
  document.getElementById('modal-status').value     = isEdit ? '' : statusOrId;
  document.getElementById('modal-titulo').value     = '';
  document.getElementById('modal-desc').value       = '';
  document.getElementById('modal-prioridade').value = 'media';
  document.getElementById('modal-data').value       = '';
  document.getElementById('modal-hora').value       = '';
  document.getElementById('modal-title').textContent = isEdit ? 'Editar Tarefa' : 'Nova Tarefa';

  if (isEdit) {
    const t = tarefas.find(t => t.id == statusOrId);
    if (t) {
      document.getElementById('modal-titulo').value     = t.titulo;
      document.getElementById('modal-desc').value       = t.descricao || '';
      document.getElementById('modal-prioridade').value = t.prioridade;
      if (t.prazo) {
        const d = new Date(t.prazo);
        document.getElementById('modal-data').value = d.toISOString().split('T')[0];
        document.getElementById('modal-hora').value = d.toTimeString().slice(0, 5);
      }
    }
  }

  document.getElementById('modal').classList.add('open');
}

function closeModal(e) { if (e.target.id === 'modal') closeModalBtn(); }
function closeModalBtn() { document.getElementById('modal').classList.remove('open'); }
function editTask(id) { openModal(id); }

async function saveTask() {
  const id         = document.getElementById('modal-id').value;
  const status     = document.getElementById('modal-status').value || 'todo';
  const titulo     = document.getElementById('modal-titulo').value.trim();
  const descricao  = document.getElementById('modal-desc').value.trim();
  const prioridade = document.getElementById('modal-prioridade').value;
  const data       = document.getElementById('modal-data').value;
  const hora       = document.getElementById('modal-hora').value;

  if (!titulo) { toast('Título é obrigatório!', true); return; }

  let prazo = null;
  if (data) prazo = hora ? `${data}T${hora}:00` : `${data}T00:00:00`;

  const url    = id ? `/api/tarefas/${id}` : '/api/tarefas';
  const method = id ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method, credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titulo, descricao, prioridade, status, prazo })
  });

  if (res.ok) {
    closeModalBtn();
    toast(id ? 'Tarefa atualizada!' : 'Tarefa criada!');
    await loadTarefas();
  } else {
    const d = await res.json();
    toast(d.error, true);
  }
}

async function deleteTask(id) {
  if (!confirm('Excluir esta tarefa?')) return;
  const res = await fetch(`/api/tarefas/${id}`, { method: 'DELETE', credentials: 'include' });
  if (res.ok) { toast('Tarefa excluída.'); await loadTarefas(); }
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/login.html';
}

function toggleTheme() {
  const isLight = document.body.classList.toggle('light');
  document.getElementById('btn-theme').textContent = isLight ? '☀️' : '🌙';
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
}

function toast(msg, err = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.background = err ? '#f74f4f' : '#f0f0f0';
  el.style.color = err ? '#fff' : '#0f0f0f';
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}