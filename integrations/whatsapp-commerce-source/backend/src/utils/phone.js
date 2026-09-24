/**
 * Phone number normalization utilities
 * Supports Malaysian (+60), Bangladeshi (+880), and international formats
 */

export const normalizePhone = (phone, defaultCountryCode = null) => {
  if (!phone) return null;

  let normalized = phone.trim();
  const hasPlus = normalized.startsWith('+');
  normalized = normalized.replace(/\D/g, '');
  if (hasPlus) {
    normalized = '+' + normalized;
  }

  if (!normalized.startsWith('+') && defaultCountryCode) {
    if (normalized.startsWith('0')) {
      normalized = normalized.substring(1);
    }
    normalized = `+${defaultCountryCode}${normalized}`;
  } else if (!normalized.startsWith('+')) {
    if (/^01\d{8,9}$/.test(normalized)) {
      normalized = '+60' + normalized.substring(1);
    } else if (/^01\d{8,9}$/.test(normalized) && normalized.length === 11) {
      normalized = '+880' + normalized;
    }
  }

  if (!normalized.startsWith('+')) {
    normalized = '+' + normalized;
  }

  return normalized;
};

export const validatePhone = (phone) => {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  return /^\+[1-9]\d{7,14}$/.test(normalized);
};
