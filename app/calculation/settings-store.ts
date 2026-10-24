import { createStoredValue } from "../lib/stored-value";
import { DEFAULT_SETTINGS, sanitizeSettings } from "./problems";

const store = createStoredValue(
  "brain-dumbell:calculation-settings",
  DEFAULT_SETTINGS,
  sanitizeSettings,
);

export const useSettings = store.useValue;
export const saveSettings = store.save;
