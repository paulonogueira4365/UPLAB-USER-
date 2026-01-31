// @ts-nocheck
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { supabase } from '$lib/supabase';

export const load = async () => {
    // Busca apenas diamantes que estão em uso para o usuário devolver
    const { data } = await supabase
        .from('diamantes')
        .select('*')
        .eq('status', 'em_uso')
        .order('codigo', { ascending: true });

    return { diamantes: data ?? [] };
};

export const actions = {
    solicitarTroca: async ({ request }: import('./$types').RequestEvent) => {
        const formData = await request.formData();
        const id = formData.get('id');

        if (!id) return fail(400, { message: "Selecione um diamante." });

        // Quando o usuário devolve, o status muda automaticamente para 'afiando'
        const { error } = await supabase
            .from('diamantes')
            .update({ status: 'afiando' })
            .eq('id', id);

        if (error) return fail(400, { message: "Erro ao processar devolução." });

        return { success: true, message: "Diamante enviado para afiação com sucesso!" };
    }
};;null as any as PageServerLoad;;null as any as Actions;