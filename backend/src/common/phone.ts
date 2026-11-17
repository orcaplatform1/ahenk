import { ValidateBy, buildMessage, type ValidationOptions } from "class-validator";
import { isValidPhoneNumber, parsePhoneNumberFromString } from "libphonenumber-js/mobile";

// Telefonlar E.164 saklanır (+905…, +44…). "+" ile başlamayan numaralarda varsayılan ülke Türkiye (+90): 5XXXXXXXXX, 05…, 905…
export function normalizePhone(raw: string): string {
  const s = (raw ?? "").trim();
  const parsed = s.startsWith("+") ? parsePhoneNumberFromString(s) : parsePhoneNumberFromString(s.replace(/\D/g, ""), "TR");
  if (parsed && parsed.isValid()) return parsed.number;
  const digits = s.replace(/\D/g, "");
  return digits.length >= 10 && !s.startsWith("+") ? `+90${digits.slice(-10)}` : s;
}

// Geçerli E.164 numara (libphonenumber-js "mobile" verisi: ülkeye göre yalnız mobil numaralar — WhatsApp OTP).
// Web ve mobil istemciler de aynı "libphonenumber-js/mobile" doğrulamasını kullanır.
export function isE164Mobile(value: unknown): boolean {
  return typeof value === "string" && /^\+[1-9]\d{6,14}$/.test(value) && isValidPhoneNumber(value);
}

export function IsE164Phone(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: "isE164Phone",
      validator: {
        validate: (value) => isE164Mobile(value),
        defaultMessage: buildMessage(() => "Geçerli bir telefon numarası gir", validationOptions),
      },
    },
    validationOptions,
  );
}
