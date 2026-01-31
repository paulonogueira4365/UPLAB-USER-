
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	export interface AppTypes {
		RouteId(): "/" | "/alterar-senha" | "/notificacoes" | "/pedidos" | "/requisicao" | "/solicitacoes-agendadas" | "/solicitar-troca";
		RouteParams(): {
			
		};
		LayoutParams(): {
			"/": Record<string, never>;
			"/alterar-senha": Record<string, never>;
			"/notificacoes": Record<string, never>;
			"/pedidos": Record<string, never>;
			"/requisicao": Record<string, never>;
			"/solicitacoes-agendadas": Record<string, never>;
			"/solicitar-troca": Record<string, never>
		};
		Pathname(): "/" | "/alterar-senha" | "/alterar-senha/" | "/notificacoes" | "/notificacoes/" | "/pedidos" | "/pedidos/" | "/requisicao" | "/requisicao/" | "/solicitacoes-agendadas" | "/solicitacoes-agendadas/" | "/solicitar-troca" | "/solicitar-troca/";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/logo-uplab.jpg" | "/logo-uplab.png" | "/robots.txt" | "/UPLAB.png" | string & {};
	}
}