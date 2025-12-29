/**
 * Constantes do sistema de incidentes
 */

export const NO_INCIDENTS_CATEGORY_NAME = 'Não houve incidentes'
export const NO_INCIDENTS_CATEGORY_ID = 'no_incidents'

/**
 * Verifica se uma categoria representa um incidente real
 * @param categoryId - ID da categoria
 * @returns true se for um incidente real, false se for "Não houve incidentes"
 */
export const isRealIncident = (categoryId: string | null): boolean => {
	return categoryId !== null && categoryId !== NO_INCIDENTS_CATEGORY_ID
}
