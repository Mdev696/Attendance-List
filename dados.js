const SUPABASE_URL = 'https://xuairybzhetuwvivblaq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1YWlyeWJ6aGV0dXd2aXZibGFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NzYwMzIsImV4cCI6MjEwMjA1MjAzMn0.oy5zWtGHdK6WV4mYRXJ5vjpwqHbNMo1fVil1diimT_g';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let todosColaboradores = [];
let paginaAtual = 1;
let itensPorPagina = 50;

// ---------- AUTENTICAÇÃO ----------
_supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
        document.getElementById("login-view").classList.add("hidden");
        document.getElementById("dashboard-view").classList.remove("hidden");
        atualizarIconeTema(document.documentElement.getAttribute('data-theme') || 'light');
        await carregarColaboradores();
    }
});

async function realizarLogin() {
    const email = document.getElementById("login-user").value;
    const pass = document.getElementById("login-pass").value;
    const erroMensagem = document.getElementById("login-error");
    erroMensagem.innerText = "";

    const { error } = await _supabase.auth.signInWithPassword({ email, password: pass });
    if (error) {
        erroMensagem.innerText = "Erro: " + error.message;
    }
}

function realizarLogout() {
    _supabase.auth.signOut().then(() => location.reload());
}

// ---------- TEMA ----------
function alternarTema() {
    const html = document.documentElement;
    const atual = html.getAttribute('data-theme') || 'light';
    const novo = atual === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', novo);
    localStorage.setItem('tema', novo);
    atualizarIconeTema(novo);
}

function atualizarIconeTema(tema) {
    const btn = document.getElementById('themeToggleBtn');
    if (btn) btn.textContent = tema === 'dark' ? '☀️' : '🌙';
}

// ---------- CARREGAR / LISTAR ----------
async function carregarColaboradores() {
    const { data, error } = await _supabase.from('colaboradores').select('*').order('nome');
    if (error) {
        alert("Erro ao carregar colaboradores: " + error.message);
        return;
    }
    todosColaboradores = data || [];
    paginaAtual = 1;
    renderizarTabela();
    atualizarDashboard();
}

function atualizarDashboard() {
    document.getElementById('count-total').innerText = todosColaboradores.length;
    document.getElementById('count-rjc').innerText = todosColaboradores.filter(c => c.regiao === 'RJ_CAPITAL').length;
    document.getElementById('count-rji').innerText = todosColaboradores.filter(c => c.regiao === 'RJ_INTERIOR').length;
    document.getElementById('count-esc').innerText = todosColaboradores.filter(c => c.regiao === 'ES_CAPITAL').length;
    document.getElementById('count-esi').innerText = todosColaboradores.filter(c => c.regiao === 'ES_INTERIOR').length;
}

function aplicarFiltroBusca(lista) {
    const busca = (document.getElementById("inputBusca").value || "").toLowerCase().trim();
    if (!busca) return lista;
    return lista.filter(c =>
        [c.nome, c.regiao, c.uf, c.empresa, c.supervisor, c.coordenador, c.gerente_tel, c.micro_area]
            .some(campo => (campo || '').toString().toLowerCase().includes(busca))
    );
}

const LABEL_REGIAO = {
    'RJ_CAPITAL': 'RJ Capital',
    'RJ_INTERIOR': 'RJ Interior',
    'ES_CAPITAL': 'ES Capital',
    'ES_INTERIOR': 'ES Interior'
};

function renderizarTabela() {
    const lista = document.getElementById("lista");
    const filtrados = aplicarFiltroBusca(todosColaboradores);

    const totalPaginas = Math.max(1, Math.ceil(filtrados.length / itensPorPagina));
    if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;

    const inicio = (paginaAtual - 1) * itensPorPagina;
    const pagina = filtrados.slice(inicio, inicio + itensPorPagina);

    lista.innerHTML = pagina.map(c => `
        <tr>
            <td>${c.nome || ''}</td>
            <td>${LABEL_REGIAO[c.regiao] || c.regiao || ''}</td>
            <td>${c.uf || ''}</td>
            <td>${c.empresa || ''}</td>
            <td>${c.supervisor || ''}</td>
            <td>${c.coordenador || ''}</td>
            <td>${c.gerente_tel || ''}</td>
            <td>${c.micro_area || ''}</td>
            <td>
                <button class="btn-note" title="Editar" onclick="abrirModalColaborador(${c.id})">✏️</button>
                <button class="btn-del" title="Excluir" onclick="excluirColaborador(${c.id}, '${(c.nome || '').replace(/'/g, "\\'")}')">🗑️</button>
            </td>
        </tr>`).join('');

    document.getElementById('infoPagina').innerText =
        `Página ${paginaAtual} de ${totalPaginas} (${filtrados.length} colaborador${filtrados.length === 1 ? '' : 'es'})`;
    document.getElementById('btnPagAnterior').disabled = paginaAtual <= 1;
    document.getElementById('btnPagProxima').disabled = paginaAtual >= totalPaginas;
}

function filtrarTabela() {
    paginaAtual = 1;
    renderizarTabela();
}

function mudarPagina(delta) {
    paginaAtual += delta;
    renderizarTabela();
}

function mudarItensPorPagina() {
    itensPorPagina = parseInt(document.getElementById('itensPorPagina').value, 10);
    paginaAtual = 1;
    renderizarTabela();
}

// ---------- ADICIONAR / EDITAR ----------
function abrirModalColaborador(id) {
    document.getElementById('colabErro').innerText = '';

    if (id === null) {
        document.getElementById('modalTitulo').innerText = '➕ Adicionar Colaborador';
        document.getElementById('colabId').value = '';
        document.getElementById('colabNome').value = '';
        document.getElementById('colabRegiao').value = 'RJ_CAPITAL';
        document.getElementById('colabEmpresa').value = '';
        document.getElementById('colabSupervisor').value = '';
        document.getElementById('colabCoordenador').value = '';
        document.getElementById('colabGerente').value = '';
        document.getElementById('colabMicroArea').value = '';
    } else {
        const c = todosColaboradores.find(x => x.id === id);
        if (!c) return;
        document.getElementById('modalTitulo').innerText = '✏️ Editar Colaborador';
        document.getElementById('colabId').value = c.id;
        document.getElementById('colabNome').value = c.nome || '';
        document.getElementById('colabRegiao').value = c.regiao || 'RJ_CAPITAL';
        document.getElementById('colabEmpresa').value = c.empresa || '';
        document.getElementById('colabSupervisor').value = c.supervisor || '';
        document.getElementById('colabCoordenador').value = c.coordenador || '';
        document.getElementById('colabGerente').value = c.gerente_tel || '';
        document.getElementById('colabMicroArea').value = c.micro_area || '';
    }

    document.getElementById('modalColaborador').style.display = 'block';
}

function fecharModalColaborador() {
    document.getElementById('modalColaborador').style.display = 'none';
}

async function salvarColaborador() {
    const id = document.getElementById('colabId').value;
    const nome = document.getElementById('colabNome').value.trim();
    const regiao = document.getElementById('colabRegiao').value;
    const uf = regiao.split('_')[0];
    const empresa = document.getElementById('colabEmpresa').value.trim();
    const supervisor = document.getElementById('colabSupervisor').value.trim();
    const coordenador = document.getElementById('colabCoordenador').value.trim();
    const gerente_tel = document.getElementById('colabGerente').value.trim();
    const micro_area = document.getElementById('colabMicroArea').value.trim();

    const erroDiv = document.getElementById('colabErro');
    if (!nome) {
        erroDiv.innerText = "O nome é obrigatório.";
        return;
    }

    const payload = { nome, regiao, uf, empresa, supervisor, coordenador, gerente_tel, micro_area };

    let error;
    if (id) {
        ({ error } = await _supabase.from('colaboradores').update(payload).eq('id', id));
    } else {
        ({ error } = await _supabase.from('colaboradores').insert(payload));
    }

    if (error) {
        erroDiv.innerText = "Erro ao salvar: " + error.message;
        return;
    }

    fecharModalColaborador();
    await carregarColaboradores();
}

// ---------- EXCLUIR ----------
async function excluirColaborador(id, nome) {
    if (!confirm(`Excluir o colaborador "${nome}" do cadastro?`)) return;

    const { error } = await _supabase.from('colaboradores').delete().eq('id', id);
    if (error) {
        alert("Erro ao excluir: " + error.message);
        return;
    }
    await carregarColaboradores();
}

// ---------- EXPORTAR EXCEL ----------
function exportarExcel() {
    const filtrados = aplicarFiltroBusca(todosColaboradores);

    if (!filtrados.length) {
        alert("Não há colaboradores para exportar.");
        return;
    }

    const dadosPlanilha = filtrados.map(c => ({
        'Nome': c.nome || '',
        'Região': LABEL_REGIAO[c.regiao] || c.regiao || '',
        'UF': c.uf || '',
        'Empresa': c.empresa || '',
        'Supervisor': c.supervisor || '',
        'Coordenador': c.coordenador || '',
        'Gerente TEL': c.gerente_tel || '',
        'Micro Área': c.micro_area || ''
    }));

    const planilha = XLSX.utils.json_to_sheet(dadosPlanilha);
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, planilha, 'Colaboradores');

    // Largura automática básica das colunas
    const larguras = Object.keys(dadosPlanilha[0]).map(chave => {
        const maiorValor = Math.max(
            chave.length,
            ...dadosPlanilha.map(linha => (linha[chave] || '').toString().length)
        );
        return { wch: maiorValor + 2 };
    });
    planilha['!cols'] = larguras;

    const dataHoje = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(livro, `colaboradores_${dataHoje}.xlsx`);
}