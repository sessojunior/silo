/**
 * Configuração centralizada de datas para o projeto SILO
 * Timezone: São Paulo (America/Sao_Paulo)
 *
 * Este arquivo centraliza todas as configurações de data do projeto
 * para garantir consistência de timezone em toda a aplicação.
 */

export const DATE_CONFIG = {
	TIMEZONE: 'America/Sao_Paulo',
	DATE_FORMAT: 'YYYY-MM-DD',
	DATETIME_FORMAT: 'YYYY-MM-DD HH:mm:ss',
	DISPLAY_DATE_FORMAT: 'DD/MM/YYYY',
	DISPLAY_DATETIME_FORMAT: 'DD/MM/YYYY HH:mm',
	LOCALE: 'pt-BR',
	TIMEZONE_OFFSET: -3, // GMT-3
} as const

export type DateConfig = typeof DATE_CONFIG
