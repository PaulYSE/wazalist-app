import { generateToken } from "./auth";
import {
  ValidationError,
  requireObject,
} from "./validation";

export const PASSWORD_RESET_EXPIRY_HOURS = 24;
export const PASSWORD_RESET_TOKEN_HEX_LENGTH = 64;

export const PASSWORD_RESET_ADMIN_SUBJECT =
  "<Wazalist App by IFX> Account Recovery Request";

const MAX_IDENTIFIER_LENGTH = 254;

/**
 * Generates a cryptographically secure password-reset token.
 *
 * The token contains 256 random bits represented as 64 lowercase
 * hexadecimal characters.
 *
 * @return Raw password-reset token.
 */
export function generatePassword*esetToken(): string {
  return gen*rateToken();
}

/**
 * Hashes an e*act token value using SHA-256.
 *
** Only this hash is stored in D1. *he raw token is sent through the
 * recovery link and must not be log*ed or persisted.
 *
 * @param toke* Raw password-reset token.
 * @ret*rn Lowercase hexadecimal SHA-256 d*gest.
 */
export async function ha*hPasswordResetToken(
  token: stri*g,
): Promise<string> {
  const di*est = await crypto.subtle.digest(
*   "SHA-256",
    new TextEncoder(*.encode(token),
  );

  return byt*sToHex(new Uint8Array(digest));
}
*/**
 * Produces a keyed SHA-256 ha*h of a client IP address.
 *
 * Us*s HMAC so an exposed database hash*cannot be compared against a
 * si*ple precomputed list of common IP *ddresses without the Worker
 * sec*et.
 *
 * @param ip Raw client IP *ddress.
 * @param secret Server-si*e HMAC secret.
 * @return Lowercas* hexadecimal HMAC digest.
 */
expo*t async function hashPasswordReset*p(
  ip: string,
  secret: string,*): Promise<string> {
  if (!secret* {
    throw new Error(
      "PAS*WORD_RESET_IP_HASH_SECRET is not c*nfigured",
    );
  }

  const enc*der = new TextEncoder();

  const *ey = await crypto.subtle.importKey*
    "raw",
    encoder.encode(sec*et),
    {
      name: "HMAC",
   *  hash: "SHA-256",
    },
    fals*,
    ["sign"],
  );

  const sign*ture = await crypto.subtle.sign(
 *  "HMAC",
    key,
    encoder.enc*de(ip.trim()),
  );

  return byte*ToHex(new Uint8Array(signature));
*

/**
 * Validates a submitted res*t-token string.
 *
 * @param value*Submitted token value.
 * @return *ormalized lowercase 64-character h*xadecimal token.
 * @throws Valida*ionError If the token has an inval*d format.
 */
export function vali*atePasswordResetToken(
  value: un*nown,
): string {
  if (typeof val*e !== "string") {
    throw new Va*idationError(
      "Password rese* token is invalid",
    );
  }

  *onst token = value.trim().toLowerC*se();

  if (
    !new RegExp(
   *  `^[0-9a-f]{${PASSWORD_RESET_TOKE*_HEX_LENGTH}}$`,
    ).test(token)*  ) {
    throw new ValidationErro*(
      "Password reset token is i*valid",
    );
  }

  return token*
}

/**
 * Reads and validates a p*ssword-reset request body.
 *
 * T*e same identifier is later matched*against both username and email.
 * This function does not classify t*e identifier.
 *
 * @param value P*rsed request body.
 * @return Vali*ated recovery identifier.
 * @thro*s ValidationError If the body is u*supported or invalid.
 */
export f*nction validatePasswordResetReques*(
  value: unknown,
): {
  identif*er: string;
} {
  const body = req*ireObject(value, "Request body");
*  rejectUnknownFields(body, ["identifier"]);

  if (typeof body.ident*fier !== "string") {
    throw new*ValidationError(
      "Username o* email is required",
    );
  }

 *const identifier = body.identifier*trim();

  if (
    !identifier ||*    [...identifier].length > MAX_I*ENTIFIER_LENGTH
  ) {
    throw ne* ValidationError(
      "Username *r email is required",
    );
  }

* return { identifier };
}

/**
 * *eads and validates a reset-token v*lidation body.
 *
 * @param value *arsed request body.
 * @return Val*dated raw token.
 * @throws Valida*ionError If the body is unsupporte* or invalid.
 */
export function v*lidatePasswordResetValidation(
  v*lue: unknown,
): {
  token: string*
} {
  const body = requireObject(*alue, "Request body");

  rejectUn*nownFields(body, ["token"]);

  re*urn {
    token: validatePasswordR*setToken(body.token),
  };
}

/**
** Reads and validates a password-r*set confirmation body.
 *
 * The e*isting Wazalist password baseline *equires a nonempty string.
 * Pass*ords are deliberately not trimmed.* *
 * @param value Parsed request *ody.
 * @return Validated token an* new password.
 * @throws Validati*nError If the body is unsupported *r invalid.
 */
export function val*datePasswordResetConfirmation(
  v*lue: unknown,
): {
  token: string*
  newPassword: string;
} {
  cons* body = requireObject(value, "Requ*st body");

  rejectUnknownFields(*ody, [
    "token",
    "new_password",
  ]);

  const token = valida*ePasswordResetToken(body.token);

* if (
    typeof body.new_password*!== "string" ||
    !body.new_pass*ord
  ) {
    throw new Validation*rror(
      "New password is requi*ed",
    );
  }

  return {
    to*en,
    newPassword: body.new_pass*ord,
  };
}

/**
 * Generates a re*uest-specific identifier for an at*mic token claim.
 *
 * @return Cry*tographically random 64-character *exadecimal identifier.
 */
export *unction generateResetConsumptionId*): string {
  return generateToken*);
}

function rejectUnknownFields*
  value: Record<string, unknown>,*  allowed: readonly string[],
): v*id {
  if (
    Object.keys(value)*some(
      (field) => !allowed.in*ludes(field),
    )
  ) {
    thro* new ValidationError(
      "Reque*t contains an unsupported field",
*   );
  }
}

function bytesToHex(b*tes: Uint8Array): string {
  retur* Array.from(bytes)
    .map((byte)*=>
      byte.toString(16).padStar*(2, "0"),
    )
    .join("");
}
`*
