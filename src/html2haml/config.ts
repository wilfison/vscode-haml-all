export type Html2HamlOptions = {
  erb?: boolean;
  tabSize: number;
  tabChar: HamlTabChar;
};

export enum HamlTabChar {
  Space = ' ',
  Tab = '\t',
}

export const defaultOptions: Html2HamlOptions = {
  erb: false,
  tabSize: 2,
  tabChar: HamlTabChar.Space,
};
