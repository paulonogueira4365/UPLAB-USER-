<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { 
    Box, Search, RefreshCw, 
    CheckCircle2, Clock, User, Package, Calendar, AlertCircle
  } from 'lucide-svelte';
  import { fade, fly } from 'svelte/transition';

  // --- INTERFACES ---
  interface Requisicao {
    id: number;
    status: 'PENDENTE' | 'ENTREGUE';
    quantidade: number;
    horario_retirada: string;
    data_retirada: string;
    observacao_geral: string;
    data_criacao: string;
    setor_id: number;
    // Dados do produto normal
    produtos: {
      nome: string;
      unidade_medida: string;
    } | null;
    // Dados do produto avulso
    produtos_expedicao_avulso: {
      nome: string;
      unidade_medida: string;
    } | null;
  }

  // --- ESTADOS ---
  let requisicoes = $state<Requisicao[]>([]);
  let carregando = $state(true);
  let busca = $state("");
  let tabAtiva = $state<'PENDENTE' | 'HISTORICO'>('PENDENTE');
  let setorUsuario = $state({ id: null as number | null, nome: "Carregando..." });

  async function carregarDados() {
    carregando = true;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: perfil } = await supabase
        .from('usuarios')
        .select(`setor_id, setores ( nome )`)
        .eq('id', user.id)
        .single();
      
      if (perfil) {
        const infoSetor: any = perfil.setores;
        setorUsuario = { 
          id: perfil.setor_id, 
          nome: (Array.isArray(infoSetor) ? infoSetor[0]?.nome : infoSetor?.nome) || "Setor não identificado" 
        };
        
        // BUSCA COM JOIN EM AMBAS AS TABELAS (PRODUTOS E AVULSOS)
        const { data, error } = await supabase
          .from('requisicoes')
          .select(`
            *, 
            produtos ( nome, unidade_medida ),
            produtos_expedicao_avulso ( nome, unidade_medida )
          `)
          .eq('setor_id', setorUsuario.id)
          .order('data_criacao', { ascending: false });

        if (data) requisicoes = data as unknown as Requisicao[];
      }
    } catch (e) {
      console.error("Erro na carga de dados:", e);
    } finally {
      carregando = false;
    }
  }

  // --- LÓGICA DE EXIBIÇÃO ---
  // Essa função decide qual nome mostrar: se o do produto cadastrado ou do avulso
  function getNomeProduto(item: Requisicao) {
    if (item.produtos) return item.produtos.nome;
    if (item.produtos_expedicao_avulso) return `(AVULSO) ${item.produtos_expedicao_avulso.nome}`;
    return "Produto não identificado";
  }

  let filtradas = $derived(
    requisicoes.filter(r => {
      const statusMatch = tabAtiva === 'PENDENTE' ? r.status === 'PENDENTE' : r.status === 'ENTREGUE';
      const nomeProd = getNomeProduto(r).toLowerCase();
      const obsGeral = r.observacao_geral?.toLowerCase() || "";
      const buscaTermo = busca.toLowerCase();
      
      return statusMatch && (nomeProd.includes(buscaTermo) || obsGeral.includes(buscaTermo));
    })
  );

  function formatarSolicitante(texto: string) {
    if (!texto) return "Solicitante N/A";
    const partes = texto.split('SOLICITANTE:');
    if (partes.length > 1) return partes[1].split('|')[0].trim();
    return "Solicitante";
  }

  onMount(carregarDados);
</script>

<div class="app-container">
  <aside class="sidebar">
    <div class="header-setor">
      <div class="setor-icon"><Package size={20} /></div>
      <div class="setor-info">
        <h1>{setorUsuario.nome}</h1>
        <p>Painel do Setor</p>
      </div>
    </div>

    <div class="nav-menu">
      <button class:active={tabAtiva === 'PENDENTE'} onclick={() => tabAtiva = 'PENDENTE'}>
        <Clock size={18} />
        Aguardando
        {#if requisicoes.filter(r => r.status === 'PENDENTE').length > 0}
          <span class="count-pill">{requisicoes.filter(r => r.status === 'PENDENTE').length}</span>
        {/if}
      </button>
      <button class:active={tabAtiva === 'HISTORICO'} onclick={() => tabAtiva = 'HISTORICO'}>
        <CheckCircle2 size={18} />
        Histórico
      </button>
    </div>

    <div class="search-wrapper">
      <div class="search-input">
        <Search size={16} />
        <input type="text" bind:value={busca} placeholder="Buscar material..." />
      </div>
    </div>

    <button class="sync-button" onclick={carregarDados} disabled={carregando}>
      <RefreshCw size={16} class={carregando ? 'spinning' : ''} />
      {carregando ? 'Sincronizando...' : 'Atualizar Painel'}
    </button>
  </aside>

  <main class="main-content">
    {#if carregando}
      <div class="state-view"><div class="loading-spinner"></div></div>
    {:else if filtradas.length === 0}
      <div class="state-view" in:fade>
        <Box size={48} strokeWidth={1} color="#cbd5e1" />
        <p>Nenhuma requisição nesta aba.</p>
      </div>
    {:else}
      <div class="grid-pedidos">
        {#each filtradas as item (item.id)}
          <div class="card-pedido" in:fly={{ y: 10, duration: 300 }}>
            <div class="card-header">
              <span class="solicitante-tag">
                <User size={12} /> {formatarSolicitante(item.observacao_geral)}
              </span>
              <div class="turno-tag" class:noite={item.horario_retirada === 'NOITE'}>
                {item.horario_retirada}
              </div>
            </div>

            <div class="card-body">
              <div class="prod-row">
                <span class="quantidade">{item.quantidade}x</span>
                <span class="nome-prod" class:is-avulso={!!item.produtos_expedicao_avulso}>
                  {getNomeProduto(item)}
                </span>
              </div>
              
              <div class="info-row">
                <Calendar size={13} />
                <span>Previsto: {item.data_retirada ? new Date(item.data_retirada + 'T00:00:00').toLocaleDateString('pt-BR') : 'Não definida'}</span>
              </div>
            </div>

            <div class="card-status status-{item.status === 'PENDENTE' ? 'aguardando' : 'entregue'}">
              {#if item.status === 'PENDENTE'}
                <div class="pulse-dot"></div> Pendente
              {:else}
                <CheckCircle2 size={14} /> Entregue
              {/if}
              
              {#if item.produtos_expedicao_avulso}
                 <div class="avulso-indicator" title="Item não cadastrado formalmente">
                   <AlertCircle size={12} /> Avulso
                 </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </main>
</div>

<style>
  :global(body) { margin: 0; background: #f8fafc; font-family: 'Inter', sans-serif; }
  .app-container { display: flex; height: 100vh; width: 100vw; overflow: hidden; }

  /* SIDEBAR */
  .sidebar { width: 280px; background: #fff; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; padding: 1.5rem; gap: 1.5rem; flex-shrink: 0; }
  .header-setor { display: flex; gap: 12px; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 1.5rem; }
  .setor-icon { background: #3b82f6; color: #fff; padding: 8px; border-radius: 10px; display: flex; align-items: center; }
  .setor-info h1 { font-size: 1rem; margin: 0; color: #1e293b; font-weight: 800; }
  .setor-info p { font-size: 0.75rem; margin: 0; color: #64748b; }

  .nav-menu { display: flex; flex-direction: column; gap: 6px; }
  .nav-menu button { display: flex; align-items: center; gap: 10px; padding: 12px; border: none; background: none; border-radius: 10px; cursor: pointer; color: #64748b; font-weight: 600; transition: 0.2s; }
  .nav-menu button.active { background: #eff6ff; color: #2563eb; }
  .count-pill { margin-left: auto; background: #dbeafe; color: #1e40af; font-size: 0.7rem; padding: 2px 8px; border-radius: 20px; }

  .search-input { position: relative; display: flex; align-items: center; }
  .search-input input { width: 100%; padding: 10px 10px 10px 38px; border-radius: 10px; border: 1px solid #e2e8f0; background: #f8fafc; outline: none; font-size: 0.85rem; }

  .sync-button { margin-top: auto; padding: 12px; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; color: #475569; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }

  /* CONTEÚDO */
  .main-content { flex: 1; padding: 2rem; overflow-y: auto; background: #f1f5f9; }
  .grid-pedidos { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; align-content: start; }

  .card-pedido { background: #fff; border-radius: 16px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; transition: 0.2s; position: relative; }
  .card-header { padding: 1rem; display: flex; justify-content: space-between; align-items: center; }
  .solicitante-tag { font-size: 0.75rem; font-weight: 700; color: #475569; display: flex; align-items: center; gap: 5px; background: #f1f5f9; padding: 4px 10px; border-radius: 20px; }
  .turno-tag { font-size: 0.65rem; font-weight: 800; color: #64748b; text-transform: uppercase; padding: 3px 7px; border-radius: 5px; border: 1px solid #e2e8f0; }
  .turno-tag.noite { background: #1e293b; color: #fbbf24; border: none; }

  .card-body { padding: 1.25rem; flex: 1; }
  .prod-row { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 12px; }
  .quantidade { background: #3b82f6; color: #fff; font-size: 0.75rem; font-weight: 800; padding: 2px 6px; border-radius: 5px; }
  .nome-prod { font-weight: 700; color: #1e293b; font-size: 0.95rem; }
  .nome-prod.is-avulso { color: #92400e; } /* Cor diferenciada para itens avulsos */

  .info-row { font-size: 0.75rem; color: #94a3b8; display: flex; align-items: center; gap: 6px; }

  .card-status { padding: 0.8rem 1.25rem; font-size: 0.75rem; font-weight: 800; display: flex; align-items: center; gap: 8px; border-radius: 0 0 16px 16px; justify-content: space-between; }
  .status-aguardando { background: #fffbeb; color: #b45309; }
  .status-entregue { background: #f0fdf4; color: #15803d; }

  .avulso-indicator { display: flex; align-items: center; gap: 4px; background: #fef3c7; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; color: #9a3412; }

  .pulse-dot { width: 7px; height: 7px; background: #f59e0b; border-radius: 50%; animation: pulse 1.5s infinite; }
  
  :global(.spinning) { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.4); opacity: 0.6; } }

  .state-view { height: 70vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; color: #94a3b8; }
  .loading-spinner { width: 28px; height: 28px; border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; }
</style>