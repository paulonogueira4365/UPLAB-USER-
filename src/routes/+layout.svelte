<script lang="ts">
  import "../app.css";
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import { 
    LayoutDashboard, CalendarCheck, 
    LogOut, User, ShieldCheck, Gem, ShoppingCart
  } from 'lucide-svelte';
  import { onMount } from 'svelte';

  // Recebe o conteúdo da página via snippets (Svelte 5)
  let { children } = $props();

  let dadosUsuario = $state({ 
    nome: "Carregando...", 
    setor: "...", 
    setorId: null as number | null 
  });

  // Forçamos o tipo para string para evitar o erro de "overlap" do TS
  let path = $derived($page.url.pathname as string);
  let mostrarMenu = $derived(path !== '/');

  onMount(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('usuarios')
        .select('nome, setor_id, setores(nome)')
        .eq('id', user.id)
        .single();
      
      if (data) {
        dadosUsuario = {
          nome: data.nome,
          setorId: data.setor_id,
          setor: (data.setores as any)?.nome || "Geral"
        };
      }
    } else if (path !== '/') {
      goto('/');
    }
  });

  async function sair() {
    await supabase.auth.signOut();
    goto('/');
  }
</script>

<div class="app-shell">
  {#if mostrarMenu}
    <header class="top-nav">
      <div class="nav-container">
        <div class="logo-area">
          <div class="logo-box">UP</div>
          <div class="brand">
            <span class="brand-title">UPLAB <strong>SISTEMA</strong></span>
            <span class="brand-subtitle">{dadosUsuario.setor}</span>
          </div>
        </div>

        <nav class="nav-links">
          <a href="/requisicao" class:active={path === '/requisicao'}>
            <LayoutDashboard size={18} />
            <span>Solicitar Material</span>
          </a>

          <a href="/pedidos" class:active={path === '/pedidos'}>
            <ShoppingCart size={18} />
            <span>SOLICITAÇÃO DE COMPRA</span>
          </a>

          {#if dadosUsuario.setorId === 4}
            <a href="/solicitar-troca" class:active={path === '/solicitar-troca'}>
              <Gem size={18} />
              <span>Troca de Diamantes</span>
            </a>
          {/if}

          <a href="/solicitacoes-agendadas" class:active={path === '/solicitacoes-agendadas'}>
            <CalendarCheck size={18} />
            <span>Histórico</span>
          </a>
        </nav>

        <div class="user-actions">
          <div class="user-badge">
             <div class="avatar"><User size={14} /></div>
             <span class="user-name">{dadosUsuario.nome.split(' ')[0]}</span>
          </div>
          <div class="v-divider"></div>
          <button class="logout-btn" onclick={sair}>
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  {/if}

  <main class="main-content" class:with-nav={mostrarMenu}>
    {#if children}
      {@render children()}
    {/if}
  </main>
</div>

<style>
  /* Mantém o mesmo CSS anterior */
  :global(body) { margin: 0; background-color: #f8fafc; font-family: 'Inter', sans-serif; overflow: hidden; }
  .app-shell { display: flex; flex-direction: column; height: 100vh; width: 100vw; }
  .top-nav { height: 64px; background: #0f172a; color: white; display: flex; align-items: center; padding: 0 1.5rem; border-bottom: 3px solid #0ea5e9; }
  .nav-container { width: 100%; max-width: 1600px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
  .logo-area { display: flex; align-items: center; gap: 12px; }
  .logo-box { width: 34px; height: 34px; background: #0ea5e9; color: white; border-radius: 8px; display: grid; place-items: center; font-weight: 900; }
  .brand { display: flex; flex-direction: column; }
  .brand-subtitle { font-size: 0.65rem; color: #94a3b8; text-transform: uppercase; }
  .nav-links { display: flex; gap: 4px; }
  .nav-links a { display: flex; align-items: center; gap: 8px; padding: 8px 14px; color: #94a3b8; text-decoration: none; font-size: 0.8rem; border-radius: 8px; }
  .nav-links a.active { background: #1e293b; color: #0ea5e9; }
  .user-actions { display: flex; align-items: center; gap: 12px; }
  .user-badge { display: flex; align-items: center; gap: 10px; background: #1e293b; padding: 6px 14px; border-radius: 12px; }
  .avatar { background: #334155; color: #0ea5e9; border-radius: 50%; width: 24px; height: 24px; display: grid; place-items: center; }
  .logout-btn { background: none; border: none; color: #64748b; cursor: pointer; }
  .main-content { flex: 1; overflow-y: auto; }
</style>