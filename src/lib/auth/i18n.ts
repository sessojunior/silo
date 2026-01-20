export type AuthClientErrorLike = {
  code?: string;
  message?: string;
  status?: number;
};

const authErrorMessagesByCode: Readonly<Record<string, string>> = {
  USER_NOT_FOUND: "Usuário não encontrado.",
  FAILED_TO_CREATE_USER: "Não foi possível criar o usuário.",
  FAILED_TO_CREATE_SESSION: "Não foi possível criar a sessão.",
  FAILED_TO_UPDATE_USER: "Não foi possível atualizar o usuário.",
  FAILED_TO_GET_SESSION: "Não foi possível obter a sessão.",
  INVALID_PASSWORD: "Senha inválida.",
  INVALID_EMAIL: "E-mail inválido.",
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha inválidos.",
  SOCIAL_ACCOUNT_ALREADY_LINKED: "Conta social já está vinculada.",
  PROVIDER_NOT_FOUND: "Provedor não encontrado.",
  INVALID_TOKEN: "Token inválido.",
  ID_TOKEN_NOT_SUPPORTED: "id_token não suportado.",
  FAILED_TO_GET_USER_INFO: "Não foi possível obter informações do usuário.",
  USER_EMAIL_NOT_FOUND: "E-mail do usuário não encontrado.",
  EMAIL_NOT_VERIFIED: "E-mail não verificado.",
  PASSWORD_TOO_SHORT: "A senha é muito curta.",
  PASSWORD_TOO_LONG: "A senha é muito longa.",
  USER_ALREADY_EXISTS: "Este e-mail já está em uso. Use outro e-mail.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "Este e-mail já está em uso. Use outro e-mail.",
  EMAIL_CAN_NOT_BE_UPDATED: "Não é possível atualizar o e-mail.",
  CREDENTIAL_ACCOUNT_NOT_FOUND: "Conta de credenciais não encontrada.",
  SESSION_EXPIRED: "Sessão expirada. Faça login novamente.",
  FAILED_TO_UNLINK_LAST_ACCOUNT: "Você não pode desvincular sua última conta.",
  ACCOUNT_NOT_FOUND: "Conta não encontrada.",
  USER_ALREADY_HAS_PASSWORD:
    "Usuário já possui senha. Informe a senha para excluir a conta.",
  CROSS_SITE_NAVIGATION_LOGIN_BLOCKED:
    "Login bloqueado por segurança. Atualize a página e tente novamente.",
  VERIFICATION_EMAIL_NOT_ENABLED: "Verificação por e-mail não está habilitada.",
  EMAIL_ALREADY_VERIFIED: "E-mail já verificado.",
  EMAIL_MISMATCH: "E-mail não confere.",
  SESSION_NOT_FRESH:
    "Sessão precisa ser reautenticada para realizar esta ação.",
  LINKED_ACCOUNT_ALREADY_EXISTS: "Já existe uma conta vinculada.",
  INVALID_ORIGIN: "Origem inválida. Atualize a página e tente novamente.",
  INVALID_CALLBACK_URL: "URL de callback inválida.",
  INVALID_REDIRECT_URL: "URL de redirecionamento inválida.",
  INVALID_ERROR_CALLBACK_URL: "URL de erro inválida.",
  INVALID_NEW_USER_CALLBACK_URL: "URL de novo usuário inválida.",
  MISSING_OR_NULL_ORIGIN: "Origem ausente ou inválida.",
  CALLBACK_URL_REQUIRED: "callbackURL é obrigatório.",
  FAILED_TO_CREATE_VERIFICATION: "Não foi possível criar a verificação.",
  FIELD_NOT_ALLOWED: "Campo não permitido.",
  ASYNC_VALIDATION_NOT_SUPPORTED: "Validação assíncrona não suportada.",
  FORBIDDEN: "Acesso negado.",
  UNAUTHORIZED: "Não autorizado.",
  VALIDATION_ERROR: "Dados inválidos. Verifique os campos e tente novamente.",
  MISSING_FIELD: "Campo obrigatório.",
  TOO_MANY_REQUESTS: "Muitas tentativas. Aguarde um pouco e tente novamente.",
};

const authSuccessMessagesByCode: Readonly<Record<string, string>> = {
  EMAIL_VERIFICATION_SENT: "Código enviado para seu e-mail.",
  OTP_SENT: "Código enviado para seu e-mail.",
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const normalizeCode = (value: unknown): string | undefined => {
  if (!isNonEmptyString(value)) return undefined;
  return value.trim().toUpperCase();
};

const normalizeMessage = (value: unknown): string | undefined => {
  if (!isNonEmptyString(value)) return undefined;
  return value.trim();
};

const isProbablyPortuguese = (message: string): boolean => {
  const normalized = message.toLowerCase();
  const markers: ReadonlyArray<string> = [
    "usuário",
    "senha",
    "código",
    "e-mail",
    "inválid",
    "contate",
    "administrador",
    "erro",
    "não autorizado",
    "acesso negado",
  ];
  return markers.some((marker) => normalized.includes(marker));
};

export const translateAuthError = (
  error: AuthClientErrorLike | null | undefined,
  fallback: string,
): string => {
  if (!error) return fallback;

  const message = normalizeMessage(error.message);
  if (message && isProbablyPortuguese(message)) return message;

  const code = normalizeCode(error.code);
  if (code && authErrorMessagesByCode[code]) {
    return authErrorMessagesByCode[code];
  }
  if (code) {
    if (code.includes("OTP") && code.includes("EXPIRED")) {
      return "Código expirado. Solicite um novo e tente novamente.";
    }
    if (code.includes("OTP") && (code.includes("INVALID") || code.includes("WRONG"))) {
      return "Código inválido. Verifique e tente novamente.";
    }
    if (code.includes("OTP") && code.includes("TOO_MANY")) {
      return authErrorMessagesByCode.TOO_MANY_REQUESTS;
    }
  }

  if (!message) return fallback;

  const normalized = message.toLowerCase();

  if (normalized.includes("invalid email or password")) {
    return authErrorMessagesByCode.INVALID_EMAIL_OR_PASSWORD;
  }

  if (normalized.includes("user already exists")) {
    return authErrorMessagesByCode.USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL;
  }

  if (normalized.includes("invalid origin")) {
    return authErrorMessagesByCode.INVALID_ORIGIN;
  }

  if (normalized.includes("forbidden")) {
    return "Acesso negado. Verifique suas credenciais.";
  }

  if (normalized.includes("unauthorized")) {
    return "Não autorizado. Verifique suas credenciais.";
  }

  if (normalized.includes("validation")) {
    return authErrorMessagesByCode.VALIDATION_ERROR;
  }

  if (normalized.includes("too many")) {
    return authErrorMessagesByCode.TOO_MANY_REQUESTS;
  }

  return message;
};

export const translateAuthSuccess = (code: string | null | undefined): string => {
  const normalizedCode = normalizeCode(code);
  if (!normalizedCode) return "Operação realizada com sucesso.";
  return authSuccessMessagesByCode[normalizedCode] ?? "Operação realizada com sucesso.";
};
