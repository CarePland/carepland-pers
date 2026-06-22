export type ConnectTheme = {
  borderColor: string;
  informationActionColor: string;
  name: string;
  outerFrameColor: string;
  panelBackgroundColor: string;
  primaryActionColor: string;
  recordActionColor: string;
  secondaryActionColor: string;
  secondaryUtilityColor: string;
  textColor: string;
};

export type ConnectThemeResponse = {
  ok?: boolean;
  source?: "default" | "saved" | string;
  theme?: Partial<ConnectTheme> | null;
};
