<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { goto } from '$app/navigation';
  import { fade } from 'svelte/transition';

  let usuario = $state("");
  let senha = $state("");
  let lembrarSenha = $state(true);
  let carregando = $state(false);
  let mensagemErro = $state("");

  onMount(() => {
    const salvoUser = localStorage.getItem('login_user');
    const salvoSenha = localStorage.getItem('login_senha');
    if (salvoUser && salvoSenha) {
      usuario = salvoUser;
      senha = salvoSenha;
    }
  });

  async function handleLogin(e: Event) {
    e.preventDefault();
    carregando = true;
    mensagemErro = "";

    try {
      // 1. Busca os dados básicos do usuário
      const { data: userRow, error: findError } = await supabase
        .from('usuarios')
        .select('email, setor_id')
        .eq('usuario', usuario)
        .single();

      if (findError || !userRow) throw new Error("Usuário não cadastrado.");

      // 2. Autenticação no Supabase Auth
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: userRow.email,
        password: senha
      });

      if (authError) throw authError;

      // 3. Salvar preferências
      if (lembrarSenha) {
        localStorage.setItem('login_user', usuario);
        localStorage.setItem('login_senha', senha);
      } else {
        localStorage.removeItem('login_user');
        localStorage.removeItem('login_senha');
      }

      // 4. Redirecionamento Inteligente:
      // Se for Surfaçagem (4), vai para troca de diamante. 
      // Se não, vai para a requisição normal.
      if (userRow.setor_id === 4) {
        goto('/solicitar-troca');
      } else {
        goto('/requisicao');
      }
      
    } catch (err: any) {
      mensagemErro = err.message === "Invalid login credentials" 
        ? "Senha incorreta para este usuário." 
        : err.message;
    } finally {
      carregando = false;
    }
  }
</script>

<div class="login-page">
  <div class="stripe s1"></div>
  <div class="stripe s2"></div>

  <div class="login-card" in:fade>
    <div class="logo-container">
      <img src="/UPLAB.png" alt="Logo UPLAB" class="logo" />
    </div>

    <header>
      <h1>UPLAB <span>USUÁRIO</span></h1>
      <p>Acesse o Terminal de Produção</p>
    </header>

    <form onsubmit={handleLogin} class="form">
      <div class="input-group">
        <label for="usuario">Usuário / Login</label>
        <input id="usuario" type="text" bind:value={usuario} placeholder="Digite seu usuário..." required />
      </div>

      <div class="input-group">
        <label for="senha">Senha de Acesso</label>
        <input id="senha" type="password" bind:value={senha} placeholder="••••••••" required />
      </div>

      <div class="options">
        <label class="checkbox-container">
          <input type="checkbox" bind:checked={lembrarSenha}> 
          <span class="checkmark"></span>
          Lembrar meu acesso
        </label>
      </div>

      {#if mensagemErro}
        <div class="error-msg" in:fade>{mensagemErro}</div>
      {/if}

      <button type="submit" class="btn-login" disabled={carregando}>
        {carregando ? "VALIDANDO..." : "ENTRAR NO SISTEMA"}
      </button>
    </form>
    
    <footer>© 2026 UPLAB Labs - Sistema LTDA</footer>
  </div>
</div>

<style>
  /* Mantenha o seu CSS original aqui */
  :global(body) { margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Inter', sans-serif; overflow: hidden; }
  .login-page { height: 100vh; width: 100vw; display: flex; align-items: center; justify-content: center; position: relative; background-color: #f8fafc; }
  .stripe { position: absolute; background: #e2e8f0; transform: rotate(-15deg); z-index: 0; }
  .s1 { width: 100%; height: 300px; top: -100px; left: -10%; opacity: 0.5; }
  .s2 { width: 100%; height: 400px; bottom: -150px; right: -5%; opacity: 0.3; }
  .login-card { background: white; padding: 2.5rem; border-radius: 24px; width: 90%; max-width: 380px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.08); z-index: 10; border: 1px solid #e2e8f0; }
  .logo-container { text-align: center; margin-bottom: 1rem; }
  .logo { width: 70px; height: 70px; object-fit: contain; border-radius: 14px; }
  header { text-align: center; margin-bottom: 2rem; }
  h1 { color: #0f172a; margin: 0; font-size: 1.5rem; font-weight: 700; }
  h1 span { color: #0284c7; }
  p { color: #64748b; font-size: 0.85rem; margin-top: 0.4rem; }
  .form { display: flex; flex-direction: column; gap: 1.2rem; }
  .input-group { display: flex; flex-direction: column; gap: 0.5rem; }
  label { color: #475569; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
  input { background: #f1f5f9; border: 1px solid #e2e8f0; padding: 0.9rem 1rem; border-radius: 12px; color: #1e293b; font-size: 1rem; outline: none; transition: all 0.2s; }
  input:focus { background: white; border-color: #0284c7; box-shadow: 0 0 0 4px rgba(2, 132, 199, 0.1); }
  .checkbox-container { display: flex; align-items: center; gap: 0.5rem; color: #64748b; font-size: 0.85rem; cursor: pointer; }
  .btn-login { background: #0284c7; color: white; border: none; padding: 1.1rem; border-radius: 12px; font-weight: 700; cursor: pointer; margin-top: 0.5rem; letter-spacing: 0.02em; transition: all 0.2s; }
  .btn-login:hover { background: #0369a1; transform: translateY(-1px); }
  .btn-login:disabled { background: #94a3b8; transform: none; }
  .error-msg { color: #b91c1c; font-size: 0.8rem; text-align: center; background: #fef2f2; padding: 0.75rem; border-radius: 10px; border: 1px solid #fee2e2; }
  footer { text-align: center; margin-top: 2.5rem; color: #94a3b8; font-size: 0.7rem; letter-spacing: 0.03em; }
</style>