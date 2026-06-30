declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

// Side-effect CSS for webpack/metro
declare module "*.css?sideEffect" {
  const _: undefined;
  export default _;
}
