/**
 * @file Password Hashing Utilities
 * @milestone M1
 *
 * WHY BCRYPT?
 * -----------
 * Passwords must NEVER be stored in plain text or with fast hashes (MD5, SHA-256).
 *
 * Fast hashes: An attacker with your DB can try BILLIONS of passwords/second (GPU).
 * bcrypt:      Intentionally slow (configurable cost factor). At cost=12:
 *              ~300ms per hash → even with DB dump, brute-force takes years.
 *
 * WHY COST FACTOR 12?
 * --------------------
 * Cost 10: ~100ms (too fast, lower security)
 * Cost 12: ~300ms (good balance for 2024 hardware)
 * Cost 14: ~1200ms (noticeable delay for users)
 *
 * Adjust up as hardware gets faster. bcrypt automatically handles salt generation.
 *
 * NEVER WRITE YOUR OWN HASHING. USE bcrypt/argon2/scrypt.
 */
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/**
 * Hash a plaintext password.
 * Returns a bcrypt hash string that includes the salt.
 *
 * @example
 * const hash = await hashPassword("MyP@ssw0rd");
 * // "$2a$12$..." — 60 character bcrypt hash
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare a plaintext password against a stored hash.
 * Uses constant-time comparison to prevent timing attacks.
 *
 * WHY CONSTANT-TIME?
 * A naive string comparison fails early on mismatch.
 * An attacker can measure response time to guess correct chars.
 * bcrypt.compare is always the same speed regardless of match.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
