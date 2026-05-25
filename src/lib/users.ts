import { compare } from "bcryptjs";

export type DemoUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
};

const DEFAULT_PASSWORD_HASH =
  "$2b$10$F660F042aG68zY2JsGmdfebwJ4L5inZDDDN9jaxKP/rLyYjGqPzca";

function getPasswordHash(): string {
  const fromEnv = process.env.DEMO_USER_PASSWORD_HASH?.trim();

  // Los $ sin comillas en .env corrompen el hash; solo aceptamos formato bcrypt válido
  if (fromEnv?.startsWith("$2")) {
    return fromEnv;
  }

  return DEFAULT_PASSWORD_HASH;
}

function getDemoUser(): DemoUser {
  return {
    id: "demo-user-1",
    email: process.env.DEMO_USER_EMAIL ?? "demo@nexusai.app",
    name: process.env.DEMO_USER_NAME ?? "Usuario Demo",
    passwordHash: getPasswordHash(),
  };
}

export async function validateDemoUser(
  email: string,
  password: string
): Promise<DemoUser | null> {
  const demoUser = getDemoUser();
  const normalizedEmail = email.trim().toLowerCase();

  if (normalizedEmail !== demoUser.email.toLowerCase()) {
    return null;
  }

  const plainPassword = process.env.DEMO_USER_PASSWORD?.trim();
  if (plainPassword && password === plainPassword) {
    return demoUser;
  }

  const isValid = await compare(password, demoUser.passwordHash);
  if (!isValid) {
    return null;
  }

  return demoUser;
}
