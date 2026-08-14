const SUPABASE_URL = 'https://xuairybzhetuwvivblaq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1YWlyeWJ6aGV0dXd2aXZibGFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NzYwMzIsImV4cCI6MjEwMjA1MjAzMn0.oy5zWtGHdK6WV4mYRXJ5vjpwqHbNMo1fVil1diimT_g';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let idAtualNota = null;

// Persistência de Sessão
_supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
        document.getElementById("login-view").classList.add("hidden");
        document.getElementById("dashboard-view").classList.remove("hidden");
        const hoje = new Date().toISOString().split('T')[0];
        document.getElementById('dataSelecionada').value = hoje;
        atualizarIconeTema(document.documentElement.getAttribute('data-theme') || 'light');
        gerarRadiosStatus();
        await carregarColaboradores();
        atualizarTabela();
    }
});

// Cadastro de colaboradores carregado do Supabase (tabela "colaboradores")
let baseDados = {};

async function carregarColaboradores() {
    const { data: colaboradores, error } = await _supabase
        .from('colaboradores')
        .select('*');

    if (error) {
        alert("Erro ao carregar cadastro de colaboradores: " + error.message);
        return;
    }

    const novaBase = {};
    (colaboradores || []).forEach(c => {
        if (!novaBase[c.regiao]) novaBase[c.regiao] = {};
        novaBase[c.regiao][c.nome] = {
            uf: c.uf,
            super: c.supervisor,
            coord: c.coordenador,
            gerente: c.gerente_tel,
            empresa: c.empresa,
            micro: c.micro_area
        };
    });
    baseDados = novaBase;
}

const statusOpcoes = ["PRESENTE", "PRESENTE - CONJUNTA (SWAP/N1)", "PRESENTE - FORMATAÇÃO", "PRESENTE - PREVENTIVA", "FALTA", "INTERJORNADA(10h)", "INTERJORNADA(12H)", "INTERMEDIÁRIO (13h)", "INTERJORNADA(13h)", "INTERJORNADA(16h)", "INTERJORNADA (SEM RETORNO)", "NOTURNO", "FÉRIAS", "INSS", "ATESTADO", "FOLGA", "DESLIGADO", "DUPLADO", "FROTA"];

function gerarRadiosStatus() {
    const container = document.getElementById("statusRadios");
    container.innerHTML = statusOpcoes.map(st => `
                <label class="item-check">
                    <input type="radio" name="statusSelect" value="${st}"> ${st}
                </label>
            `).join("");
}

// CASCATA PASSO 1 -> 2
function filtrarRegioes() {
    const ufSel = document.getElementById("uf").value;
    const selectRegiao = document.getElementById("regiao");
    const selectSup = document.getElementById("supervisorTLP");

    selectRegiao.innerHTML = '<option disabled selected value="">2º Selecione a Região</option>';
    selectSup.innerHTML = '<option disabled selected value="">3º Selecione o Supervisor</option>';
    document.getElementById("colaboradoresCheckboxes").innerHTML = "";

    Object.keys(baseDados).forEach(chave => {
        if (chave.startsWith(ufSel)) {
            const nomeRegiao = chave.split('_')[1];
            selectRegiao.innerHTML += `<option value="${chave}">${nomeRegiao}</option>`;
        }
    });
}

// CASCATA PASSO 2 -> 3
function filtrarSupervisores() {
    const regiaoChave = document.getElementById("regiao").value;
    const selectSup = document.getElementById("supervisorTLP");

    selectSup.innerHTML = '<option disabled selected value="">3º Selecione o Supervisor</option>';
    document.getElementById("colaboradoresCheckboxes").innerHTML = "";

    if (baseDados[regiaoChave]) {
        const sups = new Set();
        Object.values(baseDados[regiaoChave]).forEach(c => sups.add(c.super));

        Array.from(sups).sort().forEach(s => {
            selectSup.innerHTML += `<option value="${s}">${s}</option>`;
        });
    }
}

// CASCATA PASSO 3 -> 4
function filtrarColaboradores() {
    const regiaoChave = document.getElementById("regiao").value;
    const supSel = document.getElementById("supervisorTLP").value;
    const container = document.getElementById("colaboradoresCheckboxes");
    container.innerHTML = "";

    if (baseDados[regiaoChave]) {
        Object.entries(baseDados[regiaoChave]).forEach(([nome, info]) => {
            if (info.super === supSel) {
                container.innerHTML += `
                            <label class="item-check">
                                <input type="checkbox" name="colab" value="${nome}"> ${nome}
                            </label>`;
            }
        });
    }
}

async function realizarLogin() {
    const email = document.getElementById("login-user").value;
    const pass = document.getElementById("login-pass").value;
    const erroMensagem = document.getElementById("login-error");

    const { data, error } = await _supabase.auth.signInWithPassword({ email, password: pass });
    if (error) {
        erroMensagem.innerText = "Erro: " + error.message;
    }
}

function realizarLogout() {
    _supabase.auth.signOut().then(() => location.reload());
}

// Alterna entre tema claro e escuro, salvando a preferência no navegador
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

// O BOTÃO DE SALVAR (CORRIGIDO)
async function salvarPresenca() {
    const data = document.getElementById("dataSelecionada").value;
    const status = document.querySelector('input[name="statusSelect"]:checked')?.value;
    const selecionados = Array.from(document.querySelectorAll('input[name="colab"]:checked')).map(c => c.value);
    const regiaoChave = document.getElementById("regiao").value;

    if (!data) return alert("Selecione a data!");
    if (!status) return alert("Selecione o status!");
    if (selecionados.length === 0) return alert("Selecione pelo menos um colaborador!");

    // Verifica se algum dos selecionados já tem presença lançada nesta mesma data
    // (registrosDoDia já está carregado para a data selecionada em tela).
    const jaLancados = selecionados.filter(nome =>
        registrosDoDia.some(r => (r.nome || '').trim().toUpperCase() === nome.trim().toUpperCase())
    );

    if (jaLancados.length > 0) {
        const continuar = confirm(
            `⚠️ Os seguintes colaboradores já têm presença lançada em ${data}:\n\n` +
            jaLancados.join('\n') +
            `\n\nSe continuar, o lançamento existente deles será ATUALIZADO com o novo status (não duplica). Deseja continuar?`
        );
        if (!continuar) return;
    }

    const registros = selecionados.map(nome => {
        const info = baseDados[regiaoChave][nome];
        return {
            data: data,
            nome: nome,
            uf: info.uf,
            regiao: regiaoChave,
            empresa: info.empresa,
            micro_area: info.micro,
            supervisor: info.super,
            coordenador: info.coord,
            gerente_tel: info.gerente,
            status: status,
            observacao: ""
        };
    });

    // Separa quem já tem registro nesta data (vira update) de quem é novo (vira insert)
    const paraAtualizar = [];
    const paraInserir = [];
    registros.forEach(reg => {
        const existente = registrosDoDia.find(r => (r.nome || '').trim().toUpperCase() === reg.nome.trim().toUpperCase());
        if (existente) {
            paraAtualizar.push({ id: existente.id, status: reg.status });
        } else {
            paraInserir.push(reg);
        }
    });

    let erroFinal = null;

    if (paraInserir.length > 0) {
        const { error } = await _supabase.from('registros_presenca').insert(paraInserir);
        if (error) erroFinal = error;
    }

    for (const item of paraAtualizar) {
        const { error } = await _supabase.from('registros_presenca').update({ status: item.status }).eq('id', item.id);
        if (error) erroFinal = error;
    }

    if (erroFinal) {
        alert("Erro ao salvar: " + erroFinal.message);
    } else {
        const partes = [];
        if (paraInserir.length > 0) partes.push(`${paraInserir.length} novo(s)`);
        if (paraAtualizar.length > 0) partes.push(`${paraAtualizar.length} atualizado(s)`);
        alert("Salvo com sucesso! " + partes.join(" / "));
        atualizarTabela();
    }
}

// Monta um índice plano { NOME: info } juntando todas as regiões de baseDados,
// para localizar um colaborador pelo nome sem saber a região dele de antemão.
// Cada info recebe também a chave "regiao" (ex: RJ_CAPITAL), usada para
// gravar junto com a presença e permitir a separação Capital/Interior no Analítico.
function indexarColaboradoresPorNome() {
    const indice = {};
    Object.entries(baseDados).forEach(([regiao, colaboradoresDaRegiao]) => {
        Object.entries(colaboradoresDaRegiao).forEach(([nome, info]) => {
            indice[nome.trim().toUpperCase()] = { ...info, regiao };
        });
    });
    return indice;
}

// Acha o valor de uma coluna na linha da planilha, tentando várias variações de nome de cabeçalho.
function pegarColuna(linha, candidatos) {
    for (const chave of Object.keys(linha)) {
        const chaveNorm = chave.trim().toUpperCase();
        if (candidatos.includes(chaveNorm)) {
            return linha[chave];
        }
    }
    return null;
}

// Lê uma aba como matriz de linhas/colunas e detecta automaticamente em qual linha
// estão os cabeçalhos (procurando COLABORADOR/NOME + STATUS nas primeiras linhas).
// Isso funciona tanto com planilhas "cruas" (cabeçalho na linha 1) quanto com
// planilhas que têm uma linha de legenda/título acima do cabeçalho.
function lerAbaComHeaderAutoDetect(planilha) {
    const matriz = XLSX.utils.sheet_to_json(planilha, { header: 1, defval: "" });

    let headerRowIdx = -1;
    let colunas = [];
    for (let i = 0; i < Math.min(10, matriz.length); i++) {
        const linhaNorm = matriz[i].map(v => String(v).trim().toUpperCase());
        const temNome = linhaNorm.some(v => v === "COLABORADOR" || v === "NOME");
        const temStatus = linhaNorm.some(v => v === "STATUS");
        if (temNome && temStatus) {
            headerRowIdx = i;
            colunas = matriz[i].map(v => String(v).trim());
            break;
        }
    }

    if (headerRowIdx === -1) return [];

    const linhasObjeto = [];
    for (let i = headerRowIdx + 1; i < matriz.length; i++) {
        const linhaArr = matriz[i];
        if (!linhaArr || linhaArr.every(v => String(v).trim() === "")) continue;
        const obj = {};
        colunas.forEach((nomeCol, idx) => {
            if (nomeCol) obj[nomeCol] = linhaArr[idx] !== undefined ? linhaArr[idx] : "";
        });
        linhasObjeto.push(obj);
    }
    return linhasObjeto;
}

// Tenta extrair {dia, mes} do nome da aba, ex: "BASE TLP 01_08" -> dia 01, mês 08.
function extrairDiaMesDoNomeAba(nomeAba) {
    const match = nomeAba.match(/(\d{2})[_\-\/](\d{2})/);
    if (match) {
        return { dia: match[1], mes: match[2] };
    }
    return null;
}

async function importarPlanilha() {
    const input = document.getElementById("arquivoImportacao");
    const resultadoDiv = document.getElementById("resultadoImportacao");
    const dataSelecionada = document.getElementById("dataSelecionada").value;

    if (!input.files || input.files.length === 0) {
        return alert("Escolha um arquivo .xlsx primeiro!");
    }
    if (!dataSelecionada) {
        return alert("Selecione a data no topo do painel (ela é usada para definir o ano e para abas sem data no nome).");
    }

    resultadoDiv.innerHTML = "Lendo planilha...";
    const anoBase = dataSelecionada.split('-')[0];

    const arrayBuffer = await input.files[0].arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });

    const indiceColaboradores = indexarColaboradoresPorNome();

    const registros = [];
    const naoEncontrados = new Set();
    const abasSemCabecalho = [];
    let statusVazio = 0;

    workbook.SheetNames.forEach(nomeAba => {
        const planilha = workbook.Sheets[nomeAba];
        const linhas = lerAbaComHeaderAutoDetect(planilha);
        if (linhas.length === 0) {
            abasSemCabecalho.push(nomeAba);
            return;
        }

        let dataDoRegistro = dataSelecionada;
        const diaMes = extrairDiaMesDoNomeAba(nomeAba);
        if (diaMes) {
            dataDoRegistro = `${anoBase}-${diaMes.mes}-${diaMes.dia}`;
        }

        linhas.forEach(linha => {
            const nomeBruto = pegarColuna(linha, ["COLABORADOR", "NOME"]);
            const status = pegarColuna(linha, ["STATUS"]);

            if (!nomeBruto) return;
            const nome = String(nomeBruto).trim();
            if (!status) { statusVazio++; return; }

            const info = indiceColaboradores[nome.toUpperCase()];
            if (!info) {
                naoEncontrados.add(nome);
                return;
            }

            registros.push({
                data: dataDoRegistro,
                nome: nome,
                uf: info.uf,
                regiao: info.regiao,
                empresa: info.empresa,
                micro_area: info.micro,
                supervisor: info.super,
                coordenador: info.coord,
                gerente_tel: info.gerente,
                status: String(status).trim(),
                observacao: ""
            });
        });
    });

    if (registros.length === 0) {
        let msg = `Nenhum registro válido encontrado para importar. Verifique se as colunas COLABORADOR (ou NOME) e STATUS existem na planilha.`;
        if (abasSemCabecalho.length > 0) {
            msg += `<br>⚠️ Não encontrei as colunas COLABORADOR/STATUS nas abas: ${abasSemCabecalho.join(", ")}`;
        }
        if (statusVazio > 0) {
            msg += `<br>⚠️ ${statusVazio} linha(s) com nome preenchido mas sem status foram ignoradas — confira se a coluna STATUS está com o texto certo nessas linhas.`;
        }
        if (naoEncontrados.size > 0) {
            msg += `<br>⚠️ ${naoEncontrados.size} nome(s) lido(s) mas não encontrado(s) no cadastro: ${Array.from(naoEncontrados).join(", ")}`;
        }
        resultadoDiv.innerHTML = msg;
        return;
    }

    resultadoDiv.innerHTML = `Importando ${registros.length} registros...`;

    // Insere em lotes de 500 para evitar payload muito grande
    const tamanhoLote = 500;
    let inseridos = 0;
    for (let i = 0; i < registros.length; i += tamanhoLote) {
        const lote = registros.slice(i, i + tamanhoLote);
        const { error } = await _supabase.from('registros_presenca').insert(lote);
        if (error) {
            resultadoDiv.innerHTML = `Erro ao importar: ${error.message} (${inseridos} de ${registros.length} inseridos antes do erro)`;
            return;
        }
        inseridos += lote.length;
    }

    let resumo = `✅ ${inseridos} registros importados com sucesso (${new Set(registros.map(r => r.nome)).size} colaborador(es) único(s)).`;
    if (naoEncontrados.size > 0) {
        resumo += `<br>⚠️ ${naoEncontrados.size} colaborador(es) não encontrado(s) no cadastro e ignorado(s): ${Array.from(naoEncontrados).join(", ")}`;
    }
    if (statusVazio > 0) {
        resumo += `<br>⚠️ ${statusVazio} linha(s) sem status foram ignoradas.`;
    }
    resultadoDiv.innerHTML = resumo;
    atualizarTabela();
}

// Estado da tabela: guarda os registros do dia já sem duplicados,
// e controla a paginação/filtro de busca aplicados sobre eles.
let registrosDoDia = [];
let paginaAtual = 1;
let itensPorPagina = 50;

async function atualizarTabela() {
    const dataFiltro = document.getElementById("dataSelecionada").value;
    const { data: registros, error } = await _supabase
        .from('registros_presenca')
        .select('*')
        .eq('data', dataFiltro);

    if (!registros) return;

    // Remove duplicados: se o mesmo colaborador aparecer mais de uma vez
    // na mesma data (ex: importado duas vezes), mantém só o registro
    // mais recente (maior id) para não poluir a tabela.
    const porNome = new Map();
    registros
        .slice()
        .sort((a, b) => a.id - b.id)
        .forEach(r => porNome.set((r.nome || '').trim().toUpperCase(), r));

    registrosDoDia = Array.from(porNome.values())
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    paginaAtual = 1;
    renderizarTabela();
    atualizarDashboard(registrosDoDia);
}

function aplicarFiltroBusca(lista) {
    const busca = (document.getElementById("inputBusca").value || "").toLowerCase().trim();
    if (!busca) return lista;
    return lista.filter(r =>
        [r.uf, r.empresa, r.micro_area, r.nome, r.supervisor, r.coordenador, r.gerente_tel, r.status]
            .some(campo => (campo || '').toString().toLowerCase().includes(busca))
    );
}

function renderizarTabela() {
    const lista = document.getElementById("lista");
    const filtrados = aplicarFiltroBusca(registrosDoDia);

    const totalPaginas = Math.max(1, Math.ceil(filtrados.length / itensPorPagina));
    if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;

    const inicio = (paginaAtual - 1) * itensPorPagina;
    const pagina = filtrados.slice(inicio, inicio + itensPorPagina);

    lista.innerHTML = pagina.map(r => `
                <tr>
                    <td>${r.uf}</td>
                    <td>${r.empresa}</td>
                    <td>${r.micro_area || ''}</td>
                    <td>${r.nome}</td>
                    <td>${r.supervisor}</td>
                    <td>${r.coordenador}</td>
                    <td>${r.gerente_tel}</td>
                    <td><b>${r.status}</b></td>
                    <td>
                        <button class="btn-note" title="Nota" onclick="abrirModal(${r.id}, '${(r.observacao || '').replace(/'/g, "\\'")}')">📝</button>
                        <button class="btn-del" title="Excluir" onclick="deletar(${r.id})">🗑️</button>
                    </td>
                </tr>`).join('');

    document.getElementById('infoPagina').innerText = `Página ${paginaAtual} de ${totalPaginas} (${filtrados.length} registro${filtrados.length === 1 ? '' : 's'})`;
    document.getElementById('btnPagAnterior').disabled = paginaAtual <= 1;
    document.getElementById('btnPagProxima').disabled = paginaAtual >= totalPaginas;
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

function atualizarDashboard(regs) {
    document.getElementById('count-uf').innerText = [...new Set(regs.map(r => r.uf))].length;
    document.getElementById('count-empresa').innerText = [...new Set(regs.map(r => r.empresa))].length;
    document.getElementById('count-colab').innerText = regs.length;
    document.getElementById('count-super').innerText = [...new Set(regs.map(r => r.supervisor))].length;
    document.getElementById('count-gerente').innerText = [...new Set(regs.map(r => r.gerente_tel))].length;
}

async function deletar(id) {
    if (confirm("Excluir?")) {
        await _supabase.from('registros_presenca').delete().eq('id', id);
        atualizarTabela();
    }
}

// Apaga TODOS os registros de presença da data selecionada no painel.
// Não afeta outras datas — só o que está sendo exibido na tabela agora.
async function limparTabela() {
    const data = document.getElementById("dataSelecionada").value;

    if (!data) return alert("Selecione uma data primeiro!");
    if (registrosDoDia.length === 0) return alert("Não há registros nesta data para limpar.");

    const confirmar = confirm(
        `⚠️ ATENÇÃO: isso vai EXCLUIR PERMANENTEMENTE os ${registrosDoDia.length} registro(s) de presença do dia ${data}.\n\n` +
        `Essa ação não pode ser desfeita. Deseja continuar?`
    );
    if (!confirmar) return;

    const { error } = await _supabase.from('registros_presenca').delete().eq('data', data);

    if (error) {
        alert("Erro ao limpar a tabela: " + error.message);
    } else {
        alert(`Tabela do dia ${data} limpa com sucesso.`);
        atualizarTabela();
    }
}

function toggleSection(id, element) {
    document.getElementById(id).classList.toggle("hidden");
    element.classList.toggle("collapsed");
}

function filtrarTabela() {
    paginaAtual = 1;
    renderizarTabela();
}

function abrirModal(id, texto) {
    idAtualNota = id;
    document.getElementById("modalId").innerText = id;
    document.getElementById("notaTexto").value = (texto === 'null' || !texto) ? '' : texto;
    document.getElementById("modalNotas").style.display = "block";
}

function fecharModal() { document.getElementById("modalNotas").style.display = "none"; }

async function salvarNotaBD() {
    const texto = document.getElementById("notaTexto").value;
    await _supabase.from('registros_presenca').update({ observacao: texto }).eq('id', idAtualNota);
    fecharModal();
    atualizarTabela();
}