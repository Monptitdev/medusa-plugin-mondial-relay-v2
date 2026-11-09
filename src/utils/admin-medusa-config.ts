export type AdminMedusaConfig = {
  baseUrl: string
  email: string
  password: string
}

export type AdminMedusaConfigInput = {
  adminBaseUrl?: string
  adminEmail?: string
  adminPassword?: string
}

function present(value: string | undefined | null): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * Résout l'accès à l'API admin Medusa.
 * Les options du provider priment sur les variables d'environnement.
 * Aucune valeur par défaut : une config incomplète lève une erreur sans contenu secret.
 */
export function resolveAdminMedusaConfig(
  options: AdminMedusaConfigInput | undefined,
  env: NodeJS.ProcessEnv = process.env
): AdminMedusaConfig {
  const baseUrl = present(options?.adminBaseUrl) ?? present(env.ADMIN_BASE_URL)
  const email = present(options?.adminEmail) ?? present(env.ADMIN_EMAIL)
  const password = present(options?.adminPassword) ?? present(env.ADMIN_PASSWORD)

  const missing: string[] = []
  if (!baseUrl) {
    missing.push("ADMIN_BASE_URL ou options.adminBaseUrl")
  }
  if (!email) {
    missing.push("ADMIN_EMAIL ou options.adminEmail")
  }
  if (!password) {
    missing.push("ADMIN_PASSWORD ou options.adminPassword")
  }

  if (missing.length > 0) {
    throw new Error(
      `Configuration admin Medusa incomplète (${missing.join(", ")}). ` +
        "Renseignez les options du provider ou les variables d'environnement. Aucune valeur par défaut n'est utilisée."
    )
  }

  const resolvedBaseUrl = baseUrl as string
  let parsed: URL
  try {
    parsed = new URL(resolvedBaseUrl)
  } catch {
    throw new Error(
      "ADMIN_BASE_URL (ou options.adminBaseUrl) n'est pas une URL absolue valide."
    )
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      "ADMIN_BASE_URL (ou options.adminBaseUrl) doit utiliser http ou https."
    )
  }

  return {
    baseUrl: resolvedBaseUrl.replace(/\/+$/, ""),
    email: email as string,
    password: password as string,
  }
}
