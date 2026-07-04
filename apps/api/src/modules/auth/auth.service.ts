import bcrypt from "bcryptjs";

export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  const expectedUsername = process.env.ADMIN_USERNAME;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!expectedUsername || !passwordHash) {
    throw new Error(
      "Configure ADMIN_USERNAME e ADMIN_PASSWORD_HASH no .env para habilitar o login.",
    );
  }

  if (username !== expectedUsername) return false;
  return bcrypt.compare(password, passwordHash);
}
