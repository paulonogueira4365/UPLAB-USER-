<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { 
    Search, Send, History, Loader2, AlertCircle, 
    CheckCircle2, Clock, ShoppingCart, PackageOpen
  } from 'lucide-svelte';
  import { fade, slide } from 'svelte/transition';

  // --- ESTADOS (Svelte 5) ---
  let produtos = $state<any[]>([]);
  let pedidos = $state<any[]>([]);
  let busca = $state('');
  let abaAtiva = $state<'catalogo' | 'pedidos'>('catalogo');
  let dadosUsuario = $state<any>(null);
  let carregando = $state(true);
  let enviandoId = $state<number | null>(null);
  let toast = $state({ mostrar: false, msg: '' });

  function mostrarToast(msg: string) {
    toast = { mostrar: true, msg };
    setTimeout(() => toast = { mostrar: false, msg: '' }, 3000);
  }

  async function carregarDados() {
    carregando = true;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userDb } = await supabase.from('usuarios').select('*').eq('id', user.id).single();
      dadosUsuario = userDb;

      // 1. Busca Pedidos (Ordens de Compra) do usuário
      const { data: ordens } = await supabase
        .from('ordens_compra')
        .select('*, itens_ordem_compra(produto_id, quantidade, produtos(nome))')
        .eq('usuario_id', user.id)
        .order('data_emissao', { ascending: false });

      pedidos = ordens || [];

      // 2. Busca Produtos Ativos de Estoque Direto
      const { data: prods } = await supabase
        .from('produtos')
        .select('*')
        .eq('ativo', true)
        .eq('estoque_direto_setor', true);

      // 3. Cruzamento de dados: Se o produto já tem OC aberta/aprovada, bloqueia o botão
      produtos = (prods || [])
        .filter(p => !p.setores_ids || p.setores_ids.length === 0 || p.setores_ids.includes(userDb?.setor_id))
        .map(p => {
          const ocAtiva = pedidos.find(ped => 
            ped.itens_ordem_compra.some((i: any) => i.produto_id === p.id) &&
            (ped.status === 'EM_ABERTO' || ped.status === 'APROVADA')
          );
          return { ...p, statusAtivo: ocAtiva?.status || null };
        });

    } catch (e: any) {
      console.error("Erro ao carregar:", e.message);
    } finally {
      carregando = false;
    }
  }

  async function solicitarCompra(produto: any) {
    if (enviandoId) return;
    enviandoId = produto.id;

    try {
      const fornecedorId = produto.fornecedores_ids?.[0] || null;

      // PASSO 1: Criar Ordem de Compra
      const { data: oc, error: errOc } = await supabase
        .from('ordens_compra')
        .insert([{
          fornecedor_id: fornecedorId,
          status: 'EM_ABERTO',
          valor_total: 0, // Obrigatório conforme seu SQL (Numeric 12,2)
          observacoes: `Solicitação direta setor: ${produto.nome}`
        }])
        .select().single();

      if (errOc) throw errOc;

      // PASSO 2: Criar Item (NÃO enviamos valor_total pois é GENERATED ALWAYS no seu SQL)
      const { error: errItem } = await supabase
        .from('itens_ordem_compra')
        .insert([{
          ordem_id: oc.id,
          produto_id: produto.id,
          quantidade: 1,
          preco_unitario: 0
        }]);

      if (errItem) throw errItem;

      mostrarToast(`Solicitação de ${produto.nome} enviada!`);
      await carregarDados(); // Recarrega para bloquear o botão do produto
    } catch (e: any) {
      alert("Falha ao salvar pedido: " + e.message);
    } finally {
      enviandoId = null;
    }
  }

  const filtrados = $derived(produtos.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase())));

  onMount(carregarDados);
</script>

<div class="layout">
  {#if toast.mostrar}
    <div class="toast" in:slide out:fade>
      <CheckCircle2 size={18} /> {toast.msg}
    </div>
  {/if}

  <header class="navbar">
    <div class="tabs">
      <button class:active={abaAtiva === 'catalogo'} onclick={() => abaAtiva = 'catalogo'}>
        <ShoppingCart size={18} /> Novo Pedido
      </button>
      <button class:active={abaAtiva === 'pedidos'} onclick={() => abaAtiva = 'pedidos'}>
        <History size={18} /> Histórico
      </button>
    </div>
  </header>

  <main>
    {#if abaAtiva === 'catalogo'}
      <div class="search-container">
        <Search size={20} class="icon" />
        <input type="text" placeholder="O que você precisa hoje?" bind:value={busca} />
      </div>

      {#if carregando}
        <div class="center"><Loader2 class="spin" size={40} /></div>
      {:else}
        <div class="grid">
          {#each filtrados as p}
            <div class="card" class:blocked={p.statusAtivo}>
              <div class="card-top">
                <span class="badge-un">{p.unidade_medida}</span>
                <h3>{p.nome}</h3>
              </div>

              {#if p.statusAtivo}
                <div class="status-info {p.statusAtivo.toLowerCase()}">
                  {#if p.statusAtivo === 'EM_ABERTO'}<Clock size={16} /> Em Análise
                  {:else}<CheckCircle2 size={16} /> Aprovado{/if}
                </div>
              {:else}
                <button class="btn-action" onclick={() => solicitarCompra(p)} disabled={enviandoId === p.id}>
                  {#if enviandoId === p.id}<Loader2 class="spin" size={18} />{:else}<Send size={18} /> Solicitar{/if}
                </button>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

    {:else}
      <div class="list">
        {#each pedidos as ped}
          <div class="row" in:fade>
            <div class="row-status">
              <span class="st-tag {ped.status.toLowerCase()}">{ped.status}</span>
              <small>#{ped.numero_oc}</small>
            </div>
            <div class="row-content">
              <strong>{ped.itens_ordem_compra[0]?.produtos?.nome || 'Item'}</strong>
              <span>{new Date(ped.data_emissao).toLocaleDateString()}</span>
            </div>
          </div>
        {:else}
          <div class="center"><PackageOpen size={48} /><p>Nenhum pedido encontrado.</p></div>
        {/each}
      </div>
    {/if}
  </main>
</div>

<style>
  :global(body) { background: #f8fafc; font-family: 'Inter', system-ui, sans-serif; }
  .layout { max-width: 900px; margin: 0 auto; padding: 20px; }

  .toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #10b981; color: white; padding: 12px 24px; border-radius: 12px; display: flex; align-items: center; gap: 10px; z-index: 100; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); font-weight: 600; }

  .navbar { margin-bottom: 2rem; display: flex; justify-content: center; }
  .tabs { background: #f1f5f9; padding: 4px; border-radius: 12px; display: flex; gap: 4px; border: 1px solid #e2e8f0; }
  .tabs button { border: none; background: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: 700; color: #64748b; transition: 0.2s; }
  .tabs button.active { background: white; color: #0ea5e9; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }

  .search-container { background: white; border: 1px solid #e2e8f0; border-radius: 16px; display: flex; align-items: center; padding: 0 20px; margin-bottom: 2rem; }
  .search-container input { border: none; padding: 16px; width: 100%; outline: none; font-size: 1rem; }
  .icon { color: #94a3b8; }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
  .card { background: white; border-radius: 20px; padding: 24px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; justify-content: space-between; min-height: 180px; transition: 0.2s; }
  .card.blocked { background: #f8fafc; border-style: dashed; }
  .card h3 { margin: 8px 0; font-size: 1.1rem; color: #1e293b; line-height: 1.4; }
  .badge-un { font-size: 0.7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; }

  .btn-action { background: #0ea5e9; color: white; border: none; padding: 12px; border-radius: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; }
  .btn-action:hover { background: #0284c7; }

  .status-info { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 12px; border-radius: 12px; font-size: 0.85rem; font-weight: 700; background: #f1f5f9; }
  .status-info.em_aberto { color: #b45309; }
  .status-info.aprovada { color: #166534; }

  .list { display: flex; flex-direction: column; gap: 12px; }
  .row { background: white; padding: 16px; border-radius: 16px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 24px; }
  .row-status { display: flex; flex-direction: column; min-width: 100px; gap: 4px; }
  .st-tag { font-size: 0.65rem; font-weight: 900; padding: 4px 8px; border-radius: 6px; text-transform: uppercase; text-align: center; }
  .st-tag.em_aberto { background: #fef3c7; color: #92400e; }
  .st-tag.aprovada { background: #dcfce7; color: #15803d; }
  .st-tag.rejeitada, .st-tag.cancelada { background: #fee2e2; color: #991b1b; }
  
  .row-content { flex: 1; display: flex; justify-content: space-between; align-items: center; }
  .row-content span { color: #94a3b8; font-size: 0.85rem; }

  .center { display: flex; flex-direction: column; align-items: center; padding: 4rem; color: #94a3b8; gap: 1rem; }
  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>