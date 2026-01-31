<script lang="ts">
	import { enhance } from '$app/forms';
	import { RefreshCw, CheckCircle2, AlertCircle, ArrowLeftRight } from 'lucide-svelte';
	import { fade } from 'svelte/transition';

	let { data, form } = $props();
	let carregando = $state(false);
</script>

<div class="user-container">
	<header class="user-header">
		<ArrowLeftRight size={32} color="#3b82f6" />
		<h1>Solicitar Troca</h1>
		<p>Sinalize o diamante que terminou o uso</p>
	</header>

	{#if form?.success}
		<div class="success-msg" in:fade>
			<CheckCircle2 size={24} />
			{form.message}
		</div>
	{/if}

	<div class="list-section">
		<h2>Diamantes em Uso na Máquina</h2>
		
		{#if data.diamantes.length === 0}
			<div class="empty-state">
				<AlertCircle size={40} />
				<p>Não há diamantes registrados em uso no momento.</p>
			</div>
		{:else}
			<div class="request-grid">
				{#each data.diamantes as d (d.id)}
					<div class="request-card">
						<div class="card-info">
							<span class="label">CÓDIGO</span>
							<strong class="code">{d.codigo}</strong>
							<span class="cycles">Afiações: {d.ciclos_afiacao}/10</span>
						</div>

						<form method="POST" action="?/solicitarTroca" use:enhance={() => {
							carregando = true;
							return async ({ update }) => {
								carregando = false;
								await update();
							};
						}}>
							<input type="hidden" name="id" value={d.id} />
							<button class="btn-devolver" disabled={carregando}>
								<RefreshCw size={18} class={carregando ? 'spin' : ''} />
								DEVOLVER PARA AFIAÇÃO
							</button>
						</form>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	:global(body) { background: #f8fafc; margin: 0; font-family: sans-serif; }
	.user-container { max-width: 600px; margin: 0 auto; padding: 20px; }

	.user-header { text-align: center; padding: 40px 0; }
	.user-header h1 { margin: 10px 0 5px 0; color: #1e293b; font-size: 28px; }
	.user-header p { color: #64748b; margin: 0; }

	.success-msg { 
		background: #ecfdf5; color: #059669; padding: 20px; border-radius: 16px; 
		margin-bottom: 20px; display: flex; align-items: center; gap: 12px; font-weight: bold;
		border: 1px solid #d1fae5;
	}

	.list-section h2 { font-size: 14px; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; margin-bottom: 20px; }

	.request-grid { display: flex; flex-direction: column; gap: 15px; }

	.request-card { 
		background: white; padding: 20px; border-radius: 20px; 
		box-shadow: 0 4px 6px rgba(0,0,0,0.03); border: 1px solid #e2e8f0;
		display: flex; flex-direction: column; gap: 20px;
	}

	.card-info { display: flex; flex-direction: column; }
	.label { font-size: 10px; font-weight: 800; color: #3b82f6; }
	.code { font-size: 24px; font-family: monospace; color: #1e293b; }
	.cycles { font-size: 12px; color: #64748b; margin-top: 4px; }

	.btn-devolver { 
		background: #1e293b; color: white; border: none; padding: 16px; 
		border-radius: 14px; font-weight: 800; width: 100%; cursor: pointer;
		display: flex; align-items: center; justify-content: center; gap: 10px;
		transition: 0.2s;
	}
	.btn-devolver:hover { background: #334155; }
	.btn-devolver:active { transform: scale(0.98); }

	.empty-state { text-align: center; padding: 60px 0; color: #cbd5e1; }
	.empty-state p { margin-top: 10px; }

	.spin { animation: rotate 1s linear infinite; }
	@keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>