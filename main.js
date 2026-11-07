// ============================================================
// FIREBASE / CACHE EM MEMÓRIA
// ============================================================

let cacheDoadores = [];
let cacheDoacoes = [];
let cacheBeneficiarios = [];
let firestorePronto = false;

const DB = {
  doadores: () => cacheDoadores,
  doacoes: () => cacheDoacoes,
  beneficiarios: () => cacheBeneficiarios,

  async salvarBeneficiarios(dados) {
    await salvarColecao("beneficiarios", dados);
  },

  async salvarDoadores(dados) {
    await salvarColecao("doadores", dados);
  },

  async salvarDoacoes(dados) {
    await salvarColecao("doacoes", dados);
  }
};

function idDocumento(id) {
  return String(id);
}

// Salva a lista no Firestore, atualizando os documentos existentes.
async function salvarColecao(nome, dados) {
  const colecao = firebaseDb.collection(nome);
  const existentes = await colecao.get();

  const idsDesejados = new Set(
    dados.map(item => idDocumento(item.id))
  );

  const lote = firebaseDb.batch();

  // Remove documentos que não estão mais na lista.
  existentes.docs.forEach(doc => {
    if (!idsDesejados.has(doc.id)) {
      lote.delete(doc.ref);
    }
  });

  // Cria ou atualiza os documentos.
  dados.forEach(item => {
    const ref = colecao.doc(idDocumento(item.id));

    lote.set(ref, {
      ...item,
      id: Number(item.id)
    });
  });

  await lote.commit();
}

// ============================================================
// INICIALIZAÇÃO E ATUALIZAÇÃO DAS TELAS
// ============================================================

function atualizarTelasAbertas() {
  if (!firestorePronto) {
    return;
  }

  const paginaAtiva =
    document.querySelector(".pagina.ativa")?.id;

  if (paginaAtiva === "painel") {
    renderPainel();
  }

  if (paginaAtiva === "doadores") {
    renderDoadores();
  }

  if (paginaAtiva === "doacoes") {
    renderDoacoes();
  }

  if (paginaAtiva === "beneficiarios") {
    renderBeneficiarios();
  }

  if (paginaAtiva === "relatorio") {
    gerarRelatorio();
  }
}

async function iniciarFirebaseDados() {
  try {
    const carregado = {
      doadores: false,
      doacoes: false,
      beneficiarios: false
    };

    // Escuta uma coleção em tempo real e guarda no cache.
    function escutar(colecao, rotulo, guardar) {
      firebaseDb.collection(colecao).onSnapshot(
        snapshot => {
          guardar(
            snapshot.docs.map(doc => ({
              ...doc.data(),
              id: Number(doc.id)
            }))
          );

          carregado[colecao] = true;

          firestorePronto =
            carregado.doadores &&
            carregado.doacoes &&
            carregado.beneficiarios;

          if (firestorePronto) {
            atualizarTelasAbertas();
          }
        },

        erro => {
          console.error(
            `Erro ao carregar ${rotulo} do Firestore:`,
            erro
          );

          mostrarToast(
            `Erro ao carregar ${rotulo}. Verifique a configuração e as permissões.`,
            true
          );
        }
      );
    }

    escutar("doadores", "doadores", lista => {
      cacheDoadores = lista;
    });

    escutar("doacoes", "doações", lista => {
      cacheDoacoes = lista;
    });

    escutar("beneficiarios", "beneficiários", lista => {
      cacheBeneficiarios = lista;
    });
  } catch (erro) {
    console.error(
      "Erro ao iniciar o Firebase:",
      erro
    );

    mostrarToast(
      "Não foi possível conectar ao Firebase.",
      true
    );
  }
}

// ============================================================
// NAVEGAÇÃO
// ============================================================

function irPara(pagina) {
  document.querySelectorAll(".pagina").forEach(p => {
    p.classList.remove("ativa");
  });

  document.querySelectorAll(".nav-item").forEach(n => {
    n.classList.remove("ativo");
  });

  document.getElementById(pagina).classList.add("ativa");

  document.querySelectorAll(".nav-item").forEach(n => {
    const onclick = n.getAttribute("onclick") || "";

    if (onclick.includes(pagina)) {
      n.classList.add("ativo");
    }
  });

  if (pagina === "painel") {
    renderPainel();
  }

  if (pagina === "doadores") {
    renderDoadores();
  }

  if (pagina === "doacoes") {
    renderDoacoes();
  }

  if (pagina === "beneficiarios") {
    renderBeneficiarios();
  }

  if (pagina === "relatorio") {
    iniciarRelatorio();
    gerarRelatorio();
  }
}

// ============================================================
// UTILITÁRIOS
// ============================================================

function formatarData(d) {
  if (!d) {
    return "—";
  }

  const [y, m, dia] = d.split("-");

  return `${dia}/${m}/${y}`;
}

// Evita que texto digitado vire HTML ao ser exibido nas tabelas.
function esc(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

// Nome de quem recebeu a doação. Usa o cadastro atual (se o nome
// mudou) e cai no nome gravado na doação se o cadastro foi removido.
function nomeBeneficiarioDaDoacao(d) {
  if (!d.beneficiarioId) {
    return "";
  }

  const b = DB.beneficiarios().find(
    x => x.id === d.beneficiarioId
  );

  return b ? b.nome : (d.beneficiario || "");
}

// Máscara de celular: (11) 99999-9999
function mascararCelular(input) {
  let v = input.value.replace(/\D/g, "").slice(0, 11);

  if (v.length > 6) {
    const corte = v.length > 10 ? 7 : 6;
    v = `(${v.slice(0, 2)}) ${v.slice(2, corte)}-${v.slice(corte)}`;
  } else if (v.length > 2) {
    v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
  } else if (v.length > 0) {
    v = `(${v}`;
  }

  input.value = v;
}

function badgeTipoDoador(t) {
  if (t === "Empresa") {
    return "badge-azul";
  }

  if (t === "Igreja / Instituição") {
    return "badge-laranja";
  }

  if (t === "Anônimo") {
    return "badge-cinza";
  }

  return "badge-principal";
}

function badgeTipoItem(t) {
  const mapa = {
    "Alimento": "badge-verde",
    "Roupa": "badge-azul",
    "Higiene": "badge-laranja",
    "Medicamento": "badge-cinza",
    "Brinquedo": "badge-principal",
    "Móvel / Utensílio": "badge-cinza"
  };

  return mapa[t] || "badge-cinza";
}

// ============================================================
// TOAST
// ============================================================

function mostrarToast(msg, erro) {
  const t = document.getElementById("toast");

  t.textContent = msg;

  t.style.background = erro
    ? "var(--vermelho)"
    : "var(--principal)";

  t.classList.add("visivel");

  setTimeout(() => {
    t.classList.remove("visivel");
  }, 2800);
}

// ============================================================
// MODAIS
// ============================================================

function fecharModal(id) {
  document.getElementById(id).classList.remove("aberto");
}

// ============================================================
// PAINEL GERAL
// ============================================================

function renderPainel() {
  const doadores = DB.doadores();
  const doacoes = DB.doacoes();
  const hoje = new Date();

  const mesAtual = doacoes.filter(d => {
    const dt = new Date(d.data + "T12:00:00");

    return (
      dt.getMonth() === hoje.getMonth() &&
      dt.getFullYear() === hoje.getFullYear()
    );
  });

  const tipos = {};

  doacoes.forEach(d => {
    tipos[d.tipo] = (tipos[d.tipo] || 0) + 1;
  });

  const tipoTop = Object.entries(tipos)
    .sort((a, b) => b[1] - a[1])[0];

  document.getElementById("cards-painel").innerHTML = `
    <div class="card">
      <div class="card-label">Total de Doadores</div>
      <div class="card-valor">${doadores.length}</div>
      <div class="card-detalhe">cadastrados</div>
    </div>

    <div class="card">
      <div class="card-label">Total de Doações</div>
      <div class="card-valor">${doacoes.length}</div>
      <div class="card-detalhe">registradas</div>
    </div>

    <div class="card">
      <div class="card-label">Doações este mês</div>
      <div class="card-valor">${mesAtual.length}</div>
      <div class="card-detalhe">
        ${hoje.toLocaleString("pt-BR", {
          month: "long",
          year: "numeric"
        })}
      </div>
    </div>

    <div class="card">
      <div class="card-label">Item mais doado</div>
      <div class="card-valor" style="font-size:20px">
        ${tipoTop ? tipoTop[0] : "—"}
      </div>
      <div class="card-detalhe">
        ${tipoTop ? tipoTop[1] + " registros" : "sem dados"}
      </div>
    </div>
  `;

  const ultimas = [...doacoes]
    .sort((a, b) => b.id - a.id)
    .slice(0, 5);

  const tbody = document.getElementById("tabela-ultimas");

  tbody.innerHTML = ultimas.length === 0
    ? `
      <tr>
        <td colspan="4" class="sem-dados">
          <div class="ico-grande">📦</div>
          Nenhuma doação registrada ainda
        </td>
      </tr>
    `
    : ultimas.map(d => `
      <tr>
        <td>${
          d.pelaOng
            ? '<span class="badge badge-azul">ONG</span>'
            : `<strong>${esc(d.doador)}</strong>`
        }</td>
        <td>${d.item}</td>
        <td>${d.qtd}</td>
        <td>${formatarData(d.data)}</td>
      </tr>
    `).join("");
}

// ============================================================
// DOADORES
// ============================================================

let termoBuscaDoador = "";

function renderDoadores() {
  const todos = DB.doadores();
  const doacoes = DB.doacoes();

  const lista = todos.filter(d =>
    d.nome.toLowerCase().includes(
      termoBuscaDoador.toLowerCase()
    )
  );

  document.getElementById("contagem-doadores").textContent =
    `${lista.length} doador${lista.length !== 1 ? "es" : ""}`;

  const tbody = document.getElementById("tabela-doadores");

  if (lista.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="sem-dados">
          <div class="ico-grande">👥</div>
          ${
            termoBuscaDoador
              ? "Nenhum resultado encontrado"
              : "Nenhum doador cadastrado ainda"
          }
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML = lista.map(d => {
    const qtd = doacoes.filter(
      x => x.doadorId === d.id
    ).length;

    return `
      <tr>
        <td>
          <strong>${d.nome}</strong>
          ${
            d.obs
              ? `<br><span style="font-size:11px;color:var(--cinza-3)">${d.obs}</span>`
              : ""
          }
        </td>

        <td>
          <span class="badge ${badgeTipoDoador(d.tipo)}">
            ${d.tipo}
          </span>
        </td>

        <td>
          <span style="font-size:13px">
            ${d.tel || "—"}
          </span>

          ${
            d.email
              ? `<br><span style="font-size:11px;color:var(--cinza-3)">${d.email}</span>`
              : ""
          }
        </td>

        <td>
          <span class="badge badge-principal">
            ${qtd} ${qtd === 1 ? "doação" : "doações"}
          </span>
        </td>

        <td>
          <button
            class="btn btn-ghost btn-sm"
            onclick="editarDoador(${d.id})"
          >✏️</button>

          <button
            class="btn btn-perigo btn-sm"
            onclick="excluirDoador(${d.id})"
            style="margin-left:4px"
          >🗑️</button>
        </td>
      </tr>
    `;
  }).join("");
}

function filtrarDoadores(v) {
  termoBuscaDoador = v;
  renderDoadores();
}

let editandoDoador = null;

function abrirModalDoador(id) {
  editandoDoador = id || null;

  document.getElementById("titulo-modal-doador").textContent =
    id ? "Editar Doador" : "Novo Doador";

  if (id) {
    const d = DB.doadores().find(x => x.id === id);

    if (!d) {
      mostrarToast("Doador não encontrado.", true);
      return;
    }

    document.getElementById("d-nome").value = d.nome;
    document.getElementById("d-tipo").value = d.tipo;
    document.getElementById("d-tel").value = d.tel || "";
    document.getElementById("d-email").value = d.email || "";
    document.getElementById("d-obs").value = d.obs || "";
  } else {
    ["d-nome", "d-tel", "d-email", "d-obs"].forEach(f => {
      document.getElementById(f).value = "";
    });

    document.getElementById("d-tipo").value = "Pessoa Física";
  }

  document.getElementById("modal-doador")
    .classList.add("aberto");
}

function editarDoador(id) {
  abrirModalDoador(id);
}

async function salvarDoador() {
  const nome = document.getElementById("d-nome").value.trim();

  if (!nome) {
    mostrarToast("Informe o nome do doador", true);
    return;
  }

  const doadores = [...DB.doadores()];

  const doador = {
    id: editandoDoador || Date.now(),
    nome,
    tipo: document.getElementById("d-tipo").value,
    tel: document.getElementById("d-tel").value.trim(),
    email: document.getElementById("d-email").value.trim(),
    obs: document.getElementById("d-obs").value.trim()
  };

  if (editandoDoador) {
    const indice = doadores.findIndex(
      d => d.id === editandoDoador
    );

    if (indice === -1) {
      mostrarToast("Doador não encontrado.", true);
      return;
    }

    doadores[indice] = doador;
  } else {
    doadores.push(doador);
  }

  try {
    await DB.salvarDoadores(doadores);

    mostrarToast(
      editandoDoador
        ? "Doador atualizado!"
        : "Doador cadastrado!"
    );

    fecharModal("modal-doador");
    renderDoadores();
  } catch (erro) {
    console.error("Erro ao salvar doador:", erro);

    mostrarToast(
      "Não foi possível salvar o doador no Firebase.",
      true
    );
  }
}

async function excluirDoador(id) {
  if (
    !confirm(
      "Excluir este doador? As doações vinculadas não serão removidas."
    )
  ) {
    return;
  }

  try {
    const doadoresAtualizados = DB.doadores().filter(
      d => d.id !== id
    );

    await DB.salvarDoadores(doadoresAtualizados);

    mostrarToast("Doador removido.");
    renderDoadores();
  } catch (erro) {
    console.error("Erro ao excluir doador:", erro);

    mostrarToast(
      "Não foi possível excluir o doador no Firebase.",
      true
    );
  }
}

// ============================================================
// DOAÇÕES
// ============================================================

function renderDoacoes() {
  const busca = (
    document.getElementById("busca-doacoes")?.value || ""
  ).toLowerCase();

  const tipo =
    document.getElementById("filtro-tipo")?.value || "";

  const lista = DB.doacoes().filter(d =>
    (
      d.doador.toLowerCase().includes(busca) ||
      d.item.toLowerCase().includes(busca) ||
      nomeBeneficiarioDaDoacao(d).toLowerCase().includes(busca)
    ) &&
    (tipo === "" || d.tipo === tipo)
  );

  document.getElementById("contagem-doacoes").textContent =
    `${lista.length} ${lista.length === 1 ? "doação" : "doações"}`;

  const tbody = document.getElementById("tabela-doacoes");

  const sorted = [...lista].sort(
    (a, b) => b.id - a.id
  );

  if (sorted.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="sem-dados">
          <div class="ico-grande">📦</div>
          Nenhuma doação encontrada
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML = sorted.map(d => `
    <tr>
      <td>${
        d.pelaOng
          ? '<span class="badge badge-azul">ONG</span>'
          : `<strong>${esc(d.doador)}</strong>`
      }</td>
      <td>${d.item}</td>

      <td>
        <span class="badge ${badgeTipoItem(d.tipo)}">
          ${d.tipo}
        </span>
      </td>

      <td>${d.qtd}</td>
      <td>${formatarData(d.data)}</td>

      <td>
        ${
          nomeBeneficiarioDaDoacao(d)
            ? `<strong>${esc(nomeBeneficiarioDaDoacao(d))}</strong>`
            : '<span class="badge badge-cinza">Em estoque</span>'
        }
      </td>

      <td style="font-size:12px;color:var(--cinza-3)">
        ${d.obs || "—"}
      </td>

      <td>
        <button
          class="btn btn-ghost btn-sm"
          onclick="editarDoacao(${d.id})"
        >✏️</button>

        <button
          class="btn btn-perigo btn-sm"
          onclick="excluirDoacao(${d.id})"
          style="margin-left:4px"
        >🗑️</button>
      </td>
    </tr>
  `).join("");
}

function filtrarDoacoes() {
  renderDoacoes();
}

let editandoDoacao = null;

function abrirModalDoacao(id) {
  editandoDoacao = id || null;

  document.getElementById("titulo-modal-doacao").textContent =
    id ? "Editar Doação" : "Nova Doação";

  const doadores = DB.doadores();
  const sel = document.getElementById("dc-doador");

  sel.innerHTML = doadores.length === 0
    ? '<option value="">— Cadastre um doador primeiro —</option>'
    : doadores.map(d =>
        `<option value="${d.id}">${d.nome}</option>`
      ).join("");

  const beneficiarios = [...DB.beneficiarios()].sort(
    (a, b) => a.nome.localeCompare(b.nome, "pt-BR")
  );

  const selBen = document.getElementById("dc-beneficiario");

  selBen.innerHTML =
    '<option value="">— Ainda não entregue (em estoque) —</option>' +
    beneficiarios.map(b =>
      `<option value="${b.id}">${esc(b.nome)}</option>`
    ).join("");

  if (id) {
    const d = DB.doacoes().find(x => x.id === id);

    if (!d) {
      mostrarToast("Doação não encontrada.", true);
      return;
    }

    if (d.doadorId) {
      sel.value = d.doadorId;
    } else {
      sel.selectedIndex = 0;
    }

    document.getElementById("dc-ong").checked = !!d.pelaOng;
    selBen.value = d.beneficiarioId || "";

    document.getElementById("dc-tipo").value = d.tipo;
    document.getElementById("dc-data").value = d.data;
    document.getElementById("dc-item").value = d.item;
    document.getElementById("dc-qtd").value = d.qtd;
    document.getElementById("dc-obs").value = d.obs || "";
  } else {
    document.getElementById("dc-tipo").value = "Alimento";
    document.getElementById("dc-ong").checked = false;
    selBen.value = "";

    document.getElementById("dc-data").value =
      new Date().toISOString().split("T")[0];

    ["dc-item", "dc-qtd", "dc-obs"].forEach(f => {
      document.getElementById(f).value = "";
    });
  }

  alternarDoacaoOng();

  document.getElementById("modal-doacao")
    .classList.add("aberto");
}

// Mostra ou esconde a escolha do doador conforme "Doação feita pela ONG".
function alternarDoacaoOng() {
  const ong = document.getElementById("dc-ong").checked;

  document.getElementById("grupo-doador").style.display =
    ong ? "none" : "";

  document.getElementById("aviso-ong").style.display =
    ong ? "" : "none";
}

function editarDoacao(id) {
  abrirModalDoacao(id);
}

async function salvarDoacao() {
  const pelaOng = document.getElementById("dc-ong").checked;

  const doadorId = pelaOng
    ? null
    : parseInt(document.getElementById("dc-doador").value, 10);

  const item =
    document.getElementById("dc-item").value.trim();

  const qtd =
    document.getElementById("dc-qtd").value.trim();

  const data =
    document.getElementById("dc-data").value;

  if ((!pelaOng && !doadorId) || !item || !qtd || !data) {
    mostrarToast(
      "Preencha todos os campos obrigatórios.",
      true
    );

    return;
  }

  const doador = pelaOng
    ? null
    : DB.doadores().find(d => d.id === doadorId);

  if (!pelaOng && !doador) {
    mostrarToast("Selecione um doador válido.", true);
    return;
  }

  const beneficiarioId = parseInt(
    document.getElementById("dc-beneficiario").value,
    10
  ) || null;

  const beneficiario = beneficiarioId
    ? DB.beneficiarios().find(b => b.id === beneficiarioId)
    : null;

  const doacoes = [...DB.doacoes()];

  const doacao = {
    id: editandoDoacao || Date.now(),
    doadorId: pelaOng ? null : doador.id,
    doador: pelaOng ? "ONG" : doador.nome,
    pelaOng,
    beneficiarioId: beneficiario ? beneficiario.id : null,
    beneficiario: beneficiario ? beneficiario.nome : "",
    tipo: document.getElementById("dc-tipo").value,
    item,
    qtd,
    data,
    obs: document.getElementById("dc-obs").value.trim()
  };

  if (editandoDoacao) {
    const indice = doacoes.findIndex(
      d => d.id === editandoDoacao
    );

    if (indice === -1) {
      mostrarToast("Doação não encontrada.", true);
      return;
    }

    doacoes[indice] = doacao;
  } else {
    doacoes.push(doacao);
  }

  try {
    await DB.salvarDoacoes(doacoes);

    mostrarToast(
      editandoDoacao
        ? "Doação atualizada!"
        : "Doação registrada!"
    );

    fecharModal("modal-doacao");
    renderDoacoes();
    renderPainel();
  } catch (erro) {
    console.error("Erro ao salvar doação:", erro);

    mostrarToast(
      "Não foi possível salvar a doação no Firebase.",
      true
    );
  }
}

async function excluirDoacao(id) {
  if (!confirm("Excluir esta doação?")) {
    return;
  }

  try {
    const doacoesAtualizadas = DB.doacoes().filter(
      d => d.id !== id
    );

    await DB.salvarDoacoes(doacoesAtualizadas);

    mostrarToast("Doação removida.");
    renderDoacoes();
    renderPainel();
  } catch (erro) {
    console.error("Erro ao excluir doação:", erro);

    mostrarToast(
      "Não foi possível excluir a doação no Firebase.",
      true
    );
  }
}

// ============================================================
// BENEFICIÁRIOS (quem recebe as doações)
// ============================================================

let termoBuscaBeneficiario = "";

function renderBeneficiarios() {
  const doacoes = DB.doacoes();
  const termo = termoBuscaBeneficiario.toLowerCase();

  const lista = DB.beneficiarios()
    .filter(b =>
      b.nome.toLowerCase().includes(termo) ||
      (b.endereco || "").toLowerCase().includes(termo) ||
      (b.tel || "").includes(termo)
    )
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  document.getElementById("contagem-beneficiarios").textContent =
    `${lista.length} ${lista.length === 1 ? "beneficiário" : "beneficiários"}`;

  const tbody = document.getElementById("tabela-beneficiarios");

  if (lista.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="sem-dados">
          <div class="ico-grande">🏠</div>
          ${
            termoBuscaBeneficiario
              ? "Nenhum resultado encontrado"
              : "Nenhum beneficiário cadastrado ainda"
          }
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML = lista.map(b => {
    const recebidas = doacoes
      .filter(d => d.beneficiarioId === b.id)
      .sort((x, y) => y.data.localeCompare(x.data));

    const resumo = recebidas
      .slice(0, 3)
      .map(d => esc(d.item))
      .join(", ");

    return `
      <tr>
        <td><strong>${esc(b.nome)}</strong></td>

        <td>${esc(b.tel) || "—"}</td>

        <td style="max-width:260px">${esc(b.endereco) || "—"}</td>

        <td>
          <span class="badge badge-principal">
            ${recebidas.length} ${recebidas.length === 1 ? "doação" : "doações"}
          </span>
          ${
            resumo
              ? `<br><span style="font-size:11px;color:var(--cinza-3)">${resumo}${recebidas.length > 3 ? "…" : ""}</span>`
              : ""
          }
        </td>

        <td>
          <button
            class="btn btn-ghost btn-sm"
            onclick="editarBeneficiario(${b.id})"
          >✏️</button>

          <button
            class="btn btn-perigo btn-sm"
            onclick="excluirBeneficiario(${b.id})"
            style="margin-left:4px"
          >🗑️</button>
        </td>
      </tr>
    `;
  }).join("");
}

function filtrarBeneficiarios(v) {
  termoBuscaBeneficiario = v;
  renderBeneficiarios();
}

let editandoBeneficiario = null;

function abrirModalBeneficiario(id) {
  editandoBeneficiario = id || null;

  document.getElementById("titulo-modal-beneficiario").textContent =
    id ? "Editar Beneficiário" : "Novo Beneficiário";

  if (id) {
    const b = DB.beneficiarios().find(x => x.id === id);

    if (!b) {
      mostrarToast("Beneficiário não encontrado.", true);
      return;
    }

    document.getElementById("b-nome").value = b.nome;
    document.getElementById("b-tel").value = b.tel || "";
    document.getElementById("b-endereco").value = b.endereco || "";
  } else {
    ["b-nome", "b-tel", "b-endereco"].forEach(f => {
      document.getElementById(f).value = "";
    });
  }

  document.getElementById("modal-beneficiario")
    .classList.add("aberto");
}

function editarBeneficiario(id) {
  abrirModalBeneficiario(id);
}

async function salvarBeneficiario() {
  const nome = document.getElementById("b-nome").value.trim();
  const tel = document.getElementById("b-tel").value.trim();

  const endereco =
    document.getElementById("b-endereco").value.trim();

  if (!nome || !tel || !endereco) {
    mostrarToast(
      "Preencha nome, celular e endereço.",
      true
    );

    return;
  }

  if (tel.replace(/\D/g, "").length < 10) {
    mostrarToast(
      "Informe o celular com DDD.",
      true
    );

    return;
  }

  const beneficiarios = [...DB.beneficiarios()];

  const beneficiario = {
    id: editandoBeneficiario || Date.now(),
    nome,
    tel,
    endereco
  };

  if (editandoBeneficiario) {
    const indice = beneficiarios.findIndex(
      b => b.id === editandoBeneficiario
    );

    if (indice === -1) {
      mostrarToast("Beneficiário não encontrado.", true);
      return;
    }

    beneficiarios[indice] = beneficiario;
  } else {
    beneficiarios.push(beneficiario);
  }

  try {
    await DB.salvarBeneficiarios(beneficiarios);

    mostrarToast(
      editandoBeneficiario
        ? "Beneficiário atualizado!"
        : "Beneficiário cadastrado!"
    );

    fecharModal("modal-beneficiario");
    renderBeneficiarios();
  } catch (erro) {
    console.error("Erro ao salvar beneficiário:", erro);

    mostrarToast(
      "Não foi possível salvar o beneficiário no Firebase.",
      true
    );
  }
}

async function excluirBeneficiario(id) {
  const vinculadas = DB.doacoes().filter(
    d => d.beneficiarioId === id
  ).length;

  const aviso = vinculadas > 0
    ? `Excluir este beneficiário? As ${vinculadas} doação(ões) entregues a ele continuarão registradas, com o nome dele.`
    : "Excluir este beneficiário?";

  if (!confirm(aviso)) {
    return;
  }

  try {
    const atualizados = DB.beneficiarios().filter(
      b => b.id !== id
    );

    await DB.salvarBeneficiarios(atualizados);

    mostrarToast("Beneficiário removido.");
    renderBeneficiarios();
  } catch (erro) {
    console.error("Erro ao excluir beneficiário:", erro);

    mostrarToast(
      "Não foi possível excluir o beneficiário no Firebase.",
      true
    );
  }
}

// ============================================================
// RELATÓRIO MENSAL
// ============================================================

function iniciarRelatorio() {
  const hoje = new Date();

  document.getElementById("rel-mes").value =
    hoje.getMonth() + 1;

  document.getElementById("rel-ano").value =
    hoje.getFullYear();
}

const ESTILO_MUDO = "font-size:11px;color:var(--texto-2);line-height:1.6";

function linhaMuda(texto) {
  return `<br><span style="${ESTILO_MUDO}">${esc(texto)}</span>`;
}

// Quem doou: nome, tipo, telefone e e-mail (ou "ONG").
function celulaDoadorRelatorio(d) {
  if (d.pelaOng) {
    return `<strong>ONG</strong>${linhaMuda("Doação feita pela ONG")}`;
  }

  const cadastro = DB.doadores().find(x => x.id === d.doadorId);
  const nome = cadastro ? cadastro.nome : d.doador;

  let html = `<strong>${esc(nome)}</strong>`;

  if (cadastro) {
    if (cadastro.tipo) {
      html += linhaMuda(cadastro.tipo);
    }

    if (cadastro.tel) {
      html += linhaMuda(`Tel: ${cadastro.tel}`);
    }

    if (cadastro.email) {
      html += linhaMuda(cadastro.email);
    }
  }

  return html;
}

// Quem recebeu: nome, celular e endereço (ou "em estoque").
function celulaBeneficiarioRelatorio(d) {
  if (!d.beneficiarioId) {
    return `<span style="${ESTILO_MUDO}">Não entregue (em estoque)</span>`;
  }

  const cadastro = DB.beneficiarios().find(
    x => x.id === d.beneficiarioId
  );

  const nome = cadastro ? cadastro.nome : d.beneficiario;

  let html = `<strong>${esc(nome)}</strong>`;

  if (cadastro) {
    if (cadastro.tel) {
      html += linhaMuda(`Celular: ${cadastro.tel}`);
    }

    if (cadastro.endereco) {
      html += linhaMuda(`Endereço: ${cadastro.endereco}`);
    }
  } else {
    html += linhaMuda("Cadastro removido");
  }

  return html;
}

// O que foi doado: item, quantidade, tipo e observações.
function celulaDoacaoRelatorio(d) {
  let html = `<strong>${esc(d.item)}</strong>`;

  html += `<br>Quantidade: ${esc(d.qtd)}`;
  html += `<br>Tipo: ${esc(d.tipo)}`;

  if (d.obs) {
    html += linhaMuda(`Obs.: ${d.obs}`);
  }

  return html;
}

function gerarRelatorio() {
  const mes = parseInt(
    document.getElementById("rel-mes").value,
    10
  );

  const ano = parseInt(
    document.getElementById("rel-ano").value,
    10
  );

  const meses = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro"
  ];

  const doacoes = DB.doacoes().filter(d => {
    const dt = new Date(d.data + "T12:00:00");

    return (
      dt.getMonth() + 1 === mes &&
      dt.getFullYear() === ano
    );
  });

  const container =
    document.getElementById("conteudo-relatorio");

  if (doacoes.length === 0) {
    container.innerHTML = `
      <div class="sem-dados">
        <div class="ico-grande">📄</div>
        Nenhuma doação registrada em ${meses[mes - 1]}/${ano}
      </div>
    `;

    return;
  }

  const tipos = {};
  const doadores = {};

  doacoes.forEach(d => {
    tipos[d.tipo] = (tipos[d.tipo] || 0) + 1;

    doadores[d.doador] =
      (doadores[d.doador] || 0) + 1;
  });

  const doadoresDiferentes = new Set(
    doacoes
      .filter(d => !d.pelaOng)
      .map(d => d.doadorId || d.doador)
  ).size;

  const feitasPelaOng = doacoes.filter(d => d.pelaOng).length;
  const entregues = doacoes.filter(d => d.beneficiarioId).length;

  container.innerHTML = `
    <h2 style="font-family:'DM Serif Display',serif;font-size:20px;color:var(--principal);margin-bottom:4px">
      Relatório de Doações — ${meses[mes - 1]}/${ano}
    </h2>

    <p style="font-size:12px;color:var(--cinza-3);margin-bottom:24px">
      Gerado em ${new Date().toLocaleDateString("pt-BR")}
    </p>

    <div class="rel-secao">
      <h3>Resumo Geral</h3>

      <div class="rel-linha">
        <span>Total de doações registradas</span>
        <span class="valor">${doacoes.length}</span>
      </div>

      <div class="rel-linha">
        <span>Doadores diferentes (sem contar a ONG)</span>
        <span class="valor">${doadoresDiferentes}</span>
      </div>

      <div class="rel-linha">
        <span>Doações feitas pela ONG</span>
        <span class="valor">${feitasPelaOng}</span>
      </div>

      <div class="rel-linha">
        <span>Doações entregues a beneficiários</span>
        <span class="valor">${entregues}</span>
      </div>

      <div class="rel-linha">
        <span>Doações em estoque (sem beneficiário)</span>
        <span class="valor">${doacoes.length - entregues}</span>
      </div>
    </div>

    <div class="rel-secao">
      <h3>Doações por Tipo de Item</h3>

      ${Object.entries(tipos)
        .sort((a, b) => b[1] - a[1])
        .map(([t, n]) => `
          <div class="rel-linha">
            <span>${t}</span>
            <span class="valor">
              ${n} registro${n !== 1 ? "s" : ""}
            </span>
          </div>
        `).join("")}
    </div>

    <div class="rel-secao">
      <h3>Doadores do Mês</h3>

      ${Object.entries(doadores)
        .sort((a, b) => b[1] - a[1])
        .map(([n, q]) => `
          <div class="rel-linha">
            <span>${n}</span>
            <span class="valor">
              ${q} ${q === 1 ? "doação" : "doações"}
            </span>
          </div>
        `).join("")}
    </div>

    <div class="rel-secao">
      <h3>Detalhamento das Doações</h3>

      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:var(--cinza-1)">
            <th style="padding:8px;text-align:left;border-bottom:1px solid var(--cinza-2);width:11%">Data</th>
            <th style="padding:8px;text-align:left;border-bottom:1px solid var(--cinza-2);width:25%">Quem doou</th>
            <th style="padding:8px;text-align:left;border-bottom:1px solid var(--cinza-2);width:32%">Quem recebeu</th>
            <th style="padding:8px;text-align:left;border-bottom:1px solid var(--cinza-2);width:32%">O que foi doado</th>
          </tr>
        </thead>

        <tbody>
          ${[...doacoes]
            .sort((a, b) => a.data.localeCompare(b.data))
            .map(d => `
              <tr style="border-bottom:1px solid var(--cinza-2);page-break-inside:avoid">
                <td style="padding:8px;vertical-align:top">${formatarData(d.data)}</td>
                <td style="padding:8px;vertical-align:top">${celulaDoadorRelatorio(d)}</td>
                <td style="padding:8px;vertical-align:top">${celulaBeneficiarioRelatorio(d)}</td>
                <td style="padding:8px;vertical-align:top">${celulaDoacaoRelatorio(d)}</td>
              </tr>
            `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function imprimirRelatorio() {
  window.print();
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================

// Fecha os modais ao clicar fora do conteúdo.
document.querySelectorAll(".modal-overlay").forEach(m => {
  m.addEventListener("click", e => {
    if (e.target === m) {
      m.classList.remove("aberto");
    }
  });
});

// O carregamento inicial e as atualizações são controlados
// pelos listeners do Firestore.
iniciarFirebaseDados();