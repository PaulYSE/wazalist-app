import {
  ValidationError,
  requireObject,
} from "./validation";

export type GroupJoinPolicy = "open" | "approval" | "invite";

export type GroupSocialLink = {
  platform: string;
  url: string;
};

export type GroupCreateInput = {
  name: string;
  join_policy: GroupJoinPolicy;
  social: GroupSocialLink[];
};

export type GroupUpdateInput = {
  name?: string;
  join_policy?: GroupJoinPolicy;
  social?: GroupSocialLink[];
};

function rejectUnknownFields(
  value: Record<string, unknown>,
  allowed: readonly string[],
): void {
  if (
    Object.keys(value).some(
      (field) => !allowed.includes(field),
    )
  ) {
    throw new ValidationError(
      "Request contains an unsupported field",
    );
  }
}

function validateName(value: unknown): string {
  if (typeof value !== "string") {
    throw new ValidationError(
      "Group name must be a string",
    );
  }

  const name = value.trim();
  const length = [...name].length;

  if (length < 1 || length > 64) {
    throw new ValidationError(
      "Group name must contain 1–64 characters",
    );
  }

  return name;
}

function validatePolicy(value: unknown): GroupJoinPolicy {
  if (
    value !== "open" &&
    value !== "approval" &&
    value !== "invite"
  ) {
    throw new ValidationError("Invalid join policy");
  }

  return value;
}

function validateSocial(value: unknown): GroupSocialLink[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(
      "social must be an array",
    );
  }

  if (value.length > 10) {
    throw new ValidationError(
      "Maximum 10 social links",
    );
  }

  return value.map((item) => {
    const link = requireObject(item, "Social link");

    rejectUnknownFields(link, ["platform", "url"]);

    if (typeof link.platform !== "string") {
      throw new ValidationError(
        "Social link platform must be a string",
      );
    }

    const platform = link.platform.trim();

    if (
      [...platform].length < 1 ||
      [...platform].length > 64
    ) {
      throw new ValidationError(
        "Social link platform must contain 1–64 characters",
      );
    }

    if (typeof link.url !== "string") {
      throw new ValidationError(
        "Social link URL must be a string",
      );
    }

    const url = link.url.trim();

    if (!url || url.length > 2048) {
      throw new ValidationError(
        "Social link URL must contain 1–2048 characters",
      );
    }

    let parsed: URL;

    try {
      parsed = new URL(url);
    } catch {
      throw new ValidationError(
        "Social link URL must be an absolute HTTP or HTTPS URL",
      );
    }

    if (
      (parsed.protocol !== "http:" &&
        parsed.protocol !== "https:") ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password
    ) {
      throw new ValidationError(
        "Social link URL must use HTTP or HTTPS without embedded credentials",
      );
    }

    // Preserve the trimmed submitted URL.
    return { platform, url };
  });
}

export async function readGroupBody(
  request: Request,
): Promise<Record<string, unknown>> {
  let parsed: unknown;

  try {
    parsed = await request.json();
  } catch {
    throw new ValidationError(
      "Request body must be valid JSON",
    );
  }

  return requireObject(parsed, "Request body");
}

export function validateGroupCreate(
  value: unknown,
): GroupCreateInput {
  const body = requireObject(value, "Request body");

  rejectUnknownFields(
    body,
    ["name", "join_policy", "social"],
  );

  return {
    name: validateName(body.name),

    // Defaults apply only when the field is omitted.
    join_policy:
      body.join_policy === undefined
        ? "open"
        : validatePolicy(body.join_policy),

    social:
      body.social === undefined
        ? []
        : validateSocial(body.social),
  };
}

export function validateGroupUpdate(
  value: unknown,
): GroupUpdateInput {
  const body = requireObject(value, "Request body");

  rejectUnknownFields(
    body,
    ["name", "join_policy", "social"],
  );

  const result: GroupUpdateInput = {};

  if (body.name !== undefined) {
    result.name = validateName(body.name);
  }

  if (body.join_policy !== undefined) {
    result.join_policy = validatePolicy(body.join_policy);
  }

  if (body.social !== undefined) {
    result.social = validateSocial(body.social);
  }

  if (Object.keys(result).length === 0) {
    throw new ValidationError("Nothing to update");
  }

  return result;
}
