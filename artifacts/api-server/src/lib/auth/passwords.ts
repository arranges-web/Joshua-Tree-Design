import bcrypt from "bcryptjs";

const ROUNDS = 10;

const DUMMY_HASH =
  "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.6r5XpQ2QlF9dMJqZnWQyqXr4nC.G";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hashed: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

export async function dummyVerify(plain: string): Promise<void> {
  await bcrypt.compare(plain, DUMMY_HASH);
}
