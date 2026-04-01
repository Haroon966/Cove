import type { AppConfig } from "../types";

export interface ConfigStoreState {
  config: AppConfig | null;
  draftConfig: AppConfig | null;
}

export const initialConfigStoreState: ConfigStoreState = {
  config: null,
  draftConfig: null,
};

export function withConfigDraft(
  state: ConfigStoreState,
  draftConfig: AppConfig | null
): ConfigStoreState {
  return { ...state, draftConfig };
}

