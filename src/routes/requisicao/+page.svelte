<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { fade, slide, fly, scale } from 'svelte/transition';
  // @ts-ignore
  import * as Icons from 'lucide-svelte';

  // --- INTERFACES ---
  interface Produto {
    id: number;
    nome: string;
    unidade_medida: string;
    estoque_atual: number;
    estoque_minimo: number;
    previsao_chegada?: string | null;
    tem_oc_pendente?: boolean;
    is_avulso?: boolean;
  }

  interface ItemCarrinho extends Produto {
    quantidade_pedida: number;
    observacao_item: string;
  }

  // --- ESTADOS ---
  let busca = $state("");
  let nomeAvulso = $state("");
  let solicitante = $state(""); 
  let turnoSelecionado = $state(""); 
  let carregando = $state(true);
  let enviando = $state(false);
  let sucesso = $state(false); 
  let mostrarModal = $state(false);
  let mostrarCampoAvulso = $state(false);
  
  let produtosBase = $state<Produto[]>([]);
  let carrinho = $state<ItemCarrinho[]>([]);
  let dadosUsuario = $state({ nome: "", setor_id: null as number | null, setor_nome: "" });
  let listaMembros = $state<string[]>([]); 

  let agendamento = $state({
    data: new Date().toISOString().split('T')[0],
    obsGeral: ""
  });

  const turnos = [
    { id: 'MANHÃ', label: 'Manhã', icon: '☀️' },
    { id: 'TARDE', label: 'Tarde', icon: '⛅' },
    { id: 'NOITE', label: 'Noite', icon: '🌙' }
  ];

  // --- LÓGICA FILTRADA ---
  let produtosFiltrados = $derived(
    busca.length > 1 
      ? produtosBase.filter((p) => p.nome.toLowerCase().includes(busca.toLowerCase())).slice(0, 8)
      : []
  );

  onMount(async () => {
    await carregarDadosIniciais();
  });

  async function carregarDadosIniciais() {
    carregando = true;
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data: profile } = await supabase
        .from('usuarios')
        .select('nome, setor_id, setores(nome, membros)')
        .eq('id', userData?.user?.id).single();
      
      const infoSetor = Array.isArray(profile?.setores) ? profile.setores[0] : profile?.setores;
      
      dadosUsuario = {
        nome: profile?.nome || "",
        setor_id: profile?.setor_id,
        setor_nome: (infoSetor as any)?.nome || "Não definido"
      };
      listaMembros = (infoSetor as any)?.membros || [];

      const { data: prodData } = await supabase
        .from('produtos')
        .select(`
          id, nome, unidade_medida, estoque_minimo, 
          estoque_saldos!inner (saldo),
          itens_ordem_compra (
            ordens_compra!inner (
              compras (previsao_entrega, status_entrega)
            )
          )
        `)
        .eq('ativo', true)
        .eq('estoque_saldos.unidade_id', 2)
        .filter('setores_ids', 'cs', `[${dadosUsuario.setor_id}]`)
        .order('nome');

      produtosBase = (prodData || []).map((p: any) => {
        const comprasPendentes = (p.itens_ordem_compra || [])
          .map((item: any) => item.ordens_compra?.compras)
          .flat()
          .filter((c: any) => c && c.status_entrega !== 'RECEBIDA' && c.status_entrega !== 'CANCELADA' && c.previsao_entrega)
          .sort((a: any, b: any) => new Date(a.previsao_entrega).getTime() - new Date(b.previsao_entrega).getTime());

        return {
          id: p.id,
          nome: p.nome,
          unidade_medida: p.unidade_medida,
          estoque_minimo: p.estoque_minimo,
          estoque_atual: p.estoque_saldos[0]?.saldo || 0,
          previsao_chegada: comprasPendentes[0]?.previsao_entrega || null,
          tem_oc_pendente: comprasPendentes.length > 0,
          is_avulso: false
        };
      });
    } catch (e) { 
      console.error("Erro ao carregar dados:", e); 
    } finally { 
      carregando = false; 
    }
  }

  function adicionarAoCarrinho(p: Produto) {
    if (p.estoque_atual <= 0 && !p.is_avulso) return;
    const existente = carrinho.find(item => item.id === p.id && item.is_avulso === p.is_avulso);
    if (existente) {
      existente.quantidade_pedida += 1;
    } else {
      carrinho.push({ ...p, quantidade_pedida: 1, observacao_item: p.is_avulso ? "ITEM AVULSO - NÃO ENCONTRADO" : "" });
    }
    busca = ""; 
    nomeAvulso = "";
    mostrarCampoAvulso = false;
    sucesso = false;
  }

  async function salvarProdutoAvulso() {
    if (nomeAvulso.length < 3) return;
    try {
      const { data, error } = await supabase
        .from('produtos_expedicao_avulso')
        .insert({ nome: nomeAvulso.toUpperCase(), unidade_medida: 'UN' })
        .select()
        .single();

      if (error) throw error;

      const novoProduto: Produto = {
        id: data.id,
        nome: data.nome,
        unidade_medida: 'UN',
        estoque_atual: 0,
        estoque_minimo: 0,
        is_avulso: true
      };

      adicionarAoCarrinho(novoProduto);
    } catch (e: any) {
      alert("Erro ao salvar avulso: " + e.message);
    }
  }

  async function finalizarRequisicao() {
    if (!solicitante || !turnoSelecionado || carrinho.length === 0) return;
    enviando = true;
    try {
      const msgNoite = turnoSelecionado === 'NOITE' ? "ENTREGA NO SETOR." : "";
      const obsFinal = `[TURNO: ${turnoSelecionado}] SOLICITANTE: ${solicitante} | ${msgNoite} | ${agendamento.obsGeral}`;
      
      const payload = carrinho.map(item => ({
        produto_id: item.is_avulso ? null : item.id,
        produto_avulso_id: item.is_avulso ? item.id : null,
        setor_id: dadosUsuario.setor_id,
        quantidade: item.quantidade_pedida,
        observacao: item.observacao_item,
        data_retirada: agendamento.data,
        horario_retirada: turnoSelecionado,
        observacao_geral: obsFinal.toUpperCase(),
        status: 'PENDENTE'
      }));

      const { error } = await supabase.from('requisicoes').insert(payload);
      if (error) throw error;
      
      sucesso = true;
      mostrarModal = false;
      carrinho = [];
      solicitante = "";
      turnoSelecionado = "";
      setTimeout(() => { sucesso = false; }, 5000);
    } catch (e: any) { 
      alert("Erro ao enviar: " + e.message); 
    } finally { 
      enviando = false; 
    }
  }
</script>

<div class="app-shell">
  <header>
    <div class="header-content">
      <div class="logo-area">
        <Icons.PackageSearch size={24} color="#3b82f6" />
        <span>REQUISIÇÃO WEB | <strong>{dadosUsuario.setor_nome}</strong></span>
      </div>
      <div class="user-pill">
        <Icons.User size={14} /> {dadosUsuario.nome}
      </div>
    </div>
  </header>

  <main class="container">
    <div class="grid">
      <section class="search-section">
        <div class="search-container">
          <div class="s-icon-wrapper"><Icons.Search size={28} /></div>
          <input type="text" placeholder="Pesquisar material..." bind:value={busca} />
          
          {#if (busca.length > 1)}
            <div class="search-results" in:fly={{y: 10}}>
              {#each produtosFiltrados as p}
                <button 
                  class="result-item" 
                  class:disabled={p.estoque_atual <= 0}
                  onclick={() => adicionarAoCarrinho(p)} 
                  disabled={p.estoque_atual <= 0}
                >
                  <div class="r-info">
                    <div class="name-row">
                      <span class="r-name" class:off={p.estoque_atual <= 0}>{p.nome}</span>
                      {#if p.estoque_atual <= 0}
                        <span class="badge-error">INDISPONÍVEL</span>
                      {:else if p.estoque_atual <= p.estoque_minimo}
                        <span class="badge-warn">Baixo Estoque</span>
                      {/if}
                    </div>
                    <div class="arrival-info">
                      <span class="stock-pill" class:zero={p.estoque_atual <= 0} class:ok={p.estoque_atual > 0}>
                        Estoque: <b>{p.estoque_atual} {p.unidade_medida}</b>
                      </span>
                    </div>
                  </div>
                  {#if p.estoque_atual > 0} 
                    <div class="add-circle"><Icons.Plus size={20} /></div>
                  {:else} 
                    <div class="lock-icon"><Icons.Lock size={20} /></div> 
                  {/if}
                </button>
              {/each}

              <div class="avulso-box">
                {#if !mostrarCampoAvulso}
                  <button class="btn-avulso-toggle" onclick={() => { mostrarCampoAvulso = true; nomeAvulso = busca; }}>
                    <Icons.HelpCircle size={18} />
                    Não encontrou o que precisa? Clique aqui.
                  </button>
                {:else}
                  <div class="avulso-form" in:slide>
                    <label>Descreva o item faltante:</label>
                    <div class="avulso-input-row">
                      <input type="text" bind:value={nomeAvulso} placeholder="Ex: FITA ISOLANTE 20M..." />
                      <button class="btn-add-avulso" onclick={salvarProdutoAvulso} disabled={nomeAvulso.length < 3}>
                        ADICIONAR
                      </button>
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      </section>

      <section class="checkout-section">
        <div class="card">
          <div class="card-head">
            <Icons.ShoppingCart size={20} />
            <h2>Seu Pedido</h2>
            {#if carrinho.length > 0}
              <span class="count-badge" in:scale>{carrinho.length}</span>
            {/if}
          </div>

          <div class="cart-body">
            {#if sucesso}
              <div class="success-screen" in:scale>
                <div class="icon-pulse"><Icons.CheckCircle2 size={64} color="#16a34a" /></div>
                <h3>Enviado com Sucesso!</h3>
                <button class="btn-primary" onclick={() => sucesso = false}>Fazer outro pedido</button>
              </div>
            {:else}
              {#each carrinho as item, i (item.id + (item.is_avulso ? '-av' : ''))}
                <div class="cart-item" in:slide>
                  <div class="item-header">
                    <span class="name">
                      {item.nome} 
                      {#if item.is_avulso}<small class="avulso-tag">AVULSO</small>{/if}
                    </span>
                    <button class="del-btn" onclick={() => carrinho.splice(i, 1)}><Icons.Trash2 size={16}/></button>
                  </div>
                  <div class="item-ui">
                    <input type="text" placeholder="Observação..." bind:value={item.observacao_item} />
                    <div class="stepper">
                      <button onclick={() => item.quantidade_pedida > 1 && item.quantidade_pedida--}>-</button>
                      <span>{item.quantidade_pedida}</span>
                      <button onclick={() => item.quantidade_pedida++}>+</button>
                    </div>
                  </div>
                </div>
              {:else}
                <div class="empty-state">
                  <Icons.ShoppingCart size={48} strokeWidth={1} />
                  <p>Carrinho vazio.</p>
                </div>
              {/each}
            {/if}
          </div>

          {#if carrinho.length > 0 && !sucesso}
            <div class="card-footer">
              <button class="btn-primary" onclick={() => mostrarModal = true}>
                FINALIZAR REQUISIÇÃO <Icons.ArrowRight size={18} />
              </button>
            </div>
          {/if}
        </div>
      </section>
    </div>
  </main>
</div>

{#if mostrarModal}
<div class="modal-backdrop" onclick={() => mostrarModal = false}>
  <div class="modal-content" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <h3>Confirmação de Retirada</h3>
      <button onclick={() => mostrarModal = false}><Icons.X size={20}/></button>
    </div>
    <div class="modal-body">
      <div class="input-field">
        <label>Quem está solicitando?</label>
        <select bind:value={solicitante}>
          <option value="">Selecione...</option>
          {#each listaMembros as m} <option value={m}>{m}</option> {/each}
          <option value="OUTRO">OUTRO / VISITANTE</option>
        </select>
      </div>
      <div class="input-field">
        <label>Turno de Entrega</label>
        <div class="turno-selector">
          {#each turnos as t}
            <button class:active={turnoSelecionado === t.id} onclick={() => turnoSelecionado = t.id}>
              <span>{t.icon}</span> {t.label}
            </button>
          {/each}
        </div>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick={() => mostrarModal = false}>Voltar</button>
      <button class="btn-confirm" disabled={!solicitante || !turnoSelecionado || enviando} onclick={finalizarRequisicao}>
        {enviando ? 'Enviando...' : 'Confirmar'}
      </button>
    </div>
  </div>
</div>
{/if}

<style>
  :global(body) { margin: 0; background: #f8fafc; font-family: 'Inter', sans-serif; color: #1e293b; overflow: hidden; }
  .app-shell { height: 100vh; display: flex; flex-direction: column; }
  header { background: white; border-bottom: 1px solid #e2e8f0; padding: 0.75rem 2rem; }
  .header-content { display: flex; justify-content: space-between; align-items: center; max-width: 1400px; margin: 0 auto; width: 100%; }
  .logo-area { display: flex; align-items: center; gap: 10px; font-size: 0.9rem; }
  .user-pill { background: #f1f5f9; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; display: flex; align-items: center; gap: 6px; font-weight: 600; }
  .container { flex: 1; padding: 2rem; max-width: 1400px; margin: 0 auto; width: 100%; }
  .grid { display: grid; grid-template-columns: 1fr 420px; gap: 2.5rem; height: 100%; }

  /* BUSCA */
  .search-section { padding-top: 2rem; }
  .search-container { position: relative; max-width: 800px; margin: 0 auto; }
  .s-icon-wrapper { position: absolute; left: 24px; top: 22px; color: #3b82f6; }
  .search-container input { width: 100%; padding: 24px 24px 24px 70px; border-radius: 24px; border: 2px solid #e2e8f0; font-size: 1.4rem; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
  
  .search-results { position: absolute; top: 110%; left: 0; right: 0; background: white; border-radius: 20px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); z-index: 100; overflow: hidden; border: 1px solid #e2e8f0; }
  .result-item { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 18px 24px; border: none; background: none; cursor: pointer; border-bottom: 1px solid #f1f5f9; text-align: left; }
  .result-item:hover:not(:disabled) { background: #f8fafc; }
  .r-name { font-weight: 700; font-size: 1.1rem; }
  .badge-error { background: #fee2e2; color: #b91c1c; font-size: 0.65rem; padding: 2px 8px; border-radius: 4px; margin-left: 8px; font-weight: 700; }
  
  /* AVULSO CSS */
  .avulso-box { background: #f1f5f9; padding: 16px; border-top: 2px dashed #cbd5e1; }
  .btn-avulso-toggle { width: 100%; background: none; border: none; color: #3b82f6; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 8px; }
  .avulso-form label { font-size: 0.7rem; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 8px; display: block; }
  .avulso-input-row { display: flex; gap: 8px; }
  .avulso-input-row input { flex: 1; padding: 10px !important; font-size: 0.9rem !important; border-radius: 10px !important; border: 1px solid #cbd5e1 !important; }
  .btn-add-avulso { background: #3b82f6; color: white; border: none; padding: 0 15px; border-radius: 10px; font-weight: 700; cursor: pointer; }
  .btn-add-avulso:disabled { background: #cbd5e1; }
  .avulso-tag { background: #fef3c7; color: #92400e; font-size: 0.6rem; padding: 2px 6px; border-radius: 4px; margin-left: 8px; }

  /* CARRINHO */
  .card { background: white; border-radius: 24px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; height: 82vh; }
  .card-head { padding: 1.5rem; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #f1f5f9; }
  .cart-body { flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 12px; }
  .cart-item { background: #f8fafc; padding: 16px; border-radius: 16px; border: 1px solid #f1f5f9; }
  .item-ui { display: flex; gap: 10px; margin-top: 10px; }
  .item-ui input { flex: 1; padding: 8px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.8rem; }
  .stepper { display: flex; align-items: center; background: white; border: 1px solid #e2e8f0; border-radius: 8px; }
  .stepper button { border: none; padding: 5px 10px; cursor: pointer; color: #3b82f6; font-weight: bold; }
  
  .btn-primary { width: 100%; padding: 18px; border-radius: 16px; border: none; background: #1e293b; color: white; font-weight: 800; cursor: pointer; display: flex; justify-content: center; gap: 10px; }
  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: grid; place-items: center; z-index: 1000; }
  .modal-content { background: white; padding: 2rem; border-radius: 24px; width: 400px; }
  .turno-selector { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 10px; }
  .turno-selector button { padding: 10px; border-radius: 10px; border: 1px solid #e2e8f0; cursor: pointer; }
  .turno-selector button.active { background: #3b82f6; color: white; border-color: #3b82f6; }



  :global(body) { margin: 0; background: #f8fafc; font-family: 'Inter', sans-serif; color: #1e293b; overflow: hidden; }
  .app-shell { height: 100vh; display: flex; flex-direction: column; }
  
  header { background: white; border-bottom: 1px solid #e2e8f0; padding: 0.75rem 2rem; }
  .header-content { display: flex; justify-content: space-between; align-items: center; max-width: 1400px; margin: 0 auto; width: 100%; }
  .logo-area { display: flex; align-items: center; gap: 10px; font-size: 0.9rem; }
  .user-pill { background: #f1f5f9; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; display: flex; align-items: center; gap: 6px; font-weight: 600; }

  .container { flex: 1; padding: 2rem; max-width: 1400px; margin: 0 auto; width: 100%; }
  .grid { display: grid; grid-template-columns: 1fr 420px; gap: 2.5rem; height: 100%; }

  /* BUSCA E RESULTADOS */
  .search-section { padding-top: 4rem; }
  .search-container { position: relative; max-width: 800px; margin: 0 auto; }
  .s-icon-wrapper { position: absolute; left: 24px; top: 22px; color: #3b82f6; }
  .search-container input { width: 100%; padding: 24px 24px 24px 70px; border-radius: 24px; border: 2px solid #e2e8f0; font-size: 1.4rem; background: white; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
  .search-container input:focus { border-color: #3b82f6; outline: none; }

  .search-results { position: absolute; top: 110%; left: 0; right: 0; background: white; border-radius: 20px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); z-index: 100; overflow: hidden; border: 1px solid #e2e8f0; }
  .result-item { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 18px 24px; border: none; background: none; cursor: pointer; border-bottom: 1px solid #f1f5f9; text-align: left; }
  .result-item:hover:not(:disabled) { background: #f8fafc; }
  .result-item.disabled { background: #fcfcfc; cursor: not-allowed; opacity: 0.7; }
  
  .r-name { font-weight: 700; color: #1e293b; font-size: 1.1rem; }
  .r-name.off { color: #94a3b8; text-decoration: line-through; }
  
  .badge-error { background: #fee2e2; color: #b91c1c; font-size: 0.65rem; padding: 2px 8px; border-radius: 4px; margin-left: 8px; font-weight: 700; }
  .badge-warn { background: #fff7ed; color: #c2410c; font-size: 0.65rem; padding: 2px 8px; border-radius: 4px; border: 1px solid #ffedd5; margin-left: 8px; }

  .arrival-info { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
  .stock-pill { font-size: 0.75rem; padding: 2px 8px; border-radius: 6px; font-weight: 700; width: fit-content; }
  .stock-pill.zero { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
  .stock-pill.ok { background: #f1f5f9; color: #475569; }

  .arrival-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 0.75rem; color: #059669; background: #ecfdf5; padding: 2px 8px; border-radius: 4px; border: 1px solid #d1fae5; width: fit-content; }
  .no-arrival { font-size: 0.7rem; color: #94a3b8; font-style: italic; }

  .add-circle { width: 36px; height: 36px; background: #3b82f6; color: white; border-radius: 50%; display: grid; place-items: center; transition: transform 0.2s; }
  .lock-icon { color: #cbd5e1; width: 36px; height: 36px; display: grid; place-items: center; }

  /* CARRINHO */
  .card { background: white; border-radius: 24px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; height: 85vh; }
  .card-head { padding: 1.5rem; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #f1f5f9; }
  .card-head h2 { font-size: 1.1rem; margin: 0; font-weight: 800; flex: 1; }
  .count-badge { background: #3b82f6; color: white; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; font-size: 0.75rem; font-weight: 700; }
  
  .cart-body { flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 12px; }
  .cart-item { background: #f8fafc; padding: 16px; border-radius: 16px; border: 1px solid #f1f5f9; }
  .item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .item-ui { display: flex; gap: 10px; align-items: center; }
  .item-ui input { flex: 1; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.8rem; }
  
  .stepper { display: flex; align-items: center; background: white; border: 1px solid #e2e8f0; border-radius: 8px; height: 32px; }
  .stepper button { border: none; background: none; width: 28px; cursor: pointer; color: #3b82f6; font-weight: 700; }
  .stepper span { width: 30px; text-align: center; font-size: 0.85rem; font-weight: 700; }

  .card-footer { padding: 1.5rem; border-top: 1px solid #f1f5f9; }
  .btn-primary { width: 100%; padding: 18px; border-radius: 16px; border: none; background: #1e293b; color: white; font-weight: 800; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 10px; }

  /* MODAL */
  .modal-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); display: grid; place-items: center; z-index: 1000; }
  .modal-content { background: white; width: 95%; max-width: 460px; border-radius: 28px; }
  .modal-header { padding: 1.5rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
  .modal-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
  .input-field { display: flex; flex-direction: column; gap: 6px; }
  .input-field label { font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; }
  .input-field select, .input-field input { padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0; font-size: 1rem; }
  
  .turno-selector { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .turno-selector button { padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .turno-selector button.active { border-color: #3b82f6; background: #eff6ff; }

  .noite-detalhe { background: #fff7ed; border: 1px solid #ffedd5; border-radius: 16px; padding: 12px; }
  .noite-header { display: flex; align-items: center; gap: 8px; color: #9a3412; font-weight: 700; font-size: 0.8rem; margin-bottom: 8px; }
  .noite-body ul { margin: 0; padding-left: 20px; font-size: 0.75rem; color: #9a3412; }

  .modal-actions { padding: 1.5rem; background: #f8fafc; border-radius: 0 0 28px 28px; display: grid; grid-template-columns: 1fr 2fr; gap: 12px; }
  .btn-confirm { padding: 12px; border-radius: 12px; border: none; background: #3b82f6; color: white; font-weight: 700; cursor: pointer; }
  .btn-confirm:disabled { background: #cbd5e1; cursor: not-allowed; }

  .empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #cbd5e1; gap: 1rem; }
  .success-screen { text-align: center; padding: 2rem 0; }
  .icon-pulse { animation: pulse 2s infinite; }
  @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
</style>